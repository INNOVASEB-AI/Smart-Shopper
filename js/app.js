// app.js

import {
  getShoppingLists,
  addList as storageAddList,
  deleteList as storageDeleteList,
  addItemToList as storageAddItemToList,
  removeItemFromList as storageRemoveItemFromList,
  forceRefreshCache,
  migrateAnonymousListsToUser
} from './storage.js';

// Import storage module for direct access
import * as storage from './storage.js';

import { showError } from './ui.js';
import { renderListView, renderListItemsView } from './listUI.js';
import { groceryIcons } from './illustrations.js';
import LocationUI from './locationUI.js';

// Import security utilities
import { 
  sanitizeInput, 
  validateSearchTerm, 
  isValidEmail, 
  validatePassword, 
  rateLimiter 
} from './security.js';

// Import Firebase services and auth functions
import { 
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence,
  browserLocalPersistence
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

// List view mode state
let isAdding = false;

// Global Scanner Instance
window.html5QrCode = null;

// Global error handler for unhandled errors
window.addEventListener('error', e => {
	console.error('JS Error:', e.error);
	// Prevent error from breaking the app
	e.preventDefault();
});

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

// Price comparison state
let currentComparisonData = null;
let isComparingPrices = false;

// Navigation state tracking
let navigationHistory = [];
let currentView = 'list-tab';

// Location services
let locationUI = null;
let selectedStore = null;

// Popular grocery items for quick-add functionality
const popularGroceryItems = [
  // Bakery
  { name: 'bread', icon: groceryIcons.bread },
  { name: 'bagels', icon: groceryIcons.bread },
  { name: 'rolls', icon: groceryIcons.bread },
  { name: 'buns', icon: groceryIcons.bread },
  { name: 'pita bread', icon: groceryIcons.bread },
  { name: 'tortillas', icon: groceryIcons.bread },
  { name: 'croissants', icon: groceryIcons.bread },
  { name: 'muffins', icon: groceryIcons.bread },
  { name: 'cake', icon: groceryIcons.bread },
  { name: 'cookies', icon: groceryIcons.bread },
  { name: 'donuts', icon: groceryIcons.bread },
  { name: 'cereal', icon: groceryIcons.bread },
  { name: 'crackers', icon: groceryIcons.bread },
  
  // Dairy
  { name: 'milk', icon: groceryIcons.milk },
  { name: 'butter', icon: groceryIcons.butter },
  { name: 'cheese', icon: groceryIcons.cheese },
  { name: 'cream cheese', icon: groceryIcons.cheese },
  { name: 'sour cream', icon: groceryIcons.milk },
  { name: 'yogurt', icon: groceryIcons.milk },
  { name: 'cottage cheese', icon: groceryIcons.cheese },
  { name: 'ice cream', icon: groceryIcons.milk },
  { name: 'whipped cream', icon: groceryIcons.milk },
  { name: 'cream', icon: groceryIcons.milk },
  { name: 'half and half', icon: groceryIcons.milk },
  { name: 'almond milk', icon: groceryIcons.milk },
  { name: 'soy milk', icon: groceryIcons.milk },
  { name: 'oat milk', icon: groceryIcons.milk },
  { name: 'custard', icon: groceryIcons.milk },

  // Protein
  { name: 'eggs', icon: groceryIcons.eggs },
  { name: 'ham', icon: groceryIcons.meat },
  { name: 'bacon', icon: groceryIcons.meat },
  { name: 'sausage', icon: groceryIcons.meat },
  { name: 'ground beef', icon: groceryIcons.meat },
  { name: 'steak', icon: groceryIcons.meat },
  { name: 'chicken', icon: groceryIcons.meat },
  { name: 'chicken breast', icon: groceryIcons.meat },
  { name: 'chicken thighs', icon: groceryIcons.meat },
  { name: 'chicken wings', icon: groceryIcons.meat },
  { name: 'ground chicken', icon: groceryIcons.meat },
  { name: 'turkey', icon: groceryIcons.meat },
  { name: 'fish', icon: groceryIcons.meat },
  { name: 'salmon', icon: groceryIcons.meat },
  { name: 'tuna', icon: groceryIcons.meat },
  { name: 'shrimp', icon: groceryIcons.meat },
  { name: 'pork chops', icon: groceryIcons.meat },
  { name: 'pork ribs', icon: groceryIcons.meat },
  { name: 'lamb', icon: groceryIcons.meat },
  { name: 'tofu', icon: groceryIcons.meat },
  { name: 'beef mince', icon: groceryIcons.meat },
  { name: 'boerewors', icon: groceryIcons.meat },
  { name: 'biltong', icon: groceryIcons.meat },
  { name: 'droëwors', icon: groceryIcons.meat },

  // Fruits
  { name: 'apples', icon: groceryIcons.fruits },
  { name: 'bananas', icon: groceryIcons.fruits },
  { name: 'oranges', icon: groceryIcons.fruits },
  { name: 'grapes', icon: groceryIcons.fruits },
  { name: 'lemons', icon: groceryIcons.fruits },
  { name: 'limes', icon: groceryIcons.fruits },
  { name: 'strawberries', icon: groceryIcons.fruits },
  { name: 'blueberries', icon: groceryIcons.fruits },
  { name: 'raspberries', icon: groceryIcons.fruits },
  { name: 'blackberries', icon: groceryIcons.fruits },
  { name: 'pineapple', icon: groceryIcons.fruits },
  { name: 'watermelon', icon: groceryIcons.fruits },
  { name: 'cantaloupe', icon: groceryIcons.fruits },
  { name: 'honeydew', icon: groceryIcons.fruits },
  { name: 'peaches', icon: groceryIcons.fruits },
  { name: 'plums', icon: groceryIcons.fruits },
  { name: 'pears', icon: groceryIcons.fruits },
  { name: 'cherries', icon: groceryIcons.fruits },
  { name: 'kiwi', icon: groceryIcons.fruits },
  { name: 'avocado', icon: groceryIcons.fruits },
  { name: 'mango', icon: groceryIcons.fruits },
  { name: 'nectarines', icon: groceryIcons.fruits },
  { name: 'passion fruit', icon: groceryIcons.fruits },
  { name: 'guava', icon: groceryIcons.fruits },
  { name: 'granadilla', icon: groceryIcons.fruits },
  { name: 'litchi', icon: groceryIcons.fruits },

  // Vegetables
  { name: 'potatoes', icon: groceryIcons.potatoes },
  { name: 'onions', icon: groceryIcons.vegetables },
  { name: 'garlic', icon: groceryIcons.vegetables },
  { name: 'tomatoes', icon: groceryIcons.vegetables },
  { name: 'lettuce', icon: groceryIcons.vegetables },
  { name: 'carrots', icon: groceryIcons.vegetables },
  { name: 'broccoli', icon: groceryIcons.vegetables },
  { name: 'cauliflower', icon: groceryIcons.vegetables },
  { name: 'bell peppers', icon: groceryIcons.vegetables },
  { name: 'chili peppers', icon: groceryIcons.vegetables },
  { name: 'cabbage', icon: groceryIcons.vegetables },
  { name: 'spinach', icon: groceryIcons.vegetables },
  { name: 'kale', icon: groceryIcons.vegetables },
  { name: 'green beans', icon: groceryIcons.vegetables },
  { name: 'peas', icon: groceryIcons.vegetables },
  { name: 'corn', icon: groceryIcons.vegetables },
  { name: 'cucumber', icon: groceryIcons.vegetables },
  { name: 'zucchini', icon: groceryIcons.vegetables },
  { name: 'sweet potatoes', icon: groceryIcons.potatoes },
  { name: 'butternut', icon: groceryIcons.vegetables },
  { name: 'pumpkin', icon: groceryIcons.vegetables },
  { name: 'asparagus', icon: groceryIcons.vegetables },
  { name: 'mushrooms', icon: groceryIcons.vegetables },
  { name: 'ginger', icon: groceryIcons.vegetables },
  { name: 'beetroot', icon: groceryIcons.vegetables },
  { name: 'celery', icon: groceryIcons.vegetables },
  { name: 'leeks', icon: groceryIcons.vegetables },
  { name: 'spring onions', icon: groceryIcons.vegetables },
  { name: 'eggplant', icon: groceryIcons.vegetables },
  { name: 'gem squash', icon: groceryIcons.vegetables },
  { name: 'mielies', icon: groceryIcons.vegetables },

  // Pantry Staples
  { name: 'rice', icon: groceryIcons.rice },
  { name: 'pasta', icon: groceryIcons.rice },
  { name: 'flour', icon: groceryIcons.rice },
  { name: 'sugar', icon: groceryIcons.rice },
  { name: 'brown sugar', icon: groceryIcons.rice },
  { name: 'salt', icon: groceryIcons.potatoes },
  { name: 'pepper', icon: groceryIcons.potatoes },
  { name: 'cooking oil', icon: groceryIcons.butter },
  { name: 'olive oil', icon: groceryIcons.butter },
  { name: 'vegetable oil', icon: groceryIcons.butter },
  { name: 'vinegar', icon: groceryIcons.butter },
  { name: 'soy sauce', icon: groceryIcons.butter },
  { name: 'honey', icon: groceryIcons.rice },
  { name: 'maple syrup', icon: groceryIcons.rice },
  { name: 'peanut butter', icon: groceryIcons.butter },
  { name: 'jam', icon: groceryIcons.butter },
  { name: 'canned beans', icon: groceryIcons.rice },
  { name: 'canned tomatoes', icon: groceryIcons.rice },
  { name: 'canned tuna', icon: groceryIcons.rice },
  { name: 'canned soup', icon: groceryIcons.rice },
  { name: 'tomato sauce', icon: groceryIcons.rice },
  { name: 'pasta sauce', icon: groceryIcons.rice },
  { name: 'ketchup', icon: groceryIcons.butter },
  { name: 'mustard', icon: groceryIcons.butter },
  { name: 'mayonnaise', icon: groceryIcons.butter },
  { name: 'baking powder', icon: groceryIcons.rice },
  { name: 'baking soda', icon: groceryIcons.rice },
  { name: 'yeast', icon: groceryIcons.rice },
  { name: 'cornstarch', icon: groceryIcons.rice },
  { name: 'beef stock', icon: groceryIcons.rice },
  { name: 'chicken stock', icon: groceryIcons.rice },
  { name: 'maize meal', icon: groceryIcons.rice },
  { name: 'marmite', icon: groceryIcons.butter },

  // Spices & Herbs
  { name: 'cinnamon', icon: groceryIcons.potatoes },
  { name: 'basil', icon: groceryIcons.potatoes },
  { name: 'oregano', icon: groceryIcons.potatoes },
  { name: 'thyme', icon: groceryIcons.potatoes },
  { name: 'rosemary', icon: groceryIcons.potatoes },
  { name: 'cumin', icon: groceryIcons.potatoes },
  { name: 'paprika', icon: groceryIcons.potatoes },
  { name: 'curry powder', icon: groceryIcons.potatoes },
  { name: 'chili powder', icon: groceryIcons.potatoes },
  { name: 'garlic powder', icon: groceryIcons.potatoes },
  { name: 'onion powder', icon: groceryIcons.potatoes },
  { name: 'bay leaves', icon: groceryIcons.potatoes },
  { name: 'nutmeg', icon: groceryIcons.potatoes },
  { name: 'turmeric', icon: groceryIcons.potatoes },
  { name: 'garam masala', icon: groceryIcons.potatoes },
  { name: 'all spice', icon: groceryIcons.potatoes },
  { name: 'vanilla extract', icon: groceryIcons.potatoes },
  { name: 'bbq spice', icon: groceryIcons.potatoes },
  { name: 'aromat', icon: groceryIcons.potatoes },

  // Beverages
  { name: 'coffee', icon: groceryIcons.rice },
  { name: 'tea', icon: groceryIcons.rice },
  { name: 'juice', icon: groceryIcons.fruits },
  { name: 'soda', icon: groceryIcons.butter },
  { name: 'bottled water', icon: groceryIcons.butter },
  { name: 'sparkling water', icon: groceryIcons.butter },
  { name: 'beer', icon: groceryIcons.butter },
  { name: 'wine', icon: groceryIcons.butter },
  { name: 'energy drinks', icon: groceryIcons.butter },
  { name: 'iced tea', icon: groceryIcons.rice },
  { name: 'hot chocolate', icon: groceryIcons.rice },
  { name: 'rooibos tea', icon: groceryIcons.rice },

  // Snacks
  { name: 'chocolate', icon: groceryIcons.bread },
  { name: 'chips', icon: groceryIcons.rice },
  { name: 'pretzels', icon: groceryIcons.bread },
  { name: 'popcorn', icon: groceryIcons.rice },
  { name: 'nuts', icon: groceryIcons.rice },
  { name: 'dried fruit', icon: groceryIcons.fruits },
  { name: 'granola bars', icon: groceryIcons.bread },
  { name: 'candy', icon: groceryIcons.bread },
  { name: 'gum', icon: groceryIcons.bread },
  { name: 'energy bars', icon: groceryIcons.bread },
  { name: 'trail mix', icon: groceryIcons.rice },
  { name: 'biltong', icon: groceryIcons.meat },
  { name: 'niknaks', icon: groceryIcons.rice },
  { name: 'doritos', icon: groceryIcons.rice },
  { name: 'simba chips', icon: groceryIcons.rice },

  // Frozen Foods
  { name: 'frozen pizza', icon: groceryIcons.bread },
  { name: 'frozen vegetables', icon: groceryIcons.vegetables },
  { name: 'frozen fruits', icon: groceryIcons.fruits },
  { name: 'frozen meals', icon: groceryIcons.rice },
  { name: 'ice cream', icon: groceryIcons.milk },
  { name: 'frozen waffles', icon: groceryIcons.bread },
  { name: 'frozen fish', icon: groceryIcons.meat },
  { name: 'frozen chicken', icon: groceryIcons.meat },
  { name: 'frozen fries', icon: groceryIcons.potatoes },
  { name: 'frozen pies', icon: groceryIcons.bread },

  // Household Items
  { name: 'soap', icon: groceryIcons.butter },
  { name: 'shampoo', icon: groceryIcons.butter },
  { name: 'conditioner', icon: groceryIcons.butter },
  { name: 'toilet paper', icon: groceryIcons.butter },
  { name: 'paper towels', icon: groceryIcons.butter },
  { name: 'laundry detergent', icon: groceryIcons.butter },
  { name: 'dish soap', icon: groceryIcons.butter },
  { name: 'trash bags', icon: groceryIcons.butter },
  { name: 'tissues', icon: groceryIcons.butter },
  { name: 'toothpaste', icon: groceryIcons.butter },
  { name: 'toothbrush', icon: groceryIcons.butter },
  { name: 'dental floss', icon: groceryIcons.butter },
  { name: 'mouthwash', icon: groceryIcons.butter },
  { name: 'deodorant', icon: groceryIcons.butter },
  { name: 'body wash', icon: groceryIcons.butter },
  { name: 'lotion', icon: groceryIcons.butter },
  { name: 'sunscreen', icon: groceryIcons.butter },
  { name: 'razor blades', icon: groceryIcons.butter },
  { name: 'band-aids', icon: groceryIcons.butter },
  { name: 'batteries', icon: groceryIcons.butter },
  { name: 'light bulbs', icon: groceryIcons.butter },
  { name: 'cleaning spray', icon: groceryIcons.butter },
  { name: 'bleach', icon: groceryIcons.butter },
  { name: 'dishwasher tablets', icon: groceryIcons.butter },
  { name: 'fabric softener', icon: groceryIcons.butter },
  { name: 'handy andy', icon: groceryIcons.butter },
  { name: 'jik', icon: groceryIcons.butter },
  { name: 'sunlight liquid', icon: groceryIcons.butter },
  { name: 'omo', icon: groceryIcons.butter },
  { name: 'mr muscle', icon: groceryIcons.butter },

  // Baby Products
  { name: 'diapers', icon: groceryIcons.butter },
  { name: 'baby wipes', icon: groceryIcons.butter },
  { name: 'baby food', icon: groceryIcons.rice },
  { name: 'baby formula', icon: groceryIcons.milk },
  { name: 'baby cereal', icon: groceryIcons.bread },
  { name: 'baby lotion', icon: groceryIcons.butter },

  // Pet Supplies
  { name: 'dog food', icon: groceryIcons.rice },
  { name: 'cat food', icon: groceryIcons.rice },
  { name: 'pet treats', icon: groceryIcons.bread },
  { name: 'cat litter', icon: groceryIcons.rice },
  { name: 'pet toys', icon: groceryIcons.butter },
  { name: 'pet shampoo', icon: groceryIcons.butter }
];

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
  
  // Update current view
  currentView = viewId;
  
  // Add or remove body class for list items view
  if (viewId === 'list-items-view') {
    document.body.classList.add('showing-list-items');
  } else {
    document.body.classList.remove('showing-list-items');
  }
  
  // First, handle all tab content elements
  document.querySelectorAll('.tab-content').forEach(view => {
    // Hide all tab content
    view.classList.remove('active');
    // Don't use style.display to avoid conflicts with Tailwind
    if (view.id !== viewId) {
      view.style.display = 'none';
    }
  });
  
  // Special handling for list-items-view which is not a normal tab
  if (viewId === 'list-items-view') {
    // Show list items view
    listItemsView.classList.remove('hidden');
    listItemsView.classList.add('animate__fadeIn');
    listItemsView.style.display = 'flex'; // Force display as flex
    
    // Hide navigation bar
    navElement.classList.add('hidden');
    navElement.style.display = 'none';
    console.log("Showing list items view, hiding nav");
  } else {
    // Hide list items view
    listItemsView.classList.add('hidden');
    listItemsView.classList.remove('animate__fadeIn', 'animate__fadeOut');
    listItemsView.style.display = 'none';
    
    // Show the target tab
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.classList.add('active');
      targetView.style.display = 'block';
      
      // Ensure navigation is visible for regular tabs
      navElement.classList.remove('hidden');
      navElement.style.display = 'flex';
      
      // Update active nav button
      document.querySelectorAll(".nav-button").forEach((button) => {
        button.classList.remove("active");
        if (button.getAttribute("data-tab") === viewId) {
          button.classList.add("active");
        }
      });
      
      // Set up event listeners for settings tab when it becomes visible
      if (viewId === 'settings-tab') {
        console.log('Settings tab shown, setting up event listeners');
        setupSettingsEventListeners();
      }
      
      console.log(`Showing tab: ${viewId}, nav visible`);
    } else {
      console.error("Target view not found:", viewId);
    }
  }

  // Show/hide FAB only on "list-tab"
  const fabContainer = document.querySelector('.fab-container');

  // Update back button visibility
  updateBackButtonVisibility();
  if (fabContainer) {
    if (viewId === 'list-tab') {
      fabContainer.style.display = '';
    } else {
      fabContainer.style.display = 'none';
      closeFab();
      const fabActions = document.getElementById('fab-actions');
      if (fabActions) {
        fabActions.classList.remove('opacity-100', 'pointer-events-auto');
        fabActions.classList.add('opacity-0', 'pointer-events-none');
      }
    }
  }
}

