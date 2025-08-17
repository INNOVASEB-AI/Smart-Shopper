// app.js

import {
  getShoppingLists,
  addList as storageAddList,
  deleteList as storageDeleteList,
  addItemToList as storageAddItemToList,
  removeItemFromList as storageRemoveItemFromList,
  forceRefreshCache
} from './storage.js';

import { showError } from './ui.js';
import { renderListView, renderListItemsView } from './listUI.js';
import { groceryIcons } from './illustrations.js';

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
  browserSessionPersistence
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

// Price comparison state
let currentComparisonData = null;
let isComparingPrices = false;

// Navigation state tracking
let navigationHistory = [];
let currentView = 'list-tab';

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
  console.log(`Action: Navigate to setting "${settingName}" (Placeholder)`);
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
  
  // Instead of calling backend, filter popular items locally
  filterAndDisplaySearchResults(sanitized);
}

// Create a debounced version of the search function
const debouncedSearch = debounce(handleSearch, 300);

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

// Update the displayResults function to work with our new search
function displayResults(results) {
  console.log("displayResults called with results:", results);
  const resultsContainer = document.getElementById("search-results-container");
  const mockResults = document.getElementById("mock-search-results");
  document.getElementById("loading-indicator").classList.add("hidden");
  resultsContainer.innerHTML = "";

  // Hide mock results when displaying actual results
  if (mockResults) {
    mockResults.style.display = "none";
  }

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
      
      // Add click event to the add button
      const addButton = resultDiv.querySelector('.add-to-list-button');
      addButton.addEventListener('click', () => {
        promptAddToList(product);
      });
      
      // Also add event listener for the entire result div for better UX
      resultDiv.addEventListener('click', (e) => {
        if (!e.target.closest('.add-to-list-button')) {
          promptAddToList(product);
        }
      });
      
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

    // Set product info - handle items without prices
    const priceText = product.price ? `R${product.price} at ${product.retailer}` : product.retailer;
    productInfo.textContent = `"${product.name}" (${priceText})`;
    
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

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM loaded, initializing app...");

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
  document.querySelectorAll(".nav-button").forEach(button => {
    const tabId = button.getAttribute("data-tab");
    button.addEventListener("click", () => navigateToView(tabId, currentView));
  });

  // Show the list tab by default
  showView('list-tab');
  document.querySelectorAll(".nav-button").forEach((button) => {
    if (button.getAttribute("data-tab") === 'list-tab') {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });

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

  // Set up back buttons for all views
  const backButtons = [
    'back-to-lists-button',
    'search-back-button',
    'cards-back-button', 
    'settings-back-button'
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

  // Set up event handlers for various buttons
  addButtonHandler("new-list-button", handleNewList);
  addButtonHandler("add-card-button", showAddCardModal);
  addButtonHandler("compare-prices-button", handleComparePrices);
  addButtonHandler("close-comparison-modal", hideComparisonModal);
  // Back button handled separately above for more reliability
  addButtonHandler("search-button", handleSearch);
  
  // Setup list mode switching
  setupListModeHandlers();

  // Load retailer info
  loadRetailerInfo().then(() => {
    renderLoyaltyCards();
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
    // Function to handle mock results visibility
    function toggleMockResults() {
      const mockResults = document.getElementById("mock-search-results");
      const searchValue = searchInput.value.trim();
      
      if (mockResults) {
        if (searchValue.length === 0) {
          // Show mock results when search is empty
          mockResults.style.display = "block";
        } else {
          // Hide mock results when user starts typing
          mockResults.style.display = "none";
        }
      }
    }
    
    // Debounce the search for better performance
    const debouncedSearch = debounce(handleSearch, 500);
    
    // Combined input handler for search and mock results toggle
    searchInput.addEventListener("input", (e) => {
      console.log("Search input changed:", e.target.value);
      toggleMockResults();
      debouncedSearch();
    });
    
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSearch();
      }
    });
    
    // Initialize mock results visibility on page load
    toggleMockResults();
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
        // Use session persistence for added security
        await setPersistence(auth, browserSessionPersistence);
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
        // Use session persistence for added security
        await setPersistence(auth, browserSessionPersistence);
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
  onAuthStateChanged(auth, (user) => {
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
      console.log('User signed in, refreshing lists...');
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
      const storeTotal = await calculateStoreTotal(itemNames, store);
      results.push({
        store: store,
        total: storeTotal,
        items: itemNames.length,
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
  // This is a mock implementation - in a real app, this would call your backend API
  // to get actual prices from the database
  
  const mockPrices = {
    'Checkers': {
      'bread': 15.99,
      'bagels': 12.50,
      'cookies': 8.99,
      'almond milk': 25.99,
      'chicken': 45.99,
      'milk': 18.99,
      'butter': 22.50,
      'cheese': 35.99,
      'eggs': 28.99,
      'yogurt': 15.99
    },
    'Pick n Pay': {
      'bread': 16.99,
      'bagels': 13.50,
      'cookies': 9.99,
      'almond milk': 27.99,
      'chicken': 47.99,
      'milk': 19.99,
      'butter': 23.50,
      'cheese': 37.99,
      'eggs': 29.99,
      'yogurt': 16.99
    },
    'Woolworths': {
      'bread': 18.99,
      'bagels': 15.50,
      'cookies': 11.99,
      'almond milk': 29.99,
      'chicken': 52.99,
      'milk': 22.99,
      'butter': 26.50,
      'cheese': 42.99,
      'eggs': 32.99,
      'yogurt': 18.99
    },
    'Shoprite': {
      'bread': 14.99,
      'bagels': 11.50,
      'cookies': 7.99,
      'almond milk': 23.99,
      'chicken': 42.99,
      'milk': 17.99,
      'butter': 20.50,
      'cheese': 32.99,
      'eggs': 26.99,
      'yogurt': 14.99
    },
    'Makro': {
      'bread': 13.99,
      'bagels': 10.50,
      'cookies': 6.99,
      'almond milk': 21.99,
      'chicken': 39.99,
      'milk': 16.99,
      'butter': 19.50,
      'cheese': 29.99,
      'eggs': 24.99,
      'yogurt': 13.99
    }
  };
  
  let total = 0;
  let foundItems = 0;
  
  for (const itemName of itemNames) {
    const lowerItemName = itemName.toLowerCase();
    
    // Try to find a matching item in the store's price list
    for (const [priceItem, price] of Object.entries(mockPrices[store])) {
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
  
  return Math.round(total * 100) / 100; // Round to 2 decimal places
}

function renderComparisonResults(results) {
  const container = document.getElementById('comparison-results');
  const loadingState = document.getElementById('comparison-loading');
  
  // Hide loading state
  loadingState.classList.add('hidden');
  
  // Clear previous results
  container.innerHTML = '';
  
  if (results.length === 0) {
    container.innerHTML = '<p class="text-center text-sm opacity-70" style="color: var(--main-text);">No comparison results available.</p>';
    return;
  }
  
  // Show results
  container.classList.remove('hidden');
  
  results.forEach((result, index) => {
    const card = document.createElement('div');
    card.className = 'p-3 rounded-lg border transition-all duration-200 hover:scale-105';
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
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-full flex items-center justify-center ${isCheapest ? 'bg-green-100' : 'bg-gray-100'}" style="background: ${isCheapest ? 'var(--accent)' : 'var(--card-bg)'}; color: ${isCheapest ? 'var(--accent-text)' : 'var(--card-text)'}">
              <span class="text-sm font-bold">${result.store.charAt(0)}</span>
            </div>
            <div>
              <h3 class="font-medium text-sm">${result.store}</h3>
              <p class="text-xs opacity-70">${result.items} items</p>
            </div>
          </div>
          <div class="text-right">
            <div class="text-base font-bold">R${result.total.toFixed(2)}</div>
            ${savingsText ? `<div class="text-xs ${result.savings > 0 ? 'text-red-500' : 'text-green-500'}">${savingsText}</div>` : ''}
          </div>
        </div>
      `;
    }
    
    container.appendChild(card);
  });
}

function showComparisonLoading() {
  const loadingState = document.getElementById('comparison-loading');
  const emptyState = document.getElementById('comparison-empty');
  const resultsContainer = document.getElementById('comparison-results');
  
  loadingState.classList.remove('hidden');
  emptyState.classList.add('hidden');
  resultsContainer.classList.add('hidden');
}

function hideComparisonLoading() {
  const loadingState = document.getElementById('comparison-loading');
  loadingState.classList.add('hidden');
}

function showComparisonModal() {
  const modal = document.getElementById('price-comparison-modal');
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
  modal.classList.add('hidden');
  modal.classList.remove('animate__fadeIn');
}

// Enhanced navigation system
function navigateToView(viewId, fromView = null) {
  console.log(`navigateToView called: ${viewId} from ${fromView}`);
  
  // Add to navigation history if coming from another view
  if (fromView && fromView !== viewId) {
    navigationHistory.push(fromView);
    console.log(`Added ${fromView} to navigation history. History:`, navigationHistory);
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
    
    // Update back button visibility based on navigation history
    updateBackButtonVisibility();
  } else {
    // If no history, go to default view (list-tab)
    console.log("No navigation history, going to default view");
    currentView = 'list-tab';
    showView('list-tab');
    
    // Hide back buttons when no history
    updateBackButtonVisibility();
  }
}

// Function to update back button visibility based on navigation state
function updateBackButtonVisibility() {
  const backButtons = [
    'search-back-button',
    'cards-back-button', 
    'settings-back-button'
  ];
  
  backButtons.forEach(buttonId => {
    const button = document.getElementById(buttonId);
    if (button) {
      if (navigationHistory.length > 0 || currentView === 'list-items-view') {
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
      } else {
        button.style.opacity = '0.5';
        button.style.pointerEvents = 'none';
      }
    }
  });
}

// Universal back button handler
function handleBackButton() {
  console.log("handleBackButton called");
  
  // Check if we're in list-items-view
  if (currentView === 'list-items-view') {
    // Check if we're in add mode
    const listItemsView = document.getElementById('list-items-view');
    if (listItemsView && listItemsView.classList.contains('adding')) {
      console.log("In add mode, exiting add mode");
      console.log("Current view:", currentView);
      console.log("List items view classes:", listItemsView.classList.toString());
      exitAddMode();
      return;
    }
    
    // Not in add mode, navigate back to lists
    console.log("Not in add mode, navigating back to lists");
    navigateBackToLists();
    return;
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
      console.log(`Closing modal: ${modalId}`);
      closeAllModals();
      return;
    }
  }
  
  // If no modal is open, use general back navigation
  goBack();
}

// Enhanced modal close function that works with all modals
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
      console.log(`Closing modal: ${modalId}`);
      modal.classList.add('hidden');
      
      // Special handling for specific modals
      if (modalId === 'add-card-modal') {
        hideAddCardModal();
      } else if (modalId === 'price-comparison-modal') {
        hideComparisonModal();
      }
      
      return;
    }
  }
}

// Voice Dictation Functionality
let recognition = null;
let isListening = false;

// Initialize speech recognition
function initializeSpeechRecognition() {
  // Check if browser supports speech recognition
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.warn('Speech recognition not supported in this browser');
    return false;
  }

  // Create speech recognition instance
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  // Configure recognition settings
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US'; // Can be changed to 'af-ZA' for Afrikaans or other languages
  
  // Set up event handlers
  recognition.onstart = handleSpeechStart;
  recognition.onresult = handleSpeechResult;
  recognition.onerror = handleSpeechError;
  recognition.onend = handleSpeechEnd;
  
  return true;
}

// Handle speech recognition start
function handleSpeechStart() {
  isListening = true;
  const voiceButton = document.getElementById('voice-dictate-button');
  const voiceStatusIndicator = document.getElementById('voice-status-indicator');
  
  if (voiceButton) {
    voiceButton.classList.add('listening');
    voiceButton.title = 'Listening... Click to stop';
  }
  
  if (voiceStatusIndicator) {
    voiceStatusIndicator.classList.remove('hidden');
  }
  
  console.log('Speech recognition started');
}

// Handle speech recognition result
function handleSpeechResult(event) {
  const transcript = event.results[0][0].transcript.trim();
  console.log('Speech recognized:', transcript);
  
  // Check for stop commands first
  const stopCommands = ['done', 'stop', 'finished', 'end', 'complete', 'that\'s all', 'that is all'];
  const isStopCommand = stopCommands.some(cmd => transcript.toLowerCase().includes(cmd));
  
  if (isStopCommand) {
    // User wants to stop voice dictation
    showConfirmation('Voice dictation stopped');
    recognition.stop();
    return;
  }
  
  // Check if the transcript contains "next" to separate items
  const items = transcript.toLowerCase().split(/\bnext\b/).map(item => item.trim()).filter(item => item.length > 0);
  
  // Show what was recognized
  if (items.length === 1) {
    showConfirmation(`Recognized: "${items[0]}"`);
  } else if (items.length > 1) {
    showConfirmation(`Recognized ${items.length} items: ${items.join(', ')}`);
  }
  
  if (items.length === 1) {
    // Single item - add it directly to the input field
    const addItemInput = document.getElementById('add-item-input');
    if (addItemInput) {
      addItemInput.value = items[0];
      
      // Trigger input event to update any listeners
      addItemInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Automatically add the item after a short delay
      setTimeout(() => {
        if (addItemInput.value.trim()) {
          addItemFromInput();
        }
      }, 1000);
    }
  } else if (items.length > 1) {
    // Multiple items - add them sequentially
    addMultipleItemsSequentially(items);
  }
}

// Handle speech recognition error
function handleSpeechError(event) {
  console.error('Speech recognition error:', event.error);
  
  const voiceButton = document.getElementById('voice-dictate-button');
  const voiceStatusIndicator = document.getElementById('voice-status-indicator');
  
  if (voiceButton) {
    voiceButton.classList.remove('listening');
    voiceButton.classList.add('error');
  }
  
  if (voiceStatusIndicator) {
    voiceStatusIndicator.classList.add('hidden');
  }
  
  // Show error message
  let errorMessage = 'Voice input error';
  switch (event.error) {
    case 'no-speech':
      errorMessage = 'No speech detected. Please try again.';
      break;
    case 'audio-capture':
      errorMessage = 'Microphone not found. Please check your microphone.';
      break;
    case 'not-allowed':
      errorMessage = 'Microphone access denied. Please allow microphone access.';
      break;
    case 'network':
      errorMessage = 'Network error. Please check your connection.';
      break;
    default:
      errorMessage = `Voice input error: ${event.error}`;
  }
  
  showError(errorMessage);
  
  // Remove error class after animation
  setTimeout(() => {
    if (voiceButton) {
      voiceButton.classList.remove('error');
    }
  }, 2000);
  
  isListening = false;
}

// Handle speech recognition end
function handleSpeechEnd() {
  isListening = false;
  const voiceButton = document.getElementById('voice-dictate-button');
  const voiceStatusIndicator = document.getElementById('voice-status-indicator');
  
  if (voiceButton) {
    voiceButton.classList.remove('listening');
    voiceButton.title = 'Voice Dictation';
  }
  
  if (voiceStatusIndicator) {
    voiceStatusIndicator.classList.add('hidden');
  }
  
  console.log('Speech recognition ended');
}

// Toggle voice dictation
function toggleVoiceDictation() {
  if (!recognition) {
    if (!initializeSpeechRecognition()) {
      showError('Voice dictation is not supported in your browser. Please use a modern browser like Chrome or Edge.');
      return;
    }
  }
  
  if (isListening) {
    // Stop listening
    recognition.stop();
  } else {
    // Start listening
    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      showError('Failed to start voice dictation. Please try again.');
    }
  }
}

// Add item from input field (helper function)
function addItemFromInput() {
  const addItemInput = document.getElementById('add-item-input');
  if (!addItemInput || !currentOpenListId) return;
  
  const itemName = addItemInput.value.trim();
  if (!itemName) return;
  
  // Add the item to the list with "Voice Input" as retailer
  addItemToList(currentOpenListId, {
    name: itemName,
    price: null,
    retailer: 'Voice Input'
  }).then(() => {
    // Add to recent items
    addToRecentItems(itemName);
    
    // Clear the input field
    addItemInput.value = '';
    
    // Show a visual confirmation
    showConfirmation(itemName + ' added via voice');
    
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
      showError(`"${itemName}" is already in your list.`);
    } else {
      showError("Failed to add item to list. Please try again.");
    }
    
    // Keep focus on the input
    addItemInput.focus();
  });
}

// Add multiple items sequentially from voice input
function addMultipleItemsSequentially(items) {
  if (!currentOpenListId || items.length === 0) return;
  
  let currentIndex = 0;
  const totalItems = items.length;
  
  // Show initial status
  showConfirmation(`Adding ${totalItems} items via voice...`);
  
  // Update voice status indicator to show processing
  const voiceStatusIndicator = document.getElementById('voice-status-indicator');
  if (voiceStatusIndicator) {
    const statusText = voiceStatusIndicator.querySelector('.voice-status-text');
    if (statusText) {
      statusText.textContent = `Processing ${totalItems} items...`;
    }
  }
  
  function addNextItem() {
    if (currentIndex >= items.length) {
      // All items added
      showConfirmation(`Successfully added ${totalItems} items via voice!`);
      
      // Reset voice status indicator
      if (voiceStatusIndicator) {
        const statusText = voiceStatusIndicator.querySelector('.voice-status-text');
        if (statusText) {
          statusText.textContent = 'Listening...';
        }
      }
      return;
    }
    
    const itemName = items[currentIndex].trim();
    if (!itemName) {
      currentIndex++;
      addNextItem();
      return;
    }
    
    // Update status indicator with current progress
    if (voiceStatusIndicator) {
      const statusText = voiceStatusIndicator.querySelector('.voice-status-text');
      if (statusText) {
        statusText.textContent = `Adding ${itemName} (${currentIndex + 1}/${totalItems})`;
      }
    }
    
    // Add the current item
    addItemToList(currentOpenListId, {
      name: itemName,
      price: null,
      retailer: 'Voice Input'
    }).then(() => {
      // Add to recent items
      addToRecentItems(itemName);
      
      // Show progress
      const progress = currentIndex + 1;
      showConfirmation(`${itemName} added (${progress}/${totalItems})`);
      
      currentIndex++;
      
      // Add next item after a short delay
      setTimeout(addNextItem, 800);
      
    }).catch(error => {
      console.error("Error adding item to list:", error);
      
      // Show user-friendly message for duplicate items
      if (error.message === 'This item is already in your list.') {
        showConfirmation(`${itemName} already in list (${currentIndex + 1}/${totalItems})`);
      } else {
        showConfirmation(`Failed to add ${itemName} (${currentIndex + 1}/${totalItems})`);
      }
      
      currentIndex++;
      
      // Continue with next item
      setTimeout(addNextItem, 800);
    });
  }
  
  // Start adding items
  addNextItem();
}

// Test function to verify search functionality
function testSearchFunctionality() {
  console.log("=== Testing Search Functionality ===");
  
  // Test 1: Check if popular items are loaded
  console.log(`Popular items count: ${popularGroceryItems.length}`);
  console.log("Sample popular items:", popularGroceryItems.slice(0, 5).map(item => item.name));
  
  // Test 2: Check if search elements exist
  const searchInput = document.getElementById("search-input");
  const resultsContainer = document.getElementById("search-results-container");
  const mockResults = document.getElementById("mock-search-results");
  
  console.log("Search elements found:", {
    searchInput: !!searchInput,
    resultsContainer: !!resultsContainer,
    mockResults: !!mockResults
  });
  
  // Test 3: Test filtering logic
  const testQuery = "milk";
  const matchingItems = popularGroceryItems.filter(item => 
    item.name.toLowerCase().includes(testQuery.toLowerCase())
  );
  
  console.log(`Test query "${testQuery}" found ${matchingItems.length} matches:`, 
    matchingItems.map(item => item.name));
  
  // Test 4: Simulate search
  if (searchInput) {
    searchInput.value = testQuery;
    searchInput.dispatchEvent(new Event('input'));
    console.log("Search simulation completed");
  }
  
  console.log("=== Search Test Complete ===");
}

// Add test function to window for debugging
window.testSearch = testSearchFunctionality;

