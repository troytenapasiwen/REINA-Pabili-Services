import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
  Marker,
  InfoWindow,
  DirectionsService,
  Polyline
} from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  Navigation,
  Maximize2,
  Minimize2,
  AlertCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%'
};

// Libraries to load
const libraries: ["places"] = ['places'];

export function RiderMapFixed({ source, destination, currentLocation }: RiderMapProps) {
  // State variables
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 }); // Default to Manila
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<'source' | 'destination' | 'rider' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [pathCoordinates, setPathCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; duration: number } | null>(null);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Update map center based on available locations
  useEffect(() => {
    if (currentLocation) {
      setMapCenter({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude
      });
    } else if (source) {
      setMapCenter({
        lat: source.latitude,
        lng: source.longitude
      });
    } else if (destination) {
      setMapCenter({
        lat: destination.latitude,
        lng: destination.longitude
      });
    }
  }, [currentLocation, source, destination]);

  // Calculate route when source, destination, or current location changes
  const calculateRoute = useCallback(() => {
    if (!window.google || !isMapLoaded) return;

    // Check if we have enough data to calculate a route
    if (!source || !destination) {
      setError('Missing source or destination for route calculation');
      setDirections(null);
      return;
    }

    try {
      // Just show the markers without trying to use the Directions API
      // This is a fallback since the API key doesn't have Directions API enabled
      setDirections(null);
      setError(null);

      // Calculate distance using Haversine formula
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c; // Distance in km
        return distance;
      };

      // Calculate distance between source and destination
      const distance = calculateDistance(
        source.latitude,
        source.longitude,
        destination.latitude,
        destination.longitude
      );

      // Estimate travel time (assuming average speed of 30 km/h)
      const timeInHours = distance / 30;
      const timeInMinutes = Math.round(timeInHours * 60);

      // Update the map center to show all points
      const centerLat = (source.latitude + destination.latitude) / 2;
      const centerLng = (source.longitude + destination.longitude) / 2;
      setMapCenter({ lat: centerLat, lng: centerLng });

      // Create path coordinates for the polyline
      const path = [];

      // Add source point
      path.push({ lat: source.latitude, lng: source.longitude });

      // Add rider location as waypoint if available
      if (currentLocation) {
        path.push({ lat: currentLocation.latitude, lng: currentLocation.longitude });
      }

      // Add destination point
      path.push({ lat: destination.latitude, lng: destination.longitude });

      // Set the path for polyline
      setPathCoordinates(path);

      // Set distance information
      setDistanceInfo({
        distance: distance,
        duration: timeInMinutes
      });

      // Log distance information for debugging
      console.log(`Distance: ${distance.toFixed(2)} km, Estimated time: ${timeInMinutes} minutes`);
    } catch (err) {
      console.error('Error calculating route:', err);
      setError('Error calculating route. Please try again.');
      setDirections(null);
    }
  }, [currentLocation, source, destination, isMapLoaded]);

  // Recalculate route when dependencies change
  useEffect(() => {
    if (isMapLoaded && window.google) {
      // Small delay to ensure map is fully initialized
      const timer = setTimeout(() => {
        calculateRoute();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [calculateRoute, isMapLoaded]);

  // Handle map load event
  const handleMapLoad = () => {
    setIsMapLoaded(true);
    console.log('Google Maps loaded successfully');
  };

  // Open in Google Maps app
  const openInGoogleMaps = () => {
    let url = "https://www.google.com/maps/dir/?api=1";

    if (currentLocation) {
      url += `&origin=${currentLocation.latitude},${currentLocation.longitude}`;
    } else if (source) {
      url += `&origin=${source.latitude},${source.longitude}`;
      url += `&origin_name=${encodeURIComponent(source.name || 'Restaurant')}`;
    }

    if (destination) {
      url += `&destination=${destination.latitude},${destination.longitude}`;
      url += `&destination_name=${encodeURIComponent(destination.address || 'Delivery location')}`;
    }

    url += `&travelmode=driving`;
    window.open(url, '_blank');
  };

  // Loading screen for API key
  if (isLoadingMapsKey) {
    return (
      <div className="flex items-center justify-center h-[350px] bg-muted/20 rounded-md">
        <div className="flex flex-col items-center">
          <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full"></div>
          <p className="text-muted-foreground mt-2">Loading map...</p>
        </div>
      </div>
    );
  }

  // Error screen for missing API key
  if (!googleMapsApiKey) {
    return (
      <Alert className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Google Maps API key not configured. Map functionality is limited.
        </AlertDescription>
      </Alert>
    );
  }

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
        <div className="relative w-full mb-3 border rounded-md overflow-hidden"
             style={{ height: isMapExpanded ? '500px' : '350px' }}>
          {/* Map expand/collapse button */}
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMapExpanded(!isMapExpanded)}
              className="bg-white shadow-md h-8 w-8 p-0"
            >
              {isMapExpanded ?
                <Minimize2 className="h-4 w-4" /> :
                <Maximize2 className="h-4 w-4" />
              }
            </Button>
          </div>

          <LoadScript
            googleMapsApiKey={googleMapsApiKey}
            libraries={libraries}
            onLoad={handleMapLoad}
          >
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter}
              zoom={14}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {/* Source Marker (Restaurant) */}
              {isMapLoaded && source && (
                <Marker
                  position={{
                    lat: source.latitude,
                    lng: source.longitude
                  }}
                  icon={{
                    url: "https://maps.google.com/mapfiles/ms/icons/restaurant.png",
                    scaledSize: window.google?.maps?.Size ?
                      new window.google.maps.Size(32, 32) : undefined
                  }}
                  title={source.name}
                  onClick={() => setSelectedMarker('source')}
                />
              )}

              {/* Destination Marker (Customer) */}
              {isMapLoaded && destination && (
                <Marker
                  position={{
                    lat: destination.latitude,
                    lng: destination.longitude
                  }}
                  icon={{
                    url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                    scaledSize: window.google?.maps?.Size ?
                      new window.google.maps.Size(32, 32) : undefined
                  }}
                  title="Delivery Location"
                  onClick={() => setSelectedMarker('destination')}
                />
              )}

              {/* Current Location Marker (Rider) */}
              {isMapLoaded && currentLocation && (
                <Marker
                  position={{
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude
                  }}
                  icon={{
                    url: "https://maps.google.com/mapfiles/ms/icons/motorcycling.png",
                    scaledSize: window.google?.maps?.Size ?
                      new window.google.maps.Size(32, 32) : undefined
                  }}
                  title="Your Location"
                  onClick={() => setSelectedMarker('rider')}
                />
              )}

              {/* Info Windows */}
              {selectedMarker === 'source' && source && (
                <InfoWindow
                  position={{
                    lat: source.latitude,
                    lng: source.longitude
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-1">
                    <p className="font-semibold text-sm">{source.name}</p>
                    <p className="text-xs text-gray-600">Restaurant</p>
                  </div>
                </InfoWindow>
              )}

              {selectedMarker === 'destination' && destination && (
                <InfoWindow
                  position={{
                    lat: destination.latitude,
                    lng: destination.longitude
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-1">
                    <p className="font-semibold text-sm">Delivery Location</p>
                    <p className="text-xs text-gray-600">{destination.address}</p>
                  </div>
                </InfoWindow>
              )}

              {selectedMarker === 'rider' && currentLocation && (
                <InfoWindow
                  position={{
                    lat: currentLocation.latitude,
                    lng: currentLocation.longitude
                  }}
                  onCloseClick={() => setSelectedMarker(null)}
                >
                  <div className="p-1">
                    <p className="font-semibold text-sm">Your Location</p>
                    <p className="text-xs text-gray-600">
                      {currentLocation.latitude.toFixed(5)},
                      {currentLocation.longitude.toFixed(5)}
                    </p>
                  </div>
                </InfoWindow>
              )}

              {/* Display route if available */}
              {isMapLoaded && directions && (
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

              {/* We're now using the Google Directions API directly */}
            </GoogleMap>
          </LoadScript>

          {/* Show error if route calculation fails */}
          {error && (
            <div className="absolute bottom-0 left-0 right-0 bg-red-50 p-2 text-sm text-red-600 border-t border-red-200">
              <AlertCircle className="h-4 w-4 inline mr-1" />
              {error}
            </div>
          )}

          {/* Show route details if we have directions */}
          {directions?.routes?.[0]?.legs?.[0] && (
            <div className="absolute bottom-0 left-0 right-0 bg-white p-2 border-t">
              <div className="font-semibold text-sm flex items-center">
                <Navigation className="h-4 w-4 mr-2 text-primary" />
                <>{directions.routes[0].legs[0].distance?.text} - {directions.routes[0].legs[0].duration?.text}</>
              </div>
              <div className="text-xs text-muted-foreground">
                {source?.name || 'Restaurant'} → {destination?.address || 'Delivery Address'}
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={calculateRoute}
            disabled={!source || !destination || !isMapLoaded}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Update Route
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={openInGoogleMaps}
            disabled={!source && !destination}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Open in Google Maps
          </Button>
        </div>
      </div>
    </div>
  );
}
