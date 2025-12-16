/**
 * Box Inventory - Firebase Database Layer
 * Provides cloud sync with Firestore and Google authentication
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth,
    signInWithPopup,
    signOut,
    GoogleAuthProvider,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    onSnapshot,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

class FirebaseDB {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.user = null;
        this.authStateListeners = [];
        this.dataListeners = [];
        this.initialized = false;
    }

    /**
     * Initialize Firebase
     */
    async init() {
        if (!isFirebaseConfigured()) {
            console.warn('Firebase not configured. Using local storage only.');
            return false;
        }

        try {
            this.app = initializeApp(firebaseConfig);
            this.auth = getAuth(this.app);
            this.db = getFirestore(this.app);

            // Listen for auth state changes
            onAuthStateChanged(this.auth, (user) => {
                this.user = user;
                this.authStateListeners.forEach(listener => listener(user));

                if (user) {
                    this.setupRealtimeListeners();
                } else {
                    this.cleanupListeners();
                }
            });

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            return false;
        }
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.user;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.user;
    }

    /**
     * Sign in with Google
     */
    async signIn() {
        if (!this.auth) {
            throw new Error('Firebase not initialized');
        }

        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(this.auth, provider);
            return result.user;
        } catch (error) {
            console.error('Sign in failed:', error);
            throw error;
        }
    }

    /**
     * Sign out
     */
    async signOutUser() {
        if (!this.auth) return;
        await signOut(this.auth);
    }

    /**
     * Add auth state listener
     */
    onAuthStateChange(callback) {
        this.authStateListeners.push(callback);
        // Call immediately with current state
        if (this.initialized) {
            callback(this.user);
        }
        return () => {
            this.authStateListeners = this.authStateListeners.filter(l => l !== callback);
        };
    }

    /**
     * Get user's collection path
     */
    getUserPath(collectionName) {
        if (!this.user) throw new Error('Not authenticated');
        return `users/${this.user.uid}/${collectionName}`;
    }

    // ==================== CONTAINER OPERATIONS ====================

    async addContainer(container) {
        if (!this.user) throw new Error('Not authenticated');

        const id = this.generateId();
        const data = {
            id,
            name: container.name,
            type: container.type || 'box',
            location: container.location,
            description: container.description || '',
            photo: container.photo || null,
            dateAdded: new Date().toISOString(),
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('containers'), id);
        await setDoc(docRef, data);
        return data;
    }

    async updateContainer(id, updates) {
        if (!this.user) throw new Error('Not authenticated');

        const existing = await this.getContainer(id);
        if (!existing) throw new Error('Container not found');

        const data = {
            ...existing,
            ...updates,
            id,
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('containers'), id);
        await setDoc(docRef, data);
        return data;
    }

    async getContainer(id) {
        if (!this.user) return null;

        const docRef = doc(this.db, this.getUserPath('containers'), id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    }

    async getAllContainers() {
        if (!this.user) return [];

        const q = query(
            collection(this.db, this.getUserPath('containers')),
            orderBy('name')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    }

    async deleteContainer(id) {
        if (!this.user) throw new Error('Not authenticated');

        const items = await this.getItemsByContainer(id);
        if (items.length > 0) {
            throw new Error(`Cannot delete: ${items.length} item(s) still in container`);
        }

        const docRef = doc(this.db, this.getUserPath('containers'), id);
        await deleteDoc(docRef);
        return true;
    }

    // ==================== ITEM OPERATIONS ====================

    async addItem(item) {
        if (!this.user) throw new Error('Not authenticated');

        const id = this.generateId();
        const data = {
            id,
            name: item.name,
            description: item.description || '',
            containerId: item.containerId,
            photo: item.photo || null,
            status: 'stored', // 'stored' or 'checked_out'
            checkedOutDate: null,
            checkedOutNote: null,
            previousContainerId: null,
            dateAdded: new Date().toISOString(),
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('items'), id);
        await setDoc(docRef, data);
        return data;
    }

    async updateItem(id, updates) {
        if (!this.user) throw new Error('Not authenticated');

        const existing = await this.getItem(id);
        if (!existing) throw new Error('Item not found');

        const data = {
            ...existing,
            ...updates,
            id,
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('items'), id);
        await setDoc(docRef, data);
        return data;
    }

    async getItem(id) {
        if (!this.user) return null;

        const docRef = doc(this.db, this.getUserPath('items'), id);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? docSnap.data() : null;
    }

    async getAllItems() {
        if (!this.user) return [];

        const q = query(
            collection(this.db, this.getUserPath('items')),
            orderBy('dateAdded', 'desc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => doc.data());
    }

    async getItemsByContainer(containerId) {
        if (!this.user) return [];

        const allItems = await this.getAllItems();
        return allItems.filter(item => item.containerId === containerId);
    }

    async getCheckedOutItems() {
        if (!this.user) return [];

        const allItems = await this.getAllItems();
        return allItems.filter(item => item.status === 'checked_out');
    }

    async deleteItem(id) {
        if (!this.user) throw new Error('Not authenticated');

        const docRef = doc(this.db, this.getUserPath('items'), id);
        await deleteDoc(docRef);
        return true;
    }

    // ==================== CHECK IN/OUT OPERATIONS ====================

    async checkOutItem(id, note = '') {
        if (!this.user) throw new Error('Not authenticated');

        const item = await this.getItem(id);
        if (!item) throw new Error('Item not found');
        if (item.status === 'checked_out') throw new Error('Item already checked out');

        const data = {
            ...item,
            status: 'checked_out',
            checkedOutDate: new Date().toISOString(),
            checkedOutNote: note,
            previousContainerId: item.containerId,
            containerId: null, // No longer in a container
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('items'), id);
        await setDoc(docRef, data);
        return data;
    }

    async checkInItem(id, containerId = null, note = '') {
        if (!this.user) throw new Error('Not authenticated');

        const item = await this.getItem(id);
        if (!item) throw new Error('Item not found');
        if (item.status !== 'checked_out') throw new Error('Item is not checked out');

        // Use provided container, or previous container, or throw error
        const targetContainer = containerId || item.previousContainerId;
        if (!targetContainer) throw new Error('No container specified');

        const data = {
            ...item,
            status: 'stored',
            containerId: targetContainer,
            checkedOutDate: null,
            checkedOutNote: null,
            previousContainerId: null,
            dateModified: new Date().toISOString()
        };

        const docRef = doc(this.db, this.getUserPath('items'), id);
        await setDoc(docRef, data);
        return data;
    }

    // ==================== SEARCH ====================

    async search(queryStr) {
        const normalizedQuery = queryStr.toLowerCase().trim();
        if (!normalizedQuery) return { items: [], containers: [] };

        const [allItems, allContainers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        const matchedItems = allItems.filter(item => {
            const searchText = `${item.name} ${item.description}`.toLowerCase();
            return searchText.includes(normalizedQuery);
        });

        const matchedContainers = allContainers.filter(container => {
            const searchText = `${container.name} ${container.location} ${container.description}`.toLowerCase();
            return searchText.includes(normalizedQuery);
        });

        return { items: matchedItems, containers: matchedContainers };
    }

    // ==================== IMPORT/EXPORT ====================

    async exportData() {
        const [items, containers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        return {
            exportDate: new Date().toISOString(),
            version: '2.0',
            type: 'full_backup',
            containers,
            items
        };
    }

    async importData(data) {
        if (!this.user) throw new Error('Not authenticated');
        if (!data.containers || !data.items) {
            throw new Error('Invalid import data format');
        }

        const batch = writeBatch(this.db);

        // Import containers
        for (const container of data.containers) {
            const docRef = doc(this.db, this.getUserPath('containers'), container.id);
            batch.set(docRef, {
                ...container,
                dateModified: new Date().toISOString()
            });
        }

        // Import items
        for (const item of data.items) {
            const docRef = doc(this.db, this.getUserPath('items'), item.id);
            batch.set(docRef, {
                ...item,
                status: item.status || 'stored',
                dateModified: new Date().toISOString()
            });
        }

        await batch.commit();

        return {
            containersImported: data.containers.length,
            itemsImported: data.items.length
        };
    }

    async exportForMCP() {
        const [items, containers] = await Promise.all([
            this.getAllItems(),
            this.getAllContainers()
        ]);

        const containerMap = {};
        containers.forEach(c => { containerMap[c.id] = c; });

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
                itemCount: items.filter(i => i.containerId === c.id && i.status === 'stored').length
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
                        : (container ? `${container.name} (${container.type}) - ${container.location}` : 'Unknown'),
                    hasPhoto: !!item.photo,
                    dateAdded: item.dateAdded,
                    checkedOutDate: item.checkedOutDate
                };
            }),
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
    }

    // ==================== REALTIME LISTENERS ====================

    setupRealtimeListeners() {
        // Can be used to set up real-time sync if needed
    }

    cleanupListeners() {
        this.dataListeners.forEach(unsubscribe => unsubscribe());
        this.dataListeners = [];
    }

    // ==================== UTILITIES ====================

    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Create global instance
const firebaseDB = new FirebaseDB();

export { firebaseDB };
