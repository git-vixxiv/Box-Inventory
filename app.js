/**
 * Box Inventory - Main Application
 * Supports both local IndexedDB and Firebase cloud sync
 */

import { firebaseDB } from './firebase-db.js';
import { isFirebaseConfigured } from './firebase-config.js';

// ==================== GLOBAL STATE ====================
let currentView = 'home';
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
    homeView: document.getElementById('homeView'),
    itemsView: document.getElementById('itemsView'),
    checkedOutView: document.getElementById('checkedOutView'),
    needsPhotoView: document.getElementById('needsPhotoView'),
    containersView: document.getElementById('containersView'),
    searchView: document.getElementById('searchView'),

    // Home elements
    homeStats: document.getElementById('homeStats'),
    storeInBoxBtn: document.getElementById('storeInBoxBtn'),
    addNewBoxBtn: document.getElementById('addNewBoxBtn'),
    whatsInBoxBtn: document.getElementById('whatsInBoxBtn'),
    wheresMyBoxBtn: document.getElementById('wheresMyBoxBtn'),

    // What's in the Box modal
    whatsInBoxModal: document.getElementById('whatsInBoxModal'),
    selectBoxToView: document.getElementById('selectBoxToView'),
    boxContentsResult: document.getElementById('boxContentsResult'),

    // Where's my Box modal
    wheresMyBoxModal: document.getElementById('wheresMyBoxModal'),
    findBoxInput: document.getElementById('findBoxInput'),
    findBoxResults: document.getElementById('findBoxResults'),

    // Lists
    itemsList: document.getElementById('itemsList'),
    checkedOutList: document.getElementById('checkedOutList'),
    needsPhotoList: document.getElementById('needsPhotoList'),
    containersList: document.getElementById('containersList'),
    searchResults: document.getElementById('searchResults'),

    // Empty states
    noItems: document.getElementById('noItems'),
    noCheckedOut: document.getElementById('noCheckedOut'),
    noNeedsPhoto: document.getElementById('noNeedsPhoto'),
    noContainers: document.getElementById('noContainers'),
    noResults: document.getElementById('noResults'),

    // Badge
    checkedOutBadge: document.getElementById('checkedOutBadge'),
    needsPhotoBadge: document.getElementById('needsPhotoBadge'),

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
    initVoiceInput();
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

        // Show main app views - switch to home
        elements.notSignedInView.classList.add('hidden');
        elements.notSignedInView.classList.remove('active');
        switchView('home');

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
    elements.homeView.classList.add('hidden');
    elements.homeView.classList.remove('active');
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

    // Logo link - return to home view
    const logoLink = document.getElementById('logoLink');
    if (logoLink) {
        logoLink.addEventListener('click', (e) => {
            e.preventDefault();
            switchView('home');
            elements.searchInput.value = '';
        });
    }

    // Home action buttons
    if (elements.storeInBoxBtn) {
        elements.storeInBoxBtn.addEventListener('click', () => openItemModal());
    }
    if (elements.addNewBoxBtn) {
        elements.addNewBoxBtn.addEventListener('click', () => openContainerModal());
    }
    if (elements.whatsInBoxBtn) {
        elements.whatsInBoxBtn.addEventListener('click', () => openWhatsInBoxModal());
    }
    if (elements.wheresMyBoxBtn) {
        elements.wheresMyBoxBtn.addEventListener('click', () => openWheresMyBoxModal());
    }

    // What's in the Box modal - select change
    if (elements.selectBoxToView) {
        elements.selectBoxToView.addEventListener('change', handleBoxSelection);
    }

    // Where's my Box modal - search input
    if (elements.findBoxInput) {
        elements.findBoxInput.addEventListener('input', handleFindBoxSearch);
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

    // Bulk Import (CSV)
    const bulkImportBtn = document.getElementById('bulkImportBtn');
    const bulkImportFile = document.getElementById('bulkImportFile');
    if (bulkImportBtn) {
        bulkImportBtn.addEventListener('click', (e) => {
            e.preventDefault();
            elements.menu.classList.add('hidden');
            openBulkImportModal();
        });
    }
    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener('click', downloadCSVTemplate);
    }
    const chooseCSVBtn = document.getElementById('chooseCSVBtn');
    if (chooseCSVBtn) {
        chooseCSVBtn.addEventListener('click', () => bulkImportFile.click());
    }
    if (bulkImportFile) {
        bulkImportFile.addEventListener('change', handleBulkImportFile);
    }
    const bulkImportBackBtn = document.getElementById('bulkImportBackBtn');
    if (bulkImportBackBtn) {
        bulkImportBackBtn.addEventListener('click', () => {
            document.getElementById('bulkImportStep1').classList.remove('hidden');
            document.getElementById('bulkImportStep2').classList.add('hidden');
        });
    }
    const bulkImportConfirmBtn = document.getElementById('bulkImportConfirmBtn');
    if (bulkImportConfirmBtn) {
        bulkImportConfirmBtn.addEventListener('click', executeBulkImport);
    }

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

    // Container type change - update naming suggestion
    elements.containerType.addEventListener('change', updateContainerNameSuggestion);

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
            stopVoiceInput();
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
                stopVoiceInput();
                modal.classList.add('hidden');
            }
        });
    });

    // Manual sync button (if added)
    const syncNowBtn = document.getElementById('syncNowBtn');
    if (syncNowBtn) {
        syncNowBtn.addEventListener('click', (e) => {
            e.preventDefault();
            manualSyncNow();
            elements.menu.classList.add('hidden');
        });
    }
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

    elements.homeView.classList.toggle('active', view === 'home');
    elements.itemsView.classList.toggle('active', view === 'items');
    elements.checkedOutView.classList.toggle('active', view === 'checkedOut');
    if (elements.needsPhotoView) elements.needsPhotoView.classList.toggle('active', view === 'needsPhoto');
    elements.containersView.classList.toggle('active', view === 'containers');
    elements.searchView.classList.toggle('active', view === 'search');

    elements.homeView.classList.toggle('hidden', view !== 'home');
    elements.itemsView.classList.toggle('hidden', view !== 'items');
    elements.checkedOutView.classList.toggle('hidden', view !== 'checkedOut');
    if (elements.needsPhotoView) elements.needsPhotoView.classList.toggle('hidden', view !== 'needsPhoto');
    elements.containersView.classList.toggle('hidden', view !== 'containers');
    elements.searchView.classList.toggle('hidden', view !== 'search');

    // Render home stats when switching to home
    if (view === 'home') {
        renderHomeStats();
    }
}

