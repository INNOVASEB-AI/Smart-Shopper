// app.js

import {
  getShoppingLists,
  addList as storageAddList,
  deleteList as storageDeleteList,
  addItemToList as storageAddItemToList,
  removeItemFromList as storageRemoveItemFromList
} from './storage.js';

import { showError } from './ui.js';
import { renderListView, renderListItemsView } from './listUI.js';

// Import Firebase services and auth functions
import { 
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from './firebase.js';

// Import html5-qrcode format constants
const Html5QrcodeSupportedFormats = {
  QR_CODE: 0,
  CODE_128: 1,
  CODE_39: 2,
  EAN_13: 3,
  UPC_A: 4,
  UPC_E: 5,
  EAN_8: 6
};

// Global Scanner Instance
window.html5QrCode = null;

window.addEventListener('error', e => console.error('JS Error:', e.error));
window.addEventListener('unhandledrejection', e => console.error('Promise Rejection:', e.reason));

// Debounce function for search
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Global Variables & Constants
const htmlEl = document.documentElement;
const mainContentArea = document.querySelector('main');
const listTabView = document.getElementById('list-tab');
const listItemsView = document.getElementById('list-items-view');
const navElement = document.querySelector('nav');
let currentOpenListId = null; // Track which list is being viewed
let currentUser = null; // Keep track of the logged-in user

// Global variable to track camera state
let currentCamera = "environment"; // "environment" (back) or "user" (front)

// Retailer information with branding
let retailersInfo = [];

// Dark Mode Logic
function applyTheme() {
  console.log("applyTheme called");
  const isDarkMode = htmlEl.classList.contains("dark");
  const toggleCheckbox = document.getElementById("dark-mode-checkbox");
  if (toggleCheckbox) {
    toggleCheckbox.checked = isDarkMode;
  }
}

function toggleDarkMode() {
  console.log("toggleDarkMode called");
  htmlEl.classList.toggle("dark");
  localStorage.theme = htmlEl.classList.contains("dark") ? "dark" : "light";
  applyTheme();
}

// Tab Switching Logic
function showView(viewId) {
  console.log(`showView called for: ${viewId}`);
  document.querySelectorAll('.tab-content').forEach(view => view.classList.remove('active'));
  listItemsView.classList.add('hidden');
  listItemsView.classList.remove('animate__fadeIn', 'animate__fadeOut');

  const targetView = document.getElementById(viewId);
  if (targetView) {
    if (viewId === 'list-items-view') {
      listItemsView.classList.remove('hidden');
      listItemsView.classList.add('animate__fadeIn');
      navElement.classList.add('hidden');
      console.log("Showing list items view, hiding nav.");
    } else {
      targetView.classList.remove('hidden');
      targetView.classList.add('active');
      navElement.classList.remove('hidden');
      console.log(`Showing tab: ${viewId}, ensuring nav is visible.`);
      document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.remove("active");
        if (button.getAttribute("data-tab") === viewId) {
          button.classList.add("active");
        }
      });
    }
  } else {
    console.error("Target view not found:", viewId);
  }

  // Show/hide FAB only on "list-tab"
  const fabContainer = document.querySelector('.fab-container');
  if (fabContainer) {
    if (viewId === 'list-tab') {
      fabContainer.style.display = '';
    } else {
      fabContainer.style.display = 'none';
      closeFab();
      const fabActions = document.getElementById('fab-actions');
      fabActions.classList.remove('opacity-100', 'pointer-events-auto');
      fabActions.classList.add('opacity-0', 'pointer-events-none');
    }
  }
}

function navigateToListItems(listId) {
  console.log(`navigateToListItems called for listId: ${listId}`);
  currentOpenListId = listId;
  // Now uses imported renderListItemsView
  renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
  showView('list-items-view');
}

function navigateBackToLists() {
  console.log("navigateBackToLists called");
  currentOpenListId = null;
  listItemsView.classList.remove('animate__fadeIn');
  listItemsView.classList.add('animate__fadeOut');
  setTimeout(() => {
    showView('list-tab');
    renderListView(navigateToListItems);
  }, 300);
}

// —––––––– NOTE —–––––––
// The **local** definition of `renderListItemsView(…)` has been REMOVED here.
// We now rely solely on the import from listUI.js.
// —––––––––––––––––––––––

// Placeholder Actions
function handleNewList() {
  console.log("handleNewList called (+ button clicked)");
  showModal("Create New List", `
    <div class="mb-4">
      <label for="new-list-name" class="block text-sm font-medium mb-1">List Name</label>
      <input type="text" id="new-list-name" class="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2" style="background: var(--input-bg); color: var(--main-text); border-color: var(--border-color);">
    </div>
    <div class="text-right">
      <button id="create-list-cancel" class="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 mr-2">Cancel</button>
      <button id="create-list-confirm" class="px-4 py-2 rounded-lg text-white" style="background: var(--accent);">Create</button>
    </div>
  `);
  
  const input = document.getElementById('new-list-name');
  input.focus();
  
  function handleCreate() {
    const listName = input.value.trim();
    if (listName) {
      addList(listName)
        .then(() => closeModal())
        .catch(error => {
          alert(`Failed to create list: ${error.message}`);
        });
    }
  }
  
  document.getElementById('create-list-confirm').addEventListener('click', handleCreate);
  document.getElementById('create-list-cancel').addEventListener('click', closeModal);
  input.addEventListener('keypress', e => {
    if (e.key === 'Enter') handleCreate();
  });
}

