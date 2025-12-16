/**
 * Box Inventory - Main Application
 * Supports both local IndexedDB and Firebase cloud sync
 */

import { firebaseDB } from './firebase-db.js';
import { isFirebaseConfigured } from './firebase-config.js';

// ==================== GLOBAL STATE ====================
let currentView = 'items';
let currentItemId = null;
let currentContainerId = null;
let currentPhotoData = null;
let currentContainerPhotoData = null;
let searchTimeout = null;
let addAnotherMode = false;
let useFirebase = false;
let firebaseInitialized = false;

// Active database - will be either local 'db' or 'firebaseDB'
let activeDB = null;

// ==================== DOM ELEMENTS ====================
const elements = {
    // Auth
    authBar: document.getElementById('authBar'),
    authLoading: document.getElementById('authLoading'),
    authLoggedOut: document.getElementById('authLoggedOut'),
    authLoggedIn: document.getElementById('authLoggedIn'),
    signInBtn: document.getElementById('signInBtn'),
    signOutBtn: document.getElementById('signOutBtn'),
    signInPromptBtn: document.getElementById('signInPromptBtn'),
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),

    // Menu
    menuBtn: document.getElementById('menuBtn'),
    menu: document.getElementById('menu'),

    // Views
    notSignedInView: document.getElementById('notSignedInView'),
    itemsView: document.getElementById('itemsView'),
    checkedOutView: document.getElementById('checkedOutView'),
    containersView: document.getElementById('containersView'),
    searchView: document.getElementById('searchView'),

    // Lists
    itemsList: document.getElementById('itemsList'),
    checkedOutList: document.getElementById('checkedOutList'),
    containersList: document.getElementById('containersList'),
    searchResults: document.getElementById('searchResults'),

    // Empty states
    noItems: document.getElementById('noItems'),
    noCheckedOut: document.getElementById('noCheckedOut'),
    noContainers: document.getElementById('noContainers'),
    noResults: document.getElementById('noResults'),

    // Badge
    checkedOutBadge: document.getElementById('checkedOutBadge'),

    // Buttons
    addItemBtn: document.getElementById('addItemBtn'),
    addContainerBtn: document.getElementById('addContainerBtn'),
    exportBtn: document.getElementById('exportBtn'),
    importBtn: document.getElementById('importBtn'),
    importFile: document.getElementById('importFile'),

    // Search
    searchInput: document.getElementById('searchInput'),

    // Item Modal
    itemModal: document.getElementById('itemModal'),
    itemModalTitle: document.getElementById('itemModalTitle'),
    itemForm: document.getElementById('itemForm'),
    itemId: document.getElementById('itemId'),
    itemName: document.getElementById('itemName'),
    itemDescription: document.getElementById('itemDescription'),
    itemContainer: document.getElementById('itemContainer'),
    itemPhotoPreview: document.getElementById('itemPhotoPreview'),
    takePhotoBtn: document.getElementById('takePhotoBtn'),
    choosePhotoBtn: document.getElementById('choosePhotoBtn'),
    removePhotoBtn: document.getElementById('removePhotoBtn'),
    photoInput: document.getElementById('photoInput'),
    photoFileInput: document.getElementById('photoFileInput'),

    // Container Modal
    containerModal: document.getElementById('containerModal'),
    containerModalTitle: document.getElementById('containerModalTitle'),
    containerForm: document.getElementById('containerForm'),
    containerId: document.getElementById('containerId'),
    containerName: document.getElementById('containerName'),
    containerType: document.getElementById('containerType'),
    containerLocation: document.getElementById('containerLocation'),
    containerDescription: document.getElementById('containerDescription'),
    containerPhotoPreview: document.getElementById('containerPhotoPreview'),
    containerTakePhotoBtn: document.getElementById('containerTakePhotoBtn'),
    containerChoosePhotoBtn: document.getElementById('containerChoosePhotoBtn'),
    containerRemovePhotoBtn: document.getElementById('containerRemovePhotoBtn'),
    containerPhotoInput: document.getElementById('containerPhotoInput'),
    containerPhotoFileInput: document.getElementById('containerPhotoFileInput'),

    // View Item Modal
    viewItemModal: document.getElementById('viewItemModal'),
    viewItemTitle: document.getElementById('viewItemTitle'),
    viewItemContent: document.getElementById('viewItemContent'),
    viewItemActions: document.getElementById('viewItemActions'),
    viewItemCheckedOutActions: document.getElementById('viewItemCheckedOutActions'),
    deleteItemBtn: document.getElementById('deleteItemBtn'),
    deleteItemBtn2: document.getElementById('deleteItemBtn2'),
    editItemBtn: document.getElementById('editItemBtn'),
    checkOutItemBtn: document.getElementById('checkOutItemBtn'),
    checkInItemBtn: document.getElementById('checkInItemBtn'),

    // View Container Modal
    viewContainerModal: document.getElementById('viewContainerModal'),
    viewContainerTitle: document.getElementById('viewContainerTitle'),
    viewContainerContent: document.getElementById('viewContainerContent'),
    deleteContainerBtn: document.getElementById('deleteContainerBtn'),
    editContainerBtn: document.getElementById('editContainerBtn'),

    // Check Out Modal
    checkOutModal: document.getElementById('checkOutModal'),
    checkOutForm: document.getElementById('checkOutForm'),
    checkOutNote: document.getElementById('checkOutNote'),

    // Check In Modal
    checkInModal: document.getElementById('checkInModal'),
    checkInForm: document.getElementById('checkInForm'),
    checkInContainer: document.getElementById('checkInContainer'),
    previousContainerNote: document.getElementById('previousContainerNote'),
    previousContainerName: document.getElementById('previousContainerName'),

    // Toast
    toast: document.getElementById('toast')
};

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for local db to be ready
    await db.ready;
    activeDB = db; // Start with local database

    // Try to initialize Firebase
    if (isFirebaseConfigured()) {
        elements.authBar.classList.remove('hidden');
        firebaseInitialized = await firebaseDB.init();

        if (firebaseInitialized) {
            // Set up auth state listener
            firebaseDB.onAuthStateChange(handleAuthStateChange);
        } else {
            // Firebase init failed, hide auth bar
            elements.authBar.classList.add('hidden');
            elements.authLoading.classList.add('hidden');
        }
    } else {
        // Firebase not configured, use local only
        elements.authBar.classList.add('hidden');
    }

    initEventListeners();
    await refreshData();
});