function navigateToListItems(listId) {
  console.log(`navigateToListItems called for listId: ${listId}`);
  currentOpenListId = listId;
  
  // Add to navigation history
  navigateToView('list-items-view', currentView);
  
  // Add body class for showing list items
  document.body.classList.add('showing-list-items');
  
  // Explicitly prepare the view before showing it
  listItemsView.classList.remove('hidden');
  listItemsView.style.display = 'flex';
  
  // Make sure we're not in add mode initially
  listItemsView.classList.remove('adding');
  
  // Get elements for the two modes
  const emptyListView = document.getElementById('empty-list-view');
  const addItemsView = document.getElementById('add-items-view');
  const listsContainer = document.getElementById('list-items-container');
  const addFab = document.getElementById('add-more-items-fab');
  
  // Hide both views initially
  emptyListView.classList.add('hidden');
  addItemsView.classList.add('hidden');
  addItemsView.classList.remove('shown');
  listsContainer.classList.add('hidden');
  if (addFab) addFab.classList.add('hidden');
  
  // Get the current list and check if it has items
  getShoppingLists().then(lists => {
    const currentList = lists.find(list => list.id === listId);
    
    if (!currentList || currentList.items.length === 0) {
      // Show empty state if no items
      console.log('Showing empty list view');
      emptyListView.classList.remove('hidden');
      isAdding = false;
      if (addFab) addFab.classList.add('hidden');
    } else {
      // Show the list items if there are items
      console.log('Showing list items');
      listsContainer.classList.remove('hidden');
      renderListItemsView(listId, removeItemFromList, deleteList, navigateBackToLists);
      isAdding = false;
      if (addFab) addFab.classList.remove('hidden');
    }
  }).catch(err => {
    console.error('Error getting shopping lists:', err);
    // Fall back to empty view on error
    emptyListView.classList.remove('hidden');
    if (addFab) addFab.classList.add('hidden');
  });
}

function navigateBackToLists() {
  console.log("navigateBackToLists called");
  
  // First exit add mode if we're in it
  if (document.getElementById('list-items-view').classList.contains('adding')) {
    exitAddMode();
  }
  
  // Reset state
  currentOpenListId = null;
  document.body.classList.remove('showing-list-items');
  
  // Ensure animations work properly
  const listItemsView = document.getElementById('list-items-view');
  listItemsView.classList.remove('animate__fadeIn');
  listItemsView.classList.add('animate__fadeOut');
  
  // Make sure nav becomes visible again
  const navElement = document.querySelector('nav');
  navElement.classList.remove('hidden');
  navElement.style.display = 'flex';
  
  // Use a shorter timeout to improve responsiveness
  setTimeout(() => {
    // Explicitly hide the list items view
    listItemsView.classList.add('hidden');
    listItemsView.classList.remove('animate__fadeOut');
    listItemsView.style.display = 'none';
    
    // Use the navigation system to go back
    goBack();
    renderListView(navigateToListItems);
  }, 200); // Reduced from 300ms for faster response
}

// —––––––– NOTE —–––––––
// The **local** definition of `renderListItemsView(…)` has been REMOVED here.
// We now rely solely on the import from listUI.js.
// —––––––––––––––––––––––

// —––– Modal Logic ––––
function showModal(title, bodyHtml) {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  
  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) modalBody.innerHTML = bodyHtml;
  
  overlay.classList.remove('hidden');
  
  // Set up close button
  const closeBtn = document.getElementById('modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('hidden');
}

// Placeholder Actions
function handleNewList() {
  console.log("handleNewList called (+ button clicked)");
  
  // Clear any existing event listeners
  const createBtn = document.getElementById('create-list-confirm');
  const cancelBtn = document.getElementById('create-list-cancel');
  const oldCreateBtn = createBtn.cloneNode(true);
  const oldCancelBtn = cancelBtn.cloneNode(true);
  
  if (createBtn.parentNode) {
    createBtn.parentNode.replaceChild(oldCreateBtn, createBtn);
  }
  
  if (cancelBtn.parentNode) {
    cancelBtn.parentNode.replaceChild(oldCancelBtn, cancelBtn);
  }
  
  // Simply show the modal
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  
  // Get input element
  const input = document.getElementById('new-list-name');
  
  // Clear any existing value
  if (input) {
    input.value = '';
    
    // Focus the input field immediately to show keyboard
    input.focus();
    
    // On mobile browsers, sometimes a single focus call isn't enough
    // Using multiple techniques to ensure keyboard appears
    input.click();
    
    // Also use the selection approach which often triggers keyboard
    input.setSelectionRange(0, 0);
    
    // Mobile iOS requires user interaction - attempting additional focus after animation
    setTimeout(() => {
      input.focus();
      input.click();
    }, 50);
    
    // Final attempt after a slightly longer delay
    setTimeout(() => {
      input.focus();
    }, 300);
  }
  
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
  
  // Set up event listeners
  document.getElementById('create-list-confirm').addEventListener('click', handleCreate);
  document.getElementById('create-list-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  
  if (input) {
    input.addEventListener('keypress', e => {
      if (e.key === 'Enter') handleCreate();
    });
  }
}

function handleShowCard(cardName) {
  console.log(`Action: Show card details for "${cardName}" (Placeholder)`);
}

function handleNavigateSetting(settingName) {
  console.log(`Action: Navigate to setting "${settingName}"`);
  
  // Add visual feedback
  const clickedItem = document.querySelector(`[data-setting-name="${settingName}"]`);
  if (clickedItem) {
    clickedItem.style.transform = 'scale(0.95)';
    setTimeout(() => {
      clickedItem.style.transform = '';
    }, 150);
  }
  
  switch (settingName) {
    case 'Profile':
      // Show profile management options
      showProfileSettings();
      break;
    case 'Notifications':
      // Show notification preferences
      showNotificationSettings();
      break;
    case 'About':
      // Show about information
      showAboutInfo();
      break;
    default:
      console.log(`Unknown setting: ${settingName}`);
  }
}

function showProfileSettings() {
  // Create a simple modal or update the settings area to show profile options
  const settingsContainer = document.getElementById('authenticated-settings');
  if (settingsContainer) {
    // Store the original content
    if (!settingsContainer.dataset.originalContent) {
      settingsContainer.dataset.originalContent = settingsContainer.innerHTML;
    }
    
    const profileHTML = `
      <div class="mb-4">
        <button onclick="goBackToSettings()" class="flex items-center text-blue-600 hover:text-blue-700 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Settings
        </button>
        <h3 class="text-lg font-medium mb-4">Profile Settings</h3>
        <div class="space-y-3">
          <div class="p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <label class="block text-sm font-medium mb-2">Display Name</label>
            <input type="text" placeholder="Enter display name" class="w-full p-2 border rounded text-sm" style="background: var(--input-bg); color: var(--input-text); border-color: var(--border-color);">
          </div>
          <div class="p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <label class="text-sm font-medium">Email</label>
            <p class="text-sm opacity-75 mt-1">${auth.currentUser?.email || 'No email'}</p>
          </div>
          <button class="w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-medium">Save Changes</button>
        </div>
      </div>
    `;
    
    settingsContainer.innerHTML = profileHTML;
  }
}

function showNotificationSettings() {
  const settingsContainer = document.getElementById('authenticated-settings');
  if (settingsContainer) {
    // Store the original content
    if (!settingsContainer.dataset.originalContent) {
      settingsContainer.dataset.originalContent = settingsContainer.innerHTML;
    }
    
    const notificationHTML = `
      <div class="mb-4">
        <button onclick="goBackToSettings()" class="flex items-center text-blue-600 hover:text-blue-700 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Settings
        </button>
        <h3 class="text-lg font-medium mb-4">Notification Preferences</h3>
        <div class="space-y-3">
          <div class="flex items-center justify-between p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <span class="text-sm font-medium">Price Drop Alerts</span>
            <input type="checkbox" checked class="w-4 h-4 text-blue-600 rounded">
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <span class="text-sm font-medium">New Product Notifications</span>
            <input type="checkbox" class="w-4 h-4 text-blue-600 rounded">
          </div>
          <div class="flex items-center justify-between p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <span class="text-sm font-medium">Weekly Deals Summary</span>
            <input type="checkbox" checked class="w-4 h-4 text-blue-600 rounded">
          </div>
        </div>
      </div>
    `;
    
    settingsContainer.innerHTML = notificationHTML;
  }
}

function showAboutInfo() {
  const settingsContainer = document.getElementById('authenticated-settings');
  if (settingsContainer) {
    // Store the original content
    if (!settingsContainer.dataset.originalContent) {
      settingsContainer.dataset.originalContent = settingsContainer.innerHTML;
    }
    
    const aboutHTML = `
      <div class="mb-4">
        <button onclick="goBackToSettings()" class="flex items-center text-blue-600 hover:text-blue-700 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 mr-2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Settings
        </button>
        <h3 class="text-lg font-medium mb-4">About Smart Shopper</h3>
        <div class="space-y-3">
          <div class="p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <p class="text-sm leading-relaxed">
              Smart Shopper is your intelligent grocery shopping companion. 
              Compare prices across major South African retailers, track your shopping lists, 
              and save money on your grocery bills.
            </p>
          </div>
          <div class="p-3 rounded-lg border" style="background: var(--card-bg); color: var(--card-text); border-color: var(--border-color);">
            <p class="text-sm"><strong>Version:</strong> 1.0.0</p>
            <p class="text-sm"><strong>Last Updated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    `;
    
    settingsContainer.innerHTML = aboutHTML;
  }
}

function goBackToSettings() {
  const settingsContainer = document.getElementById('authenticated-settings');
  if (settingsContainer && settingsContainer.dataset.originalContent) {
    settingsContainer.innerHTML = settingsContainer.dataset.originalContent;
    // Re-attach event listeners to the restored setting items
    document.querySelectorAll('.setting-item').forEach(settingItem => {
      settingItem.addEventListener('click', () => {
        const settingName = settingItem.getAttribute('data-setting-name');
        if (settingName) {
          handleNavigateSetting(settingName);
        }
      });
    });
  }
}

// Make goBackToSettings globally accessible for inline HTML calls
window.goBackToSettings = goBackToSettings;

// Function to set up event listeners for settings tab
function setupSettingsEventListeners() {
  console.log('Setting up settings event listeners');
  
  // Set up event listeners for setting items
  const settingItems = document.querySelectorAll('.setting-item');
  console.log(`Found ${settingItems.length} setting items`);
  
  settingItems.forEach((settingItem, index) => {
    const settingName = settingItem.getAttribute('data-setting-name');
    console.log(`Setting up event listener for setting item ${index}: ${settingName}`);
    
    // Remove any existing event listeners to prevent duplicates
    const newSettingItem = settingItem.cloneNode(true);
    if (settingItem.parentNode) {
      settingItem.parentNode.replaceChild(newSettingItem, settingItem);
    }
    
    newSettingItem.addEventListener('click', (e) => {
      console.log(`Setting item clicked: ${settingName}`);
      e.preventDefault();
      e.stopPropagation();
      
      if (settingName) {
        handleNavigateSetting(settingName);
      }
    });
  });
  
  // Set up event listener for the logout button
  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    console.log('Setting up event listener for logout button');
    
    // Remove any existing event listeners to prevent duplicates
    const newLogoutButton = logoutButton.cloneNode(true);
    if (logoutButton.parentNode) {
      logoutButton.parentNode.replaceChild(newLogoutButton, logoutButton);
    }
    
    newLogoutButton.addEventListener('click', async (e) => {
      console.log('Logout button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      // Add visual feedback
      newLogoutButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        newLogoutButton.style.transform = '';
      }, 150);
      
      try {
        await signOut(auth);
      } catch (error) {
        console.error('Logout error:', error);
        showError('Failed to log out.');
      }
    });
  } else {
    console.warn('Logout button not found in settings tab');
  }
}

// Search Functionality
function handleSearch() {
	const searchInput = document.getElementById("search-input");
	const searchTerm = searchInput.value.trim();
	console.log(`handleSearch called for: "${searchTerm}"`);
	
	// Security: Validate and sanitize search term
	const { isValid, sanitized } = validateSearchTerm(searchTerm);
	if (!isValid) {
		showError('Please enter a valid search term');
		return;
	}
	
	// Security: Rate limiting for search
	if (!rateLimiter.isAllowed('search')) {
		showError('Too many searches in a short time. Please try again in a minute.');
		return;
	}
	
	// Show loading, hide mock and messages
	const resultsContainer = document.getElementById("search-results-container");
	const mockResults = document.getElementById("mock-search-results");
	const loadingIndicator = document.getElementById("loading-indicator");
	const noResultsMessage = document.getElementById("no-results-message");
	
	if (mockResults) mockResults.style.display = "none";
	if (noResultsMessage) noResultsMessage.classList.add("hidden");
	if (resultsContainer) resultsContainer.innerHTML = "";
	if (loadingIndicator) loadingIndicator.classList.remove("hidden");
	
	// Perform backend search and render
	fetchSearchResults(sanitized)
		.then((products) => {
			if (loadingIndicator) loadingIndicator.classList.add("hidden");
			displayResults(products);
		})
		.catch((error) => {
			console.error("Search error:", error);
			if (loadingIndicator) loadingIndicator.classList.add("hidden");
			if (noResultsMessage) noResultsMessage.classList.remove("hidden");
		});
}

// Create a debounced version of the search function
const debouncedSearch = debounce(() => handleSearch(), 400);

// New function to filter and display search results from popular items
function filterAndDisplaySearchResults(query) {
	console.log("filterAndDisplaySearchResults called with query:", query);
	
	const resultsContainer = document.getElementById("search-results-container");
	const mockResults = document.getElementById("mock-search-results");
	const loadingIndicator = document.getElementById("loading-indicator");
	const noResultsMessage = document.getElementById("no-results-message");
	
	console.log("Found elements:", {
		resultsContainer: !!resultsContainer,
		mockResults: !!mockResults,
		loadingIndicator: !!loadingIndicator,
		noResultsMessage: !!noResultsMessage
	});
	
	// Hide loading and mock results
	if (loadingIndicator) loadingIndicator.classList.add("hidden");
	if (mockResults) mockResults.style.display = "none";
	
	// Clear previous results
	resultsContainer.innerHTML = "";
	
	if (!query || query.length === 0) {
		// Show mock results when search is empty
		if (mockResults) mockResults.style.display = "block";
		if (noResultsMessage) noResultsMessage.classList.add("hidden");
		console.log("Empty query, showing mock results");
		return;
	}
	
	// Filter popular items based on search query
	const matchingItems = popularGroceryItems.filter(item => 
		item.name.toLowerCase().includes(query.toLowerCase())
	);
	
	console.log(`Found ${matchingItems.length} matching items for query: "${query}"`);
	
	// Add the search term itself as a custom item option
	const customItem = {
		name: query,
		icon: groceryIcons.rice, // Default icon for custom items
		isCustom: true
	};
	
	// Combine matching items with custom item
	const allResults = [customItem, ...matchingItems];
	
	console.log(`Total results: ${allResults.length} (1 custom + ${matchingItems.length} matching)`);
	
	if (allResults.length === 0) {
		if (noResultsMessage) noResultsMessage.classList.remove("hidden");
		console.log("No results found, showing no results message");
	} else {
		if (noResultsMessage) noResultsMessage.classList.add("hidden");
		
		allResults.forEach((item, index) => {
			const resultDiv = document.createElement("div");
			resultDiv.className = "rounded-xl shadow-lg bg-white dark:bg-slate-800 p-4 mb-3 transition-transform duration-300 hover:scale-105 hover:shadow-2xl animate__animated animate__fadeInUp";
			resultDiv.style.background = "var(--card-bg)";
			resultDiv.style.color = "var(--card-text)";
			resultDiv.style.borderColor = "var(--border-color)";
			
			// Add custom styling for the first item (custom search term)
			if (index === 0 && item.isCustom) {
				resultDiv.style.border = "2px solid var(--accent)";
				resultDiv.style.background = "var(--accent)";
				resultDiv.style.color = "var(--accent-text)";
			}

			resultDiv.innerHTML = `
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-3">
						<div class="w-8 h-8 rounded-full flex items-center justify-center" style="background: ${index === 0 && item.isCustom ? 'rgba(255,255,255,0.2)' : 'var(--accent)'};">
							<span class="text-sm font-bold" style="color: ${index === 0 && item.isCustom ? 'white' : 'var(--accent-text)'}">${item.name.charAt(0).toUpperCase()}</span>
						</div>
						<div>
							<p class="font-medium text-sm">${item.name}</p>
							<p class="text-xs opacity-70">${item.isCustom ? 'Custom item' : 'Popular item'}</p>
						</div>
					</div>
					<button 
						class="add-to-list-button px-3 py-2 rounded-lg text-white flex items-center text-sm" 
						style="background: ${index === 0 && item.isCustom ? 'rgba(255,255,255,0.2)' : 'var(--accent)'}; color: ${index === 0 && item.isCustom ? 'white' : 'var(--accent-text)'}"
						aria-label="Add ${item.name} to list"
						data-item-name="${item.name}"
						data-is-custom="${item.isCustom || false}"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
						</svg>
						Add
					</button>
				</div>
			`;
			
			// Add click event to the add button
			const addButton = resultDiv.querySelector('.add-to-list-button');
			addButton.addEventListener('click', () => {
				const itemName = addButton.getAttribute('data-item-name');
				const isCustom = addButton.getAttribute('data-is-custom') === 'true';
				
				console.log(`Add button clicked for: ${itemName} (custom: ${isCustom})`);
				
				// Prompt user to select a list
				promptAddToList({
					name: itemName,
					price: null,
					retailer: isCustom ? 'Custom Item' : 'Popular Item'
				});
			});
			
			// Also add event listener for the entire result div for better UX
			resultDiv.addEventListener('click', (e) => {
				if (!e.target.closest('.add-to-list-button')) {
					// If clicked outside the button, still trigger the add action
					const itemName = addButton.getAttribute('data-item-name');
					const isCustom = addButton.getAttribute('data-is-custom') === 'true';
					
					console.log(`Result div clicked for: ${itemName} (custom: ${isCustom})`);
					
					promptAddToList({
						name: itemName,
						price: null,
						retailer: isCustom ? 'Custom Item' : 'Popular Item'
					});
				}
			});
			
			resultsContainer.appendChild(resultDiv);
		});
		
		console.log(`Rendered ${allResults.length} search result items`);
	}
}

