#!/usr/bin/env node

/**
 * Box Inventory MCP Server
 *
 * This MCP server allows Claude to query your box inventory in real-time.
 * It reads from a JSON file that the Box Inventory web app syncs to.
 *
 * Usage:
 *   1. Enable "Claude Sync" in the Box Inventory web app
 *   2. Save the inventory file somewhere accessible (e.g., ~/box-inventory.json)
 *   3. Configure this MCP server in Claude Desktop or Claude Code
 *   4. Ask Claude things like "Where is my USB-C cable?"
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Default inventory file path - can be overridden with environment variable
const INVENTORY_PATH = process.env.BOX_INVENTORY_PATH ||
  path.join(os.homedir(), "box-inventory.json");

/**
 * Load and parse the inventory file
 */
async function loadInventory() {
  try {
    const data = await fs.readFile(INVENTORY_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null; // File doesn't exist yet
    }
    throw error;
  }
}

/**
 * Search for items matching a query
 */
function searchItems(inventory, query) {
  if (!inventory || !inventory.items) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  return inventory.items.filter(item => {
    const searchText = `${item.name} ${item.description || ""}`.toLowerCase();
    return searchText.includes(normalizedQuery);
  });
}

/**
 * Search for containers matching a query
 */
function searchContainers(inventory, query) {
  if (!inventory || !inventory.containers) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  return inventory.containers.filter(container => {
    const searchText = `${container.name} ${container.location} ${container.description || ""}`.toLowerCase();
    return searchText.includes(normalizedQuery);
  });
}

/**
 * Get items in a specific container
 */
function getItemsInContainer(inventory, containerName) {
  if (!inventory || !inventory.items) {
    return [];
  }

  const normalizedName = containerName.toLowerCase().trim();

  return inventory.items.filter(item => {
    const itemContainer = (item.containerName || "").toLowerCase();
    return itemContainer.includes(normalizedName);
  });
}

/**
 * Get items at a specific location
 */
function getItemsAtLocation(inventory, location) {
  if (!inventory || !inventory.items) {
    return [];
  }

  const normalizedLocation = location.toLowerCase().trim();

  return inventory.items.filter(item => {
    const itemLocation = (item.location || "").toLowerCase();
    return itemLocation.includes(normalizedLocation);
  });
}

/**
 * Format an item for display
 */
function formatItem(item) {
  let result = `**${item.name}**`;
  if (item.description) {
    result += `\n  Description: ${item.description}`;
  }
  result += `\n  Location: ${item.fullLocation || "Unknown"}`;
  if (item.hasPhoto) {
    result += `\n  [Has photo]`;
  }
  return result;
}

/**
 * Format a container for display
 */
function formatContainer(container) {
  let result = `**${container.name}** (${container.type})`;
  result += `\n  Location: ${container.location}`;
  if (container.description) {
    result += `\n  Description: ${container.description}`;
  }
  result += `\n  Items: ${container.itemCount || 0}`;
  return result;
}

// Create the MCP server
const server = new Server(
  {
    name: "box-inventory",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "find_item",
        description: "Search for items in your inventory by name or description. Use this when looking for a specific item like 'USB cable' or 'hammer'.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The item name or description to search for",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "list_containers",
        description: "List all containers (boxes, bins, drawers, etc.) in the inventory, optionally filtered by location.",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "Optional: filter containers by location (e.g., 'garage', 'bedroom')",
            },
          },
        },
      },
      {
        name: "show_container_contents",
        description: "Show all items in a specific container.",
        inputSchema: {
          type: "object",
          properties: {
            container_name: {
              type: "string",
              description: "The name of the container to show contents of",
            },
          },
          required: ["container_name"],
        },
      },
      {
        name: "items_at_location",
        description: "Find all items stored at a specific location (e.g., 'garage', 'closet').",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The location to search (e.g., 'garage', 'bedroom closet')",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "inventory_summary",
        description: "Get a summary of the entire inventory including total items and containers.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "full_inventory",
        description: "Get the complete inventory listing in text format. Use this when the user wants to see everything or when searching for something that might have unusual naming.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const inventory = await loadInventory();

  if (!inventory) {
    return {
      content: [
        {
          type: "text",
          text: `Inventory file not found at: ${INVENTORY_PATH}\n\nTo set up:\n1. Open the Box Inventory web app\n2. Click the menu and select "Enable Claude Sync"\n3. Save the file to: ${INVENTORY_PATH}\n\nOr set BOX_INVENTORY_PATH environment variable to point to your inventory file.`,
        },
      ],
    };
  }

  switch (name) {
    case "find_item": {
      const results = searchItems(inventory, args.query);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No items found matching "${args.query}".`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} item(s) matching "${args.query}":\n\n${results.map(formatItem).join("\n\n")}`,
          },
        ],
      };
    }

    case "list_containers": {
      let containers = inventory.containers || [];
      if (args.location) {
        containers = searchContainers(inventory, args.location);
      }
      if (containers.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: args.location
                ? `No containers found at location "${args.location}".`
                : "No containers in inventory.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `${containers.length} container(s)${args.location ? ` at "${args.location}"` : ""}:\n\n${containers.map(formatContainer).join("\n\n")}`,
          },
        ],
      };
    }

    case "show_container_contents": {
      const items = getItemsInContainer(inventory, args.container_name);
      if (items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No items found in container "${args.container_name}". The container may be empty or not exist.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `${items.length} item(s) in "${args.container_name}":\n\n${items.map(formatItem).join("\n\n")}`,
          },
        ],
      };
    }

    case "items_at_location": {
      const items = getItemsAtLocation(inventory, args.location);
      if (items.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No items found at location "${args.location}".`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `${items.length} item(s) at "${args.location}":\n\n${items.map(formatItem).join("\n\n")}`,
          },
        ],
      };
    }

    case "inventory_summary": {
      const stats = inventory.stats || { totalItems: 0, totalContainers: 0 };
      const lastUpdated = inventory.lastUpdated
        ? new Date(inventory.lastUpdated).toLocaleString()
        : "Unknown";

      return {
        content: [
          {
            type: "text",
            text: `**Inventory Summary**\n\nTotal Items: ${stats.totalItems}\nTotal Containers: ${stats.totalContainers}\nLast Updated: ${lastUpdated}`,
          },
        ],
      };
    }

    case "full_inventory": {
      if (!inventory.textInventory || inventory.textInventory.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "The inventory is empty.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `**Complete Inventory Listing**\n\n${inventory.textInventory.join("\n")}`,
          },
        ],
      };
    }

    default:
      return {
        content: [
          {
            type: "text",
            text: `Unknown tool: ${name}`,
          },
        ],
      };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Box Inventory MCP server running...");
}

main().catch(console.error);
