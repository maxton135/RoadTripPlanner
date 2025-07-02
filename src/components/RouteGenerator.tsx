'use client';

import { useEffect } from 'react';

interface RouteGeneratorProps {
  startingLocation: string;
  destination: string;
  fromPlaceId: string;
  toPlaceId: string;
  apiKey: string;
}

export default function RouteGenerator({ startingLocation, destination, fromPlaceId, toPlaceId, apiKey }: RouteGeneratorProps) {
  useEffect(() => {
    const generateRoute = async () => {
      if (!startingLocation || !destination || !apiKey || !fromPlaceId || !toPlaceId) {
        console.log('Missing required data for route generation');
        return;
      }

      const requestBody = {
        origin: {
          placeId: fromPlaceId
        },
        destination: {
          placeId: toPlaceId
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false,
          avoidFerries: false
        },
        languageCode: 'en-US',
        units: 'METRIC'
      };

      try {
        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          throw new Error(`Routes API request failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Route result:', data);
        
        // Store route data in session storage
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const routeData = {
            distanceMeters: route.distanceMeters,
            duration: route.duration,
            polyline: route.polyline,
            timestamp: new Date().toISOString()
          };
          
          sessionStorage.setItem('routeData', JSON.stringify(routeData));
          console.log('Route data stored in session storage:', routeData);
        }
      } catch (err) {
        console.error('Error fetching route:', err);
      }
    };

    generateRoute();
  }, [startingLocation, destination, fromPlaceId, toPlaceId, apiKey]);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Route Generator</h2>
      <p className="text-gray-700">Check console for route data</p>
      <div className="mt-4 text-sm text-gray-600">
        <p><strong>From:</strong> {startingLocation}</p>
        <p><strong>To:</strong> {destination}</p>
      </div>
    </div>
  );
} 