// Remove the old fetchSearchResults function since we're not using backend
// async function fetchSearchResults(query) {
//   try {
//     // Security: Additional sanitization check before making the request
//     const sanitizedQuery = sanitizeInput(query);
//     
//     console.log("Fetching search results for:", sanitizedQuery);
//     const response = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(sanitizedQuery)}`);
//     if (!response.ok) throw new Error('Network response was not ok');
//     const data = await response.json();
//     displayResults(data.results);
//   } catch (error) {
//     console.error("Search error:", error);
//     document.getElementById("loading-indicator").classList.add("hidden");
//     document.getElementById("no-results-message").classList.remove("hidden");
//   }
// }

// Enhanced displayResults with shopping list integration
function displayResults(results) {
	try {
		console.log('displayResults called with results:', results);
		
		if (!results || !results.results) {
			showEmptyState('No search results available');
			return;
		}
		
		const resultsContainer = document.getElementById('results');
		if (!resultsContainer) {
			console.error('Results container not found');
			return;
		}
		
		// Clear previous results
		resultsContainer.innerHTML = '';
		
		const retailers = Object.keys(results.results);
		
		if (retailers.length === 0) {
			showEmptyState('No products found for your search');
			return;
		}
		
		// Create results HTML with enhanced shopping list integration
		let resultsHTML = `
			<div class="results-header">
				<h3>Results (${results.totalProducts} products)</h3>
				<div class="results-actions">
					<button class="add-all-to-list-btn" onclick="addAllToShoppingList()">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
							<circle cx="8.5" cy="7" r="4"></circle>
							<line x1="17" y1="8" x2="23" y2="8"></line>
							<polyline points="20,5 23,8 20,11"></polyline>
						</svg>
						Add All to List
					</button>
					<button class="compare-prices-btn" onclick="comparePrices()">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
							<polyline points="14,2 14,8 20,8"></polyline>
							<line x1="16" y1="13" x2="8" y2="13"></line>
							<line x1="16" y1="17" x2="8" y2="17"></line>
							<polyline points="10,9 9,9 8,9"></polyline>
						</svg>
						Compare Prices
					</button>
					</div>
					</div>
		`;
		
		// Store products globally for list operations
		window.searchResults = [];
		
		retailers.forEach(retailer => {
			const products = results.results[retailer];
			
			resultsHTML += `
				<div class="retailer-section">
					<div class="retailer-header">
						<h4 class="retailer-name">${retailer}</h4>
						<button class="add-retailer-to-list-btn" onclick="addRetailerToShoppingList('${retailer}')">
							Add All ${retailer} Items
						</button>
				</div>
					<div class="products-grid">
			`;
			
			products.forEach(product => {
				// Add to global search results
				window.searchResults.push(product);
				
				// Check if product is already in shopping list
				const isInList = checkIfInShoppingList(product.id);
				const listItem = getShoppingListItem(product.id);
				
				resultsHTML += `
					<div class="product-card" data-product-id="${product.id}">
						<div class="product-info">
							<h5 class="product-name">${product.name || product.title || 'Product Name'}</h5>
							<div class="product-price-section">
								<p class="product-price">R ${product.price || 'N/A'}</p>
								${product.original_price && product.original_price !== product.price ? 
									`<p class="product-original-price">R ${product.original_price}</p>` : ''
								}
								${product.price && product.original_price && product.original_price > product.price ? 
									`<span class="discount-badge">${Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF</span>` : ''
								}
							</div>
							${product.description ? `<p class="product-description">${product.description}</p>` : ''}
							${product.category ? `<p class="product-category">${product.category}</p>` : ''}
							${product.brand ? `<p class="product-brand">${product.brand}</p>` : ''}
						</div>
						<div class="product-actions">
							<div class="quantity-controls ${isInList ? 'show' : ''}">
								<button class="quantity-btn minus" onclick="updateQuantity('${product.id}', -1)" ${listItem && listItem.quantity <= 1 ? 'disabled' : ''}>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
								</button>
								<span class="quantity-display">${listItem ? listItem.quantity : 1}</span>
								<button class="quantity-btn plus" onclick="updateQuantity('${product.id}', 1)">
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="12" y1="5" x2="12" y2="19"></line>
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
								</button>
							</div>
							<button class="add-to-list-btn ${isInList ? 'in-list' : ''}" onclick="toggleShoppingListItem('${product.id}')">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									${isInList ? 
										'<path d="M9 12l2 2 4-4"></path><path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z"></path><path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z"></path>' :
										'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="17" y1="8" x2="23" y2="8"></line><polyline points="20,5 23,8 20,11"></polyline>'
									}
								</svg>
								${isInList ? 'In List' : 'Add to List'}
							</button>
							${product.url ? `<a href="${product.url}" target="_blank" class="view-product-btn">View Product</a>` : ''}
							<button class="product-details-btn" onclick="showProductDetails('${product.id}')">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="11" cy="11" r="8"></circle>
									<path d="m21 21-4.35-4.35"></path>
								</svg>
								Details
							</button>
						</div>
						${isInList ? `
							<div class="list-item-info">
								<span class="list-quantity">Quantity: ${listItem.quantity}</span>
								<span class="list-total">Total: R ${(product.price * listItem.quantity).toFixed(2)}</span>
							</div>
						` : ''}
					</div>
				`;
			});
			
			resultsHTML += `
					</div>
				</div>
			`;
		});
		
		resultsContainer.innerHTML = resultsHTML;
		
		// Initialize quantity controls
		initializeQuantityControls();
		
	} catch (error) {
		errorHandler.handleError(error, 'display-results', true);
		showEmptyState('Unable to display results');
	}
}

// Check if product is in shopping list
function checkIfInShoppingList(productId) {
	try {
		const shoppingList = JSON.parse(localStorage.getItem('shoppingList') || '[]');
		return shoppingList.some(item => item.id === productId);
	} catch (error) {
		console.error('Error checking shopping list:', error);
		return false;
	}
}

// Get shopping list item
function getShoppingListItem(productId) {
	try {
		const shoppingList = JSON.parse(localStorage.getItem('shoppingList') || '[]');
		return shoppingList.find(item => item.id === productId);
	} catch (error) {
		console.error('Error getting shopping list item:', error);
		return null;
	}
}

// Toggle product in shopping list
async function toggleShoppingListItem(productId) {
	try {
		const product = window.searchResults.find(p => p.id === productId);
		if (!product) {
			throw new Error('Product not found');
		}
		
		const isInList = checkIfInShoppingList(productId);
		
		if (isInList) {
			// Remove from list
			await removeFromShoppingList(productId);
			errorHandler.showSuccess('Removed', `${product.name} removed from shopping list`);
		} else {
			// Add to list
			await addToShoppingList(product);
			errorHandler.showSuccess('Added', `${product.name} added to shopping list`);
		}
		
		// Update UI
		updateProductCardUI(productId);
		updateShoppingListUI();
		
	} catch (error) {
		errorHandler.handleError(error, 'toggle-shopping-list', true);
	}
}

// Update product quantity
async function updateQuantity(productId, change) {
	try {
		const product = window.searchResults.find(p => p.id === productId);
		if (!product) {
			throw new Error('Product not found');
		}
		
		const shoppingList = JSON.parse(localStorage.getItem('shoppingList') || '[]');
		const existingItem = shoppingList.find(item => item.id === productId);
		
		if (existingItem) {
			const newQuantity = Math.max(1, existingItem.quantity + change);
			
			if (newQuantity === 0) {
				// Remove item if quantity becomes 0
				await removeFromShoppingList(productId);
			} else {
				// Update quantity
				existingItem.quantity = newQuantity;
				existingItem.total_price = product.price * newQuantity;
				localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
			}
		} else if (change > 0) {
			// Add new item
			await addToShoppingList(product);
		}
		
		// Update UI
		updateProductCardUI(productId);
		updateShoppingListUI();
		
	} catch (error) {
		errorHandler.handleError(error, 'update-quantity', true);
	}
}

// Update product card UI
function updateProductCardUI(productId) {
	const productCard = document.querySelector(`[data-product-id="${productId}"]`);
	if (!productCard) return;
	
	const isInList = checkIfInShoppingList(productId);
	const listItem = getShoppingListItem(productId);
	const product = window.searchResults.find(p => p.id === productId);
	
	// Update add to list button
	const addButton = productCard.querySelector('.add-to-list-btn');
	if (addButton) {
		addButton.className = `add-to-list-btn ${isInList ? 'in-list' : ''}`;
		addButton.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				${isInList ? 
					'<path d="M9 12l2 2 4-4"></path><path d="M21 12c-1 0-2-1-2-2s1-2 2-2 2 1 2 2-1 2-2 2z"></path><path d="M3 12c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2z"></path>' :
					'<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="17" y1="8" x2="23" y2="8"></line><polyline points="20,5 23,8 20,11"></polyline>'
				}
			</svg>
			${isInList ? 'In List' : 'Add to List'}
		`;
	}
	
	// Update quantity controls
	const quantityControls = productCard.querySelector('.quantity-controls');
	const quantityDisplay = productCard.querySelector('.quantity-display');
	const minusBtn = productCard.querySelector('.quantity-btn.minus');
	
	if (quantityControls && quantityDisplay && minusBtn) {
		quantityControls.className = `quantity-controls ${isInList ? 'show' : ''}`;
		quantityDisplay.textContent = listItem ? listItem.quantity : 1;
		minusBtn.disabled = listItem && listItem.quantity <= 1;
	}
	
	// Update list item info
	let listItemInfo = productCard.querySelector('.list-item-info');
	if (isInList && listItem) {
		if (!listItemInfo) {
			listItemInfo = document.createElement('div');
			listItemInfo.className = 'list-item-info';
			productCard.appendChild(listItemInfo);
		}
		listItemInfo.innerHTML = `
			<span class="list-quantity">Quantity: ${listItem.quantity}</span>
			<span class="list-total">Total: R ${(product.price * listItem.quantity).toFixed(2)}</span>
		`;
	} else if (listItemInfo) {
		listItemInfo.remove();
	}
}

// Add all products to shopping list
async function addAllToShoppingList() {
	try {
		if (!window.searchResults || window.searchResults.length === 0) {
			errorHandler.showWarning('No Products', 'No products available to add');
			return;
		}
		
		errorHandler.showLoading('Adding all products to shopping list...');
		
		let addedCount = 0;
		let skippedCount = 0;
		
		for (const product of window.searchResults) {
			const isInList = checkIfInShoppingList(product.id);
			if (!isInList) {
				await addToShoppingList(product);
				addedCount++;
			} else {
				skippedCount++;
			}
		}
		
		errorHandler.hideLoading();
		
		if (addedCount > 0) {
			errorHandler.showSuccess('Added to List', `${addedCount} products added to shopping list${skippedCount > 0 ? ` (${skippedCount} already in list)` : ''}`);
		} else {
			errorHandler.showInfo('Already Added', 'All products are already in your shopping list');
		}
		
		// Update all product cards
		window.searchResults.forEach(product => {
			updateProductCardUI(product.id);
		});
		updateShoppingListUI();
		
	} catch (error) {
		errorHandler.hideLoading();
		errorHandler.handleError(error, 'add-all-to-list', true);
	}
}

// Add all products from specific retailer
async function addRetailerToShoppingList(retailer) {
	try {
		if (!window.searchResults || window.searchResults.length === 0) {
			errorHandler.showWarning('No Products', 'No products available to add');
			return;
		}
		
		const retailerProducts = window.searchResults.filter(product => product.retailer === retailer);
		
		if (retailerProducts.length === 0) {
			errorHandler.showWarning('No Products', `No products found for ${retailer}`);
			return;
		}
		
		errorHandler.showLoading(`Adding ${retailer} products to shopping list...`);
		
		let addedCount = 0;
		let skippedCount = 0;
		
		for (const product of retailerProducts) {
			const isInList = checkIfInShoppingList(product.id);
			if (!isInList) {
				await addToShoppingList(product);
				addedCount++;
			} else {
				skippedCount++;
			}
		}
		
		errorHandler.hideLoading();
		
		if (addedCount > 0) {
			errorHandler.showSuccess('Added to List', `${addedCount} ${retailer} products added to shopping list${skippedCount > 0 ? ` (${skippedCount} already in list)` : ''}`);
		} else {
			errorHandler.showInfo('Already Added', `All ${retailer} products are already in your shopping list`);
		}
		
		// Update product cards
		retailerProducts.forEach(product => {
			updateProductCardUI(product.id);
		});
		updateShoppingListUI();
		
	} catch (error) {
		errorHandler.hideLoading();
		errorHandler.handleError(error, 'add-retailer-to-list', true);
	}
}

// Compare prices across retailers
function comparePrices() {
	try {
		if (!window.searchResults || window.searchResults.length === 0) {
			errorHandler.showWarning('No Products', 'No products to compare');
			return;
		}
		
		// Group products by name for comparison
		const productGroups = {};
		window.searchResults.forEach(product => {
			const name = product.name || product.title;
			if (!productGroups[name]) {
				productGroups[name] = [];
			}
			productGroups[name].push(product);
		});
		
		// Show price comparison modal
		showPriceComparisonModal(productGroups);
		
	} catch (error) {
		errorHandler.handleError(error, 'compare-prices', true);
	}
}

// Show price comparison modal
function showPriceComparisonModal(productGroups) {
	const modal = document.createElement('div');
	modal.className = 'price-comparison-modal';
	modal.innerHTML = `
		<div class="modal-content">
			<div class="modal-header">
				<h3>Price Comparison</h3>
				<button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>
			<div class="modal-body">
				${Object.entries(productGroups).map(([name, products]) => `
					<div class="product-comparison">
						<h4>${name}</h4>
						<div class="price-comparison-grid">
							${products.map(product => `
								<div class="price-item">
									<div class="retailer-name">${product.retailer}</div>
									<div class="price">R ${product.price || 'N/A'}</div>
									<button class="add-to-list-btn" onclick="addToShoppingList(${JSON.stringify(product).replace(/"/g, '&quot;')})">
										Add to List
									</button>
								</div>
							`).join('')}
						</div>
					</div>
				`).join('')}
			</div>
		</div>
	`;
	
	document.body.appendChild(modal);
}

// Show product details
function showProductDetails(productId) {
	try {
		const product = window.searchResults.find(p => p.id === productId);
		if (!product) {
			errorHandler.showWarning('Product Not Found', 'Product details not available');
			return;
		}
		
		const modal = document.createElement('div');
		modal.className = 'product-details-modal';
		modal.innerHTML = `
			<div class="modal-content">
				<div class="modal-header">
					<h3>Product Details</h3>
					<button class="modal-close" onclick="this.parentElement.parentElement.parentElement.remove()">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>
				<div class="modal-body">
					<div class="product-detail-item">
						<strong>Name:</strong> ${product.name || product.title || 'N/A'}
					</div>
					<div class="product-detail-item">
						<strong>Price:</strong> R ${product.price || 'N/A'}
					</div>
					${product.original_price ? `
						<div class="product-detail-item">
							<strong>Original Price:</strong> R ${product.original_price}
						</div>
					` : ''}
					${product.description ? `
						<div class="product-detail-item">
							<strong>Description:</strong> ${product.description}
						</div>
					` : ''}
					${product.category ? `
						<div class="product-detail-item">
							<strong>Category:</strong> ${product.category}
						</div>
					` : ''}
					${product.brand ? `
						<div class="product-detail-item">
							<strong>Brand:</strong> ${product.brand}
						</div>
					` : ''}
					<div class="product-detail-item">
						<strong>Retailer:</strong> ${product.retailer || 'N/A'}
					</div>
					${product.url ? `
						<div class="product-detail-item">
							<strong>Product URL:</strong> 
							<a href="${product.url}" target="_blank">View on ${product.retailer}</a>
						</div>
					` : ''}
				</div>
				<div class="modal-footer">
					<button class="add-to-list-btn" onclick="addToShoppingList(${JSON.stringify(product).replace(/"/g, '&quot;')}); this.parentElement.parentElement.parentElement.remove();">
						Add to Shopping List
					</button>
				</div>
			</div>
		`;
		
		document.body.appendChild(modal);
		
	} catch (error) {
		errorHandler.handleError(error, 'show-product-details', true);
	}
}

// Initialize quantity controls
function initializeQuantityControls() {
	// Add event listeners for quantity controls
	document.querySelectorAll('.quantity-btn').forEach(btn => {
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
		});
	});
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

		// Set product info - handle items without prices
		const priceText = product.price ? `R${product.price} at ${product.retailer}` : product.retailer;
		productInfo.textContent = `"${product.name}" (${priceText})`;
		
		// Clear previous options
		options.innerHTML = '';
		
		// Add list options
		lists.forEach(list => {
			const button = document.createElement('button');
			button.className = 'w-full text-left p-3 rounded-lg transition-colors duration-200';
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
						// Check for the specific duplicate item error
						if (error.message === 'This item is already in your list.') {
							alert(`"${product.name}" is already in "${selectedList.name}".`);
						} else {
							alert(`Error adding item: ${error.message}`);
						}
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
	const input = document.getElementById('add-item-input');
	const addItemValue = input.value.trim();
	if (!addItemValue) return;

	if (currentOpenListId) {
		addItemToList(currentOpenListId, {
			name: addItemValue,
			price: null,
			retailer: 'Manual Add'
		}).then(() => {
			// Add to recent items
			addToRecentItems(addItemValue);
			
			// Clear the input field
			input.value = '';
			
			// Show a visual confirmation
			showConfirmation(addItemValue + ' added');
			
			// Re-initialize popular items UI to ensure event listeners are updated
			setTimeout(() => {
				enhanceAddItemUI();
				
				// Keep focus on the input for adding more items
				const newInput = document.getElementById('add-item-input');
				if (newInput) {
					newInput.focus();
				}
			}, 100);
			
		}).catch(error => {
			console.error("Error adding item to list:", error);
			
			// Show user-friendly message for duplicate items
			if (error.message === 'This item is already in your list.') {
				showError(`"${addItemValue}" is already in your list.`);
			} else {
				showError("Failed to add item to list. Please try again.");
			}
			
			// Keep focus on the input
			input.focus();
		});
	}
}

// Show a temporary confirmation message
function showConfirmation(message) {
	const confirmationEl = document.createElement('div');
	confirmationEl.className = 'fixed bottom-16 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg animate__animated animate__fadeIn z-50';
	confirmationEl.textContent = message;
	document.body.appendChild(confirmationEl);
	
	setTimeout(() => {
		confirmationEl.classList.remove('animate__fadeIn');
		confirmationEl.classList.add('animate__fadeOut');
		setTimeout(() => {
			if (confirmationEl.parentNode) {
				confirmationEl.parentNode.removeChild(confirmationEl);
			}
		}, 500);
	}, 1500);
}

// Enhance item addition with popular items
function enhanceAddItemUI() {
	console.log('enhanceAddItemUI called');
	
	const addItemsView = document.getElementById('add-items-view');
	const addItemInput = document.getElementById('add-item-input');
	
	if (!addItemsView || !addItemInput) {
		console.error('Required elements not found, cannot initialize popular items UI');
		return;
	}
	
	// Get the existing container if it exists, or create a new one
	let popularItemsContainer = document.getElementById('popular-items-container');
	
	// If it doesn't exist, create it
	if (!popularItemsContainer) {
		console.log('Creating new popular items container');
		popularItemsContainer = document.createElement('div');
		popularItemsContainer.id = 'popular-items-container';
		addItemsView.appendChild(popularItemsContainer);
	}
	
	// Update the container styling to match the design
	popularItemsContainer.className = 'px-0 flex-1 overflow-auto';
	popularItemsContainer.style.background = '#1a1a1a';
	popularItemsContainer.style.color = 'white';
	
	// Check if we're in the proper context to show this container
	const listItemsView = document.getElementById('list-items-view');
	const isInAddMode = listItemsView && listItemsView.classList.contains('adding');
	
	// Only show the container if we're in add mode
	popularItemsContainer.style.display = isInAddMode ? 'block' : 'none';
	
	// Get recent items for the Recent tab
	const recentItems = getRecentItems();
	
	// Create HTML for tabs and popular/recent items
	const tabsHtml = `
		<div class="flex" id="item-tabs" style="position: sticky; top: 0; z-index: 10; background: #1a1a1a;">
			<button class="flex-1 py-2 px-4 text-center border-b-2 border-yellow-400 font-medium text-white active" data-tab="popular">Popular</button>
			<button class="flex-1 py-2 px-4 text-center opacity-60 text-white" data-tab="recent">Recent</button>
		</div>
		<div id="popular-items-content" class="overflow-auto pb-24">
			${popularGroceryItems.map(item => `
				<div class="popular-item">
					<button class="add-popular-item" data-item="${item.name}"></button>
					<span>${item.name}</span>
				</div>
			`).join('')}
			<div style="height: 80px;"></div> <!-- Extra space at the bottom to ensure content isn't hidden behind DONE button -->
		</div>
		<div id="recent-items-content" class="hidden overflow-auto pb-24">
			${recentItems.length > 0 ? 
				recentItems.map(item => `
					<div class="popular-item">
						<button class="add-recent-item" data-item="${item}"></button>
						<span>${item}</span>
					</div>
				`).join('') 
				: 
				'<div class="text-center py-4 text-gray-300">No recent items yet</div>'
			}
			<div style="height: 80px;"></div> <!-- Extra space at the bottom to ensure content isn't hidden behind DONE button -->
		</div>
	`;
	
	popularItemsContainer.innerHTML = tabsHtml;
	
	// Add event listeners for the add buttons
	popularItemsContainer.querySelectorAll('.add-popular-item, .add-recent-item').forEach(button => {
		button.addEventListener('click', () => {
			const itemName = button.getAttribute('data-item');
			if (currentOpenListId && itemName) {
				addItemToList(currentOpenListId, {
					name: itemName,
					price: null,
					retailer: 'Popular Item'
				}).then(() => {
					addToRecentItems(itemName);
					showConfirmation(itemName + ' added');
				}).catch(error => {
					console.error("Error adding popular item:", error);
					if (error.message === 'This item is already in your list.') {
						showError(`"${itemName}" is already in your list.`);
					} else {
						showError("Failed to add item. Please try again.");
					}
				});
			}
		});
	});
	
	// Set up tab switching
	const tabButtons = popularItemsContainer.querySelectorAll('#item-tabs button');
	const popularContent = popularItemsContainer.querySelector('#popular-items-content');
	const recentContent = popularItemsContainer.querySelector('#recent-items-content');
	
	if (!tabButtons.length || !popularContent || !recentContent) {
		console.error('Tab buttons or content containers not found');
		return;
	}
	
	// Add tab switching functionality
	tabButtons.forEach(button => {
		button.addEventListener('click', () => {
			tabButtons.forEach(btn => {
				btn.classList.remove('active', 'font-medium', 'border-b-2', 'border-yellow-400');
				btn.classList.add('opacity-60');
			});
			button.classList.remove('opacity-60');
			button.classList.add('active', 'font-medium', 'border-b-2', 'border-yellow-400');
			
			if (button.dataset.tab === 'popular') {
				popularContent.classList.remove('hidden');
				recentContent.classList.add('hidden');
			} else {
				popularContent.classList.add('hidden');
				recentContent.classList.remove('hidden');
			}
		});
	});
	
	// Add event listeners for the input
	addItemInput.addEventListener('keypress', (e) => {
		if (e.key === 'Enter') {
			handleAddItemManually();
		}
	});
	
	// Create suggestions dropdown for the input
	let suggestionsDropdown = document.getElementById('suggestions-dropdown');
	if (!suggestionsDropdown) {
		suggestionsDropdown = document.createElement('div');
		suggestionsDropdown.id = 'suggestions-dropdown';
		suggestionsDropdown.className = 'suggestions-dropdown hidden';
		// Insert the dropdown after the header search box
		const headerSearchBox = document.querySelector('.header-search-box');
		if (headerSearchBox) {
			headerSearchBox.appendChild(suggestionsDropdown);
		}
	}

	// Style the suggestions dropdown
	suggestionsDropdown.style.position = 'absolute';
	suggestionsDropdown.style.top = '100%';
	suggestionsDropdown.style.left = '0';
	suggestionsDropdown.style.right = '0';
	suggestionsDropdown.style.maxHeight = '200px';
	suggestionsDropdown.style.overflowY = 'auto';
	suggestionsDropdown.style.background = '#2A2A2A';
	suggestionsDropdown.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
	suggestionsDropdown.style.borderRadius = '0 0 8px 8px';
	suggestionsDropdown.style.zIndex = '100';
	suggestionsDropdown.style.marginTop = '4px';
	
	// Add search/filter functionality and suggestions
	addItemInput.addEventListener('input', (e) => {
		const searchTerm = e.target.value.toLowerCase().trim();
		
		// Filter the items in the list view
		const allItems = popularItemsContainer.querySelectorAll('.popular-item');
		allItems.forEach(item => {
			const itemText = item.querySelector('span').textContent.toLowerCase();
			if (itemText.includes(searchTerm)) {
				item.style.display = 'flex';
			} else {
				item.style.display = 'none';
			}
		});
		
		// Show suggestions dropdown only if there's text and it's not too short
		if (searchTerm.length > 1) {
			// Find matching items from popularGroceryItems
			const matchingItems = popularGroceryItems
				.filter(item => item.name.toLowerCase().includes(searchTerm))
				.slice(0, 5); // Limit to top 5 matches
			
			// Always add the search term as a custom option if it's not empty
			const customItem = {
				name: e.target.value.trim(),
				isCustom: true
			};
			
			// Combine custom item with matching items
			const allSuggestions = [customItem, ...matchingItems];
			
			if (allSuggestions.length > 0) {
				// Create suggestion HTML
				suggestionsDropdown.innerHTML = allSuggestions.map((item, index) => `
					<div class="suggestion-item p-2 hover:bg-gray-700 cursor-pointer ${index === 0 && item.isCustom ? 'bg-gray-700' : ''}" 
						 data-item="${item.name}" 
						 data-is-custom="${item.isCustom || false}">
						<div class="flex items-center space-x-2">
							<span class="text-sm">${item.name}</span>
							${index === 0 && item.isCustom ? '<span class="text-xs opacity-70">(Custom)</span>' : ''}
						</div>
					</div>
				`).join('');
				
				// Add click event to suggestion items
				suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
					item.addEventListener('click', () => {
						const selectedItem = item.getAttribute('data-item');
						const isCustom = item.getAttribute('data-is-custom') === 'true';
						addItemInput.value = selectedItem;
						suggestionsDropdown.classList.add('hidden');
						
						// Auto-add the item when selected
						if (currentOpenListId && selectedItem) {
							addItemToList(currentOpenListId, {
								name: selectedItem,
								price: null,
								retailer: isCustom ? 'Custom Item' : 'Popular Item'
							}).then(() => {
								addToRecentItems(selectedItem);
								showConfirmation(selectedItem + ' added');
								// Clear the input after adding
								addItemInput.value = '';
								// Re-filter the popular items to show all again
								addItemInput.dispatchEvent(new Event('input'));
							}).catch(error => {
								console.error("Error adding item:", error);
								if (error.message === 'This item is already in your list.') {
									showError(`"${selectedItem}" is already in your list.`);
								} else {
									showError("Failed to add item. Please try again.");
								}
							});
						}
					});
				});
				
				// Show the dropdown
				suggestionsDropdown.classList.remove('hidden');
			} else {
				suggestionsDropdown.classList.add('hidden');
			}
		} else {
			suggestionsDropdown.classList.add('hidden');
		}
	});
	
	// Hide suggestions on blur (delayed to allow for click events)
	addItemInput.addEventListener('blur', () => {
		setTimeout(() => {
			suggestionsDropdown.classList.add('hidden');
		}, 200);
	});
	
	// Show suggestions again on focus if input has value
	addItemInput.addEventListener('focus', () => {
		const searchTerm = addItemInput.value.toLowerCase().trim();
		if (searchTerm.length > 1) {
			// Trigger the input event to show suggestions
			addItemInput.dispatchEvent(new Event('input'));
		}
	});
	
	// Handle keyboard navigation in the dropdown
	addItemInput.addEventListener('keydown', (e) => {
		const suggestions = suggestionsDropdown.querySelectorAll('.suggestion-item');
		if (suggestions.length === 0) return;
		
		let activeIndex = Array.from(suggestions).findIndex(item => 
			item.classList.contains('bg-gray-700'));
		
		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				if (activeIndex < 0 || activeIndex >= suggestions.length - 1) {
					activeIndex = 0;
				} else {
					activeIndex++;
				}
				highlightSuggestion(suggestions, activeIndex);
				break;
				
			case 'ArrowUp':
				e.preventDefault();
				if (activeIndex <= 0) {
					activeIndex = suggestions.length - 1;
				} else {
					activeIndex--;
				}
				highlightSuggestion(suggestions, activeIndex);
				break;
				
			case 'Tab':
			case 'Enter':
				if (activeIndex >= 0) {
					e.preventDefault();
					const selectedItem = suggestions[activeIndex].getAttribute('data-item');
					addItemInput.value = selectedItem;
					suggestionsDropdown.classList.add('hidden');
					
					if (e.key === 'Enter') {
						handleAddItemManually();
					}
				}
				break;
				
			case 'Escape':
				suggestionsDropdown.classList.add('hidden');
				break;
		}
	});
	
	// Helper function to highlight a suggestion
	function highlightSuggestion(suggestions, activeIndex) {
		suggestions.forEach((item, index) => {
			if (index === activeIndex) {
				item.classList.add('bg-gray-700');
			} else {
				item.classList.remove('bg-gray-700');
			}
		});
		
		// Ensure the active item is visible in the dropdown
		if (activeIndex >= 0) {
			suggestions[activeIndex].scrollIntoView({ block: 'nearest' });
		}
	}
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
	try {
		const cards = localStorage.getItem('loyaltyCards');
		return cards ? JSON.parse(cards) : [];
	} catch (error) {
		console.error('Error getting loyalty cards:', error);
		return [];
	}
}

function saveLoyaltyCards(cards) {
	try {
		localStorage.setItem('loyaltyCards', JSON.stringify(cards));
	} catch (error) {
		console.error('Error saving loyalty cards:', error);
	}
}

// Show success message (placeholder - you can implement this based on your UI)
function showSuccessMessage(message) {
	// For now, just use alert - you can replace this with a proper toast notification
	alert(message);
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
	
	// Automatically show the scanner when the modal opens
	const scannerDiv = document.getElementById('barcode-scanner');
	scannerDiv.classList.remove('hidden');
	
	// Check if we're on HTTPS (required for camera access in most browsers)
	if (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
		// Auto-start the scanner with better error handling
		console.log("HTTPS detected, auto-starting scanner");
		setTimeout(() => {
			startBarcodeScanner();
		}, 500); // Small delay to ensure modal is fully rendered
	} else {
		alert("Camera access requires HTTPS for security reasons. Please use HTTPS to scan barcodes.");
		// Hide the scanner if not on HTTPS
		scannerDiv.classList.add('hidden');
	}
}

// Enhanced store recognition based on barcode patterns
function detectRetailerFromBarcode(barcodeNumber) {
	if (!barcodeNumber) return null;
	
	const numberStr = barcodeNumber.toString().replace(/\s+/g, '');
	const length = numberStr.length;
	
	// Known barcode patterns for South African retailers
	const retailerPatterns = {
		// Checkers - typically 13 digits starting with specific patterns
		'Checkers': [
			/^6\d{12}$/, // 13 digits starting with 6
			/^7\d{12}$/, // 13 digits starting with 7
		],
		// Shoprite - typically 13 digits
		'Shoprite': [
			/^8\d{12}$/, // 13 digits starting with 8
			/^9\d{12}$/, // 13 digits starting with 9
		],
		// Pick n Pay - typically 12-13 digits
		'Pick n Pay': [
			/^5\d{11}$/, // 12 digits starting with 5
			/^5\d{12}$/, // 13 digits starting with 5
		],
		// Woolworths - typically 13 digits
		'Woolworths': [
			/^4\d{12}$/, // 13 digits starting with 4
		],
		// Makro - typically 13 digits
		'Makro': [
			/^3\d{12}$/, // 13 digits starting with 3
		],
		// Dischem - typically 13 digits
		'Dischem': [
			/^2\d{12}$/, // 13 digits starting with 2
		],
		// Clicks - typically 13 digits
		'Clicks': [
			/^1\d{12}$/, // 13 digits starting with 1
		]
	};
	
	// Check each retailer's patterns
	for (const [retailer, patterns] of Object.entries(retailerPatterns)) {
		for (const pattern of patterns) {
			if (pattern.test(numberStr)) {
				return retailer;
			}
		}
	}
	
	// Fallback: Try to match based on length and common patterns
	if (length === 13 && /^\d+$/.test(numberStr)) {
		// EAN-13 format - common for loyalty cards
		const firstDigit = parseInt(numberStr.charAt(0));
		if (firstDigit >= 6 && firstDigit <= 9) {
			return 'Checkers'; // Most common for loyalty cards
		}
	}
	
	// If no pattern matches, return null (user will need to select manually)
	return null;
}

// Enhanced barcode detection with automatic store recognition
function handleBarcodeDetected(decodedText) {
	console.log("Barcode detected:", decodedText);
	
	// Detect retailer from barcode
	const detectedRetailer = detectRetailerFromBarcode(decodedText);
	
	// Update form fields
	const cardNumberInput = document.getElementById('card-number');
	const retailerInput = document.getElementById('card-retailer');
	
	cardNumberInput.value = decodedText;
	cardNumberInput.classList.add('bg-green-50', 'animate__animated', 'animate__flash');
	
	// Auto-fill retailer if detected
	if (detectedRetailer) {
		retailerInput.value = detectedRetailer;
		retailerInput.classList.add('bg-green-50', 'animate__animated', 'animate__flash');
		
		// Show success message
		const statusEl = document.getElementById('scanner-status');
		if (statusEl) {
			const scanningIndicator = statusEl.querySelector('#scanning-indicator');
			const scanResult = statusEl.querySelector('#scan-result');
			if (scanningIndicator) scanningIndicator.classList.add('hidden');
			if (scanResult) {
				scanResult.classList.remove('hidden');
				scanResult.innerHTML = `<span style="color: #10B981;">Card detected! Store: ${detectedRetailer}</span>`;
			}
		}
	} else {
		// Show generic success message
		const statusEl = document.getElementById('scanner-status');
		if (statusEl) {
			const scanningIndicator = statusEl.querySelector('#scanning-indicator');
			const scanResult = statusEl.querySelector('#scan-result');
			if (scanningIndicator) scanningIndicator.classList.add('hidden');
			if (scanResult) {
				scanResult.classList.remove('hidden');
				scanResult.innerHTML = `<span style="color: #F59E0B;">Card detected! Please select the store manually.</span>`;
			}
		}
	}
	
	// Add a slight delay before closing scanner to show the success state
	setTimeout(() => {
		window.html5QrCode.stop().then(() => {
			// Only hide the scanner, NOT the whole modal
			const scannerDiv = document.getElementById('barcode-scanner');
			scannerDiv.classList.add('hidden');
			
			// Show the form for user to review and submit
			const form = document.getElementById('add-card-form');
			form.classList.remove('hidden');
			
			// Clear status after a delay
			setTimeout(() => {
				const statusEl = document.getElementById('scanner-status');
				if (statusEl) {
					const scanningIndicator = statusEl.querySelector('#scanning-indicator');
					const scanResult = statusEl.querySelector('#scan-result');
					if (scanningIndicator) scanningIndicator.classList.add('hidden');
					if (scanResult) scanResult.classList.add('hidden');
				}
				
				// Remove highlight effects
				cardNumberInput.classList.remove('bg-green-50', 'animate__animated', 'animate__flash');
				if (detectedRetailer) {
					retailerInput.classList.remove('bg-green-50', 'animate__animated', 'animate__flash');
				}
			}, 2000);
		}).catch(err => {
			console.error("Error stopping scanner after success:", err);
			const scannerDiv = document.getElementById('barcode-scanner');
			scannerDiv.classList.add('hidden');
			
			// Show the form even if there's an error
			const form = document.getElementById('add-card-form');
			form.classList.remove('hidden');
		});
	}, 1000);
}

// Handle loyalty card form submission
function handleAddCardSubmit(event) {
	event.preventDefault();
	
	const retailer = document.getElementById('card-retailer').value;
	const cardNumber = document.getElementById('card-number').value;
	
	if (!retailer || !cardNumber) {
		alert('Please fill in all required fields.');
		return;
	}
	
	// Add the loyalty card
	addLoyaltyCard(retailer, cardNumber);
	
	// Close the modal
	hideAddCardModal();
	
	// Clear the form
	document.getElementById('card-retailer').value = '';
	document.getElementById('card-number').value = '';
}

// Add loyalty card to storage
function addLoyaltyCard(retailer, cardNumber) {
	try {
		const cards = getLoyaltyCards();
		const newCard = {
			retailer: retailer,
			number: cardNumber,
			addedAt: new Date().toISOString()
		};
		
		cards.push(newCard);
		localStorage.setItem('loyaltyCards', JSON.stringify(cards));
		
		// Refresh the cards display
		renderLoyaltyCards();
		
		// Show success message
		showSuccessMessage(`Loyalty card for ${retailer} added successfully!`);
	} catch (error) {
		console.error('Error adding loyalty card:', error);
		showError('Failed to add loyalty card. Please try again.');
	}
}



function startBarcodeScanner() {
	const scannerDiv = document.getElementById('barcode-scanner');
	const statusEl = document.getElementById('scanner-status');

	console.log("Starting barcode scanner with camera: " + currentCamera);

	// Check if camera API is supported
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		const statusEl = document.getElementById('scanner-status');
		if (statusEl) {
			const scanningIndicator = statusEl.querySelector('#scanning-indicator');
			const scanResult = statusEl.querySelector('#scan-result');
			if (scanningIndicator) scanningIndicator.classList.add('hidden');
			if (scanResult) {
				scanResult.classList.remove('hidden');
				scanResult.innerHTML = '<span style="color: #EF4444;">Camera not supported. Please use a modern browser.</span>';
			}
		}
		scannerDiv.classList.add('hidden');
		return;
	}

	// Show scanning status
	if (statusEl) {
		const scanningIndicator = statusEl.querySelector('#scanning-indicator');
		const scanResult = statusEl.querySelector('#scan-result');
		if (scanningIndicator) scanningIndicator.classList.remove('hidden');
		if (scanResult) scanResult.classList.add('hidden');
	} else {
		console.warn("Scanner status element not found");
	}

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

					// Use the enhanced barcode detection handler
					handleBarcodeDetected(decodedText);
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
				
				// Handle specific camera errors gracefully
				if (err.name === 'NotAllowedError') {
					// Show user-friendly message and offer manual entry option
					const statusEl = document.getElementById('scanner-status');
					if (statusEl) {
						const scanningIndicator = statusEl.querySelector('#scanning-indicator');
						const scanResult = statusEl.querySelector('#scan-result');
						if (scanningIndicator) scanningIndicator.classList.add('hidden');
						if (scanResult) {
							scanResult.classList.remove('hidden');
							scanResult.innerHTML = `
								<span style="color: #F59E0B;">Camera permission denied</span>
								<br><small style="color: #9CA3AF;">Click "Manual Entry" to add card manually</small>
							`;
						}
					}
					
					// Don't hide scanner, let user choose manual entry
					console.log("Camera permission denied, showing manual entry option");
				} else {
					// For other errors, show appropriate message
					let errorMessage = "Camera error: ";
					if (err.name === 'NotFoundError') {
						errorMessage += "No camera found on this device.";
					} else if (err.name === 'NotReadableError') {
						errorMessage += "Camera is in use by another application.";
					} else if (err.name === 'OverconstrainedError') {
						errorMessage += "Camera doesn't meet requirements.";
					} else if (err.name === 'AbortError') {
						errorMessage += "Camera access was aborted.";
					} else if (err.name === 'SecurityError') {
						errorMessage += "Camera access blocked for security reasons.";
					} else {
						errorMessage += err.message || "Camera streaming not supported.";
					}
					
					const statusEl = document.getElementById('scanner-status');
					if (statusEl) {
						const scanningIndicator = statusEl.querySelector('#scanning-indicator');
						const scanResult = statusEl.querySelector('#scan-result');
						if (scanningIndicator) scanningIndicator.classList.add('hidden');
						if (scanResult) {
							scanResult.classList.remove('hidden');
							scanResult.innerHTML = `<span style="color: #EF4444;">${errorMessage}</span>`;
						}
					}
					
					// Hide scanner for non-permission errors
					scannerDiv.classList.add('hidden');
				}
			});
		} catch (err) {
			console.error("Error during scanner initialization:", err);
			
			// Show error in status instead of alert
			const statusEl = document.getElementById('scanner-status');
			if (statusEl) {
				const scanningIndicator = statusEl.querySelector('#scanning-indicator');
				const scanResult = statusEl.querySelector('#scan-result');
				if (scanningIndicator) scanningIndicator.classList.add('hidden');
				if (scanResult) {
					scanResult.classList.remove('hidden');
					scanResult.innerHTML = `<span style="color: #EF4444;">Scanner initialization failed</span>`;
				}
			}
			
			scannerDiv.classList.add('hidden');
		}
	}
}

function hideAddCardModal() {
	document.getElementById('add-card-modal').classList.add('hidden');
	const scannerDiv = document.getElementById('barcode-scanner');
	
	// Safely stop scanner if it's running
	if (window.html5QrCode && window.html5QrCode.isScanning) {
		window.html5QrCode.stop().then(() => {
			scannerDiv.classList.add('hidden');
		}).catch((err) => {
			console.log("Scanner stop error (normal when not running):", err.message);
			scannerDiv.classList.add('hidden');
		});
	} else {
		scannerDiv.classList.add('hidden');
	}
	
	// Reset scanner state
	window.html5QrCode = null;
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
	console.log("DOM loaded, initializing app...");

	// Initialize splash screen
	initializeSplashScreen();

	// Initialize theme
	initializeTheme();

	// Only attempt to get elements if they exist
	const darkModeToggle = document.getElementById('dark-mode-toggle-button');
	if (darkModeToggle) {
		darkModeToggle.addEventListener('click', toggleDarkMode);
	}

	// Add event listener for dark mode checkbox in settings tab
	const darkModeCheckbox = document.getElementById('dark-mode-checkbox');
	if (darkModeCheckbox) {
		darkModeCheckbox.addEventListener('change', toggleDarkMode);
	}

	// Note: Settings event listeners are now set up when the settings tab becomes visible
	// to ensure the elements exist in the DOM

	// Set up authentication form switching
	const showSignupBtn = document.getElementById('show-signup');
	const showLoginBtn = document.getElementById('show-login');
	const loginSection = document.getElementById('login-section');
	const signupSection = document.getElementById('signup-section');

	if (showSignupBtn && showLoginBtn && loginSection && signupSection) {
		showSignupBtn.addEventListener('click', () => {
			loginSection.classList.add('hidden');
			signupSection.classList.remove('hidden');
			// Clear any existing errors
			document.getElementById('auth-error').classList.add('hidden');
			document.getElementById('signup-error').classList.add('hidden');
		});

		showLoginBtn.addEventListener('click', () => {
			signupSection.classList.add('hidden');
			loginSection.classList.remove('hidden');
			// Clear any existing errors
			document.getElementById('auth-error').classList.add('hidden');
			document.getElementById('signup-error').classList.add('hidden');
		});
	}

	// Set up event handlers for navigation
	const navButtons = document.querySelectorAll(".nav-button");
	if (navButtons.length > 0) {
		navButtons.forEach(button => {
			const tabId = button.getAttribute("data-tab");
			if (tabId) {
				button.addEventListener("click", () => navigateToView(tabId, currentView));
			}
		});
	}

	// Show the list tab by default
	showView('list-tab');
	if (navButtons.length > 0) {
		navButtons.forEach((button) => {
			const tabId = button.getAttribute("data-tab");
			if (tabId === 'list-tab') {
				button.classList.add("active");
			} else {
				button.classList.remove("active");
			}
		});
	}

	// Enhanced back button functionality with multiple event binding for reliability
	const backButton = document.getElementById("back-to-lists-button");
	if (backButton) {
		// Remove any existing listeners to prevent duplicates
		const newBackButton = backButton.cloneNode(true);
		if (backButton.parentNode) {
			backButton.parentNode.replaceChild(newBackButton, backButton);
		}
		
		// Add multiple event listeners for better reliability
		newBackButton.addEventListener('click', handleBackButton);
		newBackButton.addEventListener('touchend', function(e) {
			e.preventDefault();
			handleBackButton();
		});
		
		console.log("Back button event listeners enhanced for reliability");
	}

	// Set up back button for list items view only
	const backButtons = [
		'back-to-lists-button'
	];

	backButtons.forEach(buttonId => {
		const button = document.getElementById(buttonId);
		if (button) {
			// Remove any existing listeners to prevent duplicates
			const newButton = button.cloneNode(true);
			if (button.parentNode) {
				button.parentNode.replaceChild(newButton, button);
			}
			
			// Add multiple event listeners for better reliability
			newButton.addEventListener('click', function(e) {
				console.log(`Back button clicked: ${buttonId}`);
				e.preventDefault();
				e.stopPropagation();
				handleBackButton();
			});
			
			newButton.addEventListener('touchend', function(e) {
				console.log(`Back button touched: ${buttonId}`);
				e.preventDefault();
				e.stopPropagation();
				handleBackButton();
			});
			
			console.log(`Back button event listeners added for: ${buttonId}`);
		} else {
			console.warn(`Back button not found: ${buttonId}`);
		}
	});

	// Initialize location services
	try {
		locationUI = new LocationUI();
		locationUI.init();
		console.log('Location services initialized successfully');
	} catch (error) {
		console.warn('Location services failed to initialize:', error);
		locationUI = null;
	}

	// Store selection events temporarily disabled
	/*
	document.addEventListener('storeSelected', (event) => {
		selectedStore = event.detail.store;
		console.log('Store selected:', selectedStore);
		
		// Re-run search if there's an active search to apply location filtering
		const searchInput = document.getElementById('search-input');
		if (searchInput && searchInput.value.trim()) {
			handleSearch();
		}
	});
	*/

	// Set up event handlers for various buttons
	addButtonHandler("new-list-button", handleNewList);
	addButtonHandler("add-card-button", showAddCardModal);
	addButtonHandler("compare-prices-button", handleComparePrices);
	addButtonHandler("close-comparison-modal", hideComparisonModal);
	// Back button handled separately above for more reliability
	addButtonHandler("search-button", handleSearch);
	
	// Add card modal specific handlers
	addButtonHandler("manual-entry-btn", () => {
		const scannerDiv = document.getElementById('barcode-scanner');
		const form = document.getElementById('add-card-form');
		
		if (scannerDiv && form) {
			scannerDiv.classList.add('hidden');
			form.classList.remove('hidden');
		} else {
			console.warn("Scanner or form elements not found");
		}
	});
	
	addButtonHandler("scan-again-btn", () => {
		const scannerDiv = document.getElementById('barcode-scanner');
		const form = document.getElementById('add-card-form');
		
		if (scannerDiv && form) {
			form.classList.add('hidden');
			scannerDiv.classList.remove('hidden');
			// Restart the scanner
			setTimeout(() => {
				startBarcodeScanner();
			}, 100);
		} else {
			console.warn("Scanner or form elements not found");
		}
	});
	
	addButtonHandler("switch-camera-btn", () => {
		// Toggle between front and back camera
		currentCamera = currentCamera === "environment" ? "user" : "environment";
		console.log("Switching to camera:", currentCamera);
		
		// Safely restart scanner with new camera
		if (window.html5QrCode && window.html5QrCode.isScanning) {
			window.html5QrCode.stop().then(() => {
				setTimeout(() => {
					startBarcodeScanner();
				}, 100);
			}).catch(err => {
				console.log("Camera switch error (normal):", err.message);
				// Continue with new camera even if stop fails
				setTimeout(() => {
					startBarcodeScanner();
				}, 100);
			});
		} else {
			// Scanner not running, just start with new camera
			startBarcodeScanner();
		}
	});
	
	addButtonHandler("cancel-add-card", hideAddCardModal);
	
	// Add card form submission handler
	const addCardForm = document.getElementById('add-card-form');
	if (addCardForm) {
		addCardForm.addEventListener('submit', handleAddCardSubmit);
	}
	
	// Add quick add button handlers
	const quickAddButtons = document.querySelectorAll('.quick-add-btn');
	if (quickAddButtons.length > 0) {
		quickAddButtons.forEach(btn => {
			btn.addEventListener('click', () => {
				const retailer = btn.dataset.retailer;
				const retailerInput = document.getElementById('card-retailer');
				if (retailerInput) {
					retailerInput.value = retailer;
					retailerInput.classList.add('bg-green-50', 'animate__animated', 'animate__flash');
					setTimeout(() => {
						retailerInput.classList.remove('bg-green-50', 'animate__animated', 'animate__flash');
					}, 1500);
				}
			});
		});
	}
	
	// Setup list mode switching
	setupListModeHandlers();

	// Load retailer info
	loadRetailerInfo().then(() => {
		try {
			renderLoyaltyCards();
		} catch (error) {
			console.warn('Failed to render loyalty cards:', error);
		}
	}).catch(error => {
		console.warn('Failed to load retailer info:', error);
	});

	// Initialize the list UI and add event listeners
	// Check if user is already signed in on page load
	if (auth.currentUser) {
		console.log('User already signed in on page load, refreshing lists...');
		forceRefreshCache();
		// Small delay to ensure auth state is fully established
		setTimeout(() => {
			renderListView(navigateToListItems);
		}, 200);
	} else {
		renderListView(navigateToListItems);
	}
	
	// Add the popular items enhancement for add mode
	enhanceAddItemUI();

	// Add keyboard support for back button
	document.addEventListener('keydown', function(e) {
		if (e.key === 'Escape') {
			e.preventDefault();
			handleBackButton();
		}
	});

	// Add browser back button support
	window.addEventListener('popstate', function(e) {
		e.preventDefault();
		handleBackButton();
	});

	// Refresh lists when user returns to the tab (for signed-in users)
	window.addEventListener('focus', function() {
		if (auth.currentUser) {
			console.log('Window focused, refreshing lists for signed-in user...');
			forceRefreshCache();
			renderListView(navigateToListItems);
		}
	});

	// Fix search functionality
	const searchInput = document.getElementById("search-input");
	if (searchInput) {
		// Debounced network search on input
		searchInput.addEventListener("input", (e) => {
			console.log("Search input changed:", e.target.value);
			debouncedSearch();
		});
		
		// Enter key triggers the search immediately
		searchInput.addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				handleSearch();
			}
		});
	}

	// ===== SECURITY: Add secure authentication handling =====
	
	// Login form handling with validation and rate limiting
	const loginForm = document.getElementById('login-form');
	if (loginForm) {
		loginForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			
			// Security: Rate limiting for login attempts
			if (!rateLimiter.isAllowed('login')) {
				showError('Too many login attempts. Please try again in a minute.');
				return;
			}
			
			const email = document.getElementById('login-email').value.trim();
			const password = document.getElementById('login-password').value;
			const authError = document.getElementById('auth-error');
			
			// Clear previous errors
			authError.textContent = '';
			authError.classList.add('hidden');
			
			// Validate email
			if (!isValidEmail(email)) {
				authError.textContent = 'Please enter a valid email address.';
				authError.classList.remove('hidden');
				return;
			}
			
			try {
				// Keep users signed in across sessions
				await setPersistence(auth, browserLocalPersistence);
				await signInWithEmailAndPassword(auth, email, password);
				
				// Reset rate limiter on successful login
				rateLimiter.reset('login');
			} catch (error) {
				console.error('Login error:', error);
				authError.textContent = error.message || 'Login failed. Please check your credentials.';
				authError.classList.remove('hidden');
			}
		});
	}
	
	// Signup form handling with validation
	const signupForm = document.getElementById('signup-form');
	if (signupForm) {
		signupForm.addEventListener('submit', async (e) => {
			e.preventDefault();
			
			// Security: Rate limiting for signup attempts
			if (!rateLimiter.isAllowed('signup')) {
				showError('Too many signup attempts. Please try again in a minute.');
				return;
			}
			
			const email = document.getElementById('signup-email').value.trim();
			const password = document.getElementById('signup-password').value;
			const signupError = document.getElementById('signup-error');
			
			// Clear previous errors
			signupError.textContent = '';
			signupError.classList.add('hidden');
			
			// Validate email
			if (!isValidEmail(email)) {
				signupError.textContent = 'Please enter a valid email address.';
				signupError.classList.remove('hidden');
				return;
			}
			
			// Validate password strength
			const passwordValidation = validatePassword(password);
			if (!passwordValidation.isValid) {
				signupError.textContent = passwordValidation.message;
				signupError.classList.remove('hidden');
				return;
			}
			
			try {
				// Keep users signed in across sessions
				await setPersistence(auth, browserLocalPersistence);
				await createUserWithEmailAndPassword(auth, email, password);
				
				// Reset rate limiter on successful signup
				rateLimiter.reset('signup');
			} catch (error) {
				console.error('Signup error:', error);
				signupError.textContent = error.message || 'Signup failed. Please try again.';
				signupError.classList.remove('hidden');
			}
		});
	}
	
	// Listen for auth state changes
	onAuthStateChanged(auth, async (user) => {
		console.log('Auth state changed:', user ? 'User signed in' : 'User signed out');
		currentUser = user;
		const loginSection = document.getElementById('login-section');
		const signupSection = document.getElementById('signup-section');
		const userInfo = document.getElementById('user-info');
		const userEmail = document.getElementById('user-email');
		const authenticatedSettings = document.getElementById('authenticated-settings');
		
		if (user) {
			// User is signed in
			console.log('User signed in:', user.email);
			
			// Update UI - hide both login and signup sections
			if (loginSection) loginSection.classList.add('hidden');
			if (signupSection) signupSection.classList.add('hidden');
			if (userInfo) {
				userInfo.classList.remove('hidden');
				
				// Sanitize the email before displaying it
				if (userEmail) userEmail.textContent = sanitizeInput(user.email);
				
				// Add logout button if not already present
				if (!document.getElementById('logout-button')) {
					const logoutButton = document.createElement('button');
					logoutButton.id = 'logout-button';
					logoutButton.className = 'w-full py-2 rounded bg-red-600 text-white hover:bg-red-700';
					logoutButton.textContent = 'Logout';
					
					logoutButton.addEventListener('click', async () => {
						try {
							await signOut(auth);
						} catch (error) {
							console.error('Logout error:', error);
							showError('Failed to log out.');
						}
					});
					
					userInfo.appendChild(logoutButton);
				}
			}
			
			// Show authenticated settings
			if (authenticatedSettings) authenticatedSettings.classList.remove('hidden');
			
			// Force refresh cache and reload lists for the signed-in user
			console.log('User signed in, migrating any anonymous lists and refreshing...');
			// Migrate any lists that may have been saved under 'anonymous' before login
			await migrateAnonymousListsToUser();
			forceRefreshCache(); // Clear any cached data
			
			// Use a longer delay for the initial auth state change to ensure everything is ready
			setTimeout(() => {
				console.log('Refreshing lists after auth state change...');
				renderListView(navigateToListItems);
			}, 500); // Longer delay to ensure auth state is fully established
		} else {
			// User is signed out
			console.log('User signed out');
			
			// Update UI - show login section by default
			if (loginSection) loginSection.classList.remove('hidden');
			if (signupSection) signupSection.classList.add('hidden');
			if (userInfo) userInfo.classList.add('hidden');
			
			// Hide authenticated settings
			if (authenticatedSettings) authenticatedSettings.classList.add('hidden');
			
			// Refresh lists to show anonymous data
			forceRefreshCache(); // Clear cached data for signed-out user
			renderListView(navigateToListItems);
		}
	});

	// Initialize voice dictation functionality
	initializeSpeechRecognition();
	
	// Add event listener for voice dictate button
	const voiceButton = document.getElementById('voice-dictate-button');
	if (voiceButton) {
		voiceButton.addEventListener('click', toggleVoiceDictation);
	}

	console.log("Initial setup complete.");
	
	// Test search functionality after a short delay
	setTimeout(() => {
		testSearchFunctionality();
	}, 1000);
});

// Global add mode functions
function enterAddMode() {
	console.log('Entering add mode');
	isAdding = true;
	
	const emptyListView = document.getElementById('empty-list-view');
	const addItemsView = document.getElementById('add-items-view');
	const listsContainer = document.getElementById('list-items-container');
	const addFab = document.getElementById('add-more-items-fab');
	const listItemsView = document.getElementById('list-items-view');
	const headerSearchBox = document.querySelector('.header-search-box');
	const addItemInput = document.getElementById('add-item-input');
	
	// Mark the list view as being in "adding" mode for CSS selectors
	if (listItemsView) {
		listItemsView.classList.add('adding');
		
		// Ensure the header search box is visible
		if (headerSearchBox) {
			headerSearchBox.style.display = 'flex';
			
			// Force display of header searchbox
			setTimeout(() => {
				headerSearchBox.style.display = 'flex';
			}, 50);
		}
	}
	
	emptyListView.classList.add('hidden');
	listsContainer.classList.add('hidden');
	addItemsView.classList.remove('hidden');
	addItemsView.classList.add('shown'); // Add the shown class to trigger CSS display rules
	if (addFab) addFab.classList.add('hidden');
	
	// Initialize suggestions
	enhanceAddItemUI();
	
	// Clear any existing progress bar from the container
	const listItemsContainer = document.getElementById('list-items-container');
	if (listItemsContainer) {
		const firstChild = listItemsContainer.firstElementChild;
		if (firstChild && firstChild.classList.contains('animate__animated')) {
			firstChild.remove();
		}
	}
	
	// Focus the input with multiple attempts to make sure it works
	if (addItemInput) {
		addItemInput.focus();
		
		// Multiple attempts to ensure focus works
		setTimeout(() => {
			addItemInput.focus();
			addItemInput.click();
		}, 50);
		
		setTimeout(() => {
			addItemInput.focus();
		}, 200);
	}
}

function exitAddMode() {
	console.log('Exiting add mode');
	console.log('Current view before exit:', currentView);
	console.log('Current open list ID:', currentOpenListId);
	isAdding = false;
	
	const emptyListView = document.getElementById('empty-list-view');
	const addItemsView = document.getElementById('add-items-view');
	const listsContainer = document.getElementById('list-items-container');
	const addFab = document.getElementById('add-more-items-fab');
	const listItemsView = document.getElementById('list-items-view');
	const headerSearchBox = document.querySelector('.header-search-box');
	
	// Remove the adding class from the list view
	if (listItemsView) {
		listItemsView.classList.remove('adding');
		// Ensure the header search box is hidden
		if (headerSearchBox) {
			headerSearchBox.style.display = 'none';
		}
	}
	
	// Hide add items view
	addItemsView.classList.remove('shown');
	addItemsView.classList.add('hidden');
	
	// Get the current list and check if it has items
	getShoppingLists().then(lists => {
		const currentList = lists.find(list => list.id === currentOpenListId);
		
		if (!currentList || currentList.items.length === 0) {
			// Show empty state if no items
			console.log('Showing empty list view');
			emptyListView.classList.remove('hidden');
			listsContainer.classList.add('hidden');
			if (addFab) addFab.classList.add('hidden');
		} else {
			// Show the list items if there are items
			console.log('Showing list items');
			emptyListView.classList.add('hidden');
			listsContainer.classList.remove('hidden');
			renderListItemsView(currentOpenListId, removeItemFromList, deleteList, navigateBackToLists);
			if (addFab) addFab.classList.remove('hidden');
		}
	}).catch(err => {
		console.error('Error getting shopping lists:', err);
		// Fall back to empty view on error
		emptyListView.classList.remove('hidden');
		listsContainer.classList.add('hidden');
		if (addFab) addFab.classList.add('hidden');
	});
}

// Set up handlers for switching between empty and add modes
function setupListModeHandlers() {
	// Element refs
	const startAddBtn = document.getElementById('start-adding-button');
	const doneAddBtn = document.getElementById('done-adding-button');
	const addInput = document.getElementById('add-item-input');
	const addFab = document.getElementById('add-more-items-fab');

	// Button event hooks
	if (startAddBtn) {
		startAddBtn.addEventListener('click', enterAddMode);
	}
	
	if (doneAddBtn) {
		doneAddBtn.addEventListener('click', exitAddMode);
	}
	
	if (addFab) {
		addFab.addEventListener('click', enterAddMode);
	}
	
	// Add item handlers
	if (addInput) {
		addInput.addEventListener('keypress', e => {
			if (e.key === 'Enter') {
				e.preventDefault();
				handleAddItemManually();
			}
		});
	}
	

}

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

// Function to get recent items from localStorage
function getRecentItems() {
	const recentItems = localStorage.getItem('recentItems');
	return recentItems ? JSON.parse(recentItems) : [];
}

// Function to add an item to recent items
function addToRecentItems(itemName) {
	const recentItems = getRecentItems();
	
	// Only add if it's not already the most recent item
	if (recentItems.length === 0 || recentItems[0] !== itemName) {
		// Remove the item if it already exists in the list to avoid duplicates
		const filteredItems = recentItems.filter(item => item !== itemName);
		
		// Add new item to the beginning of the array
		filteredItems.unshift(itemName);
		
		// Keep only the 15 most recent items
		const trimmedItems = filteredItems.slice(0, 15);
		
		// Save to localStorage
		localStorage.setItem('recentItems', JSON.stringify(trimmedItems));
	}
}

// Price Comparison Functions
async function handleComparePrices() {
	if (!currentOpenListId) {
		showError('No list selected for comparison.');
		return;
	}

	try {
		isComparingPrices = true;
		showComparisonLoading();
		
		// Get the current list
		const lists = await getShoppingLists();
		const currentList = lists.find(list => list.id === currentOpenListId);
		
		if (!currentList || currentList.items.length === 0) {
			showError('No items in the current list to compare.');
			return;
		}

		// Get item names from the list
		const itemNames = currentList.items.map(item => item.name);
		
		// Perform price comparison
		const comparisonResults = await comparePricesAcrossStores(itemNames);
		
		// Store the results and show them
		currentComparisonData = {
			listId: currentOpenListId,
			listName: currentList.name,
			items: itemNames,
			results: comparisonResults,
			timestamp: new Date().toISOString()
		};
		
		renderComparisonResults(comparisonResults);
		showComparisonModal();
		
	} catch (error) {
		console.error('Price comparison error:', error);
		showError('Failed to compare prices. Please try again.');
	} finally {
		isComparingPrices = false;
		hideComparisonLoading();
	}
}



async function comparePricesAcrossStores(itemNames) {
	const stores = ['Checkers', 'Pick n Pay', 'Woolworths', 'Shoprite', 'Makro'];
	const results = [];
	
	for (const store of stores) {
		try {
			const storeData = await calculateStoreTotal(itemNames, store);
			results.push({
				store: store,
				total: storeData.total,
				items: itemNames.length,
				itemDetails: storeData.items,
				missingItems: storeData.missingItems,
				savings: 0 // Will be calculated after all stores are processed
			});
		} catch (error) {
			console.error(`Error calculating total for ${store}:`, error);
			results.push({
				store: store,
				total: null,
				items: itemNames.length,
				error: 'Unable to calculate prices'
			});
		}
	}
	
	// Sort by total price (lowest first), excluding stores with errors
	const validResults = results.filter(result => result.total !== null);
	const invalidResults = results.filter(result => result.total === null);
	
	validResults.sort((a, b) => a.total - b.total);
	
	// Calculate savings relative to the cheapest store
	if (validResults.length > 0) {
		const cheapestTotal = validResults[0].total;
		validResults.forEach(result => {
			result.savings = result.total - cheapestTotal;
		});
	}
	
	return [...validResults, ...invalidResults];
}

async function calculateStoreTotal(itemNames, store) {
	try {
		// Call the backend API for price comparison
		const response = await fetch('http://localhost:3001/api/compare-basket', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				items: itemNames
			})
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}

		const data = await response.json();
		
		// Find the store data in the response
		const storeData = data[store];
		if (!storeData) {
			throw new Error(`No data found for store: ${store}`);
		}

		return {
			total: storeData.totalPrice || 0,
			items: storeData.foundItems || [],
			missingItems: storeData.missingItems || []
		};
		
	} catch (error) {
		console.error(`Error fetching prices for ${store}:`, error);
		
		// Fallback to mock data if backend fails
		const mockPrices = {
			'Checkers': {
				'bread': 15.99, 'bagels': 12.50, 'cookies': 8.99, 'almond milk': 25.99,
				'chicken': 45.99, 'milk': 18.99, 'butter': 22.50, 'cheese': 35.99,
				'eggs': 28.99, 'yogurt': 15.99, 'muffins': 12.99, 'croissants': 8.50,
				'cereal': 45.99, 'half and half': 18.99, 'steak': 89.99
			},
			'Pick n Pay': {
				'bread': 16.99, 'bagels': 13.50, 'cookies': 9.99, 'almond milk': 27.99,
				'chicken': 47.99, 'milk': 19.99, 'butter': 23.50, 'cheese': 37.99,
				'eggs': 29.99, 'yogurt': 16.99, 'muffins': 13.99, 'croissants': 9.50,
				'cereal': 47.99, 'half and half': 19.99, 'steak': 92.99
			},
			'Woolworths': {
				'bread': 18.99, 'bagels': 15.50, 'cookies': 11.99, 'almond milk': 29.99,
				'chicken': 52.99, 'milk': 22.99, 'butter': 26.50, 'cheese': 42.99,
				'eggs': 32.99, 'yogurt': 18.99, 'muffins': 15.99, 'croissants': 11.50,
				'cereal': 52.99, 'half and half': 22.99, 'steak': 99.99
			},
			'Shoprite': {
				'bread': 14.99, 'bagels': 11.50, 'cookies': 7.99, 'almond milk': 23.99,
				'chicken': 42.99, 'milk': 17.99, 'butter': 20.50, 'cheese': 32.99,
				'eggs': 26.99, 'yogurt': 14.99, 'muffins': 11.99, 'croissants': 7.50,
				'cereal': 42.99, 'half and half': 17.99, 'steak': 79.99
			},
			'Makro': {
				'bread': 13.99, 'bagels': 10.50, 'cookies': 6.99, 'almond milk': 21.99,
				'chicken': 39.99, 'milk': 16.99, 'butter': 19.50, 'cheese': 29.99,
				'eggs': 24.99, 'yogurt': 13.99, 'muffins': 10.99, 'croissants': 6.50,
				'cereal': 39.99, 'half and half': 16.99, 'steak': 74.99
			}
		};
		
		let total = 0;
		let foundItems = 0;
		
		for (const itemName of itemNames) {
			const lowerItemName = itemName.toLowerCase();
			
			// Try to find a matching item in the store's price list
			for (const [priceItem, price] of Object.entries(mockPrices[store] || {})) {
				if (priceItem.toLowerCase().includes(lowerItemName) || 
					lowerItemName.includes(priceItem.toLowerCase())) {
					total += price;
					foundItems++;
					break;
				}
			}
			
			// If no exact match found, add a default price
			if (foundItems < itemNames.indexOf(itemName) + 1) {
				total += 20; // Default price for items not in our mock data
			}
		}
		
		// Create mock item details for fallback
		const mockItems = itemNames.map(itemName => {
			const lowerItemName = itemName.toLowerCase();
			let price = 20; // Default price
			
			// Try to find a matching item in the store's price list
			for (const [priceItem, itemPrice] of Object.entries(mockPrices[store] || {})) {
				if (priceItem.toLowerCase().includes(lowerItemName) || 
					lowerItemName.includes(priceItem.toLowerCase())) {
					price = itemPrice;
					break;
				}
			}
			
			return {
				name: itemName,
				price: price,
				details: { name: itemName, price: price, retailer: store }
			};
		});
		
		return {
			total: Math.round(total * 100) / 100,
			items: mockItems,
			missingItems: []
		};
	}
}

function renderComparisonResults(results) {
	const container = document.getElementById('comparison-results');
	const loadingState = document.getElementById('comparison-loading');
	
	// Hide loading state
	if (loadingState) loadingState.classList.add('hidden');
	
	// Clear previous results
	if (container) container.innerHTML = '';
	
	if (results.length === 0) {
		if (container) container.innerHTML = '<p class="text-center text-sm opacity-70" style="color: var(--main-text);">No comparison results available.</p>';
		return;
	}
	
	// Show results
	if (container) container.classList.remove('hidden');
	
	results.forEach((result, index) => {
		const card = document.createElement('div');
		card.className = 'p-3 rounded-lg border transition-all duration-200 hover:scale-105 cursor-pointer';
		card.style.cssText = `
			background: var(--card-bg);
			color: var(--card-text);
			border-color: var(--border-color);
			box-shadow: 0 2px 8px rgba(0,0,0,0.08);
		`;
		
		if (result.total === null) {
			// Error state
			card.innerHTML = `
				<div class="flex items-center justify-between">
					<div class="flex items-center space-x-2">
						<div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
							<span class="text-sm font-bold text-gray-500">${result.store.charAt(0)}</span>
						</div>
						<div>
							<h3 class="font-medium text-sm">${result.store}</h3>
							<p class="text-xs opacity-70">${result.error}</p>
						</div>
					</div>
					<div class="text-right">
						<span class="text-xs opacity-50">--</span>
					</div>
				</div>
			`;
		} else {
			// Success state
			const isCheapest = index === 0 && result.savings === 0;
			const savingsText = result.savings > 0 ? `+R${result.savings.toFixed(2)}` : '';
			
			card.innerHTML = `
				<div class="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
					<div class="flex items-center space-x-2">
						<div class="w-8 h-8 rounded-full flex items-center justify-center ${isCheapest ? 'bg-green-100' : 'bg-gray-100'}" style="background: ${isCheapest ? 'var(--accent)' : 'var(--card-bg)'}; color: ${isCheapest ? 'var(--accent-text)' : 'var(--card-text)'}">
							<span class="text-sm font-bold">${result.store.charAt(0)}</span>
						</div>
						<div>
							<h3 class="font-medium text-sm">${result.store}</h3>
							<p class="text-xs opacity-70">${result.items} items • Tap to see details</p>
						</div>
					</div>
					<div class="text-right">
						<div class="text-base font-bold">R${result.total.toFixed(2)}</div>
						${savingsText ? `<div class="text-xs ${result.savings > 0 ? 'text-red-500' : 'text-green-500'}">${savingsText}</div>` : ''}
					</div>
				</div>
			`;
			
			// Add click handler to show detailed prices
			card.addEventListener('click', () => {
				showStoreDetails(result.store, result);
			});
		}
		
		if (container) container.appendChild(card);
	});
}

function showComparisonLoading() {
	const loadingState = document.getElementById('comparison-loading');
	const emptyState = document.getElementById('comparison-empty');
	const resultsContainer = document.getElementById('comparison-results');
	
	if (loadingState) loadingState.classList.remove('hidden');
	if (emptyState) emptyState.classList.add('hidden');
	if (resultsContainer) resultsContainer.classList.add('hidden');
}

function hideComparisonLoading() {
	const loadingState = document.getElementById('comparison-loading');
	if (loadingState) loadingState.classList.add('hidden');
}

function showComparisonModal() {
	const modal = document.getElementById('price-comparison-modal');
	if (!modal) {
		console.error('Price comparison modal not found');
		return;
	}
	modal.classList.remove('hidden');
	modal.classList.add('animate__fadeIn');
	
	// Add click handler to close modal when clicking outside
	modal.addEventListener('click', (e) => {
		if (e.target === modal) {
			hideComparisonModal();
		}
	});
}

function hideComparisonModal() {
	const modal = document.getElementById('price-comparison-modal');
	if (!modal) {
		console.error('Price comparison modal not found');
		return;
	}
	modal.classList.add('hidden');
	modal.classList.remove('animate__fadeIn');
}

function showStoreDetails(storeName, storeData) {
	const modal = document.getElementById('price-comparison-modal');
	if (!modal) return;
	
	// Update modal content to show store details
	const modalContent = modal.querySelector('.w-full');
	if (!modalContent) return;
	
	modalContent.innerHTML = `
		<div class="w-full bg-white dark:bg-gray-800 rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex justify-between items-center mb-4">
				<div class="flex items-center space-x-2">
					<button id="back-to-comparison" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--main-text);">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
						</svg>
					</button>
					<h3 class="text-lg font-semibold" style="color: var(--main-text);">${storeName} - Item Details</h3>
				</div>
				<button id="close-comparison-modal" class="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6" style="color: var(--main-text);">
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Store Summary -->
			<div class="mb-6 p-4 rounded-lg" style="background: var(--card-bg); border: 1px solid var(--border-color);">
				<div class="flex items-center justify-between">
					<div>
						<h4 class="font-semibold text-lg" style="color: var(--main-text);">${storeName}</h4>
						<p class="text-sm opacity-70" style="color: var(--main-text);">${storeData.items} items</p>
					</div>
					<div class="text-right">
						<div class="text-2xl font-bold" style="color: var(--main-text);">R${storeData.total.toFixed(2)}</div>
						${storeData.savings > 0 ? `<div class="text-sm text-red-500">+R${storeData.savings.toFixed(2)} more than cheapest</div>` : '<div class="text-sm text-green-500">Cheapest option!</div>'}
					</div>
				</div>
			</div>

			<!-- Item List -->
			<div class="space-y-3">
				<h5 class="font-medium text-sm" style="color: var(--main-text);">Item Prices:</h5>
				${storeData.itemDetails ? storeData.itemDetails.map(item => `
					<div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--card-bg); border: 1px solid var(--border-color);">
						<div>
							<h6 class="font-medium text-sm" style="color: var(--main-text);">${item.name}</h6>
							<p class="text-xs opacity-70" style="color: var(--main-text);">${item.details.name}</p>
						</div>
						<div class="text-right">
							<div class="font-semibold text-sm" style="color: var(--main-text);">R${item.price.toFixed(2)}</div>
						</div>
					</div>
				`).join('') : '<p class="text-center text-sm opacity-70" style="color: var(--main-text);">No item details available</p>'}
			</div>
		</div>
	`;
	
	// Add event listeners
	const backButton = modalContent.querySelector('#back-to-comparison');
	const closeButton = modalContent.querySelector('#close-comparison-modal');
	
	if (backButton) {
		backButton.addEventListener('click', () => {
			// Restore original comparison view
			renderComparisonResults(currentComparisonData.results);
		});
	}
	
	if (closeButton) {
		closeButton.addEventListener('click', hideComparisonModal);
	}
}

// Enhanced navigation system
function navigateToView(viewId, fromView = null) {
	console.log(`navigateToView called: ${viewId} from ${fromView}`);
	if (fromView && fromView !== viewId) {
		navigationHistory.push(fromView);
	}
	currentView = viewId;
	showView(viewId);
}

function goBack() {
	console.log("goBack called. History:", navigationHistory);
	if (navigationHistory.length > 0) {
		const previousView = navigationHistory.pop();
		console.log(`Navigating back to: ${previousView}`);
		currentView = previousView;
		showView(previousView);
	} else {
		console.log("No navigation history, going to default view");
		currentView = 'list-tab';
		showView('list-tab');
	}
	updateBackButtonVisibility();
}

// Function to update back button visibility based on navigation state
function updateBackButtonVisibility() {
	// Only update the list items back button
	const backButton = document.getElementById('back-to-lists-button');
	if (backButton) {
		if (currentView === 'list-items-view') {
			backButton.style.opacity = '1';
			backButton.style.pointerEvents = 'auto';
		} else {
			backButton.style.opacity = '0';
			backButton.style.pointerEvents = 'none';
		}
	}
}

// Universal back button handler
function handleBackButton() {
	console.log("handleBackButton called");
	// Check if we're in list-items-view and possibly in add mode
	if (currentView === 'list-items-view') {
		const listItemsViewEl = document.getElementById('list-items-view');
		if (listItemsViewEl && listItemsViewEl.classList.contains('adding')) {
			if (typeof exitAddMode === 'function') exitAddMode();
			return;
		}
		if (typeof navigateBackToLists === 'function') {
			navigateBackToLists();
			return;
		}
	}
	// Check if any modal is open
	const modals = [
		'modal-overlay',
		'add-card-modal', 
		'list-selection-modal',
		'card-detail-modal',
		'price-comparison-modal'
	];
	for (const modalId of modals) {
		const modal = document.getElementById(modalId);
		if (modal && !modal.classList.contains('hidden')) {
			closeAllModals();
			return;
		}
	}
	// Fallback to general back navigation
	goBack();
}

// Close any open modal in a generic way
function closeAllModals() {
	console.log("closeAllModals called");
	const modals = [
		'modal-overlay',
		'add-card-modal', 
		'list-selection-modal',
		'card-detail-modal',
		'price-comparison-modal'
	];
	for (const modalId of modals) {
		const modal = document.getElementById(modalId);
		if (modal && !modal.classList.contains('hidden')) {
			modal.classList.add('hidden');
			if (modalId === 'add-card-modal' && typeof hideAddCardModal === 'function') {
				hideAddCardModal();
			}
			if (modalId === 'price-comparison-modal') {
				hideComparisonModal();
			}
		}
	}
}

// Reinstate backend search function and normalize responses
async function fetchSearchResults(query) {
	// Additional sanitization before request
	const sanitizedQuery = sanitizeInput(query);
	const endpoint = `http://localhost:3001/api/search?query=${encodeURIComponent(sanitizedQuery)}`;
	
	const resp = await fetch(endpoint, { method: 'GET' });
	if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	const data = await resp.json();
	
	// Helper: choose best match from a list of products for a retailer
	function pickBestMatch(products, q) {
		if (!Array.isArray(products) || products.length === 0) return null;
		const qLower = q.toLowerCase();
		// Score by: name contains query, then lowest numeric price
		const scored = products.map(p => {
			const name = (p.name || '').toLowerCase();
			const contains = name.includes(qLower) ? 1 : 0;
			const priceNum = typeof p.price === 'number' ? p.price : parseFloat(String(p.price).replace(/[^0-9.]/g, ''));
			return { p, contains, priceNum: isNaN(priceNum) ? Infinity : priceNum };
		});
		scored.sort((a,b) => {
			if (b.contains !== a.contains) return b.contains - a.contains; // prefer contains
			return a.priceNum - b.priceNum; // then cheaper
		});
		return scored[0].p;
	}
	
	// Three possible shapes:
	// 1) { query, results: [ { name, price, retailer, ... } ] } - flat array
	// 2) { query, retailers: [ { name: 'Checkers', results: [...], error, message } ] } - retailers array
	// 3) { query, results: { Checkers: [...], Shoprite: [...], ... } } - results as object (current backend)
	if (Array.isArray(data.results)) {
		// Group to one item per retailer
		const byRetailer = {};
		for (const item of data.results) {
			const retailer = item.retailer || item.store || 'Unknown';
			if (!byRetailer[retailer]) byRetailer[retailer] = [];
			byRetailer[retailer].push(item);
		}
		const expectedRetailers = ['Checkers','Shoprite','Pick n Pay','Makro','Woolworths','PriceCheck'];
		const picked = expectedRetailers.map(r => {
			const best = pickBestMatch(byRetailer[r] || [], sanitizedQuery);
			if (!best) return { name: sanitizedQuery, price: null, retailer: r, id: `${r}-${sanitizedQuery}` };
			return {
				id: best.id || `${r}-${sanitizedQuery}`,
				name: best.name || sanitizedQuery,
				price: best.price,
				retailer: r,
				imageUrl: best.imageUrl || null,
				url: best.url || null,
			};
		}).filter(Boolean);
		// Sort by price (known first)
		return picked.sort((a,b) => {
			const ap = a.price == null ? Infinity : parseFloat(String(a.price).replace(/[^0-9.]/g, ''));
			const bp = b.price == null ? Infinity : parseFloat(String(b.price).replace(/[^0-9.]/g, ''));
			return ap - bp;
		});
	}
	if (data.results && typeof data.results === 'object' && !Array.isArray(data.results)) {
		// Handle results as object with retailer keys (current backend format)
		const expectedRetailers = ['Checkers','Shoprite','Pick n Pay','Makro','Woolworths','PriceCheck'];
		const picked = expectedRetailers.map(retailer => {
			// Map frontend retailer names to backend keys
			const retailerKey = retailer === 'Pick n Pay' ? 'PicknPay' : retailer;
			const products = data.results[retailerKey] || [];
			const best = pickBestMatch(products, sanitizedQuery);
			// Only return retailers that actually have products (no placeholders)
			if (!best) return null;
			return {
				id: best.id || `${retailer}-${sanitizedQuery}`,
				name: best.name || sanitizedQuery,
				price: best.price,
				retailer: retailer,
				imageUrl: best.imageUrl || best.image || null,
				url: best.url || null,
			};
		}).filter(Boolean);
		// Sort by price (known first)
		return picked.sort((a,b) => {
			const ap = a.price == null ? Infinity : parseFloat(String(a.price).replace(/[^0-9.]/g, ''));
			const bp = b.price == null ? Infinity : parseFloat(String(b.price).replace(/[^0-9.]/g, ''));
			return ap - bp;
		});
	}
	if (Array.isArray(data.retailers)) {
		// Strategy: pick the first matching product per retailer to represent a price for the query
		const expectedRetailers = ['Checkers','Shoprite','Pick n Pay','Makro','Woolworths','PriceCheck'];
		const mapByName = Object.fromEntries(data.retailers.map(r => [r.name, r]));
		const picked = expectedRetailers.map(rName => {
			const r = mapByName[rName];
			const first = r && Array.isArray(r.results) ? pickBestMatch(r.results, sanitizedQuery) : null;
			// Only return retailers that actually have products (no placeholders)
			if (!first) return null;
			return {
				id: first.id || `${rName}-${sanitizedQuery}`,
				name: first.name || sanitizedQuery,
				price: first.price,
				retailer: first.retailer || rName,
				imageUrl: first.imageUrl || null,
				url: first.url || null,
			};
		}).filter(Boolean);
		return picked.sort((a,b) => {
			const ap = a.price == null ? Infinity : parseFloat(String(a.price).replace(/[^0-9.]/g, ''));
			const bp = b.price == null ? Infinity : parseFloat(String(b.price).replace(/[^0-9.]/g, ''));
			return ap - bp;
		});
	}
	return [];
}

