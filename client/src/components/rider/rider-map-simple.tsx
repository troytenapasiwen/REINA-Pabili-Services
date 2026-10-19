import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadScript, GoogleMap, Marker } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// Only load the basic map functionality
const libraries: ["places"] = ['places'];

// Define props for RiderMap component
interface RiderMapProps {
  // Source location (usually restaurant)
  source?: {
    latitude: number;
    longitude: number;
    name: string;
  };
  // Destination location (usually customer address)
  destination?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  // Current rider location
  currentLocation?: {
    latitude: number;
    longitude: number;
  } | null;
}

export function RiderMapSimple({ source, destination, currentLocation }: RiderMapProps) {
  // Fetch Google Maps API key
  const { data: mapsData } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Show embedded map with locations marked
  const showEmbeddedMap = useCallback(() => {
    // This function is for embedded map display within the component
    console.log('Displaying embedded map with current locations');
  }, [currentLocation, source, destination]);

  // Default center (Manila)
  const defaultCenter = { lat: 14.5995, lng: 120.9842 };

  // Get map center based on available locations
  const getMapCenter = () => {
    if (currentLocation) return { lat: currentLocation.latitude, lng: currentLocation.longitude };
    if (source) return { lat: source.latitude, lng: source.longitude };
    if (destination) return { lat: destination.latitude, lng: destination.longitude };
    return defaultCenter;
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-4">
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Navigation</h3>
          <Badge variant="outline">Map</Badge>
        </div>
      </div>

      <div className="p-3">
        {/* Location info panel */}
        <div className="flex flex-col space-y-2 mb-3">
          {currentLocation && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Your Location: {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </span>
            </div>
          )}

          {source && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-red-500" />
              <span className="font-medium truncate">
                Restaurant: {source.name}
              </span>
            </div>
          )}

          {destination && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium truncate">
                Customer: {destination.address}
              </span>
            </div>
          )}
        </div>

        {/* Map section */}
        <div className="w-full mb-3 border rounded-md overflow-hidden" style={{ height: '350px' }}>
          {googleMapsApiKey ? (
            <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={getMapCenter()}
                zoom={14}
              >
                {currentLocation && (
                  <Marker
                    position={{
                      lat: currentLocation.latitude,
                      lng: currentLocation.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    }}
                  />
                )}

                {source && (
                  <Marker
                    position={{
                      lat: source.latitude,
                      lng: source.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                    }}
                  />
                )}

                {destination && destination.latitude && destination.longitude && (
                  <Marker
                    position={{
                      lat: destination.latitude,
                      lng: destination.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    }}
                  />
                )}
              </GoogleMap>
            </LoadScript>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p>Loading map...</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={showEmbeddedMap}
            disabled={!currentLocation || (!source && !destination)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Show Embedded Map
          </Button>
        </div>
      </div>
    </div>
  );
}
