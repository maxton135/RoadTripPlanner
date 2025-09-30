'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import GoogleMap from '@/components/GoogleMap';
import RoutePlacesSearch from '@/components/RoutePlacesSearch';
import { 
  getCurrentTripData, 
  getCurrentRouteData, 
  getCurrentPlacesData,
  storePlacesData,
  hasValidCurrentTrip,
  saveCurrentTrip,
  updateSavedTrip,
  getSavedTrips,
  generateShareableUrl,
  TripData, 
  TripPlace, 
  RouteData 
} from '@/utils/tripSession';


export default function PlannerPage() {
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [places, setPlaces] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('points_of_interest');
  const [addedTripPlaces, setAddedTripPlaces] = useState<TripPlace[]>([]);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  
  // Save/Share modals state
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string>('');
  
  // Track if this is a loaded trip (has saved places)
  const [isLoadedTrip, setIsLoadedTrip] = useState(false);
  
  // Track the ID of the currently loaded saved trip (for updates)
  const [currentSavedTripId, setCurrentSavedTripId] = useState<string | null>(null);
  const [currentSavedTripName, setCurrentSavedTripName] = useState<string>('');
  const [currentSavedTripDescription, setCurrentSavedTripDescription] = useState<string>('');
  
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    // Check if we have a valid current trip
    if (!hasValidCurrentTrip()) {
      console.log('No valid current trip found');
      setIsLoading(false);
      return;
    }

    // Get trip data using utility functions
    const currentTripData = getCurrentTripData();
    if (currentTripData) {
      setTripData(currentTripData);
      setAddedTripPlaces(currentTripData.places || []);
      console.log('Loaded trip data:', currentTripData);
      
      // Check if this trip has places (indicating it's a loaded saved trip)
      if (currentTripData.places && currentTripData.places.length > 0) {
        setIsLoadedTrip(true);
        console.log('Detected loaded trip with', currentTripData.places.length, 'places');
        
        // Try to find the matching saved trip ID
        const savedTrips = getSavedTrips();
        const matchingTrip = savedTrips.find(savedTrip => 
          savedTrip.tripData.from === currentTripData.from &&
          savedTrip.tripData.to === currentTripData.to &&
          savedTrip.tripData.places?.length === currentTripData.places?.length
        );
        
        if (matchingTrip) {
          setCurrentSavedTripId(matchingTrip.id);
          setCurrentSavedTripName(matchingTrip.name);
          setCurrentSavedTripDescription(matchingTrip.description || '');
          console.log('Found matching saved trip:', matchingTrip.name, 'ID:', matchingTrip.id);
        }
        
        // Dispatch view mode change event to ensure map shows trip view
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('viewModeChanged', { 
            detail: 'trip' 
          }));
          console.log('Dispatched viewModeChanged event for loaded trip');
        }, 500);
      }
    }

    // Get route data using utility functions
    const currentRouteData = getCurrentRouteData();
    if (currentRouteData) {
      setRouteData(currentRouteData);
      console.log('Loaded route data:', currentRouteData);
    }

    // Get places data using utility functions
    const currentPlacesData = getCurrentPlacesData();
    
    // Check if this is a loaded trip by looking at trip places
    const hasExistingPlaces = currentTripData && currentTripData.places && currentTripData.places.length > 0;
    
    if (!hasExistingPlaces && currentPlacesData) {
      // Only load search places for new trips
      setPlaces(currentPlacesData);
      console.log('Loaded places data for new trip:', currentPlacesData);
    } else if (hasExistingPlaces) {
      // Clear places data for loaded trips to prevent interference
      setPlaces([]);
      console.log('Cleared places data for loaded trip');
    }

    setIsLoading(false);
  }, []);

  // Handle loaded trip state changes
  useEffect(() => {
    if (isLoadedTrip) {
      // Clear places data when trip is marked as loaded
      setPlaces([]);
      // Ensure category is set to trip view
      setSelectedCategory('trip');
      console.log('Loaded trip detected - cleared search data and set trip view');
    }
  }, [isLoadedTrip]);

  // Listen for places data from RoutePlacesSearch component
  useEffect(() => {
    // Listen for places data updates
    const handlePlacesDataUpdated = (event: CustomEvent) => {
      console.log('Received places data update event:', event.detail);
      setPlaces(event.detail);
      // Store places data using trip-scoped storage
      storePlacesData(event.detail);
    };

    // Listen for category selection updates
    const handleCategoryChanged = (event: CustomEvent) => {
      console.log('Received category change event:', event.detail);
      setSelectedCategory(event.detail);
    };

    // Listen for places added to trip
    const handlePlaceAddedToTrip = (event: CustomEvent) => {
      console.log('Place added to trip:', event.detail.place);
      
      // If user adds a place while in view mode, switch back to edit mode
      if (isLoadedTrip) {
        setIsLoadedTrip(false);
        console.log('User modified trip - switching back to edit mode');
      }
      
      // Get updated trip data using utility functions
      const updatedTripData = getCurrentTripData();
      if (updatedTripData) {
        setAddedTripPlaces(updatedTripData.places || []);
      }
      
      // Update route data after place is added - check multiple times with longer delay
      const checkForUpdatedRouteData = (attempts = 0) => {
        const maxAttempts = 10;
        const updatedRouteData = getCurrentRouteData();
        
        if (updatedRouteData) {
          // Only update if this is newer route data
          if (!routeData || new Date(updatedRouteData.timestamp) > new Date(routeData.timestamp)) {
            console.log('Updated route data found:', updatedRouteData);
            setRouteData(updatedRouteData);
            return;
          }
        }
        
        // Retry if we haven't found updated data yet
        if (attempts < maxAttempts) {
          setTimeout(() => checkForUpdatedRouteData(attempts + 1), 500);
        }
      };
      
      // Start checking for updated route data
      setTimeout(() => checkForUpdatedRouteData(), 500);
    };

    // Listen for initial route calculation
    const handleRouteCalculated = (event: CustomEvent) => {
      console.log('Route calculated:', event.detail.routeData);
      setRouteData(event.detail.routeData);
    };

    window.addEventListener('placesDataUpdated', handlePlacesDataUpdated as EventListener);
    window.addEventListener('categoryChanged', handleCategoryChanged as EventListener);
    window.addEventListener('placeAddedToTrip', handlePlaceAddedToTrip as EventListener);
    window.addEventListener('routeCalculated', handleRouteCalculated as EventListener);

    return () => {
      window.removeEventListener('placesDataUpdated', handlePlacesDataUpdated as EventListener);
      window.removeEventListener('categoryChanged', handleCategoryChanged as EventListener);
      window.removeEventListener('placeAddedToTrip', handlePlaceAddedToTrip as EventListener);
      window.removeEventListener('routeCalculated', handleRouteCalculated as EventListener);
    };
  }, []);

  // Save trip handler
  const handleSaveTrip = async (tripName: string, description?: string) => {
    setSaveStatus('saving');
    
    try {
      let success = false;
      
      if (currentSavedTripId) {
        // Update existing trip
        success = updateSavedTrip(currentSavedTripId, tripName, description);
        console.log('Updating existing trip with ID:', currentSavedTripId);
      } else {
        // Create new trip
        success = saveCurrentTrip(tripName, description);
        console.log('Creating new trip');
        
        // After creating a new trip, try to find its ID for future updates
        if (success) {
          const savedTrips = getSavedTrips();
          const newTrip = savedTrips.find(trip => trip.name === tripName);
          if (newTrip) {
            setCurrentSavedTripId(newTrip.id);
            console.log('Set current saved trip ID:', newTrip.id);
          }
        }
      }
      
      if (success) {
        setSaveStatus('success');
        setTimeout(() => {
          setShowSaveModal(false);
          setSaveStatus('idle');
          
          // Switch to view mode after saving
          setIsLoadedTrip(true);
          
          // Dispatch view mode change event to ensure map shows trip view
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('viewModeChanged', { 
              detail: 'trip' 
            }));
            console.log('Switched to view mode after saving trip');
          }, 100);
        }, 1500);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving trip:', error);
      setSaveStatus('error');
    }
  };

  // Share trip handler
  const handleShareTrip = () => {
    try {
      const url = generateShareableUrl();
      if (url) {
        setShareUrl(url);
        setShowShareModal(true);
      } else {
        console.error('Failed to generate shareable URL');
      }
    } catch (error) {
      console.error('Error generating share URL:', error);
    }
  };

  // Edit trip handler - switch back to planning mode
  const handleEditTrip = () => {
    setIsLoadedTrip(false);
    // Keep the currentSavedTripId so updates go to the same trip
    
    // Dispatch view mode change event to switch back to searches
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('viewModeChanged', { 
        detail: 'searches' 
      }));
      console.log('Switched back to edit mode for trip ID:', currentSavedTripId);
    }, 100);
  };

  // Copy URL to clipboard
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
      alert('Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert('Link copied to clipboard!');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700">Loading your trip...</p>
        </div>
      </div>
    );
  }

  if (!tripData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Trip Data Found</h3>
          <p className="text-gray-700 mb-4">Please go back and plan a trip first.</p>
          <Link 
            href="/"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Plan a Trip
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Road Trip Planner</span>
            </div>
            <Link 
              href="/"
              className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Trip Summary */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Trip Plan</h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Starting Point</h3>
              </div>
              <p className="text-lg text-gray-800">{tripData.from}</p>
            </div>

            <div className="bg-purple-50 rounded-xl p-6">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900">Destination</h3>
              </div>
              <p className="text-lg text-gray-800">{tripData.to}</p>
            </div>
          </div>

          {/* Route Map */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Route Map</h2>
            {apiKey ? (
              <GoogleMap 
                startingLocation={tripData.from}
                destination={tripData.to}
                apiKey={apiKey}
                places={isLoadedTrip ? [] : places}
                selectedCategory={isLoadedTrip ? 'trip' : selectedCategory}
              />
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">API Key Required</h3>
                <p className="text-gray-700 mb-4">
                  Please add your Google Maps API key to the <code className="bg-yellow-100 px-2 py-1 rounded">.env.local</code> file to display the interactive route map.
                </p>
                <div className="bg-gray-100 rounded-lg p-4 text-left">
                  <p className="text-sm text-gray-700 mb-2">Add this to your <code className="bg-gray-200 px-1 rounded">.env.local</code> file:</p>
                  <code className="text-xs bg-gray-200 px-2 py-1 rounded block">
                    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Route Places Search */}
          <div className="mb-6">
            <RoutePlacesSearch apiKey={apiKey} isLoadedTrip={isLoadedTrip} />
          </div>
        </div>

        {/* Your Trip Details */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Trip Details</h2>
          
          {/* Trip Overview Bar */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Time</p>
                  <p className="text-lg font-bold text-gray-900">
                    {routeData ? (() => {
                      const totalSeconds = parseInt(routeData.duration);
                      const hours = Math.round(totalSeconds / 3600);
                      const minutes = Math.round((totalSeconds % 3600) / 60);
                      console.log('Route data for display:', {
                        totalSeconds,
                        hours,
                        minutes,
                        routeData
                      });
                      return `${hours}h ${minutes}m`;
                    })() : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Distance</p>
                  <p className="text-lg font-bold text-gray-900">
                    {routeData ? `${(routeData.distanceMeters / 1000).toFixed(1)} km` : 'Calculating...'}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Stops</p>
                  <p className="text-lg font-bold text-gray-900">{addedTripPlaces.length}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Est. Fuel</p>
                  <p className="text-lg font-bold text-gray-900">
                    {routeData ? `$${Math.round((routeData.distanceMeters / 1000) * 0.12)}` : '$--'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Trip Itinerary Timeline */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Itinerary</h3>
            
            {/* Starting Point */}
            <div className="flex items-start space-x-4 p-4 bg-blue-50 rounded-xl border-l-4 border-blue-500">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Starting Point</h4>
                  <span className="text-sm text-gray-600">Departure</span>
                </div>
                <p className="text-gray-700 mt-1">{tripData?.from}</p>
              </div>
            </div>

            {/* Added Stops */}
            {addedTripPlaces.map((place, index) => (
              <div key={`${place.displayName.text}-${index}`} className="flex items-start space-x-4 p-4 bg-purple-50 rounded-xl border-l-4 border-purple-500">
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-white font-semibold text-sm">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-gray-900">{place.displayName.text}</h4>
                    <div className="flex items-center space-x-2">
                      {place.category && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {place.category.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </span>
                      )}
                      <span className="text-sm text-gray-600">Stop {index + 1}</span>
                    </div>
                  </div>
                  <p className="text-gray-700 mt-1">{place.formattedAddress}</p>
                  <p className="text-xs text-gray-500 mt-2">Added: {new Date(place.addedAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}

            {/* Destination */}
            <div className="flex items-start space-x-4 p-4 bg-green-50 rounded-xl border-l-4 border-green-500">
              <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900">Destination</h4>
                  <span className="text-sm text-gray-600">Arrival</span>
                </div>
                <p className="text-gray-700 mt-1">{tripData?.to}</p>
              </div>
            </div>

            {/* No stops message */}
            {addedTripPlaces.length === 0 && (
              <div className="text-center py-8 px-4 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No stops added yet</h3>
                <p className="text-gray-600 mb-4">Click on places along your route to add them to your trip itinerary.</p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          {isLoadedTrip ? (
            <button 
              onClick={handleEditTrip}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold py-3 px-8 rounded-lg hover:from-green-700 hover:to-emerald-700 focus:ring-4 focus:ring-green-300 focus:outline-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Edit Trip Plan
            </button>
          ) : (
            <button 
              onClick={() => setShowSaveModal(true)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-8 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 focus:outline-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Save Trip Plan
            </button>
          )}
          <button 
            onClick={handleShareTrip}
            className="bg-white text-gray-800 font-semibold py-3 px-8 rounded-lg border border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 focus:outline-none transition-all duration-200"
          >
            Share Trip
          </button>
        </div>
      </main>

      {/* Save Trip Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {currentSavedTripId ? 'Update Your Trip' : 'Save Your Trip'}
              </h3>
              <p className="text-gray-600">
                {currentSavedTripId ? 'Update your trip details' : 'Give your trip a name to save it for later'}
              </p>
            </div>
            
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target as HTMLFormElement);
              const tripName = formData.get('tripName') as string;
              const description = formData.get('description') as string;
              if (tripName.trim()) {
                handleSaveTrip(tripName.trim(), description.trim() || undefined);
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="tripName" className="block text-sm font-medium text-gray-700 mb-2">
                    Trip Name *
                  </label>
                  <input
                    type="text"
                    id="tripName"
                    name="tripName"
                    required
                    placeholder="e.g., Summer Road Trip 2024"
                    defaultValue={currentSavedTripId ? currentSavedTripName : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-black"
                    disabled={saveStatus === 'saving'}
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={2}
                    placeholder="Brief description of your trip..."
                    defaultValue={currentSavedTripId ? currentSavedTripDescription : ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none text-black"
                    disabled={saveStatus === 'saving'}
                  />
                </div>
              </div>
              
              <div className="flex space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSaveModal(false);
                    setSaveStatus('idle');
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  disabled={saveStatus === 'saving'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === 'saving'}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {saveStatus === 'saving' && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {saveStatus === 'saving' 
                    ? (currentSavedTripId ? 'Updating...' : 'Saving...') 
                    : saveStatus === 'success' 
                      ? (currentSavedTripId ? '✓ Updated!' : '✓ Saved!') 
                      : (currentSavedTripId ? 'Update Trip' : 'Save Trip')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Trip Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Share Your Trip</h3>
              <p className="text-gray-600">Anyone with this link can view your trip plan</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shareable Link
                </label>
                <div className="flex rounded-lg border border-gray-300">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 text-sm text-gray-600 rounded-l-lg outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-r-lg hover:bg-blue-700 transition-colors duration-200"
                  >
                    Copy
                  </button>
                </div>
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> This link contains your complete trip data. Share it with friends to let them view your route and stops.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 