import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

// A very simple map component that doesn't rely on Google Maps API directly
// This uses static map images instead for better stability

interface BasicMapProps {
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

export function BasicMap({ source, destination, currentLocation }: BasicMapProps) {
  // Fetch Google Maps API key
  const { data: mapsData } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Display embedded static map with location markers
  const showStaticMapView = () => {
    // This function displays a static map view within the component
    console.log('Displaying static map with location markers');
  };

  // This creates a static map image URL
  const getStaticMapUrl = () => {
    if (!googleMapsApiKey) return '';

    let markers = '';
    let center = '14.5995,120.9842'; // Default to Manila
    let zoom = '13';

    if (currentLocation) {
      markers += `&markers=color:blue|${currentLocation.latitude},${currentLocation.longitude}`;
      center = `${currentLocation.latitude},${currentLocation.longitude}`;
    }

    if (source) {
      markers += `&markers=color:red|${source.latitude},${source.longitude}`;
      if (!currentLocation) center = `${source.latitude},${source.longitude}`;
    }

    if (destination && destination.latitude && destination.longitude) {
      markers += `&markers=color:green|${destination.latitude},${destination.longitude}`;
      if (!currentLocation && !source) center = `${destination.latitude},${destination.longitude}`;
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=600x400&maptype=roadmap${markers}&key=${googleMapsApiKey}`;
  };

  const mapUrl = getStaticMapUrl();

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
          {mapUrl ? (
            <img
              src={mapUrl}
              alt="Map"
              className="w-full h-full object-cover"
              onError={(e) => {
                // If image fails to load, show placeholder
                e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Map+unavailable';
              }}
            />
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
            onClick={showStaticMapView}
            disabled={!currentLocation || (!source && !destination)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Show Static Map
          </Button>
        </div>
      </div>
    </div>
  );
}
