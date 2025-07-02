'use client';

import { useEffect, useState } from 'react';
import { getCurrentRouteData, getCurrentPlacesData, storePlacesData } from '@/utils/tripSession';

interface RoutePlacesSearchProps {
  apiKey: string;
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
    id: 'coffee',
    name: 'Coffee Shops',
    query: 'coffee shops cafes',
    icon: '☕',
    description: 'Coffee and refreshment stops'
  },
  {
    id: 'shopping',
    name: 'Shopping',
    query: 'shopping malls stores',
    icon: '🛍️',
    description: 'Shopping centers and retail'
  }
];

export default function RoutePlacesSearch({ apiKey }: RoutePlacesSearchProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('points_of_interest');
  const [allPlaces, setAllPlaces] = useState<Record<string, Place[]>>({});
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [usingCachedData, setUsingCachedData] = useState(false);

  useEffect(() => {
    // First check if we already have cached places data for this trip
    const loadCachedPlacesData = () => {
      const cachedPlaces = getCurrentPlacesData();
      if (cachedPlaces && cachedPlaces.length > 0) {
        console.log('Loading cached places data:', cachedPlaces.length, 'places');
        setUsingCachedData(true);
        
        // Group places by category
        const groupedPlaces: Record<string, Place[]> = {};
        SEARCH_CATEGORIES.forEach(category => {
          groupedPlaces[category.id] = cachedPlaces.filter((place: Place) => place.category === category.id);
        });
        
        setAllPlaces(groupedPlaces);
        setPlaces(groupedPlaces[selectedCategory] || []);
        setSearchCompleted(true);
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('placesDataUpdated', { 
          detail: cachedPlaces
        }));
        
        return true; // Indicate we found cached data
      }
      return false; // No cached data found
    };

    const searchPlacesAlongRoute = async () => {
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

        // Search for all categories
        const allPlacesData: Record<string, Place[]> = {};
        
        for (const category of SEARCH_CATEGORIES) {
          console.log(`Searching for ${category.name}...`);
          
          const requestBody = {
            textQuery: category.query,
            searchAlongRouteParameters: {
              polyline: {
                encodedPolyline: routeData.polyline.encodedPolyline
              }
            }
          };

          try {
            const response = await fetch(`https://places.googleapis.com/v1/places:searchText?fields=places.displayName%2Cplaces.formattedAddress%2CroutingSummaries&key=${apiKey}`, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.priceLevel,places.placeId,places.place,routingSummaries'
              },
              body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
              console.error(`Failed to search for ${category.name}:`, response.statusText);
              continue;
            }

            const data = await response.json();
            console.log(`${category.name} search results:`, data);

            if (data.places) {
              // Make additional API calls for each place using their address
              const placesWithDetails = await Promise.all(
                data.places.map(async (place: Place) => {
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
                        console.warn(`No valid places data returned for ${place.displayName.text}:`, detailData);
                        return {
                          ...place,
                          category: category.id
                        };
                      }
                      
                      const detailedPlace = detailData.places[0];
                      const placeId = detailedPlace?.placeId;
                      
                      if (placeId) {
                        console.log(`Place ID for ${place.displayName.text}:`, placeId);
                      } else {
                        console.warn(`No place ID found for ${place.displayName.text}`);
                      }
                      
                      // Safely extract additional details from the response
                      return {
                        ...place,
                        name: detailedPlace?.name || place.displayName.text,
                        location: detailedPlace?.location || place.location,
                        rating: detailedPlace?.rating,
                        userRatingCount: detailedPlace?.userRatingCount,
                        photos: detailedPlace?.photos,
                        additionalDetails: detailData,
                        category: category.id
                      };
                    } else {
                      console.error(`Failed to get details for ${place.displayName.text}: ${detailResponse.status} ${detailResponse.statusText}`);
                      return {
                        ...place,
                        category: category.id
                      };
                    }
                  } catch (error) {
                    console.error(`Error getting details for ${place.displayName.text}:`, error);
                    return {
                      ...place,
                      category: category.id
                    };
                  }
                })
              );

              allPlacesData[category.id] = placesWithDetails;
            }
          } catch (err) {
            console.error(`Error searching for ${category.name}:`, err);
          }
        }

        setAllPlaces(allPlacesData);
        setPlaces(allPlacesData[selectedCategory] || []);
        setSearchCompleted(true);
        
        // Store all places data using trip-scoped storage
        const flatPlacesData = Object.values(allPlacesData).flat();
        console.log('Storing all places data with trip scope:', allPlacesData);
        storePlacesData(flatPlacesData);
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('placesDataUpdated', { 
          detail: Object.values(allPlacesData).flat()
        }));

      } catch (err) {
        console.error('Error calling Places API:', err);
        setError(err instanceof Error ? err.message : 'Failed to search places along route');
      } finally {
        setIsLoading(false);
      }
    };

    // First try to load cached data
    const hasCachedData = loadCachedPlacesData();
    if (hasCachedData) {
      console.log('Using cached places data, skipping API calls');
      return; // Exit early if we have cached data
    }

    // No cached data found, proceed with API search
    console.log('No cached places data found, will search using API');
    setUsingCachedData(false);

    // Check for route data every 2 seconds until found
    const checkInterval = setInterval(() => {
      const routeData = getCurrentRouteData();
      if (routeData) {
        clearInterval(checkInterval);
        searchPlacesAlongRoute();
      }
    }, 2000);

    // Cleanup interval on unmount
    return () => clearInterval(checkInterval);
  }, [apiKey]);

  // Handle category selection
  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setPlaces(allPlaces[categoryId] || []);
    
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
        <h2 className="text-xl font-bold text-gray-900">Places Along Route</h2>
      </div>

      {/* Category Selector */}
      {searchCompleted && (
        <div className="mb-6">
          <div className="grid grid-cols-8 gap-2">
            {SEARCH_CATEGORIES.map((category) => {
              const categoryPlaces = allPlaces[category.id] || [];
              const isSelected = selectedCategory === category.id;
              return (
                <button
                  key={category.id}
                  onClick={() => handleCategoryChange(category.id)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-center ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex flex-col items-center space-y-1">
                    <span className="text-lg">{category.icon}</span>
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

      {/* Places List */}
      {!isLoading && places.length > 0 && (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {places.map((place, index) => (
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
                  {place.photos && place.photos.length > 0 ? (
                    <div className="w-16 h-16 rounded-lg overflow-hidden">
                      <img
                        src={`https://places.googleapis.com/v1/${place.photos[0].name}/media?key=${apiKey}&maxWidthPx=200&maxHeightPx=200`}
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
                      
                      {/* Coordinates */}
                      {place.location && (
                        <p className="text-xs text-gray-500 mb-2">
                          📍 {place.location.latitude.toFixed(6)}, {place.location.longitude.toFixed(6)}
                        </p>
                      )}
                      
                      {/* Rating */}
                      {place.rating && (
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="flex items-center">
                            <span className="text-yellow-500 text-sm">⭐</span>
                            <span className="text-sm font-medium text-gray-700 ml-1">
                              {place.rating.toFixed(1)}
                            </span>
                          </div>
                          {place.userRatingCount && (
                            <span className="text-xs text-gray-500">
                              ({place.userRatingCount} reviews)
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Routing Info */}
                      {place.routingSummaries && place.routingSummaries.length > 0 && (
                        <div className="flex items-center space-x-4 text-sm">
                          <div className="flex items-center space-x-1">
                            <span className="text-blue-500">🚗</span>
                            <span className="text-gray-700">
                              {Math.round(parseInt(place.routingSummaries[0].duration) / 60)} min
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <span className="text-green-500">📏</span>
                            <span className="text-gray-700">
                              {(place.routingSummaries[0].distanceMeters / 1000).toFixed(1)} km
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isLoading && places.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔍</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Places Found</h3>
          <p className="text-gray-700">No points of interest found along your route.</p>
        </div>
      )}
    </div>
  );
} 