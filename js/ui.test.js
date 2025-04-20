/**
 * @jest-environment jsdom
 */

import { showError, clearError } from './ui'; // Assuming ui.js exports these

describe('ui.js', () => {

  beforeEach(() => {
    // Reset the DOM before each test
    document.body.innerHTML = '';
    // You might need to mock setTimeout if your functions use it
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers(); // Restore real timers
  });

  describe('showError', () => {
    test('should create and display an error message div', () => {
      showError('Test Error Message');
      const errorDiv = document.getElementById('error-message');
      expect(errorDiv).not.toBeNull();
      expect(errorDiv.textContent).toBe('Test Error Message');
      expect(errorDiv.style.display).toBe('block');
    });

    test('should reuse existing error message div', () => {
      // Create an initial div
      const initialDiv = document.createElement('div');
      initialDiv.id = 'error-message';
      document.body.appendChild(initialDiv);

      showError('Another Error');
      const errorDiv = document.getElementById('error-message');
      expect(errorDiv).toBe(initialDiv); // Should be the same element
      expect(errorDiv.textContent).toBe('Another Error');
    });

    test('should hide the error message after a delay', () => {
      showError('Temporary Error');
      const errorDiv = document.getElementById('error-message');
      expect(errorDiv.style.display).toBe('block');

      // Fast-forward time
      jest.advanceTimersByTime(3000);

      expect(errorDiv.style.display).toBe('none');
    });
  });

  describe('clearError', () => {
    test('should hide the error message div if it exists', () => {
      // Show an error first
      showError('Error To Clear');
      const errorDiv = document.getElementById('error-message');
      expect(errorDiv.style.display).toBe('block');

      clearError();
      expect(errorDiv.style.display).toBe('none');
    });

    test('should not throw error if the div does not exist', () => {
      expect(() => clearError()).not.toThrow();
    });
  });

}); 