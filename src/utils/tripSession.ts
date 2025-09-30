// Utility functions for trip-scoped session storage management

export interface TripData {
  from: string;
  to: string;
  fromPlaceId: string;
  toPlaceId: string;
  tripId?: string;
  places?: TripPlace[];
}

export interface TripPlace {
  displayName: {
    text: string;
  };
  formattedAddress: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  category?: string;
  addedAt: string;
}

export interface RouteData {
  distanceMeters: number;
  duration: string;
  polyline: {
    encodedPolyline: string;
  };
  waypoints?: Array<{
    location: {
      lat: number;
      lng: number;
    };
  }>;
  timestamp: string;
}

export interface SavedTrip {
  id: string;
  name: string;
  description?: string;
  savedAt: string;
  tripData: TripData;
  routeData?: RouteData;
  placesData?: any[];
}

/**
 * Generate a unique trip ID based on start and destination place IDs
 */
export const generateTripId = (fromPlaceId: string, toPlaceId: string): string => {
  const combinedString = `${fromPlaceId}-${toPlaceId}`;
  // Simple hash function for generating consistent IDs
  let hash = 0;
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `trip_${Math.abs(hash)}`;
};

/**
 * Get trip-scoped session storage key
 */
export const getTripStorageKey = (tripId: string, dataType: 'data' | 'route' | 'places'): string => {
  return `trip_${tripId}_${dataType}`;
};

/**
 * Store trip data with trip ID
 */
export const storeTripData = (tripData: TripData): boolean => {
  try {
    const tripId = generateTripId(tripData.fromPlaceId, tripData.toPlaceId);
    const dataWithTripId = { ...tripData, tripId };
    
    const storageKey = getTripStorageKey(tripId, 'data');
    sessionStorage.setItem(storageKey, JSON.stringify(dataWithTripId));
    
    // Also store the current trip ID for easy access
    sessionStorage.setItem('currentTripId', tripId);
    
    return true;
  } catch (error) {
    console.error('Error storing trip data:', error);
    return false;
  }
};

/**
 * Get current trip data
 */
export const getCurrentTripData = (): TripData | null => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) return null;
    
    const storageKey = getTripStorageKey(currentTripId, 'data');
    const stored = sessionStorage.getItem(storageKey);
    
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading current trip data:', error);
    return null;
  }
};

/**
 * Store route data for current trip
 */
export const storeRouteData = (routeData: RouteData): boolean => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) {
      console.warn('No current trip ID found');
      return false;
    }
    
    const storageKey = getTripStorageKey(currentTripId, 'route');
    sessionStorage.setItem(storageKey, JSON.stringify(routeData));
    
    return true;
  } catch (error) {
    console.error('Error storing route data:', error);
    return false;
  }
};

/**
 * Get route data for current trip
 */
export const getCurrentRouteData = (): RouteData | null => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) return null;
    
    const storageKey = getTripStorageKey(currentTripId, 'route');
    const stored = sessionStorage.getItem(storageKey);
    
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading current route data:', error);
    return null;
  }
};

/**
 * Store places data for current trip
 */
export const storePlacesData = (placesData: any[]): boolean => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) {
      console.warn('No current trip ID found');
      return false;
    }
    
    const storageKey = getTripStorageKey(currentTripId, 'places');
    sessionStorage.setItem(storageKey, JSON.stringify(placesData));
    
    return true;
  } catch (error) {
    console.error('Error storing places data:', error);
    return false;
  }
};

/**
 * Get places data for current trip
 */
export const getCurrentPlacesData = (): any[] | null => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) return null;
    
    const storageKey = getTripStorageKey(currentTripId, 'places');
    const stored = sessionStorage.getItem(storageKey);
    
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error reading current places data:', error);
    return null;
  }
};

/**
 * Update trip data (for adding places to trip)
 */
export const updateTripData = (updatedTripData: TripData): boolean => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    if (!currentTripId) {
      console.warn('No current trip ID found');
      return false;
    }
    
    const dataWithTripId = { ...updatedTripData, tripId: currentTripId };
    const storageKey = getTripStorageKey(currentTripId, 'data');
    sessionStorage.setItem(storageKey, JSON.stringify(dataWithTripId));
    
    return true;
  } catch (error) {
    console.error('Error updating trip data:', error);
    return false;
  }
};