function handleAuthStateChange(user) {
    elements.authLoading.classList.add('hidden');

    if (user) {
        // User is signed in
        useFirebase = true;
        activeDB = firebaseDB;

        elements.authLoggedOut.classList.add('hidden');
        elements.authLoggedIn.classList.remove('hidden');
        elements.userAvatar.src = user.photoURL || '';
        elements.userName.textContent = user.displayName || user.email;

        // Show main app views
        elements.notSignedInView.classList.add('hidden');
        elements.notSignedInView.classList.remove('active');

        // Refresh data from Firebase
        refreshData();
    } else {
        // User is signed out
        useFirebase = false;
        activeDB = db; // Fall back to local database

        elements.authLoggedIn.classList.add('hidden');
        elements.authLoggedOut.classList.remove('hidden');

        // Show sign-in prompt if Firebase is configured
        if (isFirebaseConfigured()) {
            showSignInPrompt();
        }

        refreshData();
    }
}

function showSignInPrompt() {
    // Hide all views
    elements.itemsView.classList.add('hidden');
    elements.itemsView.classList.remove('active');
    elements.containersView.classList.add('hidden');
    elements.containersView.classList.remove('active');
    elements.searchView.classList.add('hidden');
    elements.searchView.classList.remove('active');
    elements.checkedOutView.classList.add('hidden');
    elements.checkedOutView.classList.remove('active');

    // Show sign-in prompt
    elements.notSignedInView.classList.remove('hidden');
    elements.notSignedInView.classList.add('active');
}