// ==================== DATA REFRESH ====================

async function refreshData() {
    await Promise.all([
        renderItems(),
        renderCheckedOutItems(),
        renderItemsNeedingPhotos(),
        renderContainers(),
        populateContainerSelect()
    ]);

    // Auto-sync to file if enabled (works with both local and Firebase)
    if (fileSync.syncEnabled) {
        await fileSync.syncNow();
        updateSyncStatus();
    }
}

// ==================== FILE SYNC ====================

async function enableClaudeSync() {
    if (!fileSync.isSupported()) {
        showToast('Claude Sync requires Chrome or Edge desktop browser', 'error');
        return;
    }

    try {
        // Make fileSync use the active database
        fileSync.setDataGetter(() => activeDB.exportForMCP());

        const success = await fileSync.enableSync();
        if (success) {
            showToast('Claude sync enabled! File updates automatically.', 'success');
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

async function manualSyncNow() {
    if (!fileSync.syncEnabled) {
        showToast('Enable Claude Sync first', 'error');
        return;
    }
    fileSync.setDataGetter(() => activeDB.exportForMCP());
    const success = await fileSync.syncNow();
    if (success) {
        showToast('Synced to file!', 'success');
    } else {
        showToast('Sync failed - file permission may have been revoked', 'error');
    }
    updateSyncStatus();
}

function updateSyncStatus() {
    const status = fileSync.getStatus();
    const syncBtn = document.getElementById('syncBtn');
    const syncStatus = document.getElementById('syncStatus');

    if (syncBtn) {
        if (!status.supported) {
            syncBtn.textContent = 'Claude Sync (Chrome/Edge only)';
            syncBtn.style.color = 'var(--gray-400)';
        } else {
            syncBtn.textContent = status.enabled ? 'Disable Claude Sync' : 'Enable Claude Sync';
            syncBtn.style.color = '';
        }
    }
    if (syncStatus) {
        if (status.enabled && status.lastSync) {
            const timeStr = status.lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            syncStatus.textContent = `Last sync: ${timeStr} ✓`;
            syncStatus.classList.remove('hidden');
        } else if (status.enabled) {
            syncStatus.textContent = 'Sync enabled';
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

async function renderItemsNeedingPhotos() {
    if (!elements.needsPhotoList) return;

    const items = await activeDB.getAllItems();
    const containers = await activeDB.getAllContainers();
    const containerMap = {};
    containers.forEach(c => containerMap[c.id] = c);

    const itemsWithoutPhoto = items.filter(item =>
        !item.photo && item.status !== 'checked_out'
    );

    elements.needsPhotoList.innerHTML = '';
    if (elements.noNeedsPhoto) {
        elements.noNeedsPhoto.classList.toggle('hidden', itemsWithoutPhoto.length > 0);
    }

    // Update badge
    if (elements.needsPhotoBadge) {
        if (itemsWithoutPhoto.length > 0) {
            elements.needsPhotoBadge.textContent = itemsWithoutPhoto.length;
            elements.needsPhotoBadge.classList.remove('hidden');
        } else {
            elements.needsPhotoBadge.classList.add('hidden');
        }
    }

    itemsWithoutPhoto.forEach(item => {
        const container = containerMap[item.containerId];
        const card = createItemCard(item, container);
        elements.needsPhotoList.appendChild(card);
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

    // Clear any existing suggestions
    clearItemNameSuggestion();

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

        // Show item name suggestions
        await updateItemNameSuggestion();
    }

    elements.itemModal.classList.remove('hidden');
    elements.itemName.focus();
}

/**
 * Update item name suggestion
 */
async function updateItemNameSuggestion() {
    const suggestionContainer = document.getElementById('itemNameSuggestion');

    if (!suggestionContainer) {
        return;
    }

    // Don't show suggestions when editing
    if (elements.itemId.value) {
        clearItemNameSuggestion();
        return;
    }

    const suggestions = await getItemNameSuggestions();

    if (suggestions.length > 0) {
        // Show top suggestions (up to 3)
        suggestionContainer.innerHTML = '';
        const topSuggestions = suggestions.slice(0, 3);

        topSuggestions.forEach(suggestion => {
            const suggestionEl = renderNameSuggestion(suggestion, (name) => {
                elements.itemName.value = name;
                elements.itemName.focus();
                clearItemNameSuggestion();
            });
            suggestionContainer.appendChild(suggestionEl);
        });

        suggestionContainer.classList.remove('hidden');
    } else {
        clearItemNameSuggestion();
    }
}

function clearItemNameSuggestion() {
    const suggestionContainer = document.getElementById('itemNameSuggestion');
    if (suggestionContainer) {
        suggestionContainer.innerHTML = '';
        suggestionContainer.classList.add('hidden');
    }
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
    // Clear any existing suggestions
    clearContainerNameSuggestion();

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

        // Show suggestion if a type is pre-selected
        if (elements.containerType.value) {
            await updateContainerNameSuggestion();
        }
    }

    elements.containerModal.classList.remove('hidden');
    elements.containerName.focus();
}

/**
 * Update container name suggestion based on selected type
 */
async function updateContainerNameSuggestion() {
    const containerType = elements.containerType.value;
    const suggestionContainer = document.getElementById('containerNameSuggestion');

    if (!containerType || !suggestionContainer) {
        clearContainerNameSuggestion();
        return;
    }

    // Don't show suggestions when editing
    if (elements.containerId.value) {
        clearContainerNameSuggestion();
        return;
    }

    const suggestions = await getContainerNameSuggestions(containerType);

    if (suggestions.length > 0) {
        const topSuggestion = suggestions[0];
        suggestionContainer.innerHTML = '';
        const suggestionEl = renderNameSuggestion(topSuggestion, (name) => {
            elements.containerName.value = name;
            elements.containerName.focus();
            clearContainerNameSuggestion();
        });
        suggestionContainer.appendChild(suggestionEl);
        suggestionContainer.classList.remove('hidden');
    } else {
        clearContainerNameSuggestion();
    }
}

function clearContainerNameSuggestion() {
    const suggestionContainer = document.getElementById('containerNameSuggestion');
    if (suggestionContainer) {
        suggestionContainer.innerHTML = '';
        suggestionContainer.classList.add('hidden');
    }
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
        // Always use exportData (photo-stripped) for export to keep file size manageable
        const data = await activeDB.exportData();
        const json = JSON.stringify(data, null, 2);

        if (!json || json === 'null' || json === '{}') {
            throw new Error('No data to export');
        }

        const filename = `box-inventory-${formatDateForFile(new Date())}.json`;
        const blob = new Blob([json], { type: 'application/json' });

        // Detect mobile for fallback handling
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Try the standard download approach first
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // On mobile, also offer the data in a viewable form as a fallback
        if (isMobile) {
            // Give the standard download a moment to trigger
            setTimeout(() => {
                showExportFallback(json, filename);
            }, 500);
        }

        // Clean up after a delay so the download has time to start
        setTimeout(() => URL.revokeObjectURL(url), 5000);

        showToast(`Exported ${data.summary?.totalItems || 0} items, ${data.summary?.totalContainers || 0} containers`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showToast('Export failed: ' + error.message, 'error');
    }
}

function showExportFallback(json, filename) {
    // Create a modal showing the data so users can copy it on mobile
    let fallbackModal = document.getElementById('exportFallbackModal');
    if (!fallbackModal) {
        fallbackModal = document.createElement('div');
        fallbackModal.id = 'exportFallbackModal';
        fallbackModal.className = 'modal hidden';
        fallbackModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Export Data</h3>
                    <button class="close-btn" data-close-fallback>&times;</button>
                </div>
                <div style="padding: 1rem;">
                    <p style="margin-bottom: 0.75rem; font-size: 0.875rem; color: var(--gray-600);">
                        If the download didn't start, copy the text below and save it as <strong id="exportFallbackFilename"></strong>.
                    </p>
                    <textarea id="exportFallbackData" readonly style="width: 100%; height: 200px; padding: 0.5rem; font-family: monospace; font-size: 0.75rem; border: 1px solid var(--gray-300); border-radius: var(--radius);"></textarea>
                </div>
                <div class="form-actions">
                    <button type="button" class="secondary-btn" data-close-fallback>Close</button>
                    <button type="button" id="copyExportBtn" class="primary-btn">Copy to Clipboard</button>
                </div>
            </div>
        `;
        document.body.appendChild(fallbackModal);

        // Hook up close buttons
        fallbackModal.querySelectorAll('[data-close-fallback]').forEach(btn => {
            btn.addEventListener('click', () => fallbackModal.classList.add('hidden'));
        });
        fallbackModal.addEventListener('click', (e) => {
            if (e.target === fallbackModal) fallbackModal.classList.add('hidden');
        });

        document.getElementById('copyExportBtn').addEventListener('click', async () => {
            const textarea = document.getElementById('exportFallbackData');
            try {
                await navigator.clipboard.writeText(textarea.value);
                showToast('Copied to clipboard!', 'success');
            } catch (err) {
                textarea.select();
                document.execCommand('copy');
                showToast('Copied!', 'success');
            }
        });
    }

    document.getElementById('exportFallbackFilename').textContent = filename;
    document.getElementById('exportFallbackData').value = json;
    fallbackModal.classList.remove('hidden');
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

// ==================== VOICE INPUT ====================

let activeVoiceRecognition = null;
let activeVoiceTarget = null;
let userStoppedVoice = false;

function isVoiceInputSupported() {
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function startVoiceInput(targetId, button) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Voice input not supported in this browser. Try Chrome, Edge, or Safari.', 'error');
        return;
    }

    // Stop any existing recognition
    stopVoiceInput();
    userStoppedVoice = false;

    const target = document.getElementById(targetId);
    if (!target) return;

    const hint = document.getElementById(`${targetId}VoiceHint`);
    const isMobile = isMobileDevice();

    const recognition = new SpeechRecognition();
    // Mobile (especially Chrome Android) doesn't support continuous mode well;
    // it cuts off after silence. We auto-restart in onend instead.
    recognition.continuous = !isMobile;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let baseValue = target.value;
    if (baseValue && !baseValue.endsWith(' ')) baseValue += ' ';

    recognition.onstart = () => {
        button.classList.add('listening');
        if (hint) {
            hint.textContent = '🎤 Listening... (tap mic again to stop)';
            hint.classList.remove('hidden');
        }
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        if (finalTranscript) {
            baseValue += finalTranscript;
            if (!baseValue.endsWith(' ')) baseValue += ' ';
            target.value = baseValue.trim();
        } else if (interimTranscript) {
            target.value = (baseValue + interimTranscript).trim();
        }

        // Trigger input event for any listeners (e.g. naming suggestions)
        target.dispatchEvent(new Event('input', { bubbles: true }));
    };

    recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') {
            // Common, not really an error - let onend handle restart
            return;
        } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            showToast('Microphone permission denied. Allow it in your browser settings.', 'error');
            userStoppedVoice = true;
        } else if (event.error === 'network') {
            showToast('Voice input requires internet connection.', 'error');
            userStoppedVoice = true;
        } else {
            showToast(`Voice error: ${event.error}`, 'error');
            userStoppedVoice = true;
        }
    };

    recognition.onend = () => {
        // On mobile, auto-restart to simulate continuous mode
        // unless the user explicitly stopped it
        if (isMobile && !userStoppedVoice && activeVoiceRecognition === recognition) {
            try {
                recognition.start();
                return;
            } catch (e) {
                // Failed to restart, fall through to cleanup
            }
        }

        button.classList.remove('listening');
        if (hint) hint.classList.add('hidden');
        if (activeVoiceRecognition === recognition) {
            activeVoiceRecognition = null;
            activeVoiceTarget = null;
        }
    };

    try {
        recognition.start();
        activeVoiceRecognition = recognition;
        activeVoiceTarget = targetId;
    } catch (err) {
        showToast('Could not start voice input: ' + err.message, 'error');
        button.classList.remove('listening');
        if (hint) hint.classList.add('hidden');
    }
}

function stopVoiceInput() {
    userStoppedVoice = true;
    if (activeVoiceRecognition) {
        try {
            activeVoiceRecognition.stop();
        } catch (e) {
            // Already stopped
        }
        activeVoiceRecognition = null;
        activeVoiceTarget = null;
    }
    document.querySelectorAll('.voice-input-btn.listening').forEach(btn => {
        btn.classList.remove('listening');
    });
    document.querySelectorAll('.voice-hint').forEach(h => h.classList.add('hidden'));
}

function initVoiceInput() {
    if (!isVoiceInputSupported()) {
        // Hide voice buttons if not supported
        document.querySelectorAll('.voice-input-btn').forEach(btn => {
            btn.style.display = 'none';
        });
        // Adjust input padding back to normal
        document.querySelectorAll('.voice-input-wrapper input, .voice-input-wrapper textarea').forEach(el => {
            el.style.paddingRight = '';
        });
        return;
    }

    // Use event delegation for better mobile support
    document.addEventListener('click', (e) => {
        const button = e.target.closest('.voice-input-btn');
        if (!button) return;

        e.preventDefault();
        e.stopPropagation();

        const targetId = button.dataset.voiceTarget;
        if (!targetId) return;

        // If this button is already listening, stop
        if (activeVoiceTarget === targetId) {
            stopVoiceInput();
            return;
        }

        startVoiceInput(targetId, button);
    });
}

// ==================== BULK CSV IMPORT ====================

let bulkImportData = null;

function openBulkImportModal() {
    document.getElementById('bulkImportStep1').classList.remove('hidden');
    document.getElementById('bulkImportStep2').classList.add('hidden');
    document.getElementById('bulkImportStep3').classList.add('hidden');
    document.getElementById('bulkImportModal').classList.remove('hidden');
    bulkImportData = null;
}

function downloadCSVTemplate() {
    const csvContent = `name,description,container,containerType,containerLocation
Red Hammer,16oz claw hammer with red grip,Toolbox 1,box,Garage
Phillips Screwdriver Set,Set of 5 phillips screwdrivers,Toolbox 1,box,Garage
Christmas Lights,Warm white LED string lights,Holiday Bin,bin,Attic
`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boxes-import-template.csv';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    showToast('Template downloaded', 'success');
}

/**
 * Parse CSV text into array of objects.
 * Supports comma or tab separators, quoted fields, escaped quotes.
 */
function parseCSV(text) {
    // Strip BOM if present
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }

    const lines = [];
    let currentLine = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                currentLine += '""';
                i++;
            } else {
                inQuotes = !inQuotes;
                currentLine += char;
            }
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            if (currentLine.length > 0) {
                lines.push(currentLine);
                currentLine = '';
            }
            // Skip \r\n
            if (char === '\r' && next === '\n') i++;
        } else {
            currentLine += char;
        }
    }
    if (currentLine.length > 0) lines.push(currentLine);

    if (lines.length === 0) return { headers: [], rows: [] };

    // Detect separator (tab or comma) on header line
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const sep = tabCount > commaCount ? '\t' : ',';

    function parseLine(line) {
        const fields = [];
        let current = '';
        let inQ = false;

        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            const n = line[i + 1];

            if (c === '"') {
                if (inQ && n === '"') {
                    current += '"';
                    i++;
                } else {
                    inQ = !inQ;
                }
            } else if (c === sep && !inQ) {
                fields.push(current);
                current = '';
            } else {
                current += c;
            }
        }
        fields.push(current);
        return fields.map(f => f.trim());
    }

    const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, ''));
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const fields = parseLine(lines[i]);
        if (fields.every(f => !f)) continue; // Skip empty lines
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = fields[idx] || '';
        });
        rows.push(row);
    }

    return { headers, rows };
}

async function handleBulkImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const { headers, rows } = parseCSV(text);

        if (!headers.includes('name')) {
            showToast('CSV must have a "name" column', 'error');
            e.target.value = '';
            return;
        }

        if (rows.length === 0) {
            showToast('CSV file is empty', 'error');
            e.target.value = '';
            return;
        }

        // Get existing containers for matching
        const existingContainers = await activeDB.getAllContainers();
        const containerByName = {};
        existingContainers.forEach(c => {
            containerByName[c.name.toLowerCase()] = c;
        });

        // Process rows: identify items and new containers
        const itemsToImport = [];
        const newContainersMap = new Map();
        const errors = [];

        rows.forEach((row, idx) => {
            const lineNum = idx + 2; // +2 because 1-indexed and header row
            const name = (row.name || '').trim();
            if (!name) {
                errors.push(`Line ${lineNum}: missing name`);
                return;
            }

            const containerName = (row.container || '').trim();
            const containerType = (row.containertype || row.type || 'box').trim().toLowerCase();
            const containerLocation = (row.containerlocation || row.location || '').trim();

            let containerId = null;
            let containerInfo = null;

            if (containerName) {
                const existing = containerByName[containerName.toLowerCase()];
                if (existing) {
                    containerId = existing.id;
                    containerInfo = existing;
                } else {
                    // Will need to create this container
                    const key = containerName.toLowerCase();
                    if (!newContainersMap.has(key)) {
                        if (!containerLocation) {
                            errors.push(`Line ${lineNum}: container "${containerName}" doesn't exist and no containerLocation given`);
                            return;
                        }
                        newContainersMap.set(key, {
                            name: containerName,
                            type: containerType || 'box',
                            location: containerLocation,
                            description: ''
                        });
                    }
                    containerInfo = { name: containerName, isNew: true };
                }
            }

            itemsToImport.push({
                name,
                description: (row.description || '').trim(),
                containerName: containerName || null,
                containerId,
                containerInfo
            });
        });

        bulkImportData = {
            items: itemsToImport,
            newContainers: Array.from(newContainersMap.values()),
            errors
        };

        renderBulkImportPreview();

        document.getElementById('bulkImportStep1').classList.add('hidden');
        document.getElementById('bulkImportStep2').classList.remove('hidden');
    } catch (error) {
        console.error(error);
        showToast('Failed to parse CSV: ' + error.message, 'error');
    }

    e.target.value = '';
}

