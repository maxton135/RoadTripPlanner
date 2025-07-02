'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import GoogleMap from '@/components/GoogleMap';
import PointsOfInterest from '@/components/PointsOfInterest';
import RouteGenerator from '@/components/RouteGenerator';
import RoutePlacesSearch from '@/components/RoutePlacesSearch';

interface TripData {
  from: string;
  to: string;
  fromPlaceId: string;
  toPlaceId: string;
}

export default function PlannerPage() {
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [places, setPlaces] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('points_of_interest');
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  useEffect(() => {
    // Get trip data from session storage
    const storedTripData = sessionStorage.getItem('tripData');
    if (storedTripData) {
      try {
        const parsedData = JSON.parse(storedTripData);
        setTripData(parsedData);
      } catch (error) {
        console.error('Error parsing trip data:', error);
      }
    }
    setIsLoading(false);
  }, []);

  // Listen for places data from RoutePlacesSearch component
  useEffect(() => {
    const checkPlacesData = () => {
      const placesData = sessionStorage.getItem('placesData');
      if (placesData) {
        try {
          const parsedPlaces = JSON.parse(placesData);
          console.log('Retrieved places data from session storage:', parsedPlaces);
          setPlaces(parsedPlaces);
        } catch (error) {
          console.error('Error parsing places data:', error);
        }
      } else {
        console.log('No places data found in session storage');
      }
    };

    // Check once when component mounts
    checkPlacesData();

    // Listen for places data updates
    const handlePlacesDataUpdated = (event: CustomEvent) => {
      console.log('Received places data update event:', event.detail);
      setPlaces(event.detail);
    };

    // Listen for category selection updates
    const handleCategoryChanged = (event: CustomEvent) => {
      console.log('Received category change event:', event.detail);
      setSelectedCategory(event.detail);
    };

    window.addEventListener('placesDataUpdated', handlePlacesDataUpdated as EventListener);
    window.addEventListener('categoryChanged', handleCategoryChanged as EventListener);

    return () => {
      window.removeEventListener('placesDataUpdated', handlePlacesDataUpdated as EventListener);
      window.removeEventListener('categoryChanged', handleCategoryChanged as EventListener);
    };
  }, []);

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
              {tripData.fromPlaceId && (
                <p className="text-sm text-gray-600 mt-1">PlaceId: {tripData.fromPlaceId}</p>
              )}
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
              {tripData.toPlaceId && (
                <p className="text-sm text-gray-600 mt-1">PlaceId: {tripData.toPlaceId}</p>
              )}
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
                places={places}
                selectedCategory={selectedCategory}
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
            <RoutePlacesSearch apiKey={apiKey} />
          </div>
        </div>

        {/* Trip Details Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Estimated Time & Distance */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Trip Details</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-800">Estimated Time</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">Calculating...</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <span className="font-medium text-gray-800">Distance</span>
                </div>
                <span className="text-lg font-semibold text-gray-900">Calculating...</span>
              </div>
            </div>
          </div>

          {/* Weather & Conditions */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Weather & Conditions</h2>
            <div className="space-y-3">
              <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                <h3 className="font-medium text-gray-900 mb-1">Current Weather</h3>
                <p className="text-sm text-gray-800">Check weather conditions for your route</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-400">
                <h3 className="font-medium text-gray-900 mb-1">Traffic Conditions</h3>
                <p className="text-sm text-gray-800">Real-time traffic updates</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-lg border-l-4 border-orange-400">
                <h3 className="font-medium text-gray-900 mb-1">Road Conditions</h3>
                <p className="text-sm text-gray-800">Construction and road work alerts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-8 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 focus:outline-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98]">
            Save Trip Plan
          </button>
          <button className="bg-white text-gray-800 font-semibold py-3 px-8 rounded-lg border border-gray-300 hover:bg-gray-50 focus:ring-4 focus:ring-gray-300 focus:outline-none transition-all duration-200">
            Share Trip
          </button>
        </div>
      </main>
    </div>
  );
} 