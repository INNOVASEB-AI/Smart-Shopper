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

// Internal state to avoid excessive Firestore reads
let cachedLists = null;
let lastUserCached = null;

// Helper function to get the current user ID or use a fallback for anonymous users
function getCurrentUserId() {
  const user = auth.currentUser;
  return user ? user.uid : 'anonymous';
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
    const listsRef = collection(db, 'users', userId, 'lists');
    const listsSnapshot = await getDocs(listsRef);
    const lists = [];
    listsSnapshot.forEach(doc => {
      lists.push(doc.data());
    });
    return lists;
  } catch (e) {
    console.error('Failed to load shopping lists from Firestore:', e);
    return [];
  }
}

// Saves lists to Firestore
async function saveShoppingListsToFirestore(lists) {
  const userId = getCurrentUserId();
  try {
    const batch = [];
    
    // First, get the list of existing docs to find ones that need deletion
    const listsRef = collection(db, 'users', userId, 'lists');
    const existingDocs = await getDocs(listsRef);
    const existingIds = new Set();
    existingDocs.forEach(doc => existingIds.add(doc.id));
    
    // Find IDs to delete (those in Firestore but not in the new lists)
    const currentIds = new Set(lists.map(list => list.id));
    const idsToDelete = [...existingIds].filter(id => !currentIds.has(id));
    
    // Queue deletions
    for (const id of idsToDelete) {
      const docRef = doc(db, 'users', userId, 'lists', id);
      batch.push(deleteDoc(docRef));
    }
    
    // Queue updates/creations
    for (const list of lists) {
      const docRef = doc(db, 'users', userId, 'lists', list.id);
      batch.push(setDoc(docRef, list));
    }
    
    // Execute all operations
    await Promise.all(batch);
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
      await migrateFromLocalStorage();
    }
    
    const lists = await getShoppingListsFromFirestore();
    cachedLists = lists;
  }
  
  return [...cachedLists]; // Return a copy to prevent direct modification
}

// Create a debounced version for better performance
const debouncedSave = debounce(saveShoppingListsToFirestore, 300);

export async function saveShoppingLists(lists) {
  cachedLists = [...lists]; // Update the cached copy
  await debouncedSave(lists);
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
  let lists = await getShoppingLists();
  lists = lists.filter(list => list.id !== listId);
  await saveShoppingLists(lists);
}

export async function addItemToList(listId, product) {
  const lists = await getShoppingLists();
  const listIndex = lists.findIndex(list => list.id === listId);
  
  if (listIndex > -1) {
    if (!Array.isArray(lists[listIndex].items)) lists[listIndex].items = [];
    
    const newItem = {
      id: product.id || `item-${Date.now()}`,
      name: product.name,
      price: product.price,
      retailer: product.retailer,
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

// Loyalty Cards Methods

let cachedCards = null;

async function getLoyaltyCardsFromFirestore() {
  const userId = getCurrentUserId();
  try {
    const cardsRef = collection(db, 'users', userId, 'loyaltyCards');
    const cardsSnapshot = await getDocs(cardsRef);
    const cards = [];
    cardsSnapshot.forEach(doc => {
      cards.push(doc.data());
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

// Set up an auth state listener to clear caches when user logs in/out
auth.onAuthStateChanged(user => {
  // Invalidate caches when auth state changes
  cachedLists = null;
  cachedCards = null;
  lastUserCached = user ? user.uid : 'anonymous';
}); 