/**
 * Clear old trip data (keep only current trip)
 */
export const cleanupOldTripData = (): void => {
  try {
    const currentTripId = sessionStorage.getItem('currentTripId');
    const allKeys = Object.keys(sessionStorage);
    
    // Remove old trip data that doesn't match current trip
    allKeys.forEach(key => {
      if (key.startsWith('trip_') && currentTripId && !key.includes(currentTripId)) {
        sessionStorage.removeItem(key);
        console.log('Cleaned up old trip data:', key);
      }
    });
    
    // Also clean up legacy non-scoped keys if current trip exists
    if (currentTripId) {
      ['tripData', 'routeData', 'placesData'].forEach(legacyKey => {
        if (sessionStorage.getItem(legacyKey)) {
          sessionStorage.removeItem(legacyKey);
          console.log('Cleaned up legacy storage:', legacyKey);
        }
      });
    }
  } catch (error) {
    console.error('Error cleaning up old trip data:', error);
  }
};

/**
 * Check if we have a valid current trip
 */
export const hasValidCurrentTrip = (): boolean => {
  const currentTripId = sessionStorage.getItem('currentTripId');
  if (!currentTripId) return false;
  
  const tripData = getCurrentTripData();
  return tripData !== null && !!tripData.fromPlaceId && !!tripData.toPlaceId;
};

// ===== SAVED TRIPS MANAGEMENT (localStorage) =====

/**
 * Update an existing saved trip
 */
export const updateSavedTrip = (tripId: string, tripName: string, description?: string): boolean => {
  try {
    const tripData = getCurrentTripData();
    const routeData = getCurrentRouteData();
    const placesData = getCurrentPlacesData();
    
    if (!tripData) {
      console.error('No current trip data to update');
      return false;
    }
    
    // Get existing saved trips
    const existingTrips = getSavedTrips();
    const tripIndex = existingTrips.findIndex(trip => trip.id === tripId);
    
    if (tripIndex === -1) {
      console.error('Trip not found for update');
      return false;
    }
    
    // Update the existing trip
    const updatedTrip: SavedTrip = {
      id: tripId, // Keep the same ID
      name: tripName,
      description,
      savedAt: existingTrips[tripIndex].savedAt, // Keep original save date
      tripData,
      routeData: routeData || undefined,
      placesData: placesData || undefined
    };
    
    // Replace the trip in the array
    existingTrips[tripIndex] = updatedTrip;
    
    // Save back to localStorage
    localStorage.setItem('savedTrips', JSON.stringify(existingTrips));
    
    console.log('Trip updated successfully:', updatedTrip.name);
    return true;
  } catch (error) {
    console.error('Error updating trip:', error);
    return false;
  }
};

/**
 * Save current trip to localStorage with a custom name
 */
export const saveCurrentTrip = (tripName: string, description?: string): boolean => {
  try {
    const tripData = getCurrentTripData();
    const routeData = getCurrentRouteData();
    const placesData = getCurrentPlacesData();
    
    if (!tripData) {
      console.error('No current trip data to save');
      return false;
    }
    
    const savedTrip: SavedTrip = {
      id: generateUniqueId(),
      name: tripName,
      description,
      savedAt: new Date().toISOString(),
      tripData,
      routeData: routeData || undefined,
      placesData: placesData || undefined
    };
    
    // Get existing saved trips
    const existingTrips = getSavedTrips();
    const updatedTrips = [...existingTrips, savedTrip];
    
    // Save to localStorage
    localStorage.setItem('savedTrips', JSON.stringify(updatedTrips));
    
    console.log('Trip saved successfully:', savedTrip.name);
    return true;
  } catch (error) {
    console.error('Error saving trip:', error);
    return false;
  }
};

/**
 * Get all saved trips from localStorage
 */
export const getSavedTrips = (): SavedTrip[] => {
  try {
    const stored = localStorage.getItem('savedTrips');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error reading saved trips:', error);
    return [];
  }
};

/**
 * Get a specific saved trip by ID
 */
export const getSavedTrip = (tripId: string): SavedTrip | null => {
  try {
    const savedTrips = getSavedTrips();
    return savedTrips.find(trip => trip.id === tripId) || null;
  } catch (error) {
    console.error('Error reading saved trip:', error);
    return null;
  }
};

