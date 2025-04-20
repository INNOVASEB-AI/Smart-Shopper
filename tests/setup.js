// tests/setup.js
// Setup file that runs before Jest tests

// Mock localStorage for frontend tests
if (typeof window !== 'undefined') {
  // Mock localStorage
  const localStorageMock = (function() {
    let store = {};
    return {
      getItem: function(key) {
        return store[key] || null;
      },
      setItem: function(key, value) {
        store[key] = value.toString();
      },
      clear: function() {
        store = {};
      },
      removeItem: function(key) {
        delete store[key];
      }
    };
  })();
  
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  });
  
  // Mock fetch API
  global.fetch = jest.fn();
  
  // Mock other browser APIs as needed
  window.alert = jest.fn();
  window.confirm = jest.fn(() => true);
}

// Add any global test setup here 