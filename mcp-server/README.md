# Box Inventory MCP Server

This MCP (Model Context Protocol) server allows Claude to query your Box Inventory in real-time. Once set up, you can ask Claude natural questions like:

- "Where is my USB-C cable?"
- "What's in the garage?"
- "Show me everything in Plastic Bin #4"

## Setup Instructions

### Step 1: Install the MCP Server

```bash
cd mcp-server
npm install
```

### Step 2: Enable Claude Sync in the Web App

1. Open the Box Inventory web app in Chrome or Edge
2. Click the menu (☰) in the top right
3. Click "Enable Claude Sync"
4. Save the file as `box-inventory.json` in your home directory:
   - **Mac/Linux**: `~/box-inventory.json`
   - **Windows**: `C:\Users\YourName\box-inventory.json`

The app will automatically update this file whenever you add, edit, or delete items.

### Step 3: Configure Claude Desktop

Add this to your Claude Desktop configuration file:

**Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "box-inventory": {
      "command": "node",
      "args": ["/path/to/Box-Inventory/mcp-server/index.js"],
      "env": {
        "BOX_INVENTORY_PATH": "/path/to/box-inventory.json"
      }
    }
  }
}
```

Replace `/path/to/` with your actual paths.

### Step 4: Restart Claude Desktop

Close and reopen Claude Desktop. You should now be able to ask about your inventory!

## Configuration

### Custom Inventory File Location

Set the `BOX_INVENTORY_PATH` environment variable to use a different file location:

```bash
export BOX_INVENTORY_PATH="/custom/path/to/inventory.json"
```

## Available Commands

Once connected, Claude can use these tools:

| Tool | Description |
|------|-------------|
| `find_item` | Search for items by name or description |
| `list_containers` | List all containers, optionally filtered by location |
| `show_container_contents` | Show all items in a specific container |
| `items_at_location` | Find all items at a specific location |
| `inventory_summary` | Get total counts and last update time |
| `full_inventory` | Get the complete text listing |

## Example Conversations

**You**: Where did I put my passport?

**Claude**: *uses find_item tool*
> Found 1 item matching "passport":
>
> **Passport**
>   Description: US passport, expires 2028
>   Location: Filing Cabinet #1 (cabinet) - Office closet

**You**: What's in the garage?

**Claude**: *uses items_at_location tool*
> Found 15 items at "garage":
> - Power drill in Tool Box #2
> - Extension cords in Plastic Bin #7
> ...

## Troubleshooting

**"Inventory file not found"**
- Make sure you've enabled Claude Sync in the web app
- Check that the file path is correct
- Verify the file exists: `ls ~/box-inventory.json`

**"MCP server not connecting"**
- Check Claude Desktop logs
- Verify Node.js is installed: `node --version`
- Run the server manually to test: `node index.js`

## For Claude Code Users

If you're using Claude Code (CLI), you can also add the MCP server to your settings:

```bash
claude mcp add box-inventory node /path/to/mcp-server/index.js
```

Or simply ask Claude Code to read your inventory file directly:
```
Read ~/box-inventory.json and tell me where my hammer is
```