// Splash screen functionality
function initializeSplashScreen() {
	const splashScreen = document.getElementById('splash-screen');
	const body = document.body;
	
	if (!splashScreen) {
		console.warn('Splash screen element not found');
		return;
	}

	// Add splash-visible class to body
	body.classList.add('splash-visible');

	// Function to hide splash screen
	function hideSplashScreen() {
		// Add fade-out animation
		splashScreen.classList.add('fade-out');
		
		// Remove splash screen after animation completes
		setTimeout(() => {
			splashScreen.classList.add('hidden');
			body.classList.remove('splash-visible');
			console.log('Splash screen hidden');
		}, 500); // Match the CSS animation duration
	}

	// Allow tapping to dismiss splash screen (mobile-friendly)
	splashScreen.addEventListener('click', hideSplashScreen);
	splashScreen.addEventListener('touchend', (e) => {
		e.preventDefault();
		hideSplashScreen();
	});

	// Auto-hide splash screen after 3 seconds
	setTimeout(hideSplashScreen, 3000);
}

// Update the API base URL to work with both local and deployed versions
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'http://localhost:3001' 
  : 'https://your-deployed-api-url.com'; // You'll need to update this

async function searchProducts(query, retailers = []) {
	// Show loading state
	errorHandler.showLoading('Searching for products...');
	
	try {
		console.log(`Searching Firestore for: "${query}"`);
		
		// Validate search query
		if (!errorHandler.validateInput(query, { required: true, minLength: 2 }, 'Search query')) {
			errorHandler.hideLoading();
			return null;
		}
		
		// Check if offline
		if (!navigator.onLine) {
			errorHandler.hideLoading();
			errorHandler.showWarning('Offline Mode', 'You are offline. Showing cached results.');
			return getCachedSearchResults(query, retailers);
		}
		
		// Build Firestore query
		let q = collection(db, 'products');
		
		// Add filters if specified
		if (retailers.length > 0) {
			q = query(q, where('retailer', 'in', retailers));
		}
		
		// Order by most recent
		q = query(q, orderBy('updated_at', 'desc'), limit(100));
		
		// Execute query
		const querySnapshot = await getDocs(q);
		
		// Process results
		const products = [];
		querySnapshot.forEach((doc) => {
			const data = doc.data();
			products.push({
				id: doc.id,
				...data
			});
		});
		
		// Filter by search query (Firestore doesn't support full-text search easily)
		const queryLower = query.toLowerCase();
		const filteredProducts = products.filter(product => {
			const name = (product.name || product.title || '').toLowerCase();
			const description = (product.description || '').toLowerCase();
			const category = (product.category || '').toLowerCase();
			const brand = (product.brand || '').toLowerCase();
			
			return name.includes(queryLower) || 
				   description.includes(queryLower) || 
				   category.includes(queryLower) || 
				   brand.includes(queryLower);
		});
		
		// Group by retailer
		const results = {};
		filteredProducts.forEach(product => {
			const retailer = product.retailer || 'Unknown';
			if (!results[retailer]) {
				results[retailer] = [];
			}
			results[retailer].push(product);
		});
		
		// Apply location-based filtering if available (temporarily disabled)
		/*
		if (locationUI && locationUI.isLocationEnabled) {
			const locationFilteredResults = locationUI.filterResultsByLocation(results, selectedStore);
			
			// Re-group results with location information
			const newResults = {};
			Object.entries(locationFilteredResults).forEach(([retailer, products]) => {
				newResults[retailer] = products;
			});
			
			// Sort retailers by proximity if no specific store is selected
			if (!selectedStore) {
				const sortedRetailers = Object.keys(newResults).sort((a, b) => {
					const aProducts = newResults[a];
					const bProducts = newResults[b];
					const aDistance = aProducts[0]?.distance || Infinity;
					const bDistance = bProducts[0]?.distance || Infinity;
					return aDistance - bDistance;
				});
				
				const sortedResults = {};
				sortedRetailers.forEach(retailer => {
					sortedResults[retailer] = newResults[retailer];
				});
				
				results = sortedResults;
			} else {
				results = newResults;
			}
		}
		*/
		
		const response = {
			query,
			totalProducts: filteredProducts.length,
			results,
			from_firestore: true
			// locationEnabled: locationUI ? locationUI.isLocationEnabled : false,
			// selectedStore: selectedStore
		};
		
		console.log(`Found ${filteredProducts.length} products in Firestore`);
		
		// Cache results for offline use
		cacheSearchResults(query, response);
		
		// Hide loading and show success message
		errorHandler.hideLoading();
		
		if (filteredProducts.length === 0) {
			errorHandler.showInfo('No Results', `No products found for "${query}". Try different keywords or check spelling.`);
		} else {
			errorHandler.showSuccess('Search Complete', `Found ${filteredProducts.length} products for "${query}"`);
		}
		
		return response;
		
	} catch (error) {
		errorHandler.hideLoading();
		console.error('Firestore search error:', error);
		
		// Show error notification with retry option
		errorHandler.handleError(error, 'search', true);
		
		// Fall back to cached or mock data
		console.warn('Falling back to cached/mock data');
		errorHandler.showWarning('Using Cached Data', 'Real data is temporarily unavailable. Showing cached results.');
		return getCachedSearchResults(query, retailers) || getMockSearchResults(query, retailers);
	}
}

