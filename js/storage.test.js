// js/storage.test.js - Tests for the storage module
import {
  getShoppingLists,
  saveShoppingLists,
  addList,
  deleteList,
  addItemToList,
  removeItemFromList
} from './storage.js';

// Mock localStorage before each test
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
  
  // Reset any mocks
  jest.clearAllMocks();
});

describe('getShoppingLists', () => {
  test('returns an empty array when no lists exist', () => {
    const lists = getShoppingLists();
    expect(lists).toEqual([]);
  });

  test('returns lists from localStorage when they exist', () => {
    // Setup: Add a mock list to localStorage
    const mockLists = [{ id: 'list-123', name: 'Test List', items: [] }];
    localStorage.setItem('shoppingLists', JSON.stringify(mockLists));
    
    // Test
    const lists = getShoppingLists();
    expect(lists).toEqual(mockLists);
  });

  test('returns empty array if localStorage throws an error', () => {
    // Setup: Make getItem throw an error
    jest.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    // Should log the error but return an empty array
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const lists = getShoppingLists();
    
    expect(consoleSpy).toHaveBeenCalled();
    expect(lists).toEqual([]);
    
    // Cleanup
    consoleSpy.mockRestore();
  });
});

describe('saveShoppingLists', () => {
  test('saves lists to localStorage', () => {
    // Setup
    const mockLists = [{ id: 'list-123', name: 'Test List', items: [] }];
    
    // Test
    saveShoppingLists(mockLists);
    
    // We need to wait for the debounced function to execute
    jest.advanceTimersByTime(300);
    
    expect(localStorage.setItem).toHaveBeenCalledWith('shoppingLists', JSON.stringify(mockLists));
  });

  test('handles localStorage errors', () => {
    // Setup: Make setItem throw an error
    jest.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('localStorage error');
    });
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Test
    saveShoppingLists([]);
    
    // We need to wait for the debounced function to execute
    jest.advanceTimersByTime(300);
    
    expect(consoleSpy).toHaveBeenCalled();
    
    // Cleanup
    consoleSpy.mockRestore();
  });
});

describe('addList', () => {
  test('adds a new list with the given name', () => {
    // Test
    addList('Grocery List');
    
    // Wait for the debounced save
    jest.advanceTimersByTime(300);
    
    // Verify
    const savedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(savedLists.length).toBe(1);
    expect(savedLists[0].name).toBe('Grocery List');
    expect(savedLists[0].items).toEqual([]);
    expect(savedLists[0].id).toMatch(/^list-\d+$/); // ID should be list-timestamp
  });

  test('trims whitespace from list name', () => {
    addList('  Grocery List  ');
    jest.advanceTimersByTime(300);
    
    const savedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(savedLists[0].name).toBe('Grocery List');
  });

  test('rejects empty list names', () => {
    addList('');
    addList('   ');
    jest.advanceTimersByTime(300);
    
    const savedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(savedLists.length).toBe(0);
  });

  test('throws error if list name already exists', () => {
    // Setup
    addList('Grocery List');
    jest.advanceTimersByTime(300);
    
    // Test
    expect(() => addList('Grocery List')).toThrow('List name already exists');
  });
});

describe('deleteList', () => {
  test('removes a list by id', () => {
    // Setup
    addList('List 1');
    addList('List 2');
    jest.advanceTimersByTime(300);
    
    const lists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    const listId = lists[0].id;
    
    // Test
    deleteList(listId);
    jest.advanceTimersByTime(300);
    
    // Verify
    const updatedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(updatedLists.length).toBe(1);
    expect(updatedLists[0].name).toBe('List 2');
  });
});

describe('addItemToList', () => {
  test('adds an item to the specified list', () => {
    // Setup
    addList('Grocery List');
    jest.advanceTimersByTime(300);
    
    const lists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    const listId = lists[0].id;
    
    const product = {
      id: 'prod-123',
      name: 'Milk',
      price: '15.99',
      retailer: 'Checkers'
    };
    
    // Test
    addItemToList(listId, product);
    jest.advanceTimersByTime(300);
    
    // Verify
    const updatedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(updatedLists[0].items.length).toBe(1);
    expect(updatedLists[0].items[0].name).toBe('Milk');
    expect(updatedLists[0].items[0].price).toBe('15.99');
    expect(updatedLists[0].items[0].retailer).toBe('Checkers');
  });

  test('generates an id if product has none', () => {
    // Setup
    addList('Grocery List');
    jest.advanceTimersByTime(300);
    
    const lists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    const listId = lists[0].id;
    
    const product = {
      name: 'Bread',
      price: '12.99',
      retailer: 'Pick n Pay'
    };
    
    // Test
    addItemToList(listId, product);
    jest.advanceTimersByTime(300);
    
    // Verify
    const updatedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(updatedLists[0].items[0].id).toMatch(/^item-\d+$/);
  });

  test('throws error if list not found', () => {
    const product = {
      name: 'Bread',
      price: '12.99',
      retailer: 'Pick n Pay'
    };
    
    expect(() => addItemToList('non-existent-id', product)).toThrow('List not found');
  });
});

describe('removeItemFromList', () => {
  test('removes an item from the specified list', () => {
    // Setup
    addList('Grocery List');
    jest.advanceTimersByTime(300);
    
    const lists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    const listId = lists[0].id;
    
    const product1 = { id: 'prod-123', name: 'Milk', price: '15.99', retailer: 'Checkers' };
    const product2 = { id: 'prod-456', name: 'Bread', price: '12.99', retailer: 'Pick n Pay' };
    
    addItemToList(listId, product1);
    addItemToList(listId, product2);
    jest.advanceTimersByTime(300);
    
    // Test
    removeItemFromList(listId, 'prod-123');
    jest.advanceTimersByTime(300);
    
    // Verify
    const updatedLists = JSON.parse(localStorage.getItem('shoppingLists') || '[]');
    expect(updatedLists[0].items.length).toBe(1);
    expect(updatedLists[0].items[0].name).toBe('Bread');
  });

  test('does nothing if list not found', () => {
    // This shouldn't throw an error
    removeItemFromList('non-existent-id', 'item-id');
  });
}); 