// storage.js - Handles shopping list storage with Firestore

import { db, auth } from './firebase.js';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Debounce function for batching write operations
function debounce(func, delay) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

// Anonymous-mode storage helpers (localStorage fallback)
function getShoppingListsFromLocalStorage() {
  try {
    const raw = localStorage.getItem('shoppingLists');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to read shopping lists from localStorage:', e);
    return [];
  }
}

function saveShoppingListsToLocalStorage(lists) {
  try {
    localStorage.setItem('shoppingLists', JSON.stringify(lists || []));
    return true;
  } catch (e) {
    console.error('Failed to save shopping lists to localStorage:', e);
    return false;
  }
}

// Internal state to avoid excessive Firestore reads
let cachedLists = null;
let lastUserCached = null;

// Helper function to get the current user ID or use a fallback for anonymous users
function getCurrentUserId() {
  const user = auth.currentUser;
  if (user) {
    console.log('Current user ID:', user.uid, 'Email:', user.email);
    return user.uid;
  } else {
    console.log('No authenticated user, using anonymous ID');
    return 'anonymous';
  }
}

// Helper to detect if user changed (to invalidate cache)
function hasUserChanged() {
  const currentUser = getCurrentUserId();
  if (currentUser !== lastUserCached) {
    lastUserCached = currentUser;
    cachedLists = null; // Invalidate cache when user changes
    return true;
  }
  return false;
}

// Force refresh cache for current user
export function forceRefreshCache() {
  cachedLists = null;
  cachedCards = null;
}

// Migrates any existing lists from localStorage to Firestore for the logged-in user
async function migrateFromLocalStorage() {
  try {
    const localLists = localStorage.getItem('shoppingLists');
    if (localLists) {
      const parsedLists = JSON.parse(localLists);
      if (parsedLists && parsedLists.length > 0) {
        // First check if user already has lists in Firestore
        const existingLists = await getShoppingListsFromFirestore();
        if (existingLists.length === 0) {
          // Only migrate if the user doesn't have lists in Firestore yet
          console.log('Migrating lists from localStorage to Firestore');
          await saveShoppingListsToFirestore(parsedLists);
          // Clear localStorage after successful migration
          localStorage.removeItem('shoppingLists');
        }
      }
    }
  } catch (e) {
    console.error('Failed to migrate from localStorage:', e);
  }
}

// Gets lists from Firestore
async function getShoppingListsFromFirestore() {
  const userId = getCurrentUserId();
  try {
    // Use localStorage for anonymous users instead of Firestore (avoids rules errors)
    if (userId === 'anonymous') {
      const lists = getShoppingListsFromLocalStorage();
      console.log('Loaded', lists.length, 'lists from localStorage for anonymous user');
      return lists;
    }

    console.log('Fetching lists from Firestore for user:', userId);
    const listsRef = collection(db, 'users', userId, 'lists');
    const listsSnapshot = await getDocs(listsRef);
    const lists = [];
    listsSnapshot.forEach(d => {
      const data = d.data();
      const id = d.id;
      // Ensure the object has a stable id from the document id
      lists.push({ id, ...data });
    });
    console.log('Successfully loaded', lists.length, 'lists from Firestore');
    return lists;
  } catch (e) {
    console.error('Failed to load shopping lists from Firestore for user', userId, ':', e);
    return [];
  }
}

// Saves lists to Firestore without deleting any existing docs
async function saveShoppingListsToFirestore(lists) {
  const userId = getCurrentUserId();
  try {
    // Anonymous users persist to localStorage
    if (userId === 'anonymous') {
      return saveShoppingListsToLocalStorage(lists);
    }

    const operations = [];

    // Upsert each list; do not delete anything implicitly
    for (const list of lists) {
      const docRef = doc(db, 'users', userId, 'lists', list.id);
      operations.push(setDoc(docRef, list));
    }

    await Promise.all(operations);
    return true;
  } catch (e) {
    console.error('Failed to save shopping lists to Firestore:', e);
    return false;
  }
}

// Public API - maintains the same interface as before, but uses Firestore