// Keep the mock data function as fallback
function getMockSearchResults(query, retailers = []) {
	const mockData = {
		'milk': {
			'Checkers': [
				{ id: '1', name: 'Clover Low Fat Milk 1L', price: 21.99, retailer: 'Checkers', url: 'https://www.checkers.co.za' },
				{ id: '2', name: 'Parmalat EasyGest UHT Lactose Free Milk 1L', price: 26.99, retailer: 'Checkers', url: 'https://www.checkers.co.za' }
			],
			'Shoprite': [
				{ id: '3', name: 'Ritebrand Full Cream Milk 1L', price: 16.99, retailer: 'Shoprite', url: 'https://www.shoprite.co.za' },
				{ id: '4', name: 'Darling Fresh Full Cream Milk 500ml', price: 13.99, retailer: 'Shoprite', url: 'https://www.shoprite.co.za' }
			]
		},
		'bread': {
			'Checkers': [
				{ id: '5', name: 'Albany Brown Bread 700g', price: 15.99, retailer: 'Checkers', url: 'https://www.checkers.co.za' }
			],
			'Shoprite': [
				{ id: '6', name: 'Albany Brown Bread 700g', price: 14.99, retailer: 'Shoprite', url: 'https://www.shoprite.co.za' }
			]
		},
		'eggs': {
			'Checkers': [
				{ id: '7', name: 'Farm Fresh Eggs 6 Pack', price: 28.99, retailer: 'Checkers', url: 'https://www.checkers.co.za' }
			],
			'Shoprite': [
				{ id: '8', name: 'Farm Fresh Eggs 6 Pack', price: 26.99, retailer: 'Shoprite', url: 'https://www.shoprite.co.za' }
			]
		}
	};

	const queryLower = query.toLowerCase();
	const results = {};

	// Find matching products
	for (const [searchTerm, retailers] of Object.entries(mockData)) {
		if (searchTerm.includes(queryLower) || queryLower.includes(searchTerm)) {
			Object.assign(results, retailers);
		}
	}

	// If no specific match, return some general results
	if (Object.keys(results).length === 0) {
		results['Checkers'] = [
			{ id: '9', name: `${query} (Generic)`, price: 25.99, retailer: 'Checkers', url: 'https://www.checkers.co.za' }
		];
		results['Shoprite'] = [
			{ id: '10', name: `${query} (Generic)`, price: 23.99, retailer: 'Shoprite', url: 'https://www.shoprite.co.za' }
		];
	}

	return {
		query,
		totalProducts: Object.values(results).flat().length,
		results
	};
}

