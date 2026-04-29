/**
 * Box Inventory - Database Layer
 * Uses IndexedDB for persistent local storage
 */

const DB_NAME = 'BoxInventoryDB';
const DB_VERSION = 1;

class InventoryDB {
    constructor() {
        this.db = null;
        this.ready = this.init();
    }

    /**
     * Initialize the IndexedDB database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create containers store
                if (!db.objectStoreNames.contains('containers')) {
                    const containerStore = db.createObjectStore('containers', { keyPath: 'id' });
                    containerStore.createIndex('name', 'name', { unique: false });
                    containerStore.createIndex('location', 'location', { unique: false });
                    containerStore.createIndex('type', 'type', { unique: false });
                }

                // Create items store
                if (!db.objectStoreNames.contains('items')) {
                    const itemStore = db.createObjectStore('items', { keyPath: 'id' });
                    itemStore.createIndex('name', 'name', { unique: false });
                    itemStore.createIndex('containerId', 'containerId', { unique: false });
                    itemStore.createIndex('dateAdded', 'dateAdded', { unique: false });
                }
            };
        });
    }

    /**
     * Ensure database is ready before operations
     */
    async ensureReady() {
        if (!this.db) {
            await this.ready;
        }
        return this.db;
    }

    // ==================== CONTAINER OPERATIONS ====================

