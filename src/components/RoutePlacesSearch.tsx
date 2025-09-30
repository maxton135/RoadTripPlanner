'use client';

import { useEffect, useState } from 'react';
import { getCurrentRouteData, getCurrentPlacesData, storePlacesData, getCurrentTripData } from '@/utils/tripSession';

interface RoutePlacesSearchProps {
  apiKey: string;
  isLoadedTrip?: boolean; // New prop to indicate if this is a loaded saved trip
}

interface RouteData {
  distanceMeters: number;
  duration: string;
  polyline: {
    encodedPolyline: string;
  };
  timestamp: string;
}

interface Place {
  displayName: {
    text: string;
  };
  formattedAddress: string;
  routingSummaries?: Array<{
    distanceMeters: number;
    duration: string;
  }>;
  additionalDetails?: any; // Store additional API response data
  // Additional fields from the detailed API response
  name?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{
    name: string;
    widthPx: number;
    heightPx: number;
    authorAttributions: Array<{
      displayName: string;
      uri: string;
      photoUri: string;
    }>;
  }>;
  category?: string; // Add category field
}

// Helper function to decode polyline and get route coordinates
const decodePolyline = (encoded: string): Array<{lat: number, lng: number}> => {
  const points: Array<{lat: number, lng: number}> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;
    
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    lat += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    shift = 0;
    result = 0;
    
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    lng += ((result & 1) ? ~(result >> 1) : (result >> 1));
    
    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5
    });
  }
  
  return points;
};

// Helper function to get search locations along route
const getSearchLocationsAlongRoute = (encodedPolyline: string, intervalKm: number = 50): Array<{lat: number, lng: number}> => {
  const points = decodePolyline(encodedPolyline);
  if (points.length < 2) return points;
  
  const searchLocations: Array<{lat: number, lng: number}> = [];
  const intervalMeters = intervalKm * 1000;
  
  // Always include start point
  searchLocations.push(points[0]);
  
  let accumulatedDistance = 0;
  let lastSearchPointIndex = 0;
  
  for (let i = 1; i < points.length; i++) {
    const distance = getDistanceBetweenPoints(points[i-1], points[i]);
    accumulatedDistance += distance;
    
    // Add search location if we've traveled enough distance
    if (accumulatedDistance >= intervalMeters) {
      searchLocations.push(points[i]);
      accumulatedDistance = 0;
      lastSearchPointIndex = i;
    }
  }
  
  // Always include end point if it's not already included
  const lastPoint = points[points.length - 1];
  const lastSearchPoint = searchLocations[searchLocations.length - 1];
  if (lastSearchPoint.lat !== lastPoint.lat || lastSearchPoint.lng !== lastPoint.lng) {
    searchLocations.push(lastPoint);
  }
  
  return searchLocations;
};

// Helper function to calculate distance between two points (Haversine formula)
const getDistanceBetweenPoints = (point1: {lat: number, lng: number}, point2: {lat: number, lng: number}): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.lat * Math.PI/180;
  const φ2 = point2.lat * Math.PI/180;
  const Δφ = (point2.lat-point1.lat) * Math.PI/180;
  const Δλ = (point2.lng-point1.lng) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

// Define search categories for road trip planning
const SEARCH_CATEGORIES = [
  {
    id: 'points_of_interest',
    name: 'Points of Interest',
    query: 'points of interest',
    icon: '🏛️',
    description: 'Tourist attractions and landmarks'
  },
  {
    id: 'restaurants',
    name: 'Restaurants',
    query: 'restaurants',
    icon: '🍽️',
    description: 'Places to eat and dine'
  },
  {
    id: 'gas_stations',
    name: 'Gas Stations',
    query: 'gas stations',
    icon: '⛽',
    description: 'Fuel and convenience stores'
  },
  {
    id: 'parks',
    name: 'Parks & Recreation',
    query: 'parks',
    icon: '🌳',
    description: 'Parks, trails, and outdoor activities'
  },
  {
    id: 'viewpoints',
    name: 'Viewpoints',
    query: 'viewpoints scenic overlooks',
    icon: '🏔️',
    description: 'Scenic viewpoints and photo spots'
  },
  {
    id: 'hotels',
    name: 'Hotels & Lodging',
    query: 'hotels motels lodging',
    icon: '🏨',
    description: 'Places to stay overnight'
  },
  {
    id: 'historical_sites',
    name: 'Historical Sites',
    query: 'historical sites landmarks monuments',
    icon: '🏛️',
    description: 'Historic landmarks and monuments'
  },
  {
    id: 'museums',
    name: 'Museums',
    query: 'museums galleries cultural centers',
    icon: '🎨', 
    description: 'Museums and cultural attractions'
  }
];

