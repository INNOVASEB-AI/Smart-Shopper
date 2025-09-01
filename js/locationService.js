// locationService.js - Location-based services for Smart Shopper SA

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.locationPermission = 'prompt'; // 'granted', 'denied', 'prompt'
    this.watchId = null;
    this.locationCallbacks = [];
    this.storeLocations = this.loadStoreLocations();
  }

  // Load store locations data
  loadStoreLocations() {
    return {
      "Pick n Pay": [
        { name: "Pick n Pay Canal Walk", lat: -33.8715, lng: 18.5022, address: "Canal Walk Shopping Centre, Century City, Cape Town", region: "Western Cape" },
        { name: "Pick n Pay V&A Waterfront", lat: -33.9036, lng: 18.4205, address: "V&A Waterfront, Cape Town", region: "Western Cape" },
        { name: "Pick n Pay Sandton City", lat: -26.1075, lng: 28.0567, address: "Sandton City, Sandton, Johannesburg", region: "Gauteng" },
        { name: "Pick n Pay Gateway Theatre", lat: -29.7247, lng: 31.0587, address: "Gateway Theatre of Shopping, Umhlanga", region: "KwaZulu-Natal" },
        { name: "Pick n Pay Menlyn Park", lat: -25.7833, lng: 28.2833, address: "Menlyn Park Shopping Centre, Pretoria", region: "Gauteng" },
        { name: "Pick n Pay Brooklyn Mall", lat: -25.7500, lng: 28.2167, address: "Brooklyn Mall, Pretoria", region: "Gauteng" },
        { name: "Pick n Pay Pavilion", lat: -29.5833, lng: 30.3833, address: "Pavilion Shopping Centre, Westville", region: "KwaZulu-Natal" },
        { name: "Pick n Pay Eastgate", lat: -26.2500, lng: 28.1167, address: "Eastgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Pick n Pay Westgate", lat: -26.1833, lng: 27.9833, address: "Westgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Pick n Pay Northgate", lat: -26.1167, lng: 28.0167, address: "Northgate Shopping Centre, Johannesburg", region: "Gauteng" }
      ],
      "Checkers": [
        { name: "Checkers Canal Walk", lat: -33.8715, lng: 18.5022, address: "Canal Walk Shopping Centre, Century City, Cape Town", region: "Western Cape" },
        { name: "Checkers V&A Waterfront", lat: -33.9036, lng: 18.4205, address: "V&A Waterfront, Cape Town", region: "Western Cape" },
        { name: "Checkers Sandton City", lat: -26.1075, lng: 28.0567, address: "Sandton City, Sandton, Johannesburg", region: "Gauteng" },
        { name: "Checkers Gateway Theatre", lat: -29.7247, lng: 31.0587, address: "Gateway Theatre of Shopping, Umhlanga", region: "KwaZulu-Natal" },
        { name: "Checkers Menlyn Park", lat: -25.7833, lng: 28.2833, address: "Menlyn Park Shopping Centre, Pretoria", region: "Gauteng" },
        { name: "Checkers Brooklyn Mall", lat: -25.7500, lng: 28.2167, address: "Brooklyn Mall, Pretoria", region: "Gauteng" },
        { name: "Checkers Pavilion", lat: -29.5833, lng: 30.3833, address: "Pavilion Shopping Centre, Westville", region: "KwaZulu-Natal" },
        { name: "Checkers Eastgate", lat: -26.2500, lng: 28.1167, address: "Eastgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Checkers Westgate", lat: -26.1833, lng: 27.9833, address: "Westgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Checkers Northgate", lat: -26.1167, lng: 28.0167, address: "Northgate Shopping Centre, Johannesburg", region: "Gauteng" }
      ],
      "Woolworths": [
        { name: "Woolworths Canal Walk", lat: -33.8715, lng: 18.5022, address: "Canal Walk Shopping Centre, Century City, Cape Town", region: "Western Cape" },
        { name: "Woolworths V&A Waterfront", lat: -33.9036, lng: 18.4205, address: "V&A Waterfront, Cape Town", region: "Western Cape" },
        { name: "Woolworths Sandton City", lat: -26.1075, lng: 28.0567, address: "Sandton City, Sandton, Johannesburg", region: "Gauteng" },
        { name: "Woolworths Gateway Theatre", lat: -29.7247, lng: 31.0587, address: "Gateway Theatre of Shopping, Umhlanga", region: "KwaZulu-Natal" },
        { name: "Woolworths Menlyn Park", lat: -25.7833, lng: 28.2833, address: "Menlyn Park Shopping Centre, Pretoria", region: "Gauteng" },
        { name: "Woolworths Brooklyn Mall", lat: -25.7500, lng: 28.2167, address: "Brooklyn Mall, Pretoria", region: "Gauteng" },
        { name: "Woolworths Pavilion", lat: -29.5833, lng: 30.3833, address: "Pavilion Shopping Centre, Westville", region: "KwaZulu-Natal" },
        { name: "Woolworths Eastgate", lat: -26.2500, lng: 28.1167, address: "Eastgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Woolworths Westgate", lat: -26.1833, lng: 27.9833, address: "Westgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Woolworths Northgate", lat: -26.1167, lng: 28.0167, address: "Northgate Shopping Centre, Johannesburg", region: "Gauteng" }
      ],
      "Shoprite": [
        { name: "Shoprite Canal Walk", lat: -33.8715, lng: 18.5022, address: "Canal Walk Shopping Centre, Century City, Cape Town", region: "Western Cape" },
        { name: "Shoprite V&A Waterfront", lat: -33.9036, lng: 18.4205, address: "V&A Waterfront, Cape Town", region: "Western Cape" },
        { name: "Shoprite Sandton City", lat: -26.1075, lng: 28.0567, address: "Sandton City, Sandton, Johannesburg", region: "Gauteng" },
        { name: "Shoprite Gateway Theatre", lat: -29.7247, lng: 31.0587, address: "Gateway Theatre of Shopping, Umhlanga", region: "KwaZulu-Natal" },
        { name: "Shoprite Menlyn Park", lat: -25.7833, lng: 28.2833, address: "Menlyn Park Shopping Centre, Pretoria", region: "Gauteng" },
        { name: "Shoprite Brooklyn Mall", lat: -25.7500, lng: 28.2167, address: "Brooklyn Mall, Pretoria", region: "Gauteng" },
        { name: "Shoprite Pavilion", lat: -29.5833, lng: 30.3833, address: "Pavilion Shopping Centre, Westville", region: "KwaZulu-Natal" },
        { name: "Shoprite Eastgate", lat: -26.2500, lng: 28.1167, address: "Eastgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Shoprite Westgate", lat: -26.1833, lng: 27.9833, address: "Westgate Shopping Centre, Johannesburg", region: "Gauteng" },
        { name: "Shoprite Northgate", lat: -26.1167, lng: 28.0167, address: "Northgate Shopping Centre, Johannesburg", region: "Gauteng" }
      ],
      "Makro": [
        { name: "Makro Cape Town", lat: -33.9249, lng: 18.4241, address: "N1 City, Goodwood, Cape Town", region: "Western Cape" },
        { name: "Makro Johannesburg", lat: -26.2041, lng: 28.0473, address: "Roodepoort, Johannesburg", region: "Gauteng" },
        { name: "Makro Pretoria", lat: -25.7479, lng: 28.2293, address: "Pretoria West, Pretoria", region: "Gauteng" },
        { name: "Makro Durban", lat: -29.8587, lng: 31.0218, address: "Umgeni Road, Durban", region: "KwaZulu-Natal" },
        { name: "Makro Port Elizabeth", lat: -33.7139, lng: 25.5207, address: "Walmer, Port Elizabeth", region: "Eastern Cape" },
        { name: "Makro Bloemfontein", lat: -29.0852, lng: 26.1596, address: "Bloemfontein", region: "Free State" },
        { name: "Makro Kimberley", lat: -28.7282, lng: 24.7499, address: "Kimberley", region: "Northern Cape" },
        { name: "Makro Polokwane", lat: -23.9045, lng: 29.4698, address: "Polokwane", region: "Limpopo" },
        { name: "Makro Nelspruit", lat: -25.4753, lng: 30.9694, address: "Nelspruit", region: "Mpumalanga" },
        { name: "Makro Rustenburg", lat: -25.6500, lng: 27.2333, address: "Rustenburg", region: "North West" }
      ]
    };
  }

  // Request location permission and get current location
  async requestLocation() {
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation is not supported by this browser');
      }

      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            this.currentLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              timestamp: position.timestamp
            };
            this.locationPermission = 'granted';
            this.notifyLocationCallbacks(this.currentLocation);
            resolve(this.currentLocation);
          },
          (error) => {
            this.locationPermission = 'denied';
            reject(new Error(this.getLocationErrorMessage(error)));
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });
    } catch (error) {
      console.error('Location request failed:', error);
      throw error;
    }
  }

  // Get location error message
  getLocationErrorMessage(error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location access denied. Please enable location services in your browser settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Location information is unavailable.';
      case error.TIMEOUT:
        return 'Location request timed out.';
      default:
        return 'An unknown error occurred while getting location.';
    }
  }

  // Start watching location changes
  startLocationWatch(callback) {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
    }

    if (navigator.geolocation) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          this.currentLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          if (callback) callback(this.currentLocation);
          this.notifyLocationCallbacks(this.currentLocation);
        },
        (error) => {
          console.error('Location watch error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    }
  }

  // Stop watching location
  stopLocationWatch() {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  // Calculate distance between two coordinates using Haversine formula
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  // Convert degrees to radians
  deg2rad(deg) {
    return deg * (Math.PI/180);
  }

  // Get stores near current location
  getNearbyStores(radius = 10) { // radius in kilometers
    if (!this.currentLocation) {
      return [];
    }

    const nearbyStores = [];
    
    Object.entries(this.storeLocations).forEach(([retailer, stores]) => {
      stores.forEach(store => {
        const distance = this.calculateDistance(
          this.currentLocation.lat,
          this.currentLocation.lng,
          store.lat,
          store.lng
        );
        
        if (distance <= radius) {
          nearbyStores.push({
            ...store,
            retailer,
            distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
            distanceText: this.formatDistance(distance)
          });
        }
      });
    });

    // Sort by distance
    return nearbyStores.sort((a, b) => a.distance - b.distance);
  }

  // Get stores by region
  getStoresByRegion(region) {
    const storesInRegion = [];
    
    Object.entries(this.storeLocations).forEach(([retailer, stores]) => {
      stores.forEach(store => {
        if (store.region.toLowerCase() === region.toLowerCase()) {
          storesInRegion.push({
            ...store,
            retailer
          });
        }
      });
    });

    return storesInRegion;
  }

  // Get all stores for a specific retailer
  getStoresByRetailer(retailer) {
    return this.storeLocations[retailer] || [];
  }

  // Format distance for display
  formatDistance(distance) {
    if (distance < 1) {
      return `${Math.round(distance * 1000)}m`;
    } else if (distance < 10) {
      return `${Math.round(distance * 10) / 10}km`;
    } else {
      return `${Math.round(distance)}km`;
    }
  }

  // Get current location status
  getLocationStatus() {
    return {
      hasLocation: !!this.currentLocation,
      permission: this.locationPermission,
      coordinates: this.currentLocation,
      isWatching: !!this.watchId
    };
  }

  // Add location change callback
  onLocationChange(callback) {
    this.locationCallbacks.push(callback);
  }

  // Remove location change callback
  removeLocationCallback(callback) {
    const index = this.locationCallbacks.indexOf(callback);
    if (index > -1) {
      this.locationCallbacks.splice(index, 1);
    }
  }

  // Notify all location callbacks
  notifyLocationCallbacks(location) {
    this.locationCallbacks.forEach(callback => {
      try {
        callback(location);
      } catch (error) {
        console.error('Location callback error:', error);
      }
    });
  }

  // Get location-based search suggestions
  getLocationBasedSuggestions() {
    if (!this.currentLocation) {
      return [];
    }

    const nearbyStores = this.getNearbyStores(5); // Within 5km
    const suggestions = [];

    if (nearbyStores.length > 0) {
      suggestions.push({
        type: 'nearby',
        text: `Stores near you (${nearbyStores.length} found)`,
        stores: nearbyStores.slice(0, 3) // Show top 3
      });
    }

    // Add regional suggestions
    const regions = [...new Set(nearbyStores.map(store => store.region))];
    regions.forEach(region => {
      const storesInRegion = this.getStoresByRegion(region);
      suggestions.push({
        type: 'region',
        text: `${region} stores`,
        stores: storesInRegion.slice(0, 5)
      });
    });

    return suggestions;
  }

  // Get store details by name
  getStoreDetails(storeName) {
    for (const [retailer, stores] of Object.entries(this.storeLocations)) {
      const store = stores.find(s => s.name === storeName);
      if (store) {
        return { ...store, retailer };
      }
    }
    return null;
  }

  // Get directions URL for a store
  getDirectionsUrl(store) {
    if (!store || !store.lat || !store.lng) return null;
    
    // Use Google Maps directions
    return `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}&travelmode=driving`;
  }

  // Get store hours (mock data - in real app this would come from API)
  getStoreHours(storeName) {
    const hours = {
      "Pick n Pay": "7:00 AM - 9:00 PM",
      "Checkers": "7:00 AM - 9:00 PM", 
      "Woolworths": "8:00 AM - 8:00 PM",
      "Shoprite": "7:00 AM - 9:00 PM",
      "Makro": "8:00 AM - 6:00 PM"
    };
    
    // Find retailer for this store
    for (const [retailer, stores] of Object.entries(this.storeLocations)) {
      if (stores.find(s => s.name === storeName)) {
        return hours[retailer] || "Hours not available";
      }
    }
    
    return "Hours not available";
  }
}

// Export the service
export default LocationService; 