import { addList, getShoppingLists, addItemToList, removeItemFromList, deleteList } from '../../js/storage.js';

// Mock localStorage
beforeEach(() => {
  // Clear localStorage before each test
  localStorage.clear();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Shopping list integration', () => {
  test('Full shopping list workflow', () => {
    // 1. Create a new list
    addList('Weekly Groceries');
    jest.advanceTimersByTime(300); // Wait for debounce
    
    // Get lists and verify
    let lists = getShoppingLists();
    expect(lists.length).toBe(1);
    expect(lists[0].name).toBe('Weekly Groceries');
    expect(lists[0].items).toEqual([]);
    
    const listId = lists[0].id;
    
    // 2. Add items to the list
    const milkProduct = {
      id: 'prod-123',
      name: 'Full Cream Milk',
      price: '15.99',
      retailer: 'Checkers'
    };
    
    const breadProduct = {
      id: 'prod-456',
      name: 'Brown Bread',
      price: '12.99',
      retailer: 'Pick n Pay'
    };
    
    addItemToList(listId, milkProduct);
    jest.advanceTimersByTime(300); // Wait for debounce
    
    addItemToList(listId, breadProduct);
    jest.advanceTimersByTime(300); // Wait for debounce
    
    // 3. Verify items were added correctly
    lists = getShoppingLists();
    expect(lists[0].items.length).toBe(2);
    expect(lists[0].items[0].name).toBe('Full Cream Milk');
    expect(lists[0].items[1].name).toBe('Brown Bread');
    
    // 4. Remove an item
    removeItemFromList(listId, 'prod-123'); // Remove milk
    jest.advanceTimersByTime(300); // Wait for debounce
    
    // Verify item was removed
    lists = getShoppingLists();
    expect(lists[0].items.length).toBe(1);
    expect(lists[0].items[0].name).toBe('Brown Bread');
    
    // 5. Delete the entire list
    deleteList(listId);
    jest.advanceTimersByTime(300); // Wait for debounce
    
    // Verify list was deleted
    lists = getShoppingLists();
    expect(lists.length).toBe(0);
  });
  
  test('Adding duplicate lists is prevented', () => {
    // Create first list
    addList('Weekly Shopping');
    jest.advanceTimersByTime(300);
    
    // Try to add duplicate list
    expect(() => addList('Weekly Shopping')).toThrow('List name already exists');
    
    // Verify only one list exists
    const lists = getShoppingLists();
    expect(lists.length).toBe(1);
  });
  
  test('Handles case with multiple lists', () => {
    // Create multiple lists
    addList('Groceries');
    jest.advanceTimersByTime(300);
    
    addList('Hardware');
    jest.advanceTimersByTime(300);
    
    addList('Party Supplies');
    jest.advanceTimersByTime(300);
    
    // Verify all lists were created
    let lists = getShoppingLists();
    expect(lists.length).toBe(3);
    
    // Add items to different lists
    const firstListId = lists[0].id;
    const secondListId = lists[1].id;
    
    addItemToList(firstListId, { name: 'Milk', retailer: 'Checkers' });
    jest.advanceTimersByTime(300);
    
    addItemToList(secondListId, { name: 'Hammer', retailer: 'Builders' });
    jest.advanceTimersByTime(300);
    
    // Verify items were added to correct lists
    lists = getShoppingLists();
    expect(lists[0].items.length).toBe(1);
    expect(lists[0].items[0].name).toBe('Milk');
    expect(lists[1].items.length).toBe(1);
    expect(lists[1].items[0].name).toBe('Hammer');
    expect(lists[2].items.length).toBe(0);
    
    // Delete middle list
    deleteList(secondListId);
    jest.advanceTimersByTime(300);
    
    // Verify correct list was deleted
    lists = getShoppingLists();
    expect(lists.length).toBe(2);
    expect(lists[0].name).toBe('Groceries');
    expect(lists[1].name).toBe('Party Supplies');
  });
}); 