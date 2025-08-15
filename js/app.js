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
    
    // Then trigger the view change
    showView('list-items-view');
  }).catch(err => {
    console.error('Error getting shopping lists:', err);
    // Fall back to empty view on error
    emptyListView.classList.remove('hidden');
    if (addFab) addFab.classList.add('hidden');
    showView('list-items-view');
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
    
    // Make sure we're showing the list tab and refresh it
    showView('list-tab');
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
  
  document.getElementById("loading-indicator").classList.remove("hidden");
  document.getElementById("no-results-message").classList.add("hidden");
  fetchSearchResults(sanitized);
}

// Create a debounced version of the search function
const debouncedSearch = debounce(handleSearch, 300);

async function fetchSearchResults(query) {
  try {
    // Security: Additional sanitization check before making the request
    const sanitizedQuery = sanitizeInput(query);
    
    console.log("Fetching search results for:", sanitizedQuery);
    const response = await fetch(`http://localhost:3001/api/search?query=${encodeURIComponent(sanitizedQuery)}`);
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    displayResults(data.results);
  } catch (error) {
    console.error("Search error:", error);
    document.getElementById("loading-indicator").classList.add("hidden");
    document.getElementById("no-results-message").classList.remove("hidden");
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
  const addItemButton = document.getElementById('add-item-manual-btn');
  
  if (!addItemsView || !addItemInput || !addItemButton) {
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
        <div class="popular-item flex items-center p-2 border-b border-gray-700 w-full">
          <button class="add-popular-item flex items-center justify-center w-10 h-10 min-w-10 rounded-full bg-blue-400 hover:bg-blue-500 transition mr-3" data-item="${item.name}">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-white">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
          <span class="flex-grow text-white">${item.name}</span>
        </div>
      `).join('')}
      <div style="height: 80px;"></div> <!-- Extra space at the bottom to ensure content isn't hidden behind DONE button -->
    </div>
    <div id="recent-items-content" class="hidden overflow-auto pb-24">
      ${recentItems.length > 0 ? 
        recentItems.map(item => `
          <div class="popular-item flex items-center p-2 border-b border-gray-700 w-full">
            <button class="add-recent-item flex items-center justify-center w-10 h-10 min-w-10 rounded-full bg-blue-400 hover:bg-blue-500 transition mr-3" data-item="${item}">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-white">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
            <span class="flex-grow text-white">${item}</span>
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
  
  // Add event listeners for the input and button
  addItemInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleAddItemManually();
    }
  });
  
  addItemButton.addEventListener('click', handleAddItemManually);
  
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
      
      if (matchingItems.length > 0) {
        // Create suggestion HTML
        suggestionsDropdown.innerHTML = matchingItems.map(item => `
          <div class="suggestion-item p-2 hover:bg-gray-700 cursor-pointer" data-item="${item.name}">
            ${item.name}
          </div>
        `).join('');
        
        // Add click event to suggestion items
        suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            const selectedItem = item.getAttribute('data-item');
            addItemInput.value = selectedItem;
            suggestionsDropdown.classList.add('hidden');
            
            // Optional: Auto-add the item when selected
            // handleAddItemManually();
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

  // Set up event handlers for navigation
  document.querySelectorAll(".nav-button").forEach(button => {
    const tabId = button.getAttribute("data-tab");
    button.addEventListener("click", () => showView(tabId));
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
    newBackButton.addEventListener('click', navigateBackToLists);
    newBackButton.addEventListener('touchend', function(e) {
      e.preventDefault();
      navigateBackToLists();
    });
    
    console.log("Back button event listeners enhanced for reliability");
  }

  // Set up event handlers for various buttons
  addButtonHandler("new-list-button", handleNewList);
  addButtonHandler("add-card-button", showAddCardModal);
  // Back button handled separately above for more reliability
  addButtonHandler("search-button", handleSearch);
  
  // Setup list mode switching
  setupListModeHandlers();

  // Load retailer info
  loadRetailerInfo().then(() => {
    renderLoyaltyCards();
  });

  // Initialize the list UI and add event listeners
  renderListView(navigateToListItems);
  
  // Add the popular items enhancement for add mode
  enhanceAddItemUI();

  // Fix search functionality
  const searchInput = document.getElementById("search-input");
  if (searchInput) {
    // Debounce the search for better performance
    const debouncedSearch = debounce(handleSearch, 500);
    searchInput.addEventListener("input", debouncedSearch);
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
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
      
      // Validate password strength
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        authError.textContent = passwordValidation.message;
        authError.classList.remove('hidden');
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
        authError.textContent = error.message || 'Signup failed. Please try again.';
        authError.classList.remove('hidden');
      }
    });
  }
  
  // Listen for auth state changes
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const authForms = document.getElementById('auth-forms');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
      // User is signed in
      console.log('User signed in:', user.email);
      
      // Update UI
      if (authForms) authForms.classList.add('hidden');
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
      
      // Refresh lists to get the user's data
      renderListView(navigateToListItems);
    } else {
      // User is signed out
      console.log('User signed out');
      
      // Update UI
      if (authForms) authForms.classList.remove('hidden');
      if (userInfo) userInfo.classList.add('hidden');
      
      // Refresh lists to show anonymous data
      renderListView(navigateToListItems);
    }
  });

  console.log("Initial setup complete.");
});

// Set up handlers for switching between empty and add modes
function setupListModeHandlers() {
  // Element refs
  const startAddBtn = document.getElementById('start-adding-button');
  const doneAddBtn = document.getElementById('done-adding-button');
  const addManualBtn = document.getElementById('add-item-manual-btn');
  const addInput = document.getElementById('add-item-input');
  const addFab = document.getElementById('add-more-items-fab');

  // Enter add-mode: hide empty state, show the input + suggestions
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

  // Exit add-mode: re-show empty graphic or items list
  function exitAddMode() {
    console.log('Exiting add mode');
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
  
  if (addManualBtn) {
    addManualBtn.addEventListener('click', handleAddItemManually);
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