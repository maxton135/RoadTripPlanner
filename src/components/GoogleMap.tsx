'use client';

import { useEffect, useRef, useState } from 'react';
import { Wrapper } from '@googlemaps/react-wrapper';
import { 
  getCurrentTripData, 
  storeRouteData, 
  updateTripData,
  TripData, 
  TripPlace, 
  RouteData 
} from '@/utils/tripSession';


// Utility function to generate unique ID for places
const generatePlaceId = (place: { displayName: { text: string }; formattedAddress: string }): string => {
  const combinedString = `${place.displayName.text}-${place.formattedAddress}`;
  // Simple hash function for generating consistent IDs
  let hash = 0;
  for (let i = 0; i < combinedString.length; i++) {
    const char = combinedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `place-${Math.abs(hash)}`;
};

// Utility functions for trip data management (using trip-scoped storage)
const getTripData = (): TripData => {
  const tripData = getCurrentTripData();
  if (tripData) {
    // Ensure places array exists
    return {
      ...tripData,
      places: tripData.places || []
    };
  }
  return { from: '', to: '', fromPlaceId: '', toPlaceId: '', places: [] };
};

const saveTripData = (tripData: TripData): boolean => {
  return updateTripData(tripData);
};

const isPlaceInTrip = (place: { displayName: { text: string }; formattedAddress: string }, tripData: TripData): boolean => {
  return (tripData.places || []).some((tripPlace: TripPlace) => 
    tripPlace.displayName.text === place.displayName.text &&
    tripPlace.formattedAddress === place.formattedAddress
  );
};

// Utility functions for waypoint management
const convertTripPlacesToWaypoints = (tripPlaces: TripPlace[]): google.maps.DirectionsWaypoint[] => {
  return tripPlaces
    .filter(place => place.location && place.location.latitude && place.location.longitude)
    .map(place => ({
      location: new google.maps.LatLng(place.location!.latitude, place.location!.longitude),
      stopover: true
    }));
};

const getTripPlacesForWaypoints = (): TripPlace[] => {
  const tripData = getTripData();
  return tripData.places || [];
};

interface GoogleMapProps {
  startingLocation: string;
  destination: string;
  apiKey: string;
  places?: Array<{
    displayName: {
      text: string;
    };
    formattedAddress: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    category?: string;
  }>;
  selectedCategory?: string;
}

function MapComponent({ startingLocation, destination, apiKey, places, selectedCategory }: { 
  startingLocation: string; 
  destination: string; 
  apiKey: string;
  places?: Array<{
    displayName: {
      text: string;
    };
    formattedAddress: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    category?: string;
  }>;
  selectedCategory?: string;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placeMarkers, setPlaceMarkers] = useState<google.maps.Marker[]>([]);
  const [routeMarkers, setRouteMarkers] = useState<google.maps.Marker[]>([]);
  const previousPlacesRef = useRef<any[]>([]);
  const previousCategoryRef = useRef<string>('');
  const [currentInfoWindow, setCurrentInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [viewMode, setViewMode] = useState<'searches' | 'trip'>('searches');

  // Reusable route calculation function with waypoints support
  const calculateAndDisplayRoute = async (waypoints: google.maps.DirectionsWaypoint[] = []) => {
    if (!directionsService || !directionsRenderer || !startingLocation || !destination || !map) return;

    setIsLoading(true);
    setError(null);

    try {
      // Clear existing route markers
      routeMarkers.forEach(marker => marker.setMap(null));
      setRouteMarkers([]);

      const request: google.maps.DirectionsRequest = {
        origin: startingLocation,
        destination: destination,
        waypoints: waypoints,
        optimizeWaypoints: waypoints.length > 0,
        travelMode: google.maps.TravelMode.DRIVING,
        unitSystem: google.maps.UnitSystem.METRIC,
        avoidHighways: false,
        avoidTolls: false
      };

      const result = await directionsService.route(request);
      
      if (result.routes && result.routes.length > 0) {
        directionsRenderer.setDirections(result);
        
        const route = result.routes[0];
        const newRouteMarkers: google.maps.Marker[] = [];
        
        // Add custom markers for start and end points
        const firstLeg = route.legs[0];
        const lastLeg = route.legs[route.legs.length - 1];
        
        // Starting point marker
        const startMarker = new google.maps.Marker({
          position: firstLeg.start_location,
          map: map,
          title: `Starting: ${startingLocation}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#3B82F6" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
          }
        });
        newRouteMarkers.push(startMarker);

        // Destination marker
        const endMarker = new google.maps.Marker({
          position: lastLeg.end_location,
          map: map,
          title: `Destination: ${destination}`,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#8B5CF6" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
          }
        });
        newRouteMarkers.push(endMarker);

        setRouteMarkers(newRouteMarkers);
        
        // Store route data in session storage for other components to use
        const totalDistance = route.legs.reduce((total, leg) => total + (leg.distance?.value || 0), 0);
        const totalDuration = route.legs.reduce((total, leg) => total + (leg.duration?.value || 0), 0);
        
        console.log('Route calculation details:');
        console.log('Number of legs:', route.legs.length);
        console.log('Leg details:', route.legs.map((leg, index) => ({
          leg: index + 1,
          distance: leg.distance?.value || 0,
          duration: leg.duration?.value || 0,
          start: leg.start_address,
          end: leg.end_address
        })));
        console.log('Total distance (meters):', totalDistance);
        console.log('Total duration (seconds):', totalDuration);
        console.log('Total duration (hours):', totalDuration / 3600);
        
        const routeData = {
          distanceMeters: totalDistance,
          duration: totalDuration.toString(),
          polyline: {
            encodedPolyline: route.overview_polyline || ''
          },
          waypoints: waypoints.map(wp => ({
            location: {
              lat: (wp.location as google.maps.LatLng).lat(),
              lng: (wp.location as google.maps.LatLng).lng()
            }
          })),
          timestamp: new Date().toISOString()
        };
        
        const success = storeRouteData(routeData);
        if (success) {
          console.log('Route data stored with trip scope:', routeData);
          
          // Dispatch event to notify other components about route calculation
          window.dispatchEvent(new CustomEvent('routeCalculated', {
            detail: { routeData }
          }));
        } else {
          console.error('Failed to store route data');
        }
      }
    } catch (err) {
      console.error('Directions request failed:', err);
      setError('Could not calculate route. Please check your starting point and destination.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!mapRef.current) return;

    const newMap = new google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 }, // Default center (San Francisco)
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    const newDirectionsService = new google.maps.DirectionsService();
    const newDirectionsRenderer = new google.maps.DirectionsRenderer({
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3B82F6',
        strokeWeight: 5,
        strokeOpacity: 0.8
      }
    });

    newDirectionsRenderer.setMap(newMap);

    setMap(newMap);
    setDirectionsService(newDirectionsService);
    setDirectionsRenderer(newDirectionsRenderer);
  }, []);

  // Initial route calculation effect
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !startingLocation || !destination) return;

    // Check if there are existing trip places that should be included in the initial route
    const tripPlaces = getTripPlacesForWaypoints();
    const waypoints = convertTripPlacesToWaypoints(tripPlaces);
    
    if (tripPlaces.length > 0) {
      console.log('Calculating initial route with existing', waypoints.length, 'waypoints');
      calculateAndDisplayRoute(waypoints);
    } else {
      // Calculate basic route without waypoints
      console.log('Calculating basic route from', startingLocation, 'to', destination);
      calculateAndDisplayRoute([]);
    }
  }, [directionsService, directionsRenderer, startingLocation, destination]);


  // Add place markers when places data changes
  useEffect(() => {
    if (map && places) {
      // Check if places data has changed OR if selected category has changed
      const placesChanged = JSON.stringify(places) !== JSON.stringify(previousPlacesRef.current);
      const categoryChanged = selectedCategory !== previousCategoryRef.current;
      
      if (placesChanged || categoryChanged) {
        console.log('Updating place markers - places changed:', placesChanged, 'category changed:', categoryChanged);
        previousPlacesRef.current = places;
        previousCategoryRef.current = selectedCategory || '';
        addPlaceMarkers();
      }
    }
  }, [map, places, selectedCategory]);

  // Update markers when view mode changes
  useEffect(() => {
    if (map && places) {
      console.log('View mode changed, updating markers:', viewMode);
      addPlaceMarkers();
    }
  }, [viewMode]);

  // Listen for showPlacePopup events
  useEffect(() => {
    const handleShowPlacePopup = (event: CustomEvent) => {
      const { place, location } = event.detail;
      
      if (!map || !location) return;
      
      // Find the marker for this place
      const targetMarker = placeMarkers.find(marker => {
        const markerPosition = marker.getPosition();
        if (!markerPosition) return false;
        
        return markerPosition.lat() === location.latitude && 
               markerPosition.lng() === location.longitude;
      });
      
      if (targetMarker) {
        // Trigger the same click handler as clicking the marker directly
        google.maps.event.trigger(targetMarker, 'click');
      }
    };

    const handlePlaceAddedToTrip = (event: CustomEvent) => {
      // Refresh markers to show persistent state
      console.log('Place added to trip:', event.detail.place.displayName.text);
      if (map && places) {
        addPlaceMarkers();
      }
      
      // Recalculate route with new waypoints
      if (directionsService && directionsRenderer && startingLocation && destination) {
        const updatedTripPlaces = getTripPlacesForWaypoints();
        const updatedWaypoints = convertTripPlacesToWaypoints(updatedTripPlaces);
        console.log('Recalculating route with', updatedWaypoints.length, 'waypoints');
        calculateAndDisplayRoute(updatedWaypoints);
      }
    };

    const handleViewModeChanged = (event: CustomEvent) => {
      console.log('View mode changed to:', event.detail);
      setViewMode(event.detail);
    };

    window.addEventListener('showPlacePopup', handleShowPlacePopup as EventListener);
    window.addEventListener('placeAddedToTrip', handlePlaceAddedToTrip as EventListener);
    window.addEventListener('viewModeChanged', handleViewModeChanged as EventListener);
    
    return () => {
      window.removeEventListener('showPlacePopup', handleShowPlacePopup as EventListener);
      window.removeEventListener('placeAddedToTrip', handlePlaceAddedToTrip as EventListener);
      window.removeEventListener('viewModeChanged', handleViewModeChanged as EventListener);
    };
  }, [map, placeMarkers, places]);

  // Function to clear existing place markers
  const clearPlaceMarkers = () => {
    placeMarkers.forEach(marker => marker.setMap(null));
    setPlaceMarkers([]);
  };

  // Function to add markers for places along the route
  const addPlaceMarkers = () => {
    if (!map || !places || places.length === 0) {
      console.log('Cannot add place markers:', { map: !!map, places: !!places, placesLength: places?.length });
      return;
    }

    console.log('Clearing existing markers and adding new ones for', places.length, 'places');
    clearPlaceMarkers();
    const newMarkers: google.maps.Marker[] = [];

    // Define colors for different categories
    const categoryColors: Record<string, string> = {
      points_of_interest: '#8B5CF6', // Purple
      restaurants: '#EF4444', // Red
      gas_stations: '#F59E0B', // Amber
      parks: '#10B981', // Green
      viewpoints: '#06B6D4', // Cyan
      hotels: '#EC4899', // Pink
      historical_sites: '#8B4513', // Brown
      museums: '#6366F1', // Indigo
      custom: '#FF6B35' // Orange for custom searches
    };

    // Filter places based on view mode and selected category
    let filteredPlaces;
    
    if (viewMode === 'trip') {
      // Show all places that are in the trip, regardless of current search results
      const tripData = getTripData();
      filteredPlaces = tripData.places || [];
    } else {
      // Show places based on selected category (searches mode)
      filteredPlaces = selectedCategory 
        ? (selectedCategory === 'custom' 
            ? places // Show all places for custom search
            : places.filter(place => place.category === selectedCategory))
        : places;
    }

    console.log(`Showing ${filteredPlaces.length} places for category: ${selectedCategory || 'all'}`);
    console.log('Available categories in places:', [...new Set(places.map(p => p.category))]);
    console.log('Selected category:', selectedCategory);
    console.log('Filtered places:', filteredPlaces.map(p => ({ name: p.displayName.text, category: p.category })));

    filteredPlaces.forEach((place) => {
      console.log('Processing place:', place.displayName.text, 'with location:', place.location);
      if (place.location) {
        const categoryColor = place.category ? categoryColors[place.category] || '#10B981' : '#10B981';
        
        // Check if place is already in trip to determine marker style
        const tripData = getTripData();
        const placeIsInTrip = isPlaceInTrip(place, tripData);
        
        // Create icon for all markers with consistent style
        const iconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
               <circle cx="12" cy="12" r="8" fill="${categoryColor}" stroke="white" stroke-width="${placeIsInTrip ? '3' : '2'}"/>
               <circle cx="12" cy="12" r="3" fill="white"/>
               ${placeIsInTrip ? `<circle cx="12" cy="12" r="10" fill="none" stroke="${categoryColor}" stroke-width="1" opacity="0.5"/>` : ''}
             </svg>`;

        const marker = new google.maps.Marker({
          position: { lat: place.location.latitude, lng: place.location.longitude },
          map: map,
          title: place.displayName.text,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(iconSvg),
            scaledSize: new google.maps.Size(20, 20),
            anchor: new google.maps.Point(10, 10)
          }
        });

        // Add click listener to show place info with Add to Trip option
        marker.addListener('click', () => {
          // Close any existing InfoWindow
          if (currentInfoWindow) {
            currentInfoWindow.close();
          }

          // Get current trip data
          const currentTripData = getTripData();
          const placeCurrentlyInTrip = isPlaceInTrip(place, currentTripData);
          const placeId = generatePlaceId(place);

          const categoryDisplay = place.category === 'custom' 
            ? '🔍 Custom Search Result'
            : place.category ? place.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) : '';

          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div style="padding: 12px; max-width: 250px;">
                <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1F2937;">${place.displayName.text}</h3>
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #6B7280;">${place.formattedAddress}</p>
                ${categoryDisplay ? `<p style="margin: 0 0 12px 0; font-size: 11px; color: #9CA3AF;">Category: ${categoryDisplay}</p>` : ''}
                <button 
                  id="add-to-trip-btn-${placeId}" 
                  data-place-id="${placeId}"
                  style="
                    background: ${placeCurrentlyInTrip ? '#10B981' : '#3B82F6'}; 
                    color: white; 
                    border: none; 
                    padding: 8px 16px; 
                    border-radius: 6px; 
                    font-size: 12px; 
                    font-weight: 500;
                    cursor: ${placeCurrentlyInTrip ? 'default' : 'pointer'};
                    width: 100%;
                    opacity: ${placeCurrentlyInTrip ? '0.7' : '1'};
                  "
                  ${placeCurrentlyInTrip ? 'disabled' : ''}
                >
                  ${placeCurrentlyInTrip ? '✓ Added to Trip' : '+ Add to Trip'}
                </button>
              </div>
            `
          });
          
          infoWindow.open(map, marker);
          setCurrentInfoWindow(infoWindow);
          
          // Add cleanup when InfoWindow closes
          google.maps.event.addListener(infoWindow, 'closeclick', () => {
            setCurrentInfoWindow(null);
          });
          
          // Add event listener for the Add to Trip button (improved approach)
          if (!placeCurrentlyInTrip) {
            // Use a more reliable event delegation approach
            const handleButtonClick = (event: Event) => {
              const target = event.target as HTMLElement;
              if (target && target.id === `add-to-trip-btn-${placeId}`) {
                event.preventDefault();
                event.stopPropagation();
                
                // Add place to trip with error handling
                const latestTripData = getTripData();
                const newTripPlace: TripPlace = {
                  ...place,
                  addedAt: new Date().toISOString()
                };
                
                const updatedTripData: TripData = {
                  ...latestTripData,
                  places: [...(latestTripData.places || []), newTripPlace]
                };
                
                const saveSuccess = saveTripData(updatedTripData);
                
                if (saveSuccess) {
                  // Dispatch event to notify other components
                  window.dispatchEvent(new CustomEvent('placeAddedToTrip', {
                    detail: { place: newTripPlace }
                  }));
                  
                  // Update button state
                  target.textContent = '✓ Added to Trip';
                  target.style.background = '#10B981';
                  target.style.opacity = '0.7';
                  target.style.cursor = 'default';
                  target.setAttribute('disabled', 'true');
                  
                  // Update marker to persistent style
                  const persistentIconSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                         <circle cx="12" cy="12" r="8" fill="${categoryColor}" stroke="white" stroke-width="3"/>
                         <circle cx="12" cy="12" r="3" fill="white"/>
                         <circle cx="12" cy="12" r="10" fill="none" stroke="${categoryColor}" stroke-width="1" opacity="0.5"/>
                       </svg>`;

                  marker.setIcon({
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(persistentIconSvg),
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10)
                  });
                } else {
                  // Show error feedback
                  target.textContent = 'Error - Try Again';
                  target.style.background = '#EF4444';
                  setTimeout(() => {
                    target.textContent = '+ Add to Trip';
                    target.style.background = '#3B82F6';
                  }, 2000);
                }
                
                // Remove event listener after use
                document.removeEventListener('click', handleButtonClick);
              }
            };
            
            // Add event listener with a small delay to ensure InfoWindow is rendered
            setTimeout(() => {
              document.addEventListener('click', handleButtonClick);
            }, 50);
            
            // Clean up event listener when InfoWindow is closed
            google.maps.event.addListener(infoWindow, 'closeclick', () => {
              document.removeEventListener('click', handleButtonClick);
              setCurrentInfoWindow(null);
            });
          }
        });

        newMarkers.push(marker);
        console.log('Added marker for:', place.displayName.text);
      } else {
        console.log('No location data for place:', place.displayName.text);
      }
    });

    setPlaceMarkers(newMarkers);
    console.log('Total markers added:', newMarkers.length);
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Route Error</h3>
        <p className="text-gray-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative" data-map-container>
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-700">Calculating route...</p>
          </div>
        </div>
      )}
      <div 
        ref={mapRef} 
        className="w-full h-96 rounded-xl shadow-lg"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}

export default function GoogleMap({ startingLocation, destination, apiKey, places, selectedCategory }: GoogleMapProps) {
  return (
    <Wrapper apiKey={apiKey}>
      <MapComponent startingLocation={startingLocation} destination={destination} apiKey={apiKey} places={places} selectedCategory={selectedCategory} />
    </Wrapper>
  );
} 