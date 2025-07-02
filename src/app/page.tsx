'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storeTripData, cleanupOldTripData, TripData } from '@/utils/tripSession';

interface AutocompleteSuggestion {
  placePrediction: {
    place: string;
    placeId: string;
    text: {
      text: string;
    };
    structuredFormat: {
      mainText: {
        text: string;
      };
      secondaryText: {
        text: string;
      };
    };
    types: string[];
  };
}

export default function Home() {
  const [startingLocation, setStartingLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [errors, setErrors] = useState<{ startingLocation?: string; destination?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [startingSuggestions, setStartingSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [destinationSuggestions, setDestinationSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showStartingSuggestions, setShowStartingSuggestions] = useState(false);
  const [showDestinationSuggestions, setShowDestinationSuggestions] = useState(false);
  const [startingPlaceId, setStartingPlaceId] = useState<string>('');
  const [destinationPlaceId, setDestinationPlaceId] = useState<string>('');
  const router = useRouter();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  const callAutocompleteAPI = async (input: string, isStartingLocation: boolean) => {
    if (!input.trim() || !apiKey) {
      if (isStartingLocation) {
        setStartingSuggestions([]);
        setShowStartingSuggestions(false);
      } else {
        setDestinationSuggestions([]);
        setShowDestinationSuggestions(false);
      }
      return;
    }

    try {
      const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete?fields=*&key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: input
        })
      });

      if (!response.ok) {
        throw new Error(`Autocomplete failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Autocomplete response:', data);

      if (data.suggestions) {
        if (isStartingLocation) {
          setStartingSuggestions(data.suggestions);
          setShowStartingSuggestions(true);
        } else {
          setDestinationSuggestions(data.suggestions);
          setShowDestinationSuggestions(true);
        }
      }
    } catch (err) {
      console.error('Autocomplete error:', err);
    }
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion, isStartingLocation: boolean) => {
    const text = suggestion.placePrediction.text.text;
    const placeId = suggestion.placePrediction.placeId;
    
    if (isStartingLocation) {
      setStartingLocation(text);
      setStartingPlaceId(placeId);
      setShowStartingSuggestions(false);
    } else {
      setDestination(text);
      setDestinationPlaceId(placeId);
      setShowDestinationSuggestions(false);
    }
  };

  const validateForm = () => {
    const newErrors: { startingLocation?: string; destination?: string } = {};
    
    if (!startingLocation.trim()) {
      newErrors.startingLocation = 'Starting location is required';
    }
    
    if (!destination.trim()) {
      newErrors.destination = 'Destination is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      console.log('Selected PlaceIds:');
      console.log('Starting Location PlaceId:', startingPlaceId);
      console.log('Destination PlaceId:', destinationPlaceId);
      console.log('Starting Location Text:', startingLocation);
      console.log('Destination Text:', destination);
      
      // Create trip data object
      const tripData: TripData = {
        from: startingLocation.trim(),
        to: destination.trim(),
        fromPlaceId: startingPlaceId,
        toPlaceId: destinationPlaceId
      };
      
      // Store trip data with trip ID and cleanup old data
      const success = storeTripData(tripData);
      if (success) {
        cleanupOldTripData();
        console.log('Trip data stored successfully with trip ID');
        
        // Navigate to planner page with clean URL
        router.push('/planner');
      } else {
        console.error('Failed to store trip data');
        setErrors({ startingLocation: 'Failed to save trip data. Please try again.' });
        setIsLoading(false);
      }
    }
  };

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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-2xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
              Plan Your Perfect
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Road Trip
              </span>
            </h1>
            <p className="text-xl text-gray-800 max-w-2xl mx-auto">
              Discover amazing routes, plan your stops, and create unforgettable memories on the open road.
            </p>
          </div>

          {/* Trip Planning Form */}
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                {/* Starting Location */}
                <div className="relative">
                  <label htmlFor="startingLocation" className="block text-sm font-medium text-gray-800 mb-2">
                    Starting Location
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="startingLocation"
                      value={startingLocation}
                      onChange={(e) => {
                        const value = e.target.value;
                        setStartingLocation(value);
                        callAutocompleteAPI(value, true);
                        if (errors.startingLocation) {
                          setErrors(prev => ({ ...prev, startingLocation: undefined }));
                        }
                      }}
                      onFocus={() => setShowStartingSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowStartingSuggestions(false), 200)}
                      placeholder="Enter your starting point..."
                      className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/50 backdrop-blur-sm text-gray-900 placeholder-gray-500 ${
                        errors.startingLocation ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.startingLocation && (
                    <p className="mt-1 text-sm text-red-600">{errors.startingLocation}</p>
                  )}
                  
                  {/* Starting Location Suggestions */}
                  {showStartingSuggestions && startingSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {startingSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion, true)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {suggestion.placePrediction.structuredFormat.mainText.text}
                          </div>
                          <div className="text-sm text-gray-500">
                            {suggestion.placePrediction.structuredFormat.secondaryText?.text || ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination */}
                <div className="relative">
                  <label htmlFor="destination" className="block text-sm font-medium text-gray-800 mb-2">
                    Destination
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="destination"
                      value={destination}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDestination(value);
                        callAutocompleteAPI(value, false);
                        if (errors.destination) {
                          setErrors(prev => ({ ...prev, destination: undefined }));
                        }
                      }}
                      onFocus={() => setShowDestinationSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowDestinationSuggestions(false), 200)}
                      placeholder="Where do you want to go?"
                      className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors duration-200 bg-white/50 backdrop-blur-sm text-gray-900 placeholder-gray-500 ${
                        errors.destination ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errors.destination && (
                    <p className="mt-1 text-sm text-red-600">{errors.destination}</p>
                  )}
                  
                  {/* Destination Suggestions */}
                  {showDestinationSuggestions && destinationSuggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {destinationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleSuggestionClick(suggestion, false)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
                        >
                          <div className="font-medium text-gray-900">
                            {suggestion.placePrediction.structuredFormat.mainText.text}
                          </div>
                          <div className="text-sm text-gray-500">
                            {suggestion.placePrediction.structuredFormat.secondaryText?.text || ''}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 focus:ring-4 focus:ring-blue-300 focus:outline-none transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Planning...' : 'Plan My Trip'}
              </button>
            </form>
          </div>

          {/* Features Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Smart Routes</h3>
              <p className="text-sm text-gray-800">Discover the most scenic and efficient routes to your destination.</p>
            </div>

            <div className="text-center p-6 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Must-See Stops</h3>
              <p className="text-sm text-gray-800">Find amazing attractions and hidden gems along your route.</p>
            </div>

            <div className="text-center p-6 bg-white/40 backdrop-blur-sm rounded-xl border border-white/20">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Time Estimates</h3>
              <p className="text-sm text-gray-800">Get accurate travel times and plan your journey perfectly.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