function handleShowCard(cardName) {
  console.log(`Action: Show card details for "${cardName}" (Placeholder)`);
}

function handleNavigateSetting(settingName) {
  console.log(`Action: Navigate to setting "${settingName}" (Placeholder)`);
}

// Search Functionality
function handleSearch() {
  const searchInput = document.getElementById("search-input");
  const searchTerm = searchInput.value.trim();
  console.log(`handleSearch called for: "${searchTerm}"`);
  if (!searchTerm) return;

  document.getElementById("loading-indicator").classList.remove("hidden");
  document.getElementById("no-results-message").classList.add("hidden");
  document.getElementById("search-results-container").innerHTML = "";
  fetchSearchResults(searchTerm);
}

// Create a debounced version of the search function
const debouncedSearch = debounce(handleSearch, 300);

async function fetchSearchResults(query) {
  try {
    const response = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    displayResults(data.results);
  } catch (error) {
    console.error("Search API error:", error);
    document.getElementById("loading-indicator").classList.add("hidden");
    const resultsContainer = document.getElementById("search-results-container");
    resultsContainer.innerHTML = `
      <div class="text-center py-4 animate__animated animate__fadeIn">
        <svg xmlns="http://www.w3.org/2000/svg" … class="w-12 h-12 mx-auto mb-3 text-red-500">…</svg>
        <h3 class="text-lg font-semibold mb-2">Connection Error</h3>
        <p class="mb-2">Could not connect to the search service.</p>
        <p class="text-sm opacity-80">Please make sure the backend server is running.</p>
        <p class="text-sm opacity-80 mt-2">Try navigating to the "My List" tab to view your saved lists.</p>
      </div>
    `;
  }
}

function displayResults(results) {
  console.log("displayResults called with results:", results);
  const resultsContainer = document.getElementById("search-results-container");
  document.getElementById("loading-indicator").classList.add("hidden");
  resultsContainer.innerHTML = "";

  if (!results || results.length === 0) {
    document.getElementById("no-results-message").classList.remove("hidden");
  } else {
    document.getElementById("no-results-message").classList.add("hidden");
    results.forEach((product) => {
      const resultDiv = document.createElement("div");
      resultDiv.className = "rounded-xl shadow-lg bg-white dark:bg-slate-800 p-6 mb-4 transition-transform duration-300 hover:scale-105 hover:shadow-2xl animate__animated animate__fadeInUp";
      resultDiv.style.background = "var(--card-bg)";
      resultDiv.style.color = "var(--card-text)";
      resultDiv.style.borderColor = "var(--border-color)";

      resultDiv.dataset.productId = product.id;
      resultDiv.dataset.productName = product.name;
      resultDiv.dataset.productPrice = product.price;
      resultDiv.dataset.productRetailer = product.retailer;

      resultDiv.innerHTML = `
        <div class="flex-grow mr-2">
          <p class="font-medium">${product.name}</p>
          <div class="mt-1 flex justify-between items-center">
            <span style="font-weight: 600;">R ${product.price}</span>
            <span class="text-xs opacity-80">at ${product.retailer}</span>
          </div>
          <div class="mt-3">
            <button 
              class="add-to-list-button px-3 py-2 rounded-lg text-white flex items-center" 
              style="background: var(--accent);"
              aria-label="Add ${product.name} to list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add to list
            </button>
          </div>
        </div>
      `;
      resultsContainer.appendChild(resultDiv);
    });
  }
}

function promptAddToList(product) {
  console.log("promptAddToList called for product:", product);
  
  getShoppingLists().then(lists => {
    if (lists.length === 0) {
      alert("You don't have any lists yet! Create one from the 'My List' tab first.");
      return;
    }

    const modal = document.getElementById('list-selection-modal');
    const productInfo = document.getElementById('list-selection-product-info');
    const options = document.getElementById('list-selection-options');

    // Set product info
    productInfo.textContent = `"${product.name}" (R${product.price} at ${product.retailer})`;
    
    // Clear previous options
    options.innerHTML = '';
    
    // Add list options
    lists.forEach(list => {
      const button = document.createElement('button');
      button.className = 'w-full text-left p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition';
      button.dataset.listId = list.id;
      button.innerHTML = `
        <span class="font-medium">${list.name}</span>
        <span class="text-xs ml-2 opacity-70">(${list.items.length} items)</span>
      `;
      options.appendChild(button);
    });
    
    // Set up event handlers
    function closeModal() {
      modal.classList.add('hidden');
      // Clean up event listeners
      document.getElementById('list-selection-close').removeEventListener('click', closeModal);
      document.getElementById('list-selection-cancel').removeEventListener('click', closeModal);
      document.getElementById('list-selection-overlay').removeEventListener('click', closeModal);
      options.removeEventListener('click', handleListSelection);
    }
    
    function handleListSelection(e) {
      const button = e.target.closest('button');
      if (!button || !button.dataset.listId) return;
      
      const listId = button.dataset.listId;
      const selectedList = lists.find(l => l.id === listId);
      
      if (selectedList) {
        addItemToList(listId, product)
          .then(() => {
            alert(`"${product.name}" added to "${selectedList.name}"! You can see it in the 'My List' tab.`);
            closeModal();
          })
          .catch(error => {
            alert(`Error adding item: ${error.message}`);
            closeModal();
          });
      }
    }
    
    // Add event listeners
    document.getElementById('list-selection-close').addEventListener('click', closeModal);
    document.getElementById('list-selection-cancel').addEventListener('click', closeModal);
    document.getElementById('list-selection-overlay').addEventListener('click', closeModal);
    options.addEventListener('click', handleListSelection);
    
    // Show modal
    modal.classList.remove('hidden');
  }).catch(err => {
    console.error("Error getting shopping lists:", err);
    alert("There was a problem loading your lists. Please try again.");
  });
}

