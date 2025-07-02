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
  return tripData !== null && tripData.fromPlaceId && tripData.toPlaceId;
};