export default function RoutePlacesSearch({ apiKey, isLoadedTrip = false }: RoutePlacesSearchProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('points_of_interest');
  const [allPlaces, setAllPlaces] = useState<Record<string, Place[]>>({});
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);
  
  // Enhanced search controls
  const [searchRadius, setSearchRadius] = useState(15); // km
  const [customSearchQuery, setCustomSearchQuery] = useState('');
  const [searchMethod, setSearchMethod] = useState<'route' | 'radius'>('route');
  const [viewMode, setViewMode] = useState<'searches' | 'trip'>(isLoadedTrip ? 'trip' : 'searches');
  
  // On-demand category loading state
  const [loadedCategories, setLoadedCategories] = useState<Set<string>>(new Set());
  const [categoryLoading, setCategoryLoading] = useState<Record<string, boolean>>({});

  // First check if we already have cached places data for this trip
  const loadCachedPlacesData = () => {
    const cachedPlaces = getCurrentPlacesData();
    if (cachedPlaces && cachedPlaces.length > 0) {
      console.log('Loading cached places data:', cachedPlaces.length, 'places');
      setUsingCachedData(true);
      
      // Group places by category
      const groupedPlaces: Record<string, Place[]> = {};
      const loadedCats = new Set<string>();
      
      SEARCH_CATEGORIES.forEach(category => {
        const categoryPlaces = cachedPlaces.filter((place: Place) => place.category === category.id);
        groupedPlaces[category.id] = categoryPlaces;
        
        // Mark category as loaded if it has places
        if (categoryPlaces.length > 0) {
          loadedCats.add(category.id);
        }
      });
      
      setAllPlaces(groupedPlaces);
      setPlaces(groupedPlaces[selectedCategory] || []);
      setLoadedCategories(loadedCats);
      setSearchCompleted(true);
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('placesDataUpdated', { 
        detail: cachedPlaces
      }));
      
      return true; // Indicate we found cached data
    }
    return false; // No cached data found
  };

  const searchPlacesAlongRoute = async (specificCategory?: string) => {
    // Check if route data exists using trip-scoped storage
    const routeData = getCurrentRouteData();
    if (!routeData) {
      console.log('No route data found, waiting for route generation...');
      return;
    }

    try {
      if (!routeData.polyline?.encodedPolyline) {
        console.log('No polyline data found in route');
        return;
      }

      setIsLoading(true);
      setError(null);
      setSearchCompleted(false);
      
      // Mark the category being searched as loading
      if (specificCategory) {
        setCategoryLoading(prev => ({ ...prev, [specificCategory]: true }));
      }

      // Determine search categories to use
      let categoriesToSearch;
      
      if (customSearchQuery) {
        // Custom search: search all categories as before
        categoriesToSearch = [{ id: 'custom', name: 'Custom Search', query: customSearchQuery, icon: '🔍', description: 'Custom search results' }];
      } else if (specificCategory) {
        // On-demand category search: search only the specified category
        const categoryConfig = SEARCH_CATEGORIES.find(cat => cat.id === specificCategory);
        categoriesToSearch = categoryConfig ? [categoryConfig] : [SEARCH_CATEGORIES[0]];
      } else {
        // Initial load: only search points of interest (default category)
        categoriesToSearch = [SEARCH_CATEGORIES.find(cat => cat.id === 'points_of_interest') || SEARCH_CATEGORIES[0]];
      }

      console.log('Search parameters:', {
        customSearchQuery,
        searchMethod,
        searchRadius,
        categoriesToSearch: categoriesToSearch.map(c => ({ id: c.id, query: c.query }))
      });

      // Search for all categories
      const allPlacesData: Record<string, Place[]> = {};
      
      for (const category of categoriesToSearch) {
        console.log(`Searching for ${category.name} (query: "${category.query}") using ${searchMethod} method...`);
        
        let searchResults: Place[] = [];

        if (searchMethod === 'route') {
          // Original polyline-based search
          const requestBody = {
            textQuery: category.query,
            searchAlongRouteParameters: {
              polyline: {
                encodedPolyline: routeData.polyline.encodedPolyline
              }
            }
          };

          const response = await fetch(`https://places.googleapis.com/v1/places:searchText?fields=places.displayName%2Cplaces.formattedAddress%2CroutingSummaries&key=${apiKey}`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel,places.placeId,places.place,routingSummaries'
            },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`Route search API response for "${category.query}":`, data);
            searchResults = data.places || [];
            console.log(`Found ${searchResults.length} results for route search`);
          } else {
            console.error(`Route search failed for "${category.query}":`, response.status, response.statusText);
          }
        } else {
          // Radius-based search at multiple points along route
          const searchLocations = getSearchLocationsAlongRoute(routeData.polyline.encodedPolyline, 50);
          console.log(`Searching at ${searchLocations.length} locations along route`);
          
          const allLocationResults: Place[] = [];
          
          for (const location of searchLocations) {
            const requestBody = {
              textQuery: category.query,
              locationBias: {
                circle: {
                  center: {
                    latitude: location.lat,
                    longitude: location.lng
                  },
                  radius: searchRadius * 1000 // Convert km to meters
                }
              },
              maxResultCount: 20
            };

            try {
              const response = await fetch(`https://places.googleapis.com/v1/places:searchText?fields=places.displayName%2Cplaces.formattedAddress%2Cplaces.location&key=${apiKey}`, {
                method: 'POST',
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
                  'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount'
                },
                body: JSON.stringify(requestBody)
              });

              if (response.ok) {
                const data = await response.json();
                console.log(`Radius search API response at location ${location.lat}, ${location.lng}:`, data);
                if (data.places) {
                  console.log(`Found ${data.places.length} places at this location`);
                  allLocationResults.push(...data.places);
                }
              } else {
                console.error(`Radius search failed at location ${location.lat}, ${location.lng}:`, response.status, response.statusText);
              }
            } catch (err) {
              console.error(`Error searching at location ${location.lat}, ${location.lng}:`, err);
            }
          }

          // Remove duplicates and limit results
          console.log(`Total location results before deduplication: ${allLocationResults.length}`);
          const uniquePlaces = allLocationResults.filter((place, index, self) => 
            index === self.findIndex(p => p.displayName.text === place.displayName.text && p.formattedAddress === place.formattedAddress)
          );
          console.log(`Unique places after deduplication: ${uniquePlaces.length}`);
          searchResults = uniquePlaces.slice(0, 50); // Limit to 50 results per category
          console.log(`Final search results for radius method: ${searchResults.length}`);
        }

        if (searchResults.length > 0) {
          // Make additional API calls for each place using their address for enhanced details
          const placesWithDetails = await Promise.all(
            searchResults.slice(0, 20).map(async (place: Place) => { // Limit detail calls to prevent API overuse
              try {
                const detailResponse = await fetch(`https://places.googleapis.com/v1/places:searchText?alt=json&fields=*&key=${apiKey}`, {
                  method: 'POST',
                  headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    textQuery: place.formattedAddress,
                    maxResultCount: 1
                  })
                });

                if (detailResponse.ok) {
                  const detailData = await detailResponse.json();
                  
                  // Validate API response structure
                  if (!detailData || !detailData.places || !Array.isArray(detailData.places) || detailData.places.length === 0) {
                    return {
                      ...place,
                      category: category.id
                    };
                  }
                  
                  const detailedPlace = detailData.places[0];
                  
                  // Safely extract additional details from the response
                  const enrichedPlace = {
                    ...place,
                    name: detailedPlace?.name || place.displayName.text,
                    location: detailedPlace?.location || place.location,
                    rating: detailedPlace?.rating,
                    userRatingCount: detailedPlace?.userRatingCount,
                    photos: detailedPlace?.photos,
                    additionalDetails: detailData,
                    category: category.id
                  };
                  
                  // Debug location data for custom searches
                  if (category.id === 'custom') {
                    console.log('Custom search place location data:', {
                      name: enrichedPlace.displayName.text,
                      location: enrichedPlace.location,
                      originalLocation: place.location,
                      detailedLocation: detailedPlace?.location
                    });
                  }
                  
                  return enrichedPlace;
                } else {
                  const fallbackPlace = {
                    ...place,
                    category: category.id
                  };
                  
                  // Debug fallback location data for custom searches
                  if (category.id === 'custom') {
                    console.log('Custom search place fallback (no detail response):', {
                      name: fallbackPlace.displayName.text,
                      location: fallbackPlace.location
                    });
                  }
                  
                  return fallbackPlace;
                }
              } catch (error) {
                const errorPlace = {
                  ...place,
                  category: category.id
                };
                
                // Debug error location data for custom searches
                if (category.id === 'custom') {
                  console.log('Custom search place error fallback:', {
                    name: errorPlace.displayName.text,
                    location: errorPlace.location,
                    error
                  });
                }
                
                return errorPlace;
              }
            })
          );

          allPlacesData[category.id] = placesWithDetails;
        }
      }

      // Handle results display
      console.log('Final allPlacesData:', allPlacesData);
      console.log('Custom search query:', customSearchQuery);
      
      if (customSearchQuery) {
        // For custom search, show all results in a single list
        const allCustomResults = Object.values(allPlacesData).flat();
        console.log('Custom search results to display:', allCustomResults.length);
        console.log('Custom search results sample:', allCustomResults.slice(0, 3).map(p => ({
          name: p.displayName.text,
          category: p.category,
          hasLocation: !!p.location,
          location: p.location
        })));
        setPlaces(allCustomResults);
        setAllPlaces({ custom: allCustomResults });
        // Set category to 'custom' for map component
        setSelectedCategory('custom');
      } else {
        // For category search (either initial or on-demand)
        // Update the existing allPlaces data with new category results
        setAllPlaces(prevAllPlaces => ({
          ...prevAllPlaces,
          ...allPlacesData
        }));
        
        // Mark the searched category as loaded
        const searchedCategoryId = categoriesToSearch[0]?.id;
        if (searchedCategoryId) {
          setLoadedCategories(prev => new Set([...prev, searchedCategoryId]));
          setCategoryLoading(prev => ({ ...prev, [searchedCategoryId]: false }));
        }
        
        // Update places display if this is for the currently selected category
        const currentCategoryId = specificCategory || selectedCategory;
        setPlaces(allPlacesData[currentCategoryId] || []);
        console.log('Category search results to display:', allPlacesData[currentCategoryId]?.length || 0);
      }
      
      setSearchCompleted(true);
      
      // Store all places data using trip-scoped storage
      const flatPlacesData = Object.values(allPlacesData).flat();
      console.log('Storing all places data with trip scope:', allPlacesData);
      storePlacesData(flatPlacesData);
      
      // Dispatch custom event to notify other components
      const allResultsFlat = Object.values(allPlacesData).flat();
      window.dispatchEvent(new CustomEvent('placesDataUpdated', { 
        detail: allResultsFlat
      }));
      
      // Also dispatch category change event for map component
      if (customSearchQuery) {
        window.dispatchEvent(new CustomEvent('categoryChanged', { 
          detail: 'custom'
        }));
      }

    } catch (err) {
      console.error('Error calling Places API:', err);
      setError(err instanceof Error ? err.message : 'Failed to search places along route');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // First try to load cached data
    const hasCachedData = loadCachedPlacesData();
    if (hasCachedData) {
      console.log('Using cached places data, skipping API calls');
      return; // Exit early if we have cached data
    }

    // No cached data found, proceed with API search for default category only
    console.log('No cached places data found, will search using API for points_of_interest');
    setUsingCachedData(false);

    // Check for route data every 2 seconds until found
    const checkInterval = setInterval(() => {
      const routeData = getCurrentRouteData();
      if (routeData) {
        clearInterval(checkInterval);
        // Only search for points_of_interest initially (default category)
        searchPlacesAlongRoute();
      }
    }, 2000);

    // Cleanup interval on unmount
    return () => clearInterval(checkInterval);
  }, [apiKey]);

  // Handle view mode changes
  useEffect(() => {
    // Dispatch view mode change event to map component
    window.dispatchEvent(new CustomEvent('viewModeChanged', { 
      detail: viewMode 
    }));
  }, [viewMode]);

  // Handle category selection with on-demand loading
  const handleCategoryChange = async (categoryId: string) => {
    setSelectedCategory(categoryId);
    // Clear custom search when switching to categories
    if (customSearchQuery) {
      setCustomSearchQuery('');
      console.log('Cleared custom search query when switching to category:', categoryId);
    }
    
    // Check if category is already loaded
    if (loadedCategories.has(categoryId)) {
      // Category is cached, display immediately
      console.log(`Category ${categoryId} is cached, displaying immediately`);
      setPlaces(allPlaces[categoryId] || []);
    } else {
      // Category not loaded, trigger on-demand search
      console.log(`Category ${categoryId} not loaded, triggering search`);
      setCategoryLoading(prev => ({ ...prev, [categoryId]: true }));
      
      try {
        await searchPlacesAlongRoute(categoryId);
      } catch (error) {
        console.error(`Failed to load category ${categoryId}:`, error);
        setCategoryLoading(prev => ({ ...prev, [categoryId]: false }));
      }
    }
    
    // Dispatch custom event to notify map component
    window.dispatchEvent(new CustomEvent('categoryChanged', { 
      detail: categoryId 
    }));
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Searching Places</h3>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">
          {isLoadedTrip ? 'Saved Trip Details' : 'Places Along Route'}
        </h2>
        {!isLoadedTrip && (
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('searches')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'searches'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Show Searches
              </button>
              <button
                onClick={() => setViewMode('trip')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                  viewMode === 'trip'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                Show Trip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Search Controls */}
      {!isLoadedTrip && viewMode === 'searches' && (
        <div className="mb-6 space-y-4">
        {/* Search Method Toggle */}
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Search Method:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSearchMethod('route')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                searchMethod === 'route'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Along Route
            </button>
            <button
              onClick={() => setSearchMethod('radius')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${
                searchMethod === 'radius'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Radius Search
            </button>
          </div>
        </div>

        {/* Search Radius Control (shown for radius method) */}
        {searchMethod === 'radius' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Radius: {searchRadius} km
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={searchRadius}
              onChange={(e) => setSearchRadius(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>5km</span>
              <span>25km</span>
              <span>50km</span>
            </div>
          </div>
        )}

        {/* Custom Search Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Search (optional)
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={customSearchQuery}
              onChange={(e) => setCustomSearchQuery(e.target.value)}
              placeholder="e.g., waterfalls, historic sites, local restaurants..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 text-gray-900 placeholder-gray-500"
            />
            <button
              onClick={() => {
                console.log('Manual search triggered with custom query:', customSearchQuery);
                setSearchCompleted(false);
                setUsingCachedData(false);
                // Clear cached places data and loaded categories if doing custom search
                if (customSearchQuery) {
                  console.log('Clearing cached data for custom search');
                  setAllPlaces({});
                  setPlaces([]);
                  setLoadedCategories(new Set());
                  setCategoryLoading({});
                }
                const routeData = getCurrentRouteData();
                if (routeData) {
                  searchPlacesAlongRoute();
                }
              }}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isLoading ? 'Searching...' : 'Update Search'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use category-based search below
          </p>
        </div>

        </div>
      )}

      {/* Category Selector */}
      {!isLoadedTrip && viewMode === 'searches' && searchCompleted && !customSearchQuery && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Browse by Category:</h3>
          <div className="grid grid-cols-8 gap-2">
            {SEARCH_CATEGORIES.map((category) => {
              const isSelected = selectedCategory === category.id;
              const isLoading = categoryLoading[category.id] || false;
              
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border transition-all duration-200 text-center relative ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    {isLoading ? (
                      <div className="text-lg">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    ) : (
                      <span className="text-lg">{category.icon}</span>
                    )}
                    <span className="font-medium text-xs">{category.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-700">Searching for places along your route...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a moment as we search multiple categories</p>
          </div>
        </div>
      )}

      {/* Custom Search Results Header */}
      {!isLoadedTrip && viewMode === 'searches' && searchCompleted && customSearchQuery && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Search Results for "{customSearchQuery}" ({places.length} found)
          </h3>
        </div>
      )}

      {/* Trip Places Header */}
      {(viewMode === 'trip' || isLoadedTrip) && (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Places Added to Trip
          </h3>
        </div>
      )}

      {/* Places List */}
      {!isLoading && ((!isLoadedTrip && viewMode === 'searches' && places.length > 0) || (viewMode === 'trip' || isLoadedTrip)) && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {((viewMode === 'trip' || isLoadedTrip) ? (getCurrentTripData()?.places || []) : places).map((place, index) => {
            // Handle type differences between TripPlace and Place
            const hasPhotos = 'photos' in place && place.photos;
            const hasRating = 'rating' in place && place.rating;
            const hasUserRatingCount = 'userRatingCount' in place && place.userRatingCount;
            const hasRoutingSummaries = 'routingSummaries' in place && place.routingSummaries;
            
            return (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200 cursor-pointer"
              onClick={() => {
                // Dispatch custom event to show marker popup on map
                window.dispatchEvent(new CustomEvent('showPlacePopup', {
                  detail: {
                    place: place,
                    location: place.location
                  }
                }));
                
                // Auto-scroll to the map
                const mapElement = document.querySelector('[data-map-container]');
                if (mapElement) {
                  mapElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                  });
                }
              }}
            >
              <div className="flex items-start space-x-4">
                {/* Place Photo or Icon */}
                <div className="flex-shrink-0">
                  {hasPhotos && (place as any).photos.length > 0 ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden">
                      <img
                        src={`https://places.googleapis.com/v1/${(place as any).photos[0].name}/media?key=${apiKey}&maxWidthPx=200&maxHeightPx=200`}
                        alt={place.displayName.text}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to icon if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center hidden">
                        <span className="text-xl">📍</span>
                      </div>
                    </div>
                  ) : (
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-xl">📍</span>
                    </div>
                  )}
                </div>

                {/* Place Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {place.displayName.text}
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">{place.formattedAddress}</p>
                      
                      {/* Rating */}
                      {hasRating && (
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="flex items-center">
                            <span className="text-yellow-500 text-sm">⭐</span>
                            <span className="text-sm font-medium text-gray-700 ml-1">
                              {(place as any).rating.toFixed(1)}
                            </span>
                          </div>
                          {hasUserRatingCount && (
                            <span className="text-xs text-gray-500">
                              ({(place as any).userRatingCount} reviews)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Routing Info */}
                      {hasRoutingSummaries && (place as any).routingSummaries.length > 0 && (
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-500">🚗</span>
                            <span className="text-gray-700">
                              {Math.round(parseInt((place as any).routingSummaries[0].duration) / 60)} min
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-green-500">📏</span>
                            <span className="text-gray-700">
                              {((place as any).routingSummaries[0].distanceMeters / 1000).toFixed(1)} km
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* No Results */}
      {!isLoading && (
        (!isLoadedTrip && viewMode === 'searches' && places.length === 0 && searchCompleted) ||
        ((viewMode === 'trip' || isLoadedTrip) && (getCurrentTripData()?.places || []).length === 0)
      ) && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">{(viewMode === 'trip' || isLoadedTrip) ? '🗺️' : '🔍'}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {(viewMode === 'trip' || isLoadedTrip) ? 'No Places Added to Trip' : 'No Places Found'}
          </h3>
          <p className="text-gray-700">
            {(viewMode === 'trip' || isLoadedTrip)
              ? (isLoadedTrip 
                  ? 'This saved trip has no stops - it goes directly from start to destination.'
                  : 'Click on search results or map markers to add places to your trip.')
              : customSearchQuery 
                ? `No results found for "${customSearchQuery}". Try a different search term or increase the search radius.`
                : 'No points of interest found along your route.'
            }
          </p>
        </div>
      )}
    </div>
  );
} 