function initEventListeners() {
    // Auth buttons
    if (elements.signInBtn) {
        elements.signInBtn.addEventListener('click', handleSignIn);
    }
    if (elements.signOutBtn) {
        elements.signOutBtn.addEventListener('click', handleSignOut);
    }
    if (elements.signInPromptBtn) {
        elements.signInPromptBtn.addEventListener('click', handleSignIn);
    }

    // Menu toggle
    elements.menuBtn.addEventListener('click', toggleMenu);

    // Logo link - return to items view
    const logoLink = document.getElementById('logoLink');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('items');
            elements.searchInput.value = '';
        });
    }

    // Click outside menu to close
    document.addEventListener('click', (e) => {
        if (!elements.menu.contains(e.target) && e.target !== elements.menuBtn) {
            elements.menu.classList.add('hidden');
        }
    });

    // Menu navigation
    document.querySelectorAll('.menu-item[data-view]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchView(item.dataset.view);
            elements.menu.classList.add('hidden');
        });
    });

    // Add buttons
    elements.addItemBtn.addEventListener('click', () => openItemModal());
    elements.addContainerBtn.addEventListener('click', () => openContainerModal());

    // Export/Import
    elements.exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportData();
        elements.menu.classList.add('hidden');
    });

    elements.importBtn.addEventListener('click', (e) => {
        e.preventDefault();
        elements.importFile.click();
        elements.menu.classList.add('hidden');
    });

    elements.importFile.addEventListener('change', handleImport);

    // Claude Sync
    const syncBtn = document.getElementById('syncBtn');
    if (syncBtn) {
        syncBtn.addEventListener('click', (e) => {
            e.preventDefault();
            elements.menu.classList.add('hidden');
            if (fileSync.syncEnabled) {
                disableClaudeSync();
            } else {
                enableClaudeSync();
            }
        });
    }

    // Search
    elements.searchInput.addEventListener('input', handleSearch);
    elements.searchInput.addEventListener('focus', () => {
        if (elements.searchInput.value.trim()) {
            switchView('search');
        }
    });

    // Forms
    elements.itemForm.addEventListener('submit', handleItemSubmit);
    elements.containerForm.addEventListener('submit', handleContainerSubmit);

    // Photo buttons (items)
    elements.takePhotoBtn.addEventListener('click', () => elements.photoInput.click());
    elements.choosePhotoBtn.addEventListener('click', () => elements.photoFileInput.click());
    elements.removePhotoBtn.addEventListener('click', removePhoto);
    elements.photoInput.addEventListener('change', handlePhotoCapture);
    elements.photoFileInput.addEventListener('change', handlePhotoCapture);

    // Photo buttons (containers)
    elements.containerTakePhotoBtn.addEventListener('click', () => elements.containerPhotoInput.click());
    elements.containerChoosePhotoBtn.addEventListener('click', () => elements.containerPhotoFileInput.click());
    elements.containerRemovePhotoBtn.addEventListener('click', removeContainerPhoto);
    elements.containerPhotoInput.addEventListener('change', handleContainerPhotoCapture);
    elements.containerPhotoFileInput.addEventListener('change', handleContainerPhotoCapture);

    // Save & Add Another button
    const saveAndAddAnotherBtn = document.getElementById('saveAndAddAnotherBtn');
    if (saveAndAddAnotherBtn) {
        saveAndAddAnotherBtn.addEventListener('click', () => {
            addAnotherMode = true;
            elements.itemForm.requestSubmit();
        });
    }

    // Modal close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.close;
            document.getElementById(modalId).classList.add('hidden');
        });
    });

    // View modal actions
    elements.editItemBtn.addEventListener('click', () => {
        elements.viewItemModal.classList.add('hidden');
        openItemModal(currentItemId);
    });

    elements.deleteItemBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this item?')) {
            await deleteItem(currentItemId);
            elements.viewItemModal.classList.add('hidden');
        }
    });

    // Second delete button (for checked out view)
    if (elements.deleteItemBtn2) {
        elements.deleteItemBtn2.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete this item?')) {
                await deleteItem(currentItemId);
                elements.viewItemModal.classList.add('hidden');
            }
        });
    }

    // Check out button
    if (elements.checkOutItemBtn) {
        elements.checkOutItemBtn.addEventListener('click', () => {
            elements.viewItemModal.classList.add('hidden');
            openCheckOutModal();
        });
    }

    // Check in button
    if (elements.checkInItemBtn) {
        elements.checkInItemBtn.addEventListener('click', async () => {
            elements.viewItemModal.classList.add('hidden');
            await openCheckInModal();
        });
    }

    // Check out form
    if (elements.checkOutForm) {
        elements.checkOutForm.addEventListener('submit', handleCheckOut);
    }

    // Check in form
    if (elements.checkInForm) {
        elements.checkInForm.addEventListener('submit', handleCheckIn);
    }

    elements.editContainerBtn.addEventListener('click', () => {
        elements.viewContainerModal.classList.add('hidden');
        openContainerModal(currentContainerId);
    });

    elements.deleteContainerBtn.addEventListener('click', async () => {
        await deleteContainer(currentContainerId);
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    });
}

// ==================== AUTHENTICATION ====================

async function handleSignIn() {
    try {
        await firebaseDB.signIn();
    } catch (error) {
        if (error.code !== 'auth/popup-closed-by-user') {
            showToast('Sign in failed: ' + error.message, 'error');
        }
    }
}