// Import service worker manager
import swManager from './sw-register.js';

// Import error handler
import errorHandler from './errorHandler.js';

// Import Firestore functions
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  getDocs,
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from './firebase.js';

// ... existing code ...

// Load initial data
async function loadInitialData() {
	try {
		console.log('Loading initial data...');
		
		// Load retailer information
		await loadRetailerInfo();
		
		// Load any cached data
		await loadCachedData();
		
		console.log('Initial data loaded successfully');
		
	} catch (error) {
		console.error('Failed to load initial data:', error);
		errorHandler.handleError(error, 'data-loading', false);
	}
}

// Load cached data
async function loadCachedData() {
	try {
		console.log('Loading cached data...');
		
		// Load cached search results
		const searchCache = localStorage.getItem('searchCache');
		if (searchCache) {
			console.log('Found cached search data');
		}
		
		// Load cached shopping lists
		const shoppingListCache = localStorage.getItem('shoppingList');
		if (shoppingListCache) {
			console.log('Found cached shopping list data');
		}
		
		console.log('Cached data loaded successfully');
		
	} catch (error) {
		console.error('Failed to load cached data:', error);
	}
}

// Enhanced initialization with PWA support
async function initializeApp() {
	try {
		console.log('Initializing Smart Shopper SA...');
		
		// Show loading during initialization
		errorHandler.showLoading('Loading Smart Shopper SA...');
		
		// Initialize storage (storage module doesn't have initialize function)
		// await storage.initialize();
		
		// Initialize UI components
		// ui.initialize(); // Removed - ui module doesn't have initialize function
		
		// Load initial data
		await loadInitialData();
		
		// Initialize PWA features
		await initializePWA();
		
		// Hide loading
		errorHandler.hideLoading();
		
		// Show welcome message
		if (swManager.isAppInstalled()) {
			errorHandler.showSuccess('Welcome Back!', 'Smart Shopper SA is ready to help you find the best prices');
		} else {
			errorHandler.showSuccess('Welcome!', 'Smart Shopper SA is ready to help you find the best prices');
		}
		
		console.log('App initialized successfully');
		
	} catch (error) {
		errorHandler.hideLoading();
		errorHandler.handleError(error, 'app-initialization', true);
		
		// Show fallback UI
		showErrorState('Unable to initialize app', () => {
			location.reload();
		});
	}
}