    /**
     * Add a new container
     */
    async addContainer(container) {
        await this.ensureReady();
        const data = {
            id: this.generateId(),
            name: container.name,
            type: container.type || 'box',
            location: container.location,
            description: container.description || '',
            photo: container.photo || null,
            dateAdded: new Date().toISOString(),
            dateModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['containers'], 'readwrite');
            const store = transaction.objectStore('containers');
            const request = store.add(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update an existing container
     */
    async updateContainer(id, updates) {
        await this.ensureReady();
        const existing = await this.getContainer(id);
        if (!existing) {
            throw new Error('Container not found');
        }

        const data = {
            ...existing,
            ...updates,
            id: id, // Ensure ID doesn't change
            dateModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['containers'], 'readwrite');
            const store = transaction.objectStore('containers');
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get a container by ID
     */
    async getContainer(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['containers'], 'readonly');
            const store = transaction.objectStore('containers');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all containers
     */
    async getAllContainers() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['containers'], 'readonly');
            const store = transaction.objectStore('containers');
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by name
                const containers = request.result.sort((a, b) =>
                    a.name.localeCompare(b.name)
                );
                resolve(containers);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete a container by ID
     */
    async deleteContainer(id) {
        await this.ensureReady();

        // First, check if any items are in this container
        const items = await this.getItemsByContainer(id);
        if (items.length > 0) {
            throw new Error(`Cannot delete container: ${items.length} item(s) still in it. Move or delete items first.`);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['containers'], 'readwrite');
            const store = transaction.objectStore('containers');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== ITEM OPERATIONS ====================

    /**
     * Add a new item
     */
    async addItem(item) {
        await this.ensureReady();
        const now = new Date().toISOString();
        const data = {
            id: this.generateId(),
            name: item.name,
            description: item.description || '',
            containerId: item.containerId,
            photo: item.photo || null, // Base64 encoded image
            status: 'stored', // 'stored' or 'checked_out'
            checkedOutDate: null,
            checkedOutNote: null,
            previousContainerId: null,
            lastSeen: now, // When item was last put in a box
            dateAdded: now,
            dateModified: now
        };

        // Update the container's lastItemAdded date
        if (item.containerId) {
            await this.updateContainerLastItemAdded(item.containerId, now);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.add(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update container's lastItemAdded timestamp
     */
    async updateContainerLastItemAdded(containerId, timestamp) {
        const container = await this.getContainer(containerId);
        if (container) {
            await this.updateContainer(containerId, { lastItemAdded: timestamp });
        }
    }

    /**
     * Update an existing item
     */
    async updateItem(id, updates) {
        await this.ensureReady();
        const existing = await this.getItem(id);
        if (!existing) {
            throw new Error('Item not found');
        }

        const data = {
            ...existing,
            ...updates,
            id: id, // Ensure ID doesn't change
            dateModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get an item by ID
     */
    async getItem(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all items
     */
    async getAllItems() {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const request = store.getAll();

            request.onsuccess = () => {
                // Sort by date added (newest first)
                const items = request.result.sort((a, b) =>
                    new Date(b.dateAdded) - new Date(a.dateAdded)
                );
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get items by container ID
     */
    async getItemsByContainer(containerId) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readonly');
            const store = transaction.objectStore('items');
            const index = store.index('containerId');
            const request = index.getAll(containerId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete an item by ID
     */
    async deleteItem(id) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.delete(id);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== CHECK IN/OUT OPERATIONS ====================

    /**
     * Check out an item (remove from container temporarily)
     */
    async checkOutItem(id, note = '') {
        await this.ensureReady();
        const item = await this.getItem(id);
        if (!item) {
            throw new Error('Item not found');
        }
        if (item.status === 'checked_out') {
            throw new Error('Item is already checked out');
        }

        const data = {
            ...item,
            status: 'checked_out',
            checkedOutDate: new Date().toISOString(),
            checkedOutNote: note,
            previousContainerId: item.containerId,
            containerId: null,
            dateModified: new Date().toISOString()
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check in an item (return to a container)
     */
    async checkInItem(id, containerId = null, note = '') {
        await this.ensureReady();
        const item = await this.getItem(id);
        if (!item) {
            throw new Error('Item not found');
        }
        if (item.status !== 'checked_out') {
            throw new Error('Item is not checked out');
        }

        // Use provided container, or previous container, or throw error
        const targetContainer = containerId || item.previousContainerId;
        if (!targetContainer) {
            throw new Error('No container specified for check-in');
        }

        const now = new Date().toISOString();
        const data = {
            ...item,
            status: 'stored',
            containerId: targetContainer,
            checkedOutDate: null,
            checkedOutNote: null,
            previousContainerId: null,
            lastSeen: now, // Update lastSeen when item is returned
            dateModified: now
        };

        // Update the container's lastItemAdded date
        await this.updateContainerLastItemAdded(targetContainer, now);

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['items'], 'readwrite');
            const store = transaction.objectStore('items');
            const request = store.put(data);

            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all checked out items
     */
    async getCheckedOutItems() {
        const allItems = await this.getAllItems();
        return allItems.filter(item => item.status === 'checked_out');
    }

    // ==================== SEARCH ====================

    /**
     * Search items and containers by query string
     */
    async search(query) {
        const normalizedQuery = query.toLowerCase().trim();
        if (!normalizedQuery) {
            return { items: [], containers: [] };
        }

        const [allItems, allContainers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        // Search items
        const matchedItems = allItems.filter(item => {
            const searchText = `${item.name} ${item.description}`.toLowerCase();
            return searchText.includes(normalizedQuery);
        });

        // Search containers
        const matchedContainers = allContainers.filter(container => {
            const searchText = `${container.name} ${container.location} ${container.description}`.toLowerCase();
            return searchText.includes(normalizedQuery);
        });

        return {
            items: matchedItems,
            containers: matchedContainers
        };
    }

    // ==================== EXPORT / IMPORT ====================

    /**
     * Export all data as JSON
     * This format is designed to be AI-readable
     */
    async exportData() {
        const [items, containers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        // Create a container lookup map
        const containerMap = {};
        containers.forEach(c => {
            containerMap[c.id] = c;
        });

        // Create the export object with AI-friendly format
        const exportData = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            summary: {
                totalItems: items.length,
                totalContainers: containers.length
            },
            containers: containers.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                location: c.location,
                description: c.description || ''
            })),
            items: items.map(item => {
                const container = containerMap[item.containerId];
                return {
                    id: item.id,
                    name: item.name,
                    description: item.description || '',
                    container: container ? {
                        name: container.name,
                        type: container.type,
                        location: container.location
                    } : null,
                    // Include photo indicator but not the full base64 to keep export readable
                    hasPhoto: !!item.photo,
                    dateAdded: item.dateAdded
                };
            }),
            // AI-friendly inventory listing
            inventoryListing: items.map(item => {
                const container = containerMap[item.containerId];
                const locationStr = container
                    ? `in "${container.name}" (${container.type}) at ${container.location}`
                    : 'location unknown';
                return `- ${item.name}${item.description ? ': ' + item.description : ''} - ${locationStr}`;
            }).join('\n')
        };

        return exportData;
    }

    /**
     * Export data including photos (full backup)
     */
    async exportFullBackup() {
        const [items, containers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        return {
            exportDate: new Date().toISOString(),
            version: '1.0',
            type: 'full_backup',
            containers: containers,
            items: items
        };
    }

    /**
     * Import data from JSON
     */
    async importData(data) {
        await this.ensureReady();

        // Validate the data structure
        if (!data.containers || !data.items) {
            throw new Error('Invalid import data format');
        }

        // Clear existing data
        await this.clearAllData();

        // Import containers first
        for (const container of data.containers) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['containers'], 'readwrite');
                const store = transaction.objectStore('containers');
                const request = store.add({
                    ...container,
                    dateAdded: container.dateAdded || new Date().toISOString(),
                    dateModified: container.dateModified || new Date().toISOString()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        // Import items
        for (const item of data.items) {
            await new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['items'], 'readwrite');
                const store = transaction.objectStore('items');
                const request = store.add({
                    ...item,
                    // Handle the case where item has container object instead of containerId
                    containerId: item.containerId || (item.container ? item.container.id : null),
                    dateAdded: item.dateAdded || new Date().toISOString(),
                    dateModified: item.dateModified || new Date().toISOString()
                });
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }

        return {
            containersImported: data.containers.length,
            itemsImported: data.items.length
        };
    }

    /**
     * Clear all data from the database
     */
    async clearAllData() {
        await this.ensureReady();

        await Promise.all([
            new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['containers'], 'readwrite');
                const store = transaction.objectStore('containers');
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            }),
            new Promise((resolve, reject) => {
                const transaction = this.db.transaction(['items'], 'readwrite');
                const store = transaction.objectStore('items');
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            })
        ]);
    }

    // ==================== UTILITIES ====================

    /**
     * Generate a unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ==================== FILE SYNC ====================

class FileSync {
    constructor(database) {
        this.db = database;
        this.fileHandle = null;
        this.syncEnabled = false;
        this.lastSyncTime = null;
        this.dataGetter = null; // Optional override for data source
    }

    /**
     * Check if File System Access API is supported
     */
    isSupported() {
        return 'showSaveFilePicker' in window;
    }

    /**
     * Set a custom data getter (for using Firebase data instead of local)
     */
    setDataGetter(fn) {
        this.dataGetter = fn;
    }

    /**
     * Enable auto-sync by selecting a file location
     */
    async enableSync() {
        if (!this.isSupported()) {
            throw new Error('File System Access API not supported in this browser. Use Chrome or Edge.');
        }

        try {
            this.fileHandle = await window.showSaveFilePicker({
                suggestedName: 'box-inventory.json',
                types: [{
                    description: 'JSON Files',
                    accept: { 'application/json': ['.json'] }
                }]
            });
            this.syncEnabled = true;
            await this.syncNow();
            return true;
        } catch (err) {
            if (err.name === 'AbortError') {
                return false; // User cancelled
            }
            throw err;
        }
    }

    /**
     * Sync data to the file now
     */
    async syncNow() {
        if (!this.syncEnabled || !this.fileHandle) {
            return false;
        }

        try {
            const data = this.dataGetter
                ? await this.dataGetter()
                : await this.db.exportForMCP();
            const json = JSON.stringify(data, null, 2);

            const writable = await this.fileHandle.createWritable();
            await writable.write(json);
            await writable.close();

            this.lastSyncTime = new Date();
            return true;
        } catch (err) {
            console.error('Sync failed:', err);
            // Permission might have been revoked
            if (err.name === 'NotAllowedError') {
                this.syncEnabled = false;
                this.fileHandle = null;
            }
            return false;
        }
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            enabled: this.syncEnabled,
            supported: this.isSupported(),
            lastSync: this.lastSyncTime
        };
    }

    /**
     * Disable sync
     */
    disableSync() {
        this.syncEnabled = false;
        this.fileHandle = null;
        this.lastSyncTime = null;
    }
}

// Add MCP export method to InventoryDB
InventoryDB.prototype.exportForMCP = async function() {
    const [items, containers] = await Promise.all([
        this.getAllItems(),
        this.getAllContainers()
    ]);

    // Create a container lookup map
    const containerMap = {};
    containers.forEach(c => {
        containerMap[c.id] = c;
    });

    // Create MCP-optimized export
    return {
        lastUpdated: new Date().toISOString(),
        version: '2.0',
        stats: {
            totalItems: items.length,
            totalContainers: containers.length,
            checkedOutItems: items.filter(i => i.status === 'checked_out').length
        },
        containers: containers.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            location: c.location,
            description: c.description || '',
            itemCount: items.filter(i => i.containerId === c.id && i.status !== 'checked_out').length
        })),
        items: items.map(item => {
            const container = containerMap[item.containerId];
            return {
                id: item.id,
                name: item.name,
                description: item.description || '',
                status: item.status || 'stored',
                containerName: container ? container.name : null,
                containerType: container ? container.type : null,
                location: container ? container.location : null,
                fullLocation: item.status === 'checked_out'
                    ? 'CHECKED OUT' + (item.checkedOutNote ? `: ${item.checkedOutNote}` : '')
                    : (container ? `${container.name} (${container.type}) - ${container.location}` : 'Unknown location'),
                hasPhoto: !!item.photo,
                photoData: item.photo || null, // Include for MCP image viewing
                dateAdded: item.dateAdded,
                dateModified: item.dateModified,
                checkedOutDate: item.checkedOutDate
            };
        }),
        // Plain text inventory for easy AI reading
        textInventory: items.map(item => {
            const container = containerMap[item.containerId];
            if (item.status === 'checked_out') {
                return `${item.name}${item.description ? ` - ${item.description}` : ''}: CHECKED OUT${item.checkedOutNote ? ` (${item.checkedOutNote})` : ''}`;
            }
            const loc = container
                ? `in "${container.name}" (${container.type}) at ${container.location}`
                : 'location unknown';
            const desc = item.description ? ` - ${item.description}` : '';
            return `${item.name}${desc}: ${loc}`;
        })
    };
};

// Create global instances
const db = new InventoryDB();
const fileSync = new FileSync(db);