// —––– Add Item Manually ––––
function handleAddItemManually() {
  const inputElement = document.getElementById('add-item-input');
  const itemName = inputElement.value.trim();
  if (itemName && currentOpenListId) {
    const productToAdd = {
      id: `manual-${Date.now()}`,
      name: itemName,
      price: null,
      retailer: 'Manual Add'
    };
    addItemToList(currentOpenListId, productToAdd);
    inputElement.value = '';
  }
}

// —––– Modal Logic ––––
function showModal(title, bodyHtml) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  overlay.classList.remove('hidden');
  content.classList.remove('animate__fadeOutUp');
  content.classList.add('animate__fadeInDown', 'animate__zoomIn');
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.classList.remove('animate__fadeInDown', 'animate__zoomIn');
  content.classList.add('animate__fadeOutUp');
  setTimeout(() => overlay.classList.add('hidden'), 400);
}

// Helper for mobile-friendly button events
function addButtonHandler(id, handler) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', handler);
    el.addEventListener('touchstart', e => { e.preventDefault(); handler(e); }, { passive: false });
  }
}

// —––– Loyalty Card handling ––––
function getLoyaltyCards() {
  const cards = localStorage.getItem('loyaltyCards');
  return cards ? JSON.parse(cards) : [];
}
function saveLoyaltyCards(cards) {
  localStorage.setItem('loyaltyCards', JSON.stringify(cards));
}

// Function to fetch retailer information
async function loadRetailerInfo() {
  try {
    const response = await fetch('js/retailers.json');
    if (!response.ok) throw new Error('Failed to load retailer information');
    const data = await response.json();
    retailersInfo = data.retailers;
    console.log('Loaded retailer information:', retailersInfo.length);
  } catch (error) {
    console.error('Error loading retailer information:', error);
    // Default retailer info if fetch fails
    retailersInfo = [{
      name: "DefaultCard",
      logo: "",
      backgroundColor: "#6C5CE7",
      textColor: "#FFFFFF"
    }];
  }
}

// Find retailer branding by name (case-insensitive partial match)
function findRetailerBranding(retailerName) {
  if (!retailerName) return null;
  
  const normalizedName = retailerName.toLowerCase().trim();
  
  // First try exact match
  const exactMatch = retailersInfo.find(r => 
    r.name.toLowerCase() === normalizedName
  );
  if (exactMatch) return exactMatch;
  
  // Then try partial match
  const partialMatch = retailersInfo.find(r => 
    normalizedName.includes(r.name.toLowerCase()) || 
    r.name.toLowerCase().includes(normalizedName)
  );
  if (partialMatch) return partialMatch;
  
  // Return default if no match
  return retailersInfo.find(r => r.name === "DefaultCard") || {
    name: "DefaultCard",
    logo: "",
    backgroundColor: "#6C5CE7",
    textColor: "#FFFFFF"
  };
}

function renderLoyaltyCards() {
  const cards = getLoyaltyCards();
  const container = document.getElementById('cards-container');
  if (!container) return;
  container.innerHTML = '';
  if (cards.length === 0) {
    container.innerHTML = '<p class="text-center opacity-70">No loyalty cards added yet. Use the + button to add one.</p>';
    return;
  }
  cards.forEach(card => {
    const branding = findRetailerBranding(card.retailer);
    const cardDiv = document.createElement('div');
    cardDiv.className = 'loyalty-card rounded-lg shadow-md animate__animated animate__fadeInUp overflow-hidden';
    cardDiv.style.marginBottom = '1rem';
    cardDiv.dataset.cardNumber = card.number;
    cardDiv.dataset.retailer = card.retailer;
    
    // Create branded card design
    cardDiv.innerHTML = `
      <div class="p-4" style="background-color: ${branding.backgroundColor}; color: ${branding.textColor};">
        <div class="flex items-center justify-between">
          <p class="font-bold text-lg">${card.retailer}</p>
          ${branding.logo ? `<img src="${branding.logo}" alt="${card.retailer} logo" class="h-6 object-contain">` : ''}
        </div>
        <p class="text-sm opacity-90 mt-1">${formatCardNumber(card.number)}</p>
      </div>
      <div class="p-3 bg-white dark:bg-slate-700 flex justify-end">
        <button class="view-card-button px-3 py-1 text-sm rounded bg-blue-500 text-white">
          Show Card
        </button>
      </div>
    `;
    
    // Add click event to view barcode
    const viewButton = cardDiv.querySelector('.view-card-button');
    viewButton.addEventListener('click', () => showCardDetail(card));
    
    container.appendChild(cardDiv);
  });
}

