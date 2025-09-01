// locationUI.js - Location-based UI components for Smart Shopper SA

import LocationService from './locationService.js';
import LocationPermissionModal from './locationPermissionModal.js';

class LocationUI {
  constructor() {
    this.locationService = new LocationService();
    this.locationContainer = null;
    this.nearbyStoresContainer = null;
    this.locationButton = null;
    this.isLocationEnabled = false;
    this.currentRadius = 10; // Default radius in km
    this.permissionModal = new LocationPermissionModal();
  }

  // Initialize location UI
  init() {
    this.createLocationContainer();
    this.bindEvents();
    this.updateLocationStatus();
    
    // Check if we should show the permission modal
    this.checkAndShowPermissionModal();
  }

  // Create the main location container
  createLocationContainer() {
    // Create location section container
    this.locationContainer = document.createElement('div');
    this.locationContainer.id = 'location-container';
    this.locationContainer.className = 'mb-6 p-4 rounded-lg border';
    this.locationContainer.style.cssText = `
      background: var(--card-bg);
      border-color: var(--border-color);
    `;

    // Location header
    const locationHeader = document.createElement('div');
    locationHeader.className = 'flex items-center justify-between mb-4';
    
    const headerTitle = document.createElement('h3');
    headerTitle.className = 'text-lg font-semibold';
    headerTitle.style.color = 'var(--card-text)';
    headerTitle.textContent = '📍 Location Services';
    
    const locationToggle = document.createElement('button');
    locationToggle.id = 'location-toggle';
    locationToggle.className = 'px-3 py-1 text-sm rounded-full transition-colors';
    locationToggle.style.cssText = `
      background: var(--accent);
      color: var(--accent-text);
    `;
    locationToggle.textContent = 'Enable Location';
    
    locationHeader.appendChild(headerTitle);
    locationHeader.appendChild(locationToggle);
    
    // Location status
    const locationStatus = document.createElement('div');
    locationStatus.id = 'location-status';
    locationStatus.className = 'text-sm mb-3';
    locationStatus.style.color = 'var(--secondary-text)';
    locationStatus.textContent = 'Location services are disabled. Enable to find stores near you.';
    
    // Location controls
    const locationControls = document.createElement('div');
    locationControls.id = 'location-controls';
    locationControls.className = 'hidden space-y-3';
    
    // Radius selector
    const radiusContainer = document.createElement('div');
    radiusContainer.className = 'flex items-center space-x-3';
    
    const radiusLabel = document.createElement('label');
    radiusLabel.className = 'text-sm font-medium';
    radiusLabel.style.color = 'var(--card-text)';
    radiusLabel.textContent = 'Search radius:';
    
    const radiusSelect = document.createElement('select');
    radiusSelect.id = 'radius-select';
    radiusSelect.className = 'px-3 py-2 rounded border text-sm';
    radiusSelect.style.cssText = `
      background: var(--input-bg);
      color: var(--main-text);
      border-color: var(--border-color);
    `;
    
    const radiusOptions = [
      { value: 1, text: '1 km' },
      { value: 2, text: '2 km' },
      { value: 5, text: '5 km' },
      { value: 10, text: '10 km' },
      { value: 20, text: '20 km' }
    ];
    
    radiusOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      if (option.value === this.currentRadius) {
        optionElement.selected = true;
      }
      radiusSelect.appendChild(optionElement);
    });
    
    radiusContainer.appendChild(radiusLabel);
    radiusContainer.appendChild(radiusSelect);
    
    // Current location display
    const currentLocationDisplay = document.createElement('div');
    currentLocationDisplay.id = 'current-location-display';
    currentLocationDisplay.className = 'hidden p-3 rounded border text-sm';
    currentLocationDisplay.style.cssText = `
      background: var(--input-bg);
      border-color: var(--border-color);
      color: var(--secondary-text);
    `;
    
    locationControls.appendChild(radiusContainer);
    locationControls.appendChild(currentLocationDisplay);
    
    // Nearby stores section
    const nearbyStoresSection = document.createElement('div');
    nearbyStoresSection.id = 'nearby-stores-section';
    nearbyStoresSection.className = 'hidden mt-4';
    
    const nearbyTitle = document.createElement('h4');
    nearbyTitle.className = 'text-md font-medium mb-3';
    nearbyTitle.style.color = 'var(--card-text)';
    nearbyTitle.textContent = 'Stores Near You';
    
    this.nearbyStoresContainer = document.createElement('div');
    this.nearbyStoresContainer.id = 'nearby-stores-container';
    this.nearbyStoresContainer.className = 'space-y-2';
    
    nearbyStoresSection.appendChild(nearbyTitle);
    nearbyStoresSection.appendChild(this.nearbyStoresContainer);
    
    // Assemble the container
    this.locationContainer.appendChild(locationHeader);
    this.locationContainer.appendChild(locationStatus);
    this.locationContainer.appendChild(locationControls);
    this.locationContainer.appendChild(nearbyStoresSection);
    
    // Insert after search input in search tab
    const searchTab = document.getElementById('search-tab');
    const searchInput = document.getElementById('search-input');
    if (searchTab && searchInput) {
      const searchContainer = searchInput.closest('.relative');
      if (searchContainer) {
        searchContainer.parentNode.insertBefore(this.locationContainer, searchContainer.nextSibling);
      }
    }
  }

  // Bind event listeners
  bindEvents() {
    // Location toggle button
    const locationToggle = document.getElementById('location-toggle');
    if (locationToggle) {
      locationToggle.addEventListener('click', () => this.toggleLocation());
    }
    
    // Radius selector
    const radiusSelect = document.getElementById('radius-select');
    if (radiusSelect) {
      radiusSelect.addEventListener('change', (e) => {
        this.currentRadius = parseInt(e.target.value);
        this.updateNearbyStores();
      });
    }
    
    // Listen for location changes
    this.locationService.onLocationChange((location) => {
      this.onLocationChanged(location);
    });

    // Listen for tab changes to show location modal on search tab
    this.setupTabChangeListener();
  }

  // Setup tab change listener to show location modal on search tab
  setupTabChangeListener() {
    // Listen for navigation events
    document.addEventListener('click', (e) => {
      const navButton = e.target.closest('.nav-button');
      if (navButton && navButton.getAttribute('data-tab') === 'search-tab') {
        // User clicked on search tab, check if we should show location modal
        setTimeout(() => {
          this.checkAndShowPermissionModal();
        }, 500); // Small delay to ensure tab is loaded
      }
    });

    // Also listen for programmatic tab changes
    const originalShowView = window.showView;
    if (typeof originalShowView === 'function') {
      window.showView = (tabId) => {
        originalShowView(tabId);
        if (tabId === 'search-tab') {
          setTimeout(() => {
            this.checkAndShowPermissionModal();
          }, 500);
        }
      };
    }
  }

  // Toggle location services
  async toggleLocation() {
    if (this.isLocationEnabled) {
      this.disableLocation();
    } else {
      // Show custom permission modal instead of directly requesting location
      this.permissionModal.show(
        // onAllow callback
        async (position) => {
          console.log('Location permission granted:', position);
          await this.enableLocationWithPosition(position);
        },
        // onDeny callback
        () => {
          console.log('Location permission denied by user');
          this.showLocationError('Location access denied. You can enable it later in settings.');
        }
      );
    }
  }

  // Enable location services
  async enableLocation() {
    try {
      const locationToggle = document.getElementById('location-toggle');
      if (locationToggle) {
        locationToggle.textContent = 'Getting Location...';
        locationToggle.disabled = true;
      }
      
      await this.locationService.requestLocation();
      await this.enableLocationWithPosition(this.locationService.currentLocation);
      
    } catch (error) {
      console.error('Failed to enable location:', error);
      this.showLocationError(error.message);
      
      if (locationToggle) {
        locationToggle.textContent = 'Enable Location';
        locationToggle.disabled = false;
      }
    }
  }

  // Enable location with pre-granted position
  async enableLocationWithPosition(position) {
    try {
      // Set the location in the service
      this.locationService.currentLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };
      
      this.isLocationEnabled = true;
      this.updateLocationStatus();
      this.showLocationControls();
      this.updateNearbyStores();
      
      // Update the toggle button
      const locationToggle = document.getElementById('location-toggle');
      if (locationToggle) {
        locationToggle.textContent = 'Disable Location';
        locationToggle.style.background = 'var(--error)';
      }
      
      console.log('Location enabled successfully with position:', this.locationService.currentLocation);
      
    } catch (error) {
      console.error('Failed to enable location with position:', error);
      this.showLocationError('Failed to process location data. Please try again.');
    }
  }

  // Disable location services
  disableLocation() {
    this.locationService.stopLocationWatch();
    this.isLocationEnabled = false;
    this.updateLocationStatus();
    this.hideLocationControls();
    this.hideNearbyStores();
    
    const locationToggle = document.getElementById('location-toggle');
    if (locationToggle) {
      locationToggle.textContent = 'Enable Location';
      locationToggle.style.background = 'var(--accent)';
    }
  }

  // Update location status display
  updateLocationStatus() {
    const locationStatus = document.getElementById('location-status');
    if (!locationStatus) return;
    
    const status = this.locationService.getLocationStatus();
    
    if (status.hasLocation) {
      locationStatus.textContent = `📍 Location enabled - ${status.coordinates.lat.toFixed(4)}, ${status.coordinates.lng.toFixed(4)}`;
      locationStatus.style.color = 'var(--success)';
    } else if (status.permission === 'denied') {
      locationStatus.textContent = '❌ Location access denied. Please enable in browser settings.';
      locationStatus.style.color = 'var(--error)';
    } else {
      locationStatus.textContent = 'Location services are disabled. Enable to find stores near you.';
      locationStatus.style.color = 'var(--secondary-text)';
    }
  }

  // Show location controls
  showLocationControls() {
    const locationControls = document.getElementById('location-controls');
    const currentLocationDisplay = document.getElementById('current-location-display');
    
    if (locationControls) locationControls.classList.remove('hidden');
    if (currentLocationDisplay) currentLocationDisplay.classList.remove('hidden');
    
    this.updateCurrentLocationDisplay();
  }

  // Hide location controls
  hideLocationControls() {
    const locationControls = document.getElementById('location-controls');
    const currentLocationDisplay = document.getElementById('current-location-display');
    
    if (locationControls) locationControls.classList.add('hidden');
    if (currentLocationDisplay) currentLocationDisplay.classList.add('hidden');
  }

  // Update current location display
  updateCurrentLocationDisplay() {
    const currentLocationDisplay = document.getElementById('current-location-display');
    if (!currentLocationDisplay || !this.locationService.currentLocation) return;
    
    const location = this.locationService.currentLocation;
    currentLocationDisplay.innerHTML = `
      <strong>Current Location:</strong><br>
      Latitude: ${location.lat.toFixed(6)}<br>
      Longitude: ${location.lng.toFixed(6)}<br>
      Accuracy: ±${Math.round(location.accuracy)}m
    `;
  }

  // Show nearby stores
  updateNearbyStores() {
    if (!this.isLocationEnabled) return;
    
    const nearbyStoresSection = document.getElementById('nearby-stores-section');
    if (nearbyStoresSection) {
      nearbyStoresSection.classList.remove('hidden');
    }
    
    const nearbyStores = this.locationService.getNearbyStores(this.currentRadius);
    this.renderNearbyStores(nearbyStores);
  }

  // Hide nearby stores
  hideNearbyStores() {
    const nearbyStoresSection = document.getElementById('nearby-stores-section');
    if (nearbyStoresSection) {
      nearbyStoresSection.classList.add('hidden');
    }
  }

  // Render nearby stores list
  renderNearbyStores(stores) {
    if (!this.nearbyStoresContainer) return;
    
    this.nearbyStoresContainer.innerHTML = '';
    
    if (stores.length === 0) {
      const noStoresMessage = document.createElement('div');
      noStoresMessage.className = 'text-center py-4 text-sm';
      noStoresMessage.style.color = 'var(--secondary-text)';
      noStoresMessage.textContent = `No stores found within ${this.currentRadius}km of your location.`;
      this.nearbyStoresContainer.appendChild(noStoresMessage);
      return;
    }
    
    stores.forEach(store => {
      const storeCard = this.createStoreCard(store);
      this.nearbyStoresContainer.appendChild(storeCard);
    });
  }

  // Create individual store card
  createStoreCard(store) {
    const storeCard = document.createElement('div');
    storeCard.className = 'p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow';
    storeCard.style.cssText = `
      background: var(--card-bg);
      border-color: var(--border-color);
    `;
    
    // Store header
    const storeHeader = document.createElement('div');
    storeHeader.className = 'flex items-center justify-between mb-2';
    
    const storeName = document.createElement('h5');
    storeName.className = 'text-sm font-medium';
    storeName.style.color = 'var(--card-text)';
    storeName.textContent = store.name;
    
    const distance = document.createElement('span');
    distance.className = 'text-xs px-2 py-1 rounded-full';
    distance.style.cssText = `
      background: var(--accent);
      color: var(--accent-text);
    `;
    distance.textContent = store.distanceText;
    
    storeHeader.appendChild(storeName);
    storeHeader.appendChild(distance);
    
    // Store details
    const storeDetails = document.createElement('div');
    storeDetails.className = 'text-xs mb-2';
    storeDetails.style.color = 'var(--secondary-text)';
    storeDetails.textContent = store.address;
    
    // Store actions
    const storeActions = document.createElement('div');
    storeActions.className = 'flex space-x-2';
    
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
      this.openDirections(store);
    });
    
    const hoursBtn = document.createElement('button');
    hoursBtn.className = 'text-xs px-2 py-1 rounded border transition-colors';
    hoursBtn.style.cssText = `
      background: var(--input-bg);
      color: var(--main-text);
      border-color: var(--border-color);
    `;
    hoursBtn.textContent = 'Hours';
    hoursBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.showStoreHours(store);
    });
    
    storeActions.appendChild(directionsBtn);
    storeActions.appendChild(hoursBtn);
    
    // Assemble card
    storeCard.appendChild(storeHeader);
    storeCard.appendChild(storeDetails);
    storeCard.appendChild(storeActions);
    
    // Add click handler for store selection
    storeCard.addEventListener('click', () => {
      this.selectStore(store);
    });
    
    return storeCard;
  }

  // Open directions to store
  openDirections(store) {
    const directionsUrl = this.locationService.getDirectionsUrl(store);
    if (directionsUrl) {
      window.open(directionsUrl, '_blank');
    }
  }

  // Show store hours
  showStoreHours(store) {
    const hours = this.locationService.getStoreHours(store.name);
    
    // Create a simple alert for now - could be enhanced with a modal
    alert(`${store.name}\nHours: ${hours}`);
  }

  // Select a store (for filtering search results)
  selectStore(store) {
    // Dispatch custom event for store selection
    const event = new CustomEvent('storeSelected', {
      detail: { store }
    });
    document.dispatchEvent(event);
    
    // Update UI to show selected store
    this.highlightSelectedStore(store);
  }

  // Highlight selected store
  highlightSelectedStore(selectedStore) {
    // Remove previous highlights
    const allCards = this.nearbyStoresContainer.querySelectorAll('[data-store-selected]');
    allCards.forEach(card => {
      card.removeAttribute('data-store-selected');
      card.style.borderColor = 'var(--border-color)';
    });
    
    // Highlight selected store
    const selectedCard = this.nearbyStoresContainer.querySelector(`[data-store-name="${selectedStore.name}"]`);
    if (selectedCard) {
      selectedCard.setAttribute('data-store-selected', 'true');
      selectedCard.style.borderColor = 'var(--accent)';
    }
  }

  // Handle location change
  onLocationChanged(location) {
    this.updateLocationStatus();
    this.updateCurrentLocationDisplay();
    this.updateNearbyStores();
  }

  // Show location error
  showLocationError(message) {
    const locationStatus = document.getElementById('location-status');
    if (locationStatus) {
      locationStatus.textContent = `❌ ${message}`;
      locationStatus.style.color = 'var(--error)';
    }
  }

  // Get current location status
  getLocationStatus() {
    return this.locationService.getLocationStatus();
  }

  // Get nearby stores
  getNearbyStores(radius = null) {
    const searchRadius = radius || this.currentRadius;
    return this.locationService.getNearbyStores(searchRadius);
  }

  // Get stores by region
  getStoresByRegion(region) {
    return this.locationService.getStoresByRegion(region);
  }

  // Get location-based suggestions
  getLocationBasedSuggestions() {
    return this.locationService.getLocationBasedSuggestions();
  }

  // Check if we should show the permission modal
  async checkAndShowPermissionModal() {
    // Check if location permission is already granted
    const permissionStatus = await LocationPermissionModal.checkLocationPermission();
    
    if (permissionStatus === 'granted') {
      // Location already enabled, just update the UI
      this.isLocationEnabled = true;
      this.updateLocationStatus();
      this.showLocationControls();
      this.updateNearbyStores();
      
      const locationToggle = document.getElementById('location-toggle');
      if (locationToggle) {
        locationToggle.textContent = 'Disable Location';
        locationToggle.style.background = 'var(--error)';
      }
    } else if (permissionStatus === 'denied') {
      // Permission was denied, show appropriate message
      this.showLocationError('Location access denied. Please enable location services in your browser settings.');
    } else if (permissionStatus === 'not-supported') {
      // Geolocation not supported
      this.showLocationError('Location services are not supported in your browser.');
    } else if (permissionStatus === 'prompt') {
      // Show the permission modal after a short delay for better UX
      setTimeout(() => {
        this.showPermissionModal();
      }, 2000); // Show after 2 seconds
    }
    // For other cases (timeout, etc.), don't show modal automatically
  }

  // Show permission modal manually (can be called from other parts of the app)
  showPermissionModal() {
    this.permissionModal.show(
      async (position) => {
        console.log('Location permission granted:', position);
        await this.enableLocationWithPosition(position);
      },
      () => {
        console.log('Location permission denied by user');
        this.showLocationError('Location access denied. You can enable it later in settings.');
      }
    );
  }

  // Filter search results by location
  filterResultsByLocation(searchResults, selectedStore = null) {
    if (!this.isLocationEnabled || !searchResults) {
      return searchResults;
    }
    
    // If a specific store is selected, prioritize results from that store
    if (selectedStore) {
      return searchResults.map(result => ({
        ...result,
        locationPriority: result.retailer === selectedStore.retailer ? 'high' : 'normal'
      }));
    }
    
    // Otherwise, add distance information to results
    const nearbyStores = this.locationService.getNearbyStores(this.currentRadius);
    const storeDistances = {};
    
    nearbyStores.forEach(store => {
      storeDistances[store.retailer] = store.distance;
    });
    
    return searchResults.map(result => ({
      ...result,
      distance: storeDistances[result.retailer] || null,
      distanceText: storeDistances[result.retailer] ? 
        this.locationService.formatDistance(storeDistances[result.retailer]) : null
    }));
  }
}

// Export the UI class
export default LocationUI; 