// Initialize PWA features
async function initializePWA() {
	try {
		console.log('Initializing PWA features...');
		
		// Check if app is installed
		if (swManager.isAppInstalled()) {
			console.log('App is installed as PWA');
			
			// Add PWA-specific features
			document.body.classList.add('pwa-installed');
			
			// Show PWA status in UI
			showPWAStatus();
		}
		
		// Check connection status
		const connectionInfo = swManager.getConnectionInfo();
		console.log('Connection info:', connectionInfo);
		
		// Set up offline/online indicators
		setupConnectionIndicators();
		
		console.log('PWA features initialized');
		
	} catch (error) {
		console.error('Failed to initialize PWA features:', error);
	}
}

// Show PWA status in UI
function showPWAStatus() {
	const statusIndicator = document.createElement('div');
	statusIndicator.className = 'pwa-status';
	statusIndicator.innerHTML = `
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
		</svg>
		<span>App Installed</span>
	`;
	
	const header = document.querySelector('header');
	if (header) {
		header.appendChild(statusIndicator);
	}
}

// Set up connection indicators
function setupConnectionIndicators() {
	const connectionIndicator = document.createElement('div');
	connectionIndicator.id = 'connection-indicator';
	connectionIndicator.className = 'connection-indicator';
	
	// Update connection status
	function updateConnectionStatus() {
		const isOnline = navigator.onLine;
		connectionIndicator.className = `connection-indicator ${isOnline ? 'online' : 'offline'}`;
		connectionIndicator.innerHTML = `
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				${isOnline ? 
					'<path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>' :
					'<line x1="1" y1="1" x2="23" y2="23"></line><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path><path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path><path d="M8.53 16.11a12 12 0 0 1 6.95 0"></path><line x1="12" y1="20" x2="12.01" y2="20"></line>'
				}
			</svg>
			<span>${isOnline ? 'Online' : 'Offline'}</span>
		`;
	}
	
	// Initial status
	updateConnectionStatus();
	
	// Listen for changes
	window.addEventListener('online', updateConnectionStatus);
	window.addEventListener('offline', updateConnectionStatus);
	
	// Add to page
	const header = document.querySelector('header');
	if (header) {
		header.appendChild(connectionIndicator);
	}
}