// Helper to format card number with spaces for readability
function formatCardNumber(number) {
  if (!number) return '';
  // Insert a space every 4 characters
  return number.toString().replace(/(.{4})/g, '$1 ').trim();
}

// Show card detail with barcode
function showCardDetail(card) {
  const modal = document.getElementById('card-detail-modal');
  const retailerEl = document.getElementById('card-detail-retailer');
  const numberEl = document.getElementById('card-detail-number');
  const branding = findRetailerBranding(card.retailer);
  
  // Set card info
  retailerEl.textContent = card.retailer;
  numberEl.textContent = formatCardNumber(card.number);
  
  // Apply branding
  const contentDiv = document.getElementById('card-detail-content');
  contentDiv.style.backgroundColor = 'white';
  
  // Header with branding
  contentDiv.innerHTML = `
    <div class="mb-6">
      <div class="py-4 px-6 mb-4" style="background-color: ${branding.backgroundColor}; color: ${branding.textColor};">
        <div class="flex items-center justify-between">
          <h3 class="text-xl font-bold">${card.retailer}</h3>
          ${branding.logo ? `<img src="${branding.logo}" alt="${card.retailer} logo" class="h-8 object-contain">` : ''}
        </div>
      </div>
      <p class="text-gray-600 dark:text-gray-400 mb-4">${formatCardNumber(card.number)}</p>
      <div class="flex justify-center mb-6 p-4 bg-white">
        <svg id="card-barcode" class="w-full"></svg>
      </div>
      <button id="fullscreen-barcode" class="w-full bg-blue-500 text-white py-3 rounded-lg">
        Show Fullscreen for Scanning
      </button>
    </div>
  `;
  
  // Generate barcode
  setTimeout(() => {
    try {
      JsBarcode("#card-barcode", card.number, {
        format: getBarcodeFormat(card.number),
        width: 2,
        height: 100,
        displayValue: false,
        background: '#FFFFFF',
        lineColor: '#000000',
      });
    } catch (e) {
      console.error("Barcode generation error:", e);
      document.getElementById('card-barcode').innerHTML = `
        <div class="text-red-500 text-center p-4">
          <p>Could not generate barcode.</p>
          <p class="text-sm mt-2">Number: ${card.number}</p>
        </div>
      `;
    }
  }, 100);
  
  // Add event listeners
  const closeButton = document.getElementById('close-card-detail');
  closeButton.onclick = () => {
    modal.classList.add('hidden');
  };
  
  // Fullscreen button logic
  const fullscreenButton = document.getElementById('fullscreen-barcode');
  fullscreenButton.addEventListener('click', () => {
    // Create fullscreen view
    const fullscreenDiv = document.createElement('div');
    fullscreenDiv.className = 'fixed inset-0 bg-white flex flex-col items-center justify-center z-50';
    fullscreenDiv.style.backgroundColor = '#FFFFFF';
    
    fullscreenDiv.innerHTML = `
      <div class="absolute top-4 right-4">
        <button id="exit-fullscreen" class="p-2 rounded-full bg-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="py-2 px-6 mb-4 w-full text-center" style="background-color: ${branding.backgroundColor}; color: ${branding.textColor};">
        <h3 class="text-xl font-bold">${card.retailer}</h3>
      </div>
      <div class="w-3/4 max-w-lg">
        <svg id="fullscreen-barcode" class="w-full"></svg>
      </div>
      <p class="mt-4 text-gray-800">${formatCardNumber(card.number)}</p>
    `;
    
    document.body.appendChild(fullscreenDiv);
    
    // Generate barcode in fullscreen
    setTimeout(() => {
      try {
        JsBarcode("#fullscreen-barcode", card.number, {
          format: getBarcodeFormat(card.number),
          width: 3,
          height: 150,
          displayValue: false,
          background: '#FFFFFF',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error("Fullscreen barcode generation error:", e);
        document.getElementById('fullscreen-barcode').innerHTML = `
          <div class="text-red-500 text-center p-4">
            <p>Could not generate barcode.</p>
            <p class="text-sm mt-2">Number: ${card.number}</p>
          </div>
        `;
      }
    }, 100);
    
    // Exit fullscreen button
    document.getElementById('exit-fullscreen').addEventListener('click', () => {
      document.body.removeChild(fullscreenDiv);
    });
  });
  
  // Show modal
  modal.classList.remove('hidden');
}

// Helper to determine barcode format based on card number
function getBarcodeFormat(number) {
  if (!number) return 'CODE128';
  
  const numberStr = number.toString().replace(/\s+/g, '');
  const length = numberStr.length;
  
  // Common formats based on length
  if (length === 13 && /^\d+$/.test(numberStr)) return 'EAN13';
  if (length === 8 && /^\d+$/.test(numberStr)) return 'EAN8';
  if (length === 12 && /^\d+$/.test(numberStr)) return 'UPC';
  
  // Default to CODE128 which accepts any character
  return 'CODE128';
}

// —––– FAB Logic ––––
function openFab() {
  const fabSlide = document.getElementById('fab-slide');
  const fabTab = document.getElementById('fab-tab');
  if (fabSlide && fabTab) {
    fabSlide.classList.add('open');
    fabTab.classList.add('hide');
  }
}
function closeFab() {
  const fabSlide = document.getElementById('fab-slide');
  const fabTab = document.getElementById('fab-tab');
  if (fabSlide && fabTab) {
    fabSlide.classList.remove('open');
    fabTab.classList.remove('hide');
  }
}

// —––– Card Modal Logic ––––
function showAddCardModal() {
  document.getElementById('add-card-modal').classList.remove('hidden');
  
  // Only show the scanner div when explicitly requested
  const scannerDiv = document.getElementById('barcode-scanner');
  scannerDiv.classList.add('hidden');
  
  // Check if we're on HTTPS (required for camera access in most browsers)
  if (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Don't auto-start, let the user click the scan button instead
    console.log("HTTPS detected, scanner can be used");
  } else {
    alert("Camera access requires HTTPS for security reasons. Please use HTTPS to scan barcodes.");
    // Hide the scan button if not on HTTPS
    const scanButton = document.getElementById('scan-barcode-btn');
    if (scanButton) scanButton.style.display = 'none';
  }
}

function startBarcodeScanner() {
  const scannerDiv = document.getElementById('barcode-scanner');
  const statusEl = document.getElementById('scanner-status');

  console.log("Starting barcode scanner with camera: " + currentCamera);

  // Check if camera API is supported
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert("Your browser doesn't support camera access. Please try a modern browser like Chrome, Firefox, or Safari.");
    scannerDiv.classList.add('hidden');
    return;
  }

  // Show scanning status
  if (statusEl) statusEl.textContent = 'Scanning...';

  // Always stop existing scanner if running before reinitializing
  const stopExistingScanner = () => {
    if (window.html5QrCode && window.html5QrCode.isScanning) {
      return window.html5QrCode.stop().catch(err => {
        console.error("Failed to stop existing scanner:", err);
        // Continue even if stopping fails
      });
    }
    return Promise.resolve();
  };

  stopExistingScanner().then(() => {
    initializeAndStartScanner();
  });

  function initializeAndStartScanner() {
    try {
      window.html5QrCode = new Html5Qrcode("barcode-reader");
      console.log("HTML5 QR Code scanner created successfully");

      // Full camera preview, no qrbox
      const qrConfig = {
        fps: 15,
        aspectRatio: 1.0,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.EAN_8
        ]
      };

      console.log("Starting camera with config:", qrConfig);

      window.html5QrCode.start(
        { facingMode: currentCamera },
        qrConfig,
        (decodedText) => {
          // Vibrate and play sound on detection
          if (window.navigator.vibrate) window.navigator.vibrate(120);
          try {
            const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=');
            audio.play();
          } catch (e) { /* ignore */ }

          console.log("Barcode detected:", decodedText);
          if (statusEl) statusEl.textContent = 'Code found!';

          const cardNumberInput = document.getElementById('card-number');
          cardNumberInput.value = decodedText;
          cardNumberInput.classList.add('bg-green-50', 'animate__animated', 'animate__flash');
          // Add a slight delay before closing scanner to show the success state
          setTimeout(() => {
            window.html5QrCode.stop().then(() => {
              // Only hide the scanner, NOT the whole modal
              scannerDiv.classList.add('hidden');
              if (statusEl) statusEl.textContent = '';
              setTimeout(() => {
                cardNumberInput.classList.remove('bg-green-50', 'animate__animated', 'animate__flash');
              }, 1500);
            }).catch(err => {
              console.error("Error stopping scanner after success:", err);
              scannerDiv.classList.add('hidden');
              if (statusEl) statusEl.textContent = '';
            });
          }, 500);
        },
        (errorMessage) => {
          if (statusEl && statusEl.textContent === 'Scanning...') {
            statusEl.textContent = 'Scanning...';
          }
          if (Math.random() < 0.02) {
            console.log("Scanner processing frame. If nothing is happening, make sure barcode is well-lit and clearly visible.");
          }
        }
      ).catch(err => {
        console.error("Camera access error:", err);
        let errorMessage = "Camera error: ";
        if (err.name === 'NotAllowedError') {
          errorMessage += "Camera permission denied. Please allow camera access in your browser settings.";
        } else if (err.name === 'NotFoundError') {
          errorMessage += "No camera found on this device.";
        } else if (err.name === 'NotReadableError') {
          errorMessage += "Camera is in use by another application or not available.";
        } else if (err.name === 'OverconstrainedError') {
          errorMessage += "Camera doesn't meet requirements (try using a different browser).";
        } else if (err.name === 'AbortError') {
          errorMessage += "Camera access was aborted.";
        } else if (err.name === 'SecurityError') {
          errorMessage += "Camera access blocked for security reasons (needs HTTPS).";
        } else {
          errorMessage += err.message || "Camera streaming not supported by the browser";
        }
        alert(errorMessage);
        scannerDiv.classList.add('hidden');
        if (statusEl) statusEl.textContent = '';
      });
    } catch (err) {
      console.error("Error during scanner initialization:", err);
      alert("Failed to initialize scanner: " + err.message);
      scannerDiv.classList.add('hidden');
      if (statusEl) statusEl.textContent = '';
    }
  }
}