/**
 * Delete a saved trip by ID
 */
export const deleteSavedTrip = (tripId: string): boolean => {
  try {
    const savedTrips = getSavedTrips();
    const updatedTrips = savedTrips.filter(trip => trip.id !== tripId);
    
    localStorage.setItem('savedTrips', JSON.stringify(updatedTrips));
    console.log('Trip deleted successfully');
    return true;
  } catch (error) {
    console.error('Error deleting trip:', error);
    return false;
  }
};

/**
 * Load a saved trip into current session
 */
export const loadSavedTrip = (tripId: string): boolean => {
  try {
    const savedTrip = getSavedTrip(tripId);
    if (!savedTrip) {
      console.error('Saved trip not found');
      return false;
    }
    
    // Load trip data into current session
    const success = storeTripData(savedTrip.tripData);
    if (!success) return false;
    
    // Load route data if available
    if (savedTrip.routeData) {
      storeRouteData(savedTrip.routeData);
    }
    
    // Load places data if available
    if (savedTrip.placesData) {
      storePlacesData(savedTrip.placesData);
    }
    
    console.log('Saved trip loaded successfully:', savedTrip.name);
    return true;
  } catch (error) {
    console.error('Error loading saved trip:', error);
    return false;
  }
};

/**
 * Generate a unique ID for saved trips
 */
const generateUniqueId = (): string => {
  return `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ===== TRIP SHARING (URL Compression) =====

export interface ShareableTrip {
  tripData: TripData;
  routeData?: RouteData;
  placesData?: any[];
}

/**
 * Compress trip data for URL sharing
 */
export const compressTripData = (): string | null => {
  try {
    const tripData = getCurrentTripData();
    const routeData = getCurrentRouteData();
    const placesData = getCurrentPlacesData();
    
    if (!tripData) {
      console.error('No current trip data to compress');
      return null;
    }
    
    const shareableTrip: ShareableTrip = {
      tripData,
      routeData: routeData || undefined,
      placesData: placesData || undefined
    };
    
    // Convert to JSON and compress using base64
    const jsonString = JSON.stringify(shareableTrip);
    const compressed = btoa(encodeURIComponent(jsonString));
    
    console.log('Trip data compressed for sharing');
    return compressed;
  } catch (error) {
    console.error('Error compressing trip data:', error);
    return null;
  }
};

/**
 * Decompress trip data from URL parameter
 */
export const decompressTripData = (compressedData: string): ShareableTrip | null => {
  try {
    // Decode from base64 and parse JSON
    const jsonString = decodeURIComponent(atob(compressedData));
    const shareableTrip: ShareableTrip = JSON.parse(jsonString);
    
    console.log('Trip data decompressed from URL');
    return shareableTrip;
  } catch (error) {
    console.error('Error decompressing trip data:', error);
    return null;
  }
};

/**
 * Load trip from compressed URL data into current session
 */
export const loadSharedTrip = (compressedData: string): boolean => {
  try {
    const shareableTrip = decompressTripData(compressedData);
    if (!shareableTrip) {
      console.error('Failed to decompress shared trip data');
      return false;
    }
    
    // Load trip data into current session
    const success = storeTripData(shareableTrip.tripData);
    if (!success) return false;
    
    // Load route data if available
    if (shareableTrip.routeData) {
      storeRouteData(shareableTrip.routeData);
    }
    
    // Load places data if available
    if (shareableTrip.placesData) {
      storePlacesData(shareableTrip.placesData);
    }
    
    console.log('Shared trip loaded successfully');
    return true;
  } catch (error) {
    console.error('Error loading shared trip:', error);
    return false;
  }
};

/**
 * Generate shareable URL for current trip
 */
export const generateShareableUrl = (baseUrl: string = window.location.origin): string | null => {
  try {
    const compressedData = compressTripData();
    if (!compressedData) return null;
    
    const shareUrl = `${baseUrl}/shared/trip?data=${encodeURIComponent(compressedData)}`;
    console.log('Shareable URL generated');
    return shareUrl;
  } catch (error) {
    console.error('Error generating shareable URL:', error);
    return null;
  }
};