// Show error state with retry option
function showErrorState(message, retryCallback) {
	const mainContent = document.querySelector('main');
	if (mainContent) {
		mainContent.innerHTML = `
			<div class="error-state">
				<div class="error-state-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<circle cx="12" cy="12" r="10"></circle>
						<line x1="15" y1="9" x2="9" y2="15"></line>
						<line x1="9" y1="9" x2="15" y2="15"></line>
					</svg>
				</div>
				<h3 class="error-state-title">Something Went Wrong</h3>
				<p class="error-state-message">${message}</p>
				${retryCallback ? `<button class="error-state-action" onclick="(${retryCallback})()">Try Again</button>` : ''}
			</div>
		`;
	}
}

// Initialize speech recognition (placeholder for future implementation)
function initializeSpeechRecognition() {
	console.log('Speech recognition initialization - placeholder for future implementation');
	// TODO: Implement speech recognition functionality
}

// Toggle voice dictation (placeholder for future implementation)
function toggleVoiceDictation() {
	console.log('Voice dictation toggle - placeholder for future implementation');
	// TODO: Implement voice dictation functionality
}

// Test search functionality (placeholder for future implementation)
function testSearchFunctionality() {
	console.log('Search functionality test - placeholder for future implementation');
	// TODO: Implement search functionality testing
}

// Cache search results for offline use
function cacheSearchResults(query, results) {
	try {
		const searchCache = JSON.parse(localStorage.getItem('searchCache') || '{}');
		searchCache[query.toLowerCase()] = {
			results,
			timestamp: Date.now()
		};
		
		// Keep only last 20 searches
		const keys = Object.keys(searchCache);
		if (keys.length > 20) {
			const oldestKey = keys.reduce((oldest, key) => 
				searchCache[key].timestamp < searchCache[oldest].timestamp ? key : oldest
			);
			delete searchCache[oldestKey];
		}
		
		localStorage.setItem('searchCache', JSON.stringify(searchCache));
	} catch (error) {
		console.error('Failed to cache search results:', error);
	}
}

// Get cached search results
function getCachedSearchResults(query, retailers = []) {
	try {
		const searchCache = JSON.parse(localStorage.getItem('searchCache') || '{}');
		const cached = searchCache[query.toLowerCase()];
		
		if (cached && (Date.now() - cached.timestamp) < 24 * 60 * 60 * 1000) { // 24 hours
			console.log('Using cached search results');
			return cached.results;
		}
	} catch (error) {
		console.error('Failed to get cached search results:', error);
	}
	
	return null;
}

// Enhanced addToShoppingList with offline support
async function addToShoppingList(product) {
	try {
		// Validate product
		if (!product || !product.name) {
			throw new Error('Invalid product data');
		}
		
		// Show loading
		errorHandler.showLoading('Adding to shopping list...');
		
		// Add to list (using addItemToList instead of addToShoppingList)
		// For now, we'll add to the first available list or create a default list
		const lists = await storage.getShoppingLists();
		let targetListId = null;
		
		if (lists.length === 0) {
			// Create a default list if none exists
			await storage.addList('My Shopping List');
			const newLists = await storage.getShoppingLists();
			targetListId = newLists[0]?.id;
		} else {
			targetListId = lists[0].id; // Use the first list
		}
		
		const success = targetListId ? await storage.addItemToList(targetListId, product) : false;
		
		errorHandler.hideLoading();
		
		if (success) {
			errorHandler.showSuccess('Added to List', `${product.name} has been added to your shopping list`);
			updateShoppingListUI();
			
			// Sync to server when online
			if (navigator.onLine) {
				syncShoppingList();
			}
		} else {
			errorHandler.showWarning('Already in List', `${product.name} is already in your shopping list`);
		}
		
	} catch (error) {
		errorHandler.hideLoading();
		errorHandler.handleError(error, 'shopping-list', true);
	}
}

// Update shopping list UI
function updateShoppingListUI() {
	try {
		console.log('Updating shopping list UI...');
		
		// Trigger list view refresh
		if (typeof renderListView === 'function') {
			renderListView();
		}
		
		console.log('Shopping list UI updated');
		
	} catch (error) {
		console.error('Failed to update shopping list UI:', error);
	}
}

// Sync shopping list to server
async function syncShoppingList() {
	try {
		const shoppingLists = await storage.getShoppingLists();
		
		// Send to server (implement when backend is ready)
		console.log('Syncing shopping lists to server:', shoppingLists);
		
	} catch (error) {
		console.error('Failed to sync shopping lists:', error);
	}
}

// Enhanced search results display with location information
function displayLocationEnhancedSearchResults(searchResults, containerId = 'search-results-container') {
	const container = document.getElementById(containerId);
	if (!container || !searchResults) return;
	
	container.innerHTML = '';
	
	// Check if location is enabled
	const hasLocation = locationUI && locationUI.isLocationEnabled;
	const hasSelectedStore = selectedStore !== null;
	
	// Add location status header if location is enabled
	if (hasLocation) {
		const locationHeader = document.createElement('div');
		locationHeader.className = 'mb-4 p-3 rounded-lg border';
		locationHeader.style.cssText = `
			background: var(--card-bg);
			border-color: var(--border-color);
		`;
		
		let headerText = '📍 Location-based results';
		if (hasSelectedStore) {
			headerText += ` - Showing results from ${selectedStore.name}`;
		} else {
			const nearbyStores = locationUI.getNearbyStores();
			headerText += ` - ${nearbyStores.length} stores within ${locationUI.currentRadius}km`;
		}
		
		locationHeader.innerHTML = `
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-2">
					<span class="text-sm font-medium" style="color: var(--card-text);">${headerText}</span>
				</div>
				${hasSelectedStore ? `
					<button id="clear-store-filter" class="text-xs px-2 py-1 rounded border transition-colors" 
						style="background: var(--input-bg); color: var(--main-text); border-color: var(--border-color);">
						Clear Filter
					</button>
				` : ''}
			</div>
		`;
		
		container.appendChild(locationHeader);
		
		// Add clear filter functionality
		if (hasSelectedStore) {
			const clearButton = locationHeader.querySelector('#clear-store-filter');
			if (clearButton) {
				clearButton.addEventListener('click', () => {
					selectedStore = null;
					locationUI.highlightSelectedStore(null);
					displayLocationEnhancedSearchResults(searchResults, containerId);
				});
			}
		}
	}
	
	// Display search results with location enhancement
	if (searchResults.results && typeof searchResults.results === 'object') {
		Object.entries(searchResults.results).forEach(([retailer, products]) => {
			if (!Array.isArray(products) || products.length === 0) return;
			
			// Get location info for this retailer
			let locationInfo = '';
			if (hasLocation && products[0]) {
				const product = products[0];
				if (product.distanceText) {
					locationInfo = `<span class="text-xs px-2 py-1 rounded-full ml-2" 
						style="background: var(--accent); color: var(--accent-text);">${product.distanceText}</span>`;
				}
			}
			
			// Create retailer section
			const retailerSection = document.createElement('div');
			retailerSection.className = 'mb-4';
			
			const retailerHeader = document.createElement('h3');
			retailerHeader.className = 'text-lg font-semibold mb-3 flex items-center';
			retailerHeader.style.color = 'var(--card-text)';
			retailerHeader.innerHTML = `
				${retailer}
				${locationInfo}
			`;
			
			retailerSection.appendChild(retailerHeader);
			
			// Create products container
			const productsContainer = document.createElement('div');
			productsContainer.className = 'space-y-2';
			
			products.forEach(product => {
				const productCard = createProductCard(product, hasLocation);
				productsContainer.appendChild(productCard);
			});
			
			retailerSection.appendChild(productsContainer);
			container.appendChild(retailerSection);
		});
	} else if (Array.isArray(searchResults)) {
		// Handle flat array results
		searchResults.forEach(product => {
			const productCard = createProductCard(product, hasLocation);
			container.appendChild(productCard);
		});
	}
}

// Create individual product card with location information
function createProductCard(product, showLocation = false) {
	const productCard = document.createElement('div');
	productCard.className = 'p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow';
	productCard.style.cssText = `
		background: var(--card-bg);
		border-color: var(--border-color);
	`;
	
	// Product header with location info
	const productHeader = document.createElement('div');
	productHeader.className = 'flex items-center justify-between mb-2';
	
	const productName = document.createElement('h5');
	productName.className = 'text-sm font-medium';
	productName.style.color = 'var(--card-text)';
	productName.textContent = product.name || 'Unknown Product';
	
	const rightSection = document.createElement('div');
	rightSection.className = 'flex items-center space-x-2';
	
	// Add distance if available
	if (showLocation && product.distanceText) {
		const distance = document.createElement('span');
		distance.className = 'text-xs px-2 py-1 rounded-full';
		distance.style.cssText = `
			background: var(--accent);
			color: var(--accent-text);
		`;
		distance.textContent = product.distanceText;
		rightSection.appendChild(distance);
	}
	
	// Add price if available
	if (product.price) {
		const price = document.createElement('span');
		price.className = 'text-sm font-semibold';
		price.style.color = 'var(--card-text)';
		price.textContent = typeof product.price === 'string' ? product.price : `R ${product.price.toFixed(2)}`;
		rightSection.appendChild(price);
	}
	
	productHeader.appendChild(productName);
	productHeader.appendChild(rightSection);
	
	// Product details
	const productDetails = document.createElement('div');
	productDetails.className = 'text-xs mb-2';
	productDetails.style.color = 'var(--secondary-text)';
	
	let detailsText = product.retailer || 'Unknown Retailer';
	if (product.description) {
		detailsText += ` • ${product.description}`;
	}
	productDetails.textContent = detailsText;
	
	// Product actions
	const productActions = document.createElement('div');
	productActions.className = 'flex space-x-2';
	
	const addToListBtn = document.createElement('button');
	addToListBtn.className = 'text-xs px-2 py-1 rounded border transition-colors';
	addToListBtn.style.cssText = `
		background: var(--accent);
		color: var(--accent-text);
		border-color: var(--accent);
	`;
	addToListBtn.textContent = 'Add to List';
	addToListBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		addToShoppingList(product);
	});
	
	// Add directions button if location is enabled and store is nearby
	if (showLocation && locationUI) {
		const nearbyStores = locationUI.getNearbyStores();
		const nearbyStore = nearbyStores.find(store => store.retailer === product.retailer);
		
		if (nearbyStore) {
			const directionsBtn = document.createElement('button');
			directionsBtn.className = 'text-xs px-2 py-1 rounded border transition-colors';
			directionsBtn.style.cssText = `
				background: var(--input-bg);
				color: var(--main-text);
				border-color: var(--border-color);
			`;
			directionsBtn.textContent = 'Directions';
			directionsBtn.addEventListener('click', (e) => {
				e.stopPropagation();
				locationUI.openDirections(nearbyStore);
			});
			productActions.appendChild(directionsBtn);
		}
	}
	
	productActions.appendChild(addToListBtn);
	
	// Assemble card
	productCard.appendChild(productHeader);
	productCard.appendChild(productDetails);
	productCard.appendChild(productActions);
	
	return productCard;
}

// Global error handler for unhandled errors
window.addEventListener('error', (event) => {
	errorHandler.handleError(event.error, 'unhandled-error', true);
});

// Global promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
	errorHandler.handleError(event.reason, 'unhandled-promise-rejection', true);
});

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);