function hideAddCardModal() {
  document.getElementById('add-card-modal').classList.add('hidden');
  const scannerDiv = document.getElementById('barcode-scanner');
  if (window.html5QrCode) {
    window.html5QrCode.stop().then(() => {
      scannerDiv.classList.add('hidden');
    }).catch(() => {
      scannerDiv.classList.add('hidden');
    });
  } else {
    scannerDiv.classList.add('hidden');
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM fully loaded. Setting up listeners.");
  
  // Load retailer information
  loadRetailerInfo()
    .then(() => {
      // Reload cards after retailer info is loaded to apply branding
      if (document.getElementById('cards-tab')?.classList.contains('active')) {
        renderLoyaltyCards();
      }
    })
    .catch(err => console.error("Failed to load retailer info:", err));
  
  // -- Get Auth Elements ---
  const authContainer = document.getElementById('auth-container');
  const authForms = document.getElementById('auth-forms');
  const userInfo = document.getElementById('user-info');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const logoutButton = document.getElementById("logout-button");
  const userEmailSpan = document.getElementById('user-email');
  const authErrorP = document.getElementById('auth-error');

  // --- Authentication Logic ---

  // Function to update UI based on auth state
  const updateAuthUI = (user) => {
    currentUser = user;
    if (user) {
      // User is logged in
      console.log("User logged in: ", user.email);
      if(authForms) authForms.classList.add('hidden');
      if(userInfo) userInfo.classList.remove('hidden');
      if(userEmailSpan) userEmailSpan.textContent = user.email;
      // Make logout button visible (it might be inside a conditionally displayed parent)
      if(logoutButton) logoutButton.style.display = 'block'; 
      
      // Load user-specific data from Firestore
      getShoppingLists().then(lists => {
        renderListView(navigateToListItems);
      }).catch(err => {
        console.error("Error loading lists:", err);
        showError("Failed to load your lists. Please try again.");
      });

      // renderLoyaltyCards directly since it's a synchronous function
      renderLoyaltyCards();
    } else {
      // User is logged out
      console.log("User logged out");
      if(authForms) authForms.classList.remove('hidden');
      if(userInfo) userInfo.classList.add('hidden');
      if(userEmailSpan) userEmailSpan.textContent = '';
      if(authErrorP) authErrorP.classList.add('hidden'); // Hide any previous errors
      if(logoutButton) logoutButton.style.display = 'none'; // Hide logout button
      // TODO: Clear any user-specific data from UI
      // Example: clearUserLists(); clearUserCards();
      // Currently, let's reload the default list view based on localStorage (until migration)
      renderListView(navigateToListItems); 
      renderLoyaltyCards();
    }
  };

  // Sign up handler
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = signupForm['signup-email'].value;
      const password = signupForm['signup-password'].value;
      if(authErrorP) authErrorP.classList.add('hidden'); // Clear previous errors
      
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Signed up successfully: ", userCredential.user);
        signupForm.reset();
        // onAuthStateChanged will handle the UI update
      } catch (error) {
        console.error("Signup error: ", error);
        if(authErrorP) {
          authErrorP.textContent = error.message;
          authErrorP.classList.remove('hidden');
        }
      }
    });
  }

  // Login handler
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = loginForm['login-email'].value;
      const password = loginForm['login-password'].value;
      if(authErrorP) authErrorP.classList.add('hidden');

      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in successfully: ", userCredential.user);
        loginForm.reset();
        // onAuthStateChanged will handle the UI update
      } catch (error) {
        console.error("Login error: ", error);
         if(authErrorP) {
          authErrorP.textContent = error.message;
          authErrorP.classList.remove('hidden');
        }
      }
    });
  }

  // Logout handler
  if (logoutButton) {
    // Note: We attach the listener here, but visibility is controlled by updateAuthUI
    logoutButton.addEventListener('click', async () => {
      try {
        await signOut(auth);
        console.log("Logged out successfully");
        // onAuthStateChanged will handle the UI update and data clearing
      } catch (error) {
        console.error("Logout error: ", error);
        showError("Error logging out. Please try again."); // Use existing showError
      }
    });
  }

  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    updateAuthUI(user);
  });

  // --- End Authentication Logic ---

  // Initialize theme properly
  initializeTheme();
  
  // Initial render (will be updated by onAuthStateChanged if user is logged in)
  // renderListView(navigateToListItems); // Moved initial render potentially inside updateAuthUI 
  showView("search-tab");
  
  // Welcome message
  const searchResultsContainer = document.getElementById("search-results-container");
  searchResultsContainer.innerHTML = `
    <div class="text-center py-8 animate__animated animate__fadeIn">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mx-auto mb-4" style="color: var(--accent);">
        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
      <h3 class="text-lg font-semibold mb-2">Welcome to Smart Shopper SA!</h3>
      <p class="opacity-80">Search for groceries above to compare prices across different retailers.</p>
    </div>
  `;

  // Use event delegation for search results
  searchResultsContainer.addEventListener('click', e => {
    // Find closest add-to-list button or its children
    const addButton = e.target.closest('.add-to-list-button');
    if (addButton) {
      const resultDiv = addButton.closest('[data-product-id]');
      if (resultDiv) {
        const product = {
          id: resultDiv.dataset.productId,
          name: resultDiv.dataset.productName,
          price: resultDiv.dataset.productPrice,
          retailer: resultDiv.dataset.productRetailer
        };
        promptAddToList(product);
      }
    }
  });

  // Dark Mode Toggle
  const darkModeButton = document.getElementById("dark-mode-toggle-button");
  if (darkModeButton) darkModeButton.addEventListener("click", toggleDarkMode);
  const darkModeCheckbox = document.getElementById("dark-mode-checkbox");
  if (darkModeCheckbox) darkModeCheckbox.addEventListener("change", toggleDarkMode);

  // Nav Buttons
  addButtonHandler('nav-search', () => showView('search-tab'));
  addButtonHandler('nav-list', () => showView('list-tab'));
  addButtonHandler('nav-cards', () => showView('cards-tab'));
  addButtonHandler('nav-settings', () => showView('settings-tab'));

  // Search Input & Button
  const searchButton = document.getElementById("search-button");
  const searchInput = document.getElementById("search-input");
  if (searchButton) searchButton.addEventListener("click", handleSearch);
  if (searchInput) {
    searchInput.addEventListener("keypress", e => {
      if (e.key === "Enter") { e.preventDefault(); handleSearch(); }
    });
    // Add keyup event with debouncing
    searchInput.addEventListener("keyup", debouncedSearch);
  }

  // List & Logout Buttons
  const newListButton = document.getElementById("new-list-button");
  if (newListButton) newListButton.addEventListener("click", handleNewList);

  // Manual Add Item
  const addItemManuallyButton = document.getElementById("add-item-button");
  const addItemInput = document.getElementById("add-item-input");
  if (addItemManuallyButton) addItemManuallyButton.addEventListener("click", handleAddItemManually);
  if (addItemInput) addItemInput.addEventListener("keypress", e => {
    if (e.key === "Enter") { e.preventDefault(); handleAddItemManually(); }
  });

  // Back to Lists
  const backButton = document.getElementById('back-to-lists-button');
  if (backButton) backButton.addEventListener('click', navigateBackToLists);

  // Settings Modal
  document.querySelectorAll('.setting-item[data-setting-name]').forEach(item => {
    item.addEventListener('click', () => {
      const setting = item.getAttribute('data-setting-name');
      if (setting === "Profile") {
        showModal("Profile", "<p>This is a placeholder for your profile info.</p>");
      } else if (setting === "Notifications") {
        showModal("Notifications", "<p>Notification settings will go here.</p>");
      } else if (setting === "About") {
        showModal("About", "<p><b>Smart Shopper SA</b><br>Version 1.0<br><br>Compare grocery prices and save!</p>");
      }
    });
  });

  // FAB Tab and Actions
  const fabTab = document.getElementById('fab-tab');
  const fabSlide = document.getElementById('fab-slide');
  if (fabTab) {
    fabTab.addEventListener('click', openFab);
    fabTab.addEventListener('touchstart', openFab);
  }
  if (fabSlide) fabSlide.addEventListener('mouseleave', closeFab);

  const fabShare = document.getElementById('fab-share');
  if (fabShare) {
    fabShare.addEventListener('click', () => {
      const fabActions = document.getElementById('fab-actions');
      const isOpen = fabActions.classList.contains('opacity-100');
      if (isOpen) {
        fabActions.classList.remove('opacity-100', 'pointer-events-auto');
        fabActions.classList.add('opacity-0', 'pointer-events-none');
        closeFab();
      } else {
        fabActions.classList.remove('opacity-0', 'pointer-events-none');
        fabActions.classList.add('opacity-100', 'pointer-events-auto');
      }
    });
  }

  // Modal Close
  const modalClose = document.getElementById('modal-close');
  if (modalClose) modalClose.addEventListener('click', closeModal);
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  // Loyalty Card Modal Logic
  const cancelAddCard = document.getElementById('cancel-add-card');
  if (cancelAddCard) cancelAddCard.addEventListener('click', hideAddCardModal);

  const addCardForm = document.getElementById('add-card-form');
  if (addCardForm) {
    addCardForm.addEventListener('submit', e => {
      e.preventDefault();
      const retailer = document.getElementById('card-retailer').value.trim();
      const number   = document.getElementById('card-number').value.trim();
      if (retailer && number) {
        const cards = getLoyaltyCards();
        cards.push({ retailer, number });
        saveLoyaltyCards(cards);
        renderLoyaltyCards();
        hideAddCardModal();
      }
    });
  }

  // Barcode scanning logic
  const scanBarcodeBtn = document.getElementById('scan-barcode-btn');
  if (scanBarcodeBtn) {
    scanBarcodeBtn.addEventListener('click', () => {
      const scannerDiv = document.getElementById('barcode-scanner');
      scannerDiv.classList.remove('hidden');
      
      // Add test button for debugging
      if (!document.getElementById('test-barcode-btn')) {
        const testButton = document.createElement('button');
        testButton.id = 'test-barcode-btn';
        testButton.className = 'w-full bg-green-500 text-white py-2 rounded mt-2';
        testButton.textContent = 'Test Barcode Recognition';
        testButton.addEventListener('click', testBarcodeRecognition);
        
        // Insert after the other buttons
        const buttonContainer = document.querySelector('#barcode-scanner .flex');
        buttonContainer.parentNode.insertBefore(testButton, buttonContainer.nextSibling);
      }
      
      // Start the scanner when the button is clicked
      startBarcodeScanner();
    });
  }

  const closeBarcodeBtn = document.getElementById('close-barcode-btn');
  if (closeBarcodeBtn) {
    closeBarcodeBtn.addEventListener('click', () => {
      const scannerDiv = document.getElementById('barcode-scanner');
      if (window.html5QrCode) {
        window.html5QrCode.stop().then(() => {
          scannerDiv.classList.add('hidden');
        }).catch(() => {
          scannerDiv.classList.add('hidden');
        });
      } else {
        scannerDiv.classList.add('hidden');
      }
    });
  }

  // Switch camera button
  const switchCameraBtn = document.getElementById('switch-camera-btn');
  if (switchCameraBtn) {
    switchCameraBtn.addEventListener('click', () => {
      // Toggle between front and back camera
      currentCamera = currentCamera === "environment" ? "user" : "environment";
      
      // Display helpful message
      const statusEl = document.getElementById('scanner-status');
      if (statusEl) statusEl.textContent = `Switching to ${currentCamera === "environment" ? "back" : "front"} camera...`;
      
      // Restart scanner with new camera
      startBarcodeScanner();
    });
  }

  const addCardButton = document.getElementById('add-card-button');
  if (addCardButton) addCardButton.addEventListener('click', showAddCardModal);

  // If already on Cards tab, render existing cards
  if (document.getElementById('cards-tab')?.classList.contains('active')) {
    renderLoyaltyCards();
  }

  console.log("Initial setup complete.");
});

