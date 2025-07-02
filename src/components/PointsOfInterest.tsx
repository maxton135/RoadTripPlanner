'use client';

import { useEffect } from 'react';

interface PointsOfInterestProps {
  startingLocation: string;
  destination: string;
  apiKey: string;
}

export default function PointsOfInterest({ startingLocation, destination, apiKey }: PointsOfInterestProps) {
  useEffect(() => {
    const searchPlaces = async () => {
      try {
        const response = await fetch(`https://places.googleapis.com/v1/places:searchText?alt=json&fields=*&key=${apiKey}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            textQuery: 'points of interest in Santa Cruz California'
          })
        });

        if (!response.ok) {
          throw new Error(`Places search failed: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Response data:', data);
      } catch (err) {
        console.error('Error:', err);
      }
    };

    searchPlaces();
  }, [apiKey]);

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Points of Interest</h2>
      <p className="text-gray-700">Check console for API response</p>
    </div>
  );
} 