function renderBulkImportPreview() {
    const data = bulkImportData;
    if (!data) return;

    const summary = document.getElementById('bulkImportSummary');
    summary.textContent = `${data.items.length} item${data.items.length !== 1 ? 's' : ''} ready to import` +
        (data.newContainers.length > 0 ? `, ${data.newContainers.length} new container${data.newContainers.length !== 1 ? 's' : ''} will be created` : '');

    const preview = document.getElementById('bulkImportPreview');
    preview.innerHTML = '';

    // Show new containers first
    data.newContainers.forEach(c => {
        const row = document.createElement('div');
        row.className = 'bulk-preview-row new-container';
        row.innerHTML = `
            <div class="preview-name">📦 ${escapeHtml(c.name)}<span class="new-tag">NEW BOX</span></div>
            <div class="preview-detail">${escapeHtml(c.type)} at ${escapeHtml(c.location)}</div>
        `;
        preview.appendChild(row);
    });

    // Then show items
    data.items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'bulk-preview-row';
        const containerLabel = item.containerInfo
            ? (item.containerInfo.isNew ? `→ ${item.containerName} (new)` : `→ ${item.containerInfo.name}`)
            : '(no container)';
        row.innerHTML = `
            <div class="preview-name">${escapeHtml(item.name)}</div>
            <div class="preview-detail">${escapeHtml(item.description || 'no description')} ${escapeHtml(containerLabel)}</div>
        `;
        preview.appendChild(row);
    });

    const errorsDiv = document.getElementById('bulkImportErrors');
    if (data.errors.length > 0) {
        errorsDiv.innerHTML = '<strong>Issues:</strong><ul style="margin-top: 0.25rem; margin-left: 1.25rem;">' +
            data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
        errorsDiv.classList.remove('hidden');
    } else {
        errorsDiv.classList.add('hidden');
    }
}