async function handleSignOut() {
    try {
        await firebaseDB.signOutUser();
        showToast('Signed out successfully', 'success');
    } catch (error) {
        showToast('Sign out failed: ' + error.message, 'error');
    }
}

// ==================== VIEW MANAGEMENT ====================

function toggleMenu() {
    elements.menu.classList.toggle('hidden');
}

function switchView(view) {
    // Don't allow view switching if showing sign-in prompt
    if (elements.notSignedInView.classList.contains('active') && isFirebaseConfigured() && !useFirebase) {
        return;
    }

    currentView = view;

    // Update menu active state
    document.querySelectorAll('.menu-item[data-view]').forEach(item => {
        item.classList.toggle('active', item.dataset.view === view);
    });

    // Show/hide views
    elements.notSignedInView.classList.add('hidden');
    elements.notSignedInView.classList.remove('active');

    elements.itemsView.classList.toggle('active', view === 'items');
    elements.checkedOutView.classList.toggle('active', view === 'checkedOut');
    elements.containersView.classList.toggle('active', view === 'containers');
    elements.searchView.classList.toggle('active', view === 'search');

    elements.itemsView.classList.toggle('hidden', view !== 'items');
    elements.checkedOutView.classList.toggle('hidden', view !== 'checkedOut');
    elements.containersView.classList.toggle('hidden', view !== 'containers');
    elements.searchView.classList.toggle('hidden', view !== 'search');
}

// ==================== DATA REFRESH ====================

async function refreshData() {
    await Promise.all([
        renderItems(),
        renderCheckedOutItems(),
        renderContainers(),
        populateContainerSelect()
    ]);

    // Auto-sync to file if enabled (local only)
    if (!useFirebase && fileSync.syncEnabled) {
        await fileSync.syncNow();
        updateSyncStatus();
    }
}

// ==================== FILE SYNC ====================