export async function getShoppingLists() {
  hasUserChanged(); // Check for user change
  
  if (cachedLists === null) {
    // If user is logged in, check for localStorage migration
    if (auth.currentUser) {
      console.log('User is signed in, checking for localStorage migration...');
      await migrateFromLocalStorage();
    }
    
    // Try to load lists with retry mechanism
    let lists = [];
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        lists = await getShoppingListsFromFirestore();
        break;
      } catch (error) {
        retryCount++;
        console.warn(`Failed to load lists (attempt ${retryCount}/${maxRetries}):`, error);
        if (retryCount < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
        }
      }
    }
    
    cachedLists = lists;
    console.log('Loaded shopping lists from Firestore:', lists.length, 'lists for user:', getCurrentUserId());
  }
  
  return [...cachedLists]; // Return a copy to prevent direct modification
}

// Save immediately to ensure persistence across refreshes
export async function saveShoppingLists(lists) {
  cachedLists = [...lists]; // Update the cached copy
  await saveShoppingListsToFirestore(lists);
}

export async function addList(listName) {
  if (!listName || listName.trim() === '') return;
  
  const lists = await getShoppingLists();
  if (lists.some(l => l.name === listName.trim())) {
    throw new Error('List name already exists.');
  }
  
  const newList = {
    id: `list-${Date.now()}`,
    name: listName.trim(),
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  lists.push(newList);
  await saveShoppingLists(lists);
  return newList;
}

export async function deleteList(listId) {
  const userId = getCurrentUserId();
  try {
    if (userId !== 'anonymous') {
      const docRef = doc(db, 'users', userId, 'lists', listId);
      await deleteDoc(docRef);
    }
  } catch (e) {
    console.error('Failed to delete list from Firestore:', e);
  }
  // Update local cache and storage
  let lists = await getShoppingLists();
  lists = lists.filter(list => list.id !== listId);
  cachedLists = lists;
  if (userId === 'anonymous') {
    saveShoppingListsToLocalStorage(lists);
  }
}

export async function addItemToList(listId, product) {
  const lists = await getShoppingLists();
  const listIndex = lists.findIndex(list => list.id === listId);
  
  if (listIndex > -1) {
    if (!Array.isArray(lists[listIndex].items)) lists[listIndex].items = [];
    
    // Check if an item with the same name already exists in the list
    const itemName = product.name.trim().toLowerCase();
    const isDuplicate = lists[listIndex].items.some(item => 
      item.name.trim().toLowerCase() === itemName
    );
    
    if (isDuplicate) {
      throw new Error('This item is already in your list.');
    }
    
    const newItem = {
      id: product.id || `item-${Date.now()}`,
      name: product.name,
      price: product.price,
      retailer: product.retailer,
      completed: false,
      addedAt: new Date().toISOString()
    };
    
    lists[listIndex].items.push(newItem);
    lists[listIndex].updatedAt = new Date().toISOString();
    
    await saveShoppingLists(lists);
  } else {
    throw new Error('List not found.');
  }
}

export async function removeItemFromList(listId, itemId) {
  const lists = await getShoppingLists();
  const listIndex = lists.findIndex(list => list.id === listId);
  
  if (listIndex > -1) {
    lists[listIndex].items = lists[listIndex].items.filter(item => item.id !== itemId);
    lists[listIndex].updatedAt = new Date().toISOString();
    
    await saveShoppingLists(lists);
  }
}

// New function to toggle item completion status
export async function toggleItemCompletion(listId, itemId, isCompleted) {
  const lists = await getShoppingLists();
  const listIndex = lists.findIndex(list => list.id === listId);
  
  if (listIndex > -1) {
    const itemIndex = lists[listIndex].items.findIndex(item => item.id === itemId);
    
    if (itemIndex > -1) {
      lists[listIndex].items[itemIndex].completed = isCompleted;
      lists[listIndex].updatedAt = new Date().toISOString();
      
      await saveShoppingLists(lists);
      return true;
    }
  }
  return false;
}

// Loyalty Cards Methods

let cachedCards = null;

async function getLoyaltyCardsFromFirestore() {
  const userId = getCurrentUserId();
  try {
    const cardsRef = collection(db, 'users', userId, 'loyaltyCards');
    const cardsSnapshot = await getDocs(cardsRef);
    const cards = [];
    cardsSnapshot.forEach(d => {
      const data = d.data();
      const id = d.id;
      cards.push({ id, ...data });
    });
    return cards;
  } catch (e) {
    console.error('Failed to load loyalty cards from Firestore:', e);
    return [];
  }
}

async function saveLoyaltyCardsToFirestore(cards) {
  const userId = getCurrentUserId();
  try {
    const batch = [];
    
    // Delete all existing cards (simpler than tracking individual changes)
    const cardsRef = collection(db, 'users', userId, 'loyaltyCards');
    const existingDocs = await getDocs(cardsRef);
    existingDocs.forEach(document => {
      const docRef = doc(db, 'users', userId, 'loyaltyCards', document.id);
      batch.push(deleteDoc(docRef));
    });
    
    // Add all current cards
    for (const card of cards) {
      const cardId = card.id || `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const cardWithId = { ...card, id: cardId };
      const docRef = doc(db, 'users', userId, 'loyaltyCards', cardId);
      batch.push(setDoc(docRef, cardWithId));
    }
    
    await Promise.all(batch);
    return true;
  } catch (e) {
    console.error('Failed to save loyalty cards to Firestore:', e);
    return false;
  }
}

async function migrateCardsFromLocalStorage() {
  try {
    const localCards = localStorage.getItem('loyaltyCards');
    if (localCards) {
      const parsedCards = JSON.parse(localCards);
      if (parsedCards && parsedCards.length > 0) {
        // First check if user already has cards in Firestore
        const existingCards = await getLoyaltyCardsFromFirestore();
        if (existingCards.length === 0) {
          // Only migrate if the user doesn't have cards in Firestore yet
          console.log('Migrating loyalty cards from localStorage to Firestore');
          await saveLoyaltyCardsToFirestore(parsedCards);
          // Clear localStorage after successful migration
          localStorage.removeItem('loyaltyCards');
        }
      }
    }
  } catch (e) {
    console.error('Failed to migrate loyalty cards from localStorage:', e);
  }
}

export async function getLoyaltyCards() {
  hasUserChanged(); // Check for user change
  
  if (cachedCards === null) {
    // If user is logged in, check for localStorage migration
    if (auth.currentUser) {
      await migrateCardsFromLocalStorage();
    }
    
    const cards = await getLoyaltyCardsFromFirestore();
    cachedCards = cards;
  }
  
  return [...cachedCards]; // Return a copy to prevent direct modification
}

export async function saveLoyaltyCards(cards) {
  cachedCards = [...cards]; // Update the cached copy
  await saveLoyaltyCardsToFirestore(cards);
}

export async function migrateAnonymousListsToUser() {
  try {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;

    // Read anonymous lists
    const anonymousListsRef = collection(db, 'users', 'anonymous', 'lists');
    const anonSnapshot = await getDocs(anonymousListsRef);
    const anonymousLists = [];
    const anonIds = [];
    anonSnapshot.forEach(d => { anonymousLists.push(d.data()); anonIds.push(d.id); });

    if (anonymousLists.length === 0) {
      return;
    }

    // Check existing user lists to avoid overwriting
    const userListsRef = collection(db, 'users', userId, 'lists');
    const userSnapshot = await getDocs(userListsRef);
    const existingUserIds = new Set();
    userSnapshot.forEach(d => existingUserIds.add(d.id));

    const operations = [];

    // Copy missing anonymous lists to the user path
    for (const list of anonymousLists) {
      const listId = list.id;
      if (!existingUserIds.has(listId)) {
        const userDocRef = doc(db, 'users', userId, 'lists', listId);
        operations.push(setDoc(userDocRef, list));
      }
    }

    // Optionally clean up anonymous docs
    for (const anonId of anonIds) {
      const anonDocRef = doc(db, 'users', 'anonymous', 'lists', anonId);
      operations.push(deleteDoc(anonDocRef));
    }

    if (operations.length > 0) {
      await Promise.all(operations);
    }
  } catch (e) {
    console.error('Failed to migrate anonymous Firestore lists to user:', e);
  }
}

// Set up an auth state listener to clear caches when user logs in/out
import { onAuthStateChanged as onAuthStateChangedAuth } from './firebase.js';
onAuthStateChangedAuth(auth, (user) => {
  cachedLists = null;
  cachedCards = null;
  lastUserCached = user ? user.uid : 'anonymous';
}); 