async function executeBulkImport() {
    const data = bulkImportData;
    if (!data) return;

    document.getElementById('bulkImportStep2').classList.add('hidden');
    document.getElementById('bulkImportStep3').classList.remove('hidden');

    const progressEl = document.getElementById('bulkImportProgress');
    const progressFill = document.getElementById('bulkProgressFill');
    progressFill.style.width = '0%';

    const total = data.newContainers.length + data.items.length;
    if (total === 0) {
        document.getElementById('bulkImportModal').classList.add('hidden');
        showToast('Nothing to import', 'error');
        return;
    }
    let done = 0;
    let containersCreated = 0;
    let itemsCreated = 0;
    const failures = [];

    // Map of container name (lowercase) -> id (filled as we create)
    const containerNameToId = {};
    const existing = await activeDB.getAllContainers();
    existing.forEach(c => { containerNameToId[c.name.toLowerCase()] = c.id; });

    // Create new containers first
    for (const c of data.newContainers) {
        try {
            progressEl.textContent = `Creating box: ${c.name}`;
            const created = await activeDB.addContainer(c);
            containerNameToId[c.name.toLowerCase()] = created.id;
            containersCreated++;
        } catch (err) {
            failures.push(`Box "${c.name}": ${err.message}`);
        }
        done++;
        progressFill.style.width = `${(done / total) * 100}%`;
    }

    // Create items
    for (const item of data.items) {
        try {
            progressEl.textContent = `Adding: ${item.name}`;
            const containerId = item.containerName
                ? containerNameToId[item.containerName.toLowerCase()] || null
                : null;
            await activeDB.addItem({
                name: item.name,
                description: item.description,
                containerId: containerId,
                photo: null
            });
            itemsCreated++;
        } catch (err) {
            failures.push(`Item "${item.name}": ${err.message}`);
        }
        done++;
        progressFill.style.width = `${(done / total) * 100}%`;
    }

    document.getElementById('bulkImportModal').classList.add('hidden');
    bulkImportData = null;

    let msg = `Imported ${itemsCreated} items`;
    if (containersCreated > 0) msg += ` and created ${containersCreated} boxes`;
    if (failures.length > 0) msg += ` (${failures.length} failed)`;
    showToast(msg, failures.length > 0 ? 'error' : 'success');

    if (failures.length > 0) {
        console.error('Bulk import failures:', failures);
    }

    await refreshData();

    // Switch to Items Needing Photos view to encourage photo addition
    if (itemsCreated > 0) {
        switchView('needsPhoto');
    }
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

// ==================== NAMING SUGGESTIONS ====================

/**
 * Analyzes existing names to find patterns and suggest the next name
 * Supports patterns like: "Name #1", "Name 1", "Name-1", "Name #01"
 */
function analyzeNamingPatterns(names) {
    const patterns = {};

    // Regex to match common numbering patterns at the end of names
    const numberPatterns = [
        /^(.+?)\s*#(\d+)$/,      // "Name #1" or "Name#1"
        /^(.+?)\s*-\s*(\d+)$/,   // "Name - 1" or "Name-1"
        /^(.+?)\s+(\d+)$/,       // "Name 1"
    ];

    names.forEach(name => {
        for (const regex of numberPatterns) {
            const match = name.match(regex);
            if (match) {
                const baseName = match[1].trim();
                const number = parseInt(match[2], 10);
                const format = name.replace(match[1], '{base}').replace(match[2], '{num}');

                if (!patterns[baseName]) {
                    patterns[baseName] = {
                        baseName,
                        numbers: [],
                        format: format,
                        originalFormat: name.substring(match[1].length, name.length - match[2].length)
                    };
                }
                patterns[baseName].numbers.push(number);
                break;
            }
        }
    });

    // Calculate suggestions for each pattern
    const suggestions = [];
    for (const key in patterns) {
        const pattern = patterns[key];
        const maxNumber = Math.max(...pattern.numbers);
        const nextNumber = maxNumber + 1;

        // Determine the separator used
        let separator = ' #';
        if (pattern.originalFormat.includes('-')) {
            separator = pattern.originalFormat.includes(' - ') ? ' - ' : '-';
        } else if (pattern.originalFormat.includes('#')) {
            separator = pattern.originalFormat.includes(' #') ? ' #' : '#';
        } else {
            separator = ' ';
        }

        const suggestedName = `${pattern.baseName}${separator}${nextNumber}`;
        suggestions.push({
            baseName: pattern.baseName,
            suggestedName,
            count: pattern.numbers.length,
            nextNumber
        });
    }

    // Sort by count (most used patterns first)
    suggestions.sort((a, b) => b.count - a.count);

    return suggestions;
}

/**
 * Get container name suggestions based on type
 */
async function getContainerNameSuggestions(containerType) {
    const containers = await activeDB.getAllContainers();

    // Filter containers by the selected type
    const sameTypeContainers = containers.filter(c => c.type === containerType);
    const names = sameTypeContainers.map(c => c.name);

    return analyzeNamingPatterns(names);
}

/**
 * Get item name suggestions
 */
async function getItemNameSuggestions() {
    const items = await activeDB.getAllItems();
    const names = items.map(i => i.name);

    return analyzeNamingPatterns(names);
}

/**
 * Render suggestion UI
 */
function renderNameSuggestion(suggestion, onUseName) {
    if (!suggestion) return '';

    const div = document.createElement('div');
    div.className = 'name-suggestion';
    div.innerHTML = `
        <span class="suggestion-label">Suggested name:</span>
        <span class="suggestion-name">${escapeHtml(suggestion.suggestedName)}</span>
        <button type="button" class="suggestion-use-btn">Use Name</button>
    `;

    div.querySelector('.suggestion-use-btn').addEventListener('click', () => {
        onUseName(suggestion.suggestedName);
    });

    return div;
}

// ==================== HOME VIEW ====================

async function renderHomeStats() {
    const [items, containers] = await Promise.all([
        activeDB.getAllItems(),
        activeDB.getAllContainers()
    ]);

    const storedItems = items.filter(item => item.status !== 'checked_out');
    const checkedOutItems = items.filter(item => item.status === 'checked_out');

    elements.homeStats.innerHTML = `
        <h3>Your Inventory</h3>
        <div class="stats-grid">
            <div class="stat-item stat-link" onclick="window.navigateToView('items')">
                <div class="stat-value">${storedItems.length}</div>
                <div class="stat-label">Items Stored</div>
            </div>
            <div class="stat-item stat-link" onclick="window.navigateToView('containers')">
                <div class="stat-value">${containers.length}</div>
                <div class="stat-label">Boxes</div>
            </div>
            <div class="stat-item stat-link" onclick="window.navigateToView('checkedOut')">
                <div class="stat-value">${checkedOutItems.length}</div>
                <div class="stat-label">Checked Out</div>
            </div>
        </div>
    `;
}

// ==================== WHAT'S IN THE BOX ====================

async function openWhatsInBoxModal() {
    // Populate the box selector
    const containers = await activeDB.getAllContainers();
    elements.selectBoxToView.innerHTML = '<option value="">Choose a box...</option>';

    containers.forEach(container => {
        const option = document.createElement('option');
        option.value = container.id;
        option.textContent = `${container.name} (${container.location})`;
        elements.selectBoxToView.appendChild(option);
    });

    elements.boxContentsResult.classList.add('hidden');
    elements.boxContentsResult.innerHTML = '';
    elements.whatsInBoxModal.classList.remove('hidden');
}

async function handleBoxSelection() {
    const containerId = elements.selectBoxToView.value;

    if (!containerId) {
        elements.boxContentsResult.classList.add('hidden');
        return;
    }

    const container = await activeDB.getContainer(containerId);
    const items = await activeDB.getItemsByContainer(containerId);
    const storedItems = items.filter(item => item.status !== 'checked_out');

    let html = `
        <h4>${escapeHtml(container.name)}</h4>
        <div class="box-location">📍 ${escapeHtml(container.location)}</div>
    `;

    if (container.lastItemAdded) {
        html += `<div class="box-last-updated">Last updated: ${formatDate(container.lastItemAdded)}</div>`;
    }

    if (storedItems.length === 0) {
        html += '<div class="empty-box-message">This box is empty</div>';
    } else {
        html += '<ul class="contents-list">';
        storedItems.forEach(item => {
            html += `
                <li onclick="viewItemFromWhatsInBox('${item.id}')">
                    <div class="contents-item-thumb">
                        ${item.photo ? `<img src="${item.photo}" alt="">` : '📦'}
                    </div>
                    <div class="contents-item-info">
                        <div class="contents-item-name">${escapeHtml(item.name)}</div>
                        ${item.lastSeen ? `<div class="contents-item-date">Stored: ${formatDate(item.lastSeen)}</div>` : ''}
                    </div>
                </li>
            `;
        });
        html += '</ul>';
    }

    elements.boxContentsResult.innerHTML = html;
    elements.boxContentsResult.classList.remove('hidden');
}

// Global function for onclick handler
window.viewItemFromWhatsInBox = async function(itemId) {
    elements.whatsInBoxModal.classList.add('hidden');
    await viewItem(itemId);
};

// ==================== WHERE'S MY BOX ====================

let findBoxTimeout = null;

async function openWheresMyBoxModal() {
    elements.findBoxInput.value = '';
    elements.findBoxResults.innerHTML = '<div class="no-results-message">Type to search for an item or box...</div>';
    elements.wheresMyBoxModal.classList.remove('hidden');
    elements.findBoxInput.focus();
}

async function handleFindBoxSearch() {
    const query = elements.findBoxInput.value.trim();

    clearTimeout(findBoxTimeout);

    if (!query) {
        elements.findBoxResults.innerHTML = '<div class="no-results-message">Type to search for an item or box...</div>';
        return;
    }

    findBoxTimeout = setTimeout(async () => {
        const results = await activeDB.search(query);
        renderFindBoxResults(results);
    }, 200);
}

async function renderFindBoxResults(results) {
    const containers = await activeDB.getAllContainers();
    const containerMap = {};
    containers.forEach(c => containerMap[c.id] = c);

    const totalResults = results.items.length + results.containers.length;

    if (totalResults === 0) {
        elements.findBoxResults.innerHTML = '<div class="no-results-message">No results found</div>';
        return;
    }

    let html = '';

    // Show containers first
    results.containers.forEach(container => {
        html += `
            <div class="find-result-item" onclick="viewContainerFromFind('${container.id}')">
                <span class="find-result-type box">BOX</span>
                <div class="find-result-name">${escapeHtml(container.name)}</div>
                <div class="find-result-location">📍 ${escapeHtml(container.location)}</div>
            </div>
        `;
    });

    // Show items
    results.items.forEach(item => {
        const container = containerMap[item.containerId];
        const isCheckedOut = item.status === 'checked_out';

        html += `
            <div class="find-result-item" onclick="viewItemFromFind('${item.id}')">
                <span class="find-result-type item">${isCheckedOut ? 'CHECKED OUT' : 'ITEM'}</span>
                <div class="find-result-name">${escapeHtml(item.name)}</div>
                ${isCheckedOut
                    ? `<div class="find-result-location">⚠️ Currently checked out</div>`
                    : container
                        ? `<div class="find-result-location">📦 ${escapeHtml(container.name)}</div>
                           <div class="find-result-sublocation">📍 ${escapeHtml(container.location)}</div>`
                        : '<div class="find-result-location">Location unknown</div>'
                }
            </div>
        `;
    });

    elements.findBoxResults.innerHTML = html;
}

// Global functions for onclick handlers
window.viewContainerFromFind = async function(containerId) {
    elements.wheresMyBoxModal.classList.add('hidden');
    await viewContainer(containerId);
};

window.viewItemFromFind = async function(itemId) {
    elements.wheresMyBoxModal.classList.add('hidden');
    await viewItem(itemId);
};

// Global function for stats navigation
window.navigateToView = function(view) {
    switchView(view);
};

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