async function enableClaudeSync() {
    try {
        const success = await fileSync.enableSync();
        if (success) {
            showToast('Claude sync enabled! File will update automatically.', 'success');
            updateSyncStatus();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function disableClaudeSync() {
    fileSync.disableSync();
    showToast('Claude sync disabled', 'success');
    updateSyncStatus();
}

function updateSyncStatus() {
    const status = fileSync.getStatus();
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    if (syncBtn) {
        syncBtn.textContent = status.enabled ? 'Disable Claude Sync' : 'Enable Claude Sync';
    }
    if (syncStatus) {
        if (status.enabled && status.lastSync) {
            syncStatus.textContent = `Last sync: ${status.lastSync.toLocaleTimeString()}`;
            syncStatus.classList.remove('hidden');
        } else {
            syncStatus.classList.add('hidden');
        }
    }
}

// ==================== ITEMS ====================

async function renderItems() {
    const items = await activeDB.getAllItems();
    const containers = await activeDB.getAllContainers();
    const containerMap = {};
    containers.forEach(c => containerMap[c.id] = c);

    // Filter to only stored items (not checked out)
    const storedItems = items.filter(item => item.status !== 'checked_out');

    elements.itemsList.innerHTML = '';
    elements.noItems.classList.toggle('hidden', storedItems.length > 0);

    storedItems.forEach(item => {
        const container = containerMap[item.containerId];
        const card = createItemCard(item, container);
        elements.itemsList.appendChild(card);
    });
}

async function renderCheckedOutItems() {
    const items = await activeDB.getAllItems();
    const checkedOutItems = items.filter(item => item.status === 'checked_out');

    elements.checkedOutList.innerHTML = '';
    elements.noCheckedOut.classList.toggle('hidden', checkedOutItems.length > 0);

    // Update badge
    if (checkedOutItems.length > 0) {
        elements.checkedOutBadge.textContent = checkedOutItems.length;
        elements.checkedOutBadge.classList.remove('hidden');
    } else {
        elements.checkedOutBadge.classList.add('hidden');
    }

    checkedOutItems.forEach(item => {
        const card = createItemCard(item, null, true);
        elements.checkedOutList.appendChild(card);
    });
}

function createItemCard(item, container, isCheckedOut = false) {
    const card = document.createElement('div');
    card.className = 'item-card' + (isCheckedOut ? ' checked-out' : '');
    card.onclick = () => viewItem(item.id);

    const imageDiv = document.createElement('div');
    imageDiv.className = 'item-card-image';

    if (item.photo) {
        const img = document.createElement('img');
        img.src = item.photo;
        img.alt = item.name;
        img.loading = 'lazy';
        imageDiv.appendChild(img);
    } else {
        imageDiv.textContent = '📦';
    }

    const contentDiv = document.createElement('div');
    contentDiv.className = 'item-card-content';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'item-card-name';
    nameDiv.textContent = item.name;

    const locationDiv = document.createElement('div');
    locationDiv.className = 'item-card-location';

    if (isCheckedOut) {
        locationDiv.textContent = 'Checked Out';
        if (item.checkedOutNote) {
            locationDiv.textContent += `: ${item.checkedOutNote}`;
        }
    } else {
        locationDiv.textContent = container ? `${container.name} • ${container.location}` : 'No container';
    }

    contentDiv.appendChild(nameDiv);
    contentDiv.appendChild(locationDiv);

    card.appendChild(imageDiv);
    card.appendChild(contentDiv);

    return card;
}

async function viewItem(id) {
    const item = await activeDB.getItem(id);
    if (!item) return;

    currentItemId = id;
    const isCheckedOut = item.status === 'checked_out';
    const container = item.containerId ? await activeDB.getContainer(item.containerId) : null;

    elements.viewItemTitle.textContent = item.name;

    let html = '';

    if (item.photo) {
        html += `<img src="${item.photo}" alt="${item.name}" class="view-item-image">`;
    }

    // Show checked out status if applicable
    if (isCheckedOut) {
        html += `
            <div class="checked-out-info">
                <div class="status-label">⚠️ Checked Out</div>
                <div class="status-details">
                    Since: ${formatDate(item.checkedOutDate)}
                    ${item.checkedOutNote ? `<br>Note: ${escapeHtml(item.checkedOutNote)}` : ''}
                </div>
            </div>
        `;
    }

    if (item.description) {
        html += `
            <div class="detail-row">
                <div class="detail-label">Description</div>
                <div class="detail-value">${escapeHtml(item.description)}</div>
            </div>
        `;
    }

    if (container) {
        html += `
            <div class="detail-row">
                <div class="detail-label">Container</div>
                <div class="detail-value location-link" onclick="viewContainerFromItem('${container.id}')">${escapeHtml(container.name)}</div>
            </div>
            <div class="detail-row">
                <div class="detail-label">Location</div>
                <div class="detail-value">${escapeHtml(container.location)}</div>
            </div>
        `;
    } else if (isCheckedOut && item.previousContainerId) {
        const prevContainer = await activeDB.getContainer(item.previousContainerId);
        if (prevContainer) {
            html += `
                <div class="detail-row">
                    <div class="detail-label">Previous Container</div>
                    <div class="detail-value">${escapeHtml(prevContainer.name)} (${escapeHtml(prevContainer.location)})</div>
                </div>
            `;
        }
    }

    html += `
        <div class="detail-row">
            <div class="detail-label">Added</div>
            <div class="detail-value">${formatDate(item.dateAdded)}</div>
        </div>
    `;

    elements.viewItemContent.innerHTML = html;

    // Show appropriate action buttons
    if (isCheckedOut) {
        elements.viewItemActions.classList.add('hidden');
        elements.viewItemCheckedOutActions.classList.remove('hidden');
    } else {
        elements.viewItemActions.classList.remove('hidden');
        elements.viewItemCheckedOutActions.classList.add('hidden');
    }

    elements.viewItemModal.classList.remove('hidden');
}

// Global function for onclick handler
window.viewContainerFromItem = async function(containerId) {
    elements.viewItemModal.classList.add('hidden');
    await viewContainer(containerId);
};

async function openItemModal(id = null) {
    await populateContainerSelect();

    if (id) {
        const item = await activeDB.getItem(id);
        if (!item) return;

        elements.itemModalTitle.textContent = 'Edit Item';
        elements.itemId.value = item.id;
        elements.itemName.value = item.name;
        elements.itemDescription.value = item.description || '';
        elements.itemContainer.value = item.containerId || '';

        if (item.photo) {
            currentPhotoData = item.photo;
            elements.itemPhotoPreview.innerHTML = `<img src="${item.photo}" alt="Preview">`;
            elements.itemPhotoPreview.classList.add('has-photo');
            elements.removePhotoBtn.classList.remove('hidden');
        } else {
            resetPhotoPreview();
        }
    } else {
        elements.itemModalTitle.textContent = 'Add Item';
        elements.itemForm.reset();
        elements.itemId.value = '';
        resetPhotoPreview();
    }

    elements.itemModal.classList.remove('hidden');
    elements.itemName.focus();
}

async function handleItemSubmit(e) {
    e.preventDefault();

    const id = elements.itemId.value;
    const selectedContainer = elements.itemContainer.value;
    const data = {
        name: elements.itemName.value.trim(),
        description: elements.itemDescription.value.trim(),
        containerId: selectedContainer,
        photo: currentPhotoData
    };

    try {
        if (id) {
            await activeDB.updateItem(id, data);
            showToast('Item updated!', 'success');
        } else {
            await activeDB.addItem(data);
            showToast('Item added!', 'success');
        }

        await refreshData();

        // Handle "Add Another" mode
        if (addAnotherMode && !id) {
            addAnotherMode = false;
            // Reset form but keep the same container selected
            elements.itemForm.reset();
            elements.itemId.value = '';
            elements.itemContainer.value = selectedContainer;
            resetPhotoPreview();
            elements.itemName.focus();
            showToast('Item added! Add another...', 'success');
        } else {
            addAnotherMode = false;
            elements.itemModal.classList.add('hidden');
        }
    } catch (error) {
        addAnotherMode = false;
        showToast(error.message, 'error');
    }
}

async function deleteItem(id) {
    try {
        await activeDB.deleteItem(id);
        showToast('Item deleted', 'success');
        await refreshData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== CHECK IN/OUT ====================

function openCheckOutModal() {
    elements.checkOutNote.value = '';
    elements.checkOutModal.classList.remove('hidden');
}

async function openCheckInModal() {
    await populateCheckInContainerSelect();

    // Get the item to see if there's a previous container
    const item = await activeDB.getItem(currentItemId);
    if (item && item.previousContainerId) {
        const prevContainer = await activeDB.getContainer(item.previousContainerId);
        if (prevContainer) {
            elements.previousContainerNote.classList.remove('hidden');
            elements.previousContainerName.textContent = `${prevContainer.name} (${prevContainer.location})`;
            elements.checkInContainer.value = item.previousContainerId;
        } else {
            elements.previousContainerNote.classList.add('hidden');
        }
    } else {
        elements.previousContainerNote.classList.add('hidden');
    }

    elements.checkInModal.classList.remove('hidden');
}

async function populateCheckInContainerSelect() {
    const containers = await activeDB.getAllContainers();
    elements.checkInContainer.innerHTML = '<option value="">Select a container...</option>';

    containers.forEach(container => {
        const option = document.createElement('option');
        option.value = container.id;
        option.textContent = `${container.name} (${container.location})`;
        elements.checkInContainer.appendChild(option);
    });
}

async function handleCheckOut(e) {
    e.preventDefault();

    const note = elements.checkOutNote.value.trim();

    try {
        await activeDB.checkOutItem(currentItemId, note);
        showToast('Item checked out!', 'success');
        elements.checkOutModal.classList.add('hidden');
        await refreshData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function handleCheckIn(e) {
    e.preventDefault();

    const containerId = elements.checkInContainer.value;

    if (!containerId) {
        showToast('Please select a container', 'error');
        return;
    }

    try {
        await activeDB.checkInItem(currentItemId, containerId);
        showToast('Item checked in!', 'success');
        elements.checkInModal.classList.add('hidden');
        await refreshData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// ==================== CONTAINERS ====================

async function renderContainers() {
    const containers = await activeDB.getAllContainers();
    const items = await activeDB.getAllItems();

    // Count items per container (only stored items, not checked out)
    const itemCounts = {};
    items.filter(item => item.status !== 'checked_out').forEach(item => {
        itemCounts[item.containerId] = (itemCounts[item.containerId] || 0) + 1;
    });

    elements.containersList.innerHTML = '';
    elements.noContainers.classList.toggle('hidden', containers.length > 0);

    containers.forEach(container => {
        const count = itemCounts[container.id] || 0;
        const card = createContainerCard(container, count);
        elements.containersList.appendChild(card);
    });
}

function createContainerCard(container, itemCount) {
    const card = document.createElement('div');
    card.className = 'container-card';
    card.onclick = () => viewContainer(container.id);

    const typeLabels = {
        bin: 'Plastic Bin',
        box: 'Cardboard Box',
        shoebox: 'Shoebox',
        drawer: 'Drawer',
        cabinet: 'Cabinet',
        shelf: 'Shelf',
        closet: 'Closet',
        other: 'Other'
    };

    card.innerHTML = `
        <div class="container-card-header">
            <div class="container-card-name">${escapeHtml(container.name)}</div>
            <div class="container-card-type">${typeLabels[container.type] || container.type}</div>
        </div>
        <div class="container-card-location">${escapeHtml(container.location)}</div>
        <div class="container-card-count">${itemCount} item${itemCount !== 1 ? 's' : ''}</div>
    `;

    return card;
}

async function viewContainer(id) {
    const container = await activeDB.getContainer(id);
    if (!container) return;

    currentContainerId = id;
    const items = await activeDB.getItemsByContainer(id);
    // Only show stored items in container
    const storedItems = items.filter(item => item.status !== 'checked_out');

    const typeLabels = {
        bin: 'Plastic Bin',
        box: 'Cardboard Box',
        shoebox: 'Shoebox',
        drawer: 'Drawer',
        cabinet: 'Cabinet',
        shelf: 'Shelf',
        closet: 'Closet',
        other: 'Other'
    };

    elements.viewContainerTitle.textContent = container.name;

    let html = '';

    if (container.photo) {
        html += `<img src="${container.photo}" alt="${escapeHtml(container.name)}" class="view-item-image">`;
    }

    html += `
        <div class="detail-row">
            <div class="detail-label">Type</div>
            <div class="detail-value">${typeLabels[container.type] || container.type}</div>
        </div>
        <div class="detail-row">
            <div class="detail-label">Location</div>
            <div class="detail-value">${escapeHtml(container.location)}</div>
        </div>
    `;

    if (container.description) {
        html += `
            <div class="detail-row">
                <div class="detail-label">Description</div>
                <div class="detail-value">${escapeHtml(container.description)}</div>
            </div>
        `;
    }

    if (storedItems.length > 0) {
        html += `
            <div class="container-items-list">
                <h4>Items in this container (${storedItems.length})</h4>
                ${storedItems.map(item => `
                    <div class="container-item" onclick="viewItemFromContainer('${item.id}')">
                        <div class="container-item-thumb">
                            ${item.photo ? `<img src="${item.photo}" alt="${escapeHtml(item.name)}">` : '📦'}
                        </div>
                        <div class="container-item-name">${escapeHtml(item.name)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    elements.viewContainerContent.innerHTML = html;
    elements.viewContainerModal.classList.remove('hidden');
}

// Global function for onclick handler
window.viewItemFromContainer = async function(itemId) {
    elements.viewContainerModal.classList.add('hidden');
    await viewItem(itemId);
};

async function openContainerModal(id = null) {
    if (id) {
        const container = await activeDB.getContainer(id);
        if (!container) return;

        elements.containerModalTitle.textContent = 'Edit Container';
        elements.containerId.value = container.id;
        elements.containerName.value = container.name;
        elements.containerType.value = container.type;
        elements.containerLocation.value = container.location;
        elements.containerDescription.value = container.description || '';

        if (container.photo) {
            currentContainerPhotoData = container.photo;
            elements.containerPhotoPreview.innerHTML = `<img src="${container.photo}" alt="Preview">`;
            elements.containerPhotoPreview.classList.add('has-photo');
            elements.containerRemovePhotoBtn.classList.remove('hidden');
        } else {
            resetContainerPhotoPreview();
        }
    } else {
        elements.containerModalTitle.textContent = 'Add Container';
        elements.containerForm.reset();
        elements.containerId.value = '';
        resetContainerPhotoPreview();
    }

    elements.containerModal.classList.remove('hidden');
    elements.containerName.focus();
}

async function handleContainerSubmit(e) {
    e.preventDefault();

    const id = elements.containerId.value;
    const data = {
        name: elements.containerName.value.trim(),
        type: elements.containerType.value,
        location: elements.containerLocation.value.trim(),
        description: elements.containerDescription.value.trim(),
        photo: currentContainerPhotoData
    };

    try {
        if (id) {
            await activeDB.updateContainer(id, data);
            showToast('Container updated!', 'success');
        } else {
            await activeDB.addContainer(data);
            showToast('Container added!', 'success');
        }

        elements.containerModal.classList.add('hidden');
        await refreshData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteContainer(id) {
    try {
        await activeDB.deleteContainer(id);
        showToast('Container deleted', 'success');
        elements.viewContainerModal.classList.add('hidden');
        await refreshData();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function populateContainerSelect() {
    const containers = await activeDB.getAllContainers();
    elements.itemContainer.innerHTML = '<option value="">Select a container...</option>';

    containers.forEach(container => {
        const option = document.createElement('option');
        option.value = container.id;
        option.textContent = `${container.name} (${container.location})`;
        elements.itemContainer.appendChild(option);
    });
}

// ==================== PHOTOS ====================

function handlePhotoCapture(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Compress and resize the image
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentPhotoData = canvas.toDataURL('image/jpeg', 0.8);
            elements.itemPhotoPreview.innerHTML = `<img src="${currentPhotoData}" alt="Preview">`;
            elements.itemPhotoPreview.classList.add('has-photo');
            elements.removePhotoBtn.classList.remove('hidden');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
}

function removePhoto() {
    currentPhotoData = null;
    resetPhotoPreview();
}

function resetPhotoPreview() {
    currentPhotoData = null;
    elements.itemPhotoPreview.innerHTML = '<span>No photo</span>';
    elements.itemPhotoPreview.classList.remove('has-photo');
    elements.removePhotoBtn.classList.add('hidden');
}

// ==================== CONTAINER PHOTOS ====================

function handleContainerPhotoCapture(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Compress and resize the image
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxSize) {
                    height *= maxSize / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width *= maxSize / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            currentContainerPhotoData = canvas.toDataURL('image/jpeg', 0.8);
            elements.containerPhotoPreview.innerHTML = `<img src="${currentContainerPhotoData}" alt="Preview">`;
            elements.containerPhotoPreview.classList.add('has-photo');
            elements.containerRemovePhotoBtn.classList.remove('hidden');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
}

function removeContainerPhoto() {
    currentContainerPhotoData = null;
    resetContainerPhotoPreview();
}

function resetContainerPhotoPreview() {
    currentContainerPhotoData = null;
    elements.containerPhotoPreview.innerHTML = '<span>No photo</span>';
    elements.containerPhotoPreview.classList.remove('has-photo');
    elements.containerRemovePhotoBtn.classList.add('hidden');
}

// ==================== SEARCH ====================

async function handleSearch() {
    const query = elements.searchInput.value.trim();

    // Debounce search
    clearTimeout(searchTimeout);

    if (!query) {
        elements.searchResults.innerHTML = '';
        elements.noResults.textContent = 'Type to search your inventory...';
        elements.noResults.classList.remove('hidden');
        return;
    }

    // Switch to search view if not already there
    if (currentView !== 'search') {
        switchView('search');
    }

    searchTimeout = setTimeout(async () => {
        const results = await activeDB.search(query);
        renderSearchResults(results);
    }, 200);
}

async function renderSearchResults(results) {
    const containers = await activeDB.getAllContainers();
    const containerMap = {};
    containers.forEach(c => containerMap[c.id] = c);

    elements.searchResults.innerHTML = '';

    const totalResults = results.items.length + results.containers.length;

    if (totalResults === 0) {
        elements.noResults.textContent = 'No results found';
        elements.noResults.classList.remove('hidden');
        return;
    }

    elements.noResults.classList.add('hidden');

    // Render matched containers first
    results.containers.forEach(container => {
        const card = document.createElement('div');
        card.className = 'container-card';
        card.onclick = () => viewContainer(container.id);
        card.innerHTML = `
            <div class="container-card-header">
                <div class="container-card-name">${escapeHtml(container.name)}</div>
                <div class="container-card-type">Container</div>
            </div>
            <div class="container-card-location">${escapeHtml(container.location)}</div>
        `;
        elements.searchResults.appendChild(card);
    });

    // Render matched items
    results.items.forEach(item => {
        const container = containerMap[item.containerId];
        const isCheckedOut = item.status === 'checked_out';
        const card = createItemCard(item, container, isCheckedOut);
        elements.searchResults.appendChild(card);
    });
}

// ==================== EXPORT / IMPORT ====================

async function exportData() {
    try {
        let data;
        if (useFirebase) {
            data = await activeDB.exportData();
        } else {
            data = await activeDB.exportFullBackup();
        }
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `box-inventory-${formatDateForFile(new Date())}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Data exported!', 'success');
    } catch (error) {
        showToast('Export failed: ' + error.message, 'error');
    }
}

async function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('This will replace all your current data. Are you sure you want to import?')) {
        e.target.value = '';
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await activeDB.importData(data);

        showToast(`Imported ${result.containersImported} containers and ${result.itemsImported} items!`, 'success');
        await refreshData();
    } catch (error) {
        showToast('Import failed: ' + error.message, 'error');
    }

    e.target.value = '';
}

// ==================== UTILITIES ====================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateForFile(date) {
    return date.toISOString().slice(0, 10);
}

function showToast(message, type = '') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type}`;
    elements.toast.classList.remove('hidden');

    setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 3000);
}

// ==================== SERVICE WORKER REGISTRATION ====================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
