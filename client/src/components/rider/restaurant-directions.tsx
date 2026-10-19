import React, { useState, useCallback } from 'react';
import { useJsApiLoader, GoogleMap, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, MapPin, Navigation } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Define the Google Maps libraries to load
const libraries = ['places'] as any;

interface RestaurantDirectionsProps {
  restaurantLocation: {
    latitude: number;
    longitude: number;
  };
  restaurantName: string;
  userLocation?: {
    latitude: number;
    longitude: number;
  } | null;
}

export function RestaurantDirections({
  restaurantLocation,
  restaurantName,
  userLocation
}: RestaurantDirectionsProps) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);

  // Load Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || window.GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  // Get directions from user location to restaurant
  const getDirections = useCallback(() => {
    if (!isLoaded || !userLocation) return;

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: userLocation.latitude, lng: userLocation.longitude },
        destination: { lat: restaurantLocation.latitude, lng: restaurantLocation.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          setDirections(result);
          setError(null);
          setMapExpanded(true);
        } else {
          setError(`Couldn't get directions: ${status}`);
          setDirections(null);
        }
      }
    );
  }, [isLoaded, userLocation, restaurantLocation]);

  // Toggle map expanded view
  const toggleMapView = () => {
    setMapExpanded(!mapExpanded);
    if (!directions && userLocation) {
      getDirections();
    }
  };

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading maps</AlertTitle>
        <AlertDescription>
          Could not load Google Maps. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <div className="animate-pulse flex flex-col items-center justify-center py-6">
            <div className="h-12 w-12 rounded-full bg-slate-200 mb-4"></div>
            <div className="h-4 w-32 bg-slate-200 mb-2 rounded"></div>
            <div className="h-3 w-24 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={mapExpanded ? 'max-h-[500px] overflow-hidden' : 'max-h-[150px] overflow-hidden'}>
      <CardContent className="p-3">
        {!directions ? (
          <div className="flex flex-col items-center">
            <div className="flex justify-between w-full">
              <Button
                variant="outline"
                size="sm"
                onClick={getDirections}
                disabled={!userLocation}
                className="mb-2 w-1/2"
              >
                <Navigation className="h-4 w-4 mr-2" />
                Get Directions
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={toggleMapView}
                className="mb-2 w-1/2 ml-2"
              >
                <MapPin className="h-4 w-4 mr-2" />
                {mapExpanded ? 'Collapse Map' : 'Expand Map'}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!userLocation && (
              <Alert className="mt-2 bg-amber-50 text-amber-600 border-amber-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Location tracking must be enabled to get directions</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="h-full relative">
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMapExpanded(!mapExpanded)}
                className="bg-white"
              >
                {mapExpanded ? 'Collapse' : 'Expand'}
              </Button>
            </div>

            <GoogleMap
              mapContainerStyle={{
                width: '100%',
                height: mapExpanded ? '450px' : '100px',
              }}
              center={{
                lat: restaurantLocation.latitude,
                lng: restaurantLocation.longitude,
              }}
              zoom={14}
              options={{
                zoomControl: mapExpanded,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {userLocation && (
                <Marker
                  position={{
                    lat: userLocation.latitude,
                    lng: userLocation.longitude,
                  }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                  }}
                />
              )}

              <Marker
                position={{
                  lat: restaurantLocation.latitude,
                  lng: restaurantLocation.longitude,
                }}
              />

              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  options={{
                    suppressMarkers: true,
                    polylineOptions: {
                      strokeColor: '#F06445',
                      strokeWeight: 5,
                    },
                  }}
                />
              )}
            </GoogleMap>

            {directions?.routes[0]?.legs[0] && (
              <div className="p-2 bg-white border-t text-sm">
                <div className="font-semibold">
                  {directions.routes[0].legs[0].distance?.text} - {directions.routes[0].legs[0].duration?.text}
                </div>
                <div className="text-xs text-muted-foreground">
                  {restaurantName} - {directions.routes[0].legs[0].end_address}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