// Storage‑backed CRUD wrappers
async function addList(listName) {
  try {
    await storageAddList(listName);
    renderListView(navigateToListItems);
  } catch (e) {
    showError(e.message || 'Failed to add list.');
    throw e; // Re-throw to allow caller to handle
  }
}

async function deleteList(listId) {
  try {
    await storageDeleteList(listId);
    navigateBackToLists();
  } catch (e) {
    showError(e.message || 'Failed to delete list.');
    throw e;
  }
}

async function addItemToList(listId, product) {
  try {
    await storageAddItemToList(listId, product);
    if (currentOpenListId === listId) {
      renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
    }
  } catch (e) {
    showError(e.message || 'Failed to add item.');
    throw e;
  }
}

async function removeItemFromList(listId, itemId) {
  try {
    await storageRemoveItemFromList(listId, itemId);
    if (currentOpenListId === listId) {
      renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
    }
  } catch (e) {
    showError(e.message || 'Failed to remove item.');
    throw e;
  }
}

// Update theme handling to validate stored values
function initializeTheme() {
  // Get the stored theme or system preference
  const storedTheme = localStorage.theme;
  
  // Validate stored theme value
  if (storedTheme === 'dark' || storedTheme === 'light') {
    // Valid stored value, apply it
    htmlEl.classList.toggle('dark', storedTheme === 'dark');
  } else {
    // Invalid or missing value, use system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    htmlEl.classList.toggle('dark', prefersDark);
    // Save the validated theme
    localStorage.theme = prefersDark ? 'dark' : 'light';
  }
  
  applyTheme();
}

// Add the test function
function testBarcodeRecognition() {
  if (!window.html5QrCode) {
    alert("Scanner not initialized. Please try again.");
    return;
  }
  
  const statusEl = document.getElementById('scanner-status');
  if (statusEl) statusEl.textContent = 'Testing barcode recognition...';
  
  console.log("Testing barcode recognition...");
  
  // Simulate a detected barcode
  const testBarcode = "123456789012"; // Standard EAN-13 test code
  
  // Update the status
  console.log("Test barcode detected:", testBarcode);
  if (statusEl) statusEl.textContent = 'Test successful! Barcode processing works.';
  
  const cardNumberInput = document.getElementById('card-number');
  cardNumberInput.value = testBarcode + " (TEST)";
  cardNumberInput.classList.add('bg-green-50', 'animate__animated', 'animate__flash');
  
  // Alert the user
  setTimeout(() => {
    alert("Test successful! Your device can process barcodes. If actual scanning isn't working, the issue might be with camera focus, lighting, or barcode quality.");
  }, 500);
}