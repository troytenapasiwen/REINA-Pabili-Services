import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadScript, GoogleMap, Marker, DirectionsService, DirectionsRenderer, Libraries } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, Navigation, LocateFixed, Route as RouteIcon, Crosshair, Map as MapIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the Google Maps libraries to load
const libraries: Libraries = ['places', 'geometry'];

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

export function RiderMap({ source, destination, currentLocation }: RiderMapProps) {
  const { toast } = useToast();

  // Map references and state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapStable, setMapStable] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [autoCalculated, setAutoCalculated] = useState(false);

  // Display states
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  // Fetch Google Maps API key
  const { data: mapsData } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Ref to maintain component mounted state
  const mountedRef = useRef(true);

  // Get origin and destination for directions
  const getRoutePoints = useCallback(() => {
    if (!currentLocation) return null;

    let origin = { lat: currentLocation.latitude, lng: currentLocation.longitude };
    let dest = null;

    // If we have both source and destination, set destination as the customer
    // and add source (restaurant) as a waypoint
    if (destination && destination.latitude && destination.longitude) {
      dest = { lat: destination.latitude, lng: destination.longitude };
    } else if (source) {
      // If we only have source, set it as the destination
      dest = { lat: source.latitude, lng: source.longitude };
    } else {
      // No valid destination
      return null;
    }

    return { origin, destination: dest };
  }, [currentLocation, source, destination]);

  // Prepare waypoints if needed
  const getWaypoints = useCallback(() => {
    const waypoints: google.maps.DirectionsWaypoint[] = [];

    // If both source and destination are available, use source as waypoint
    if (source && destination) {
      waypoints.push({
        location: { lat: source.latitude, lng: source.longitude },
        stopover: true
      });
    }

    return waypoints;
  }, [source, destination]);

  // Handle direction results
  const directionsCallback = useCallback((
    result: google.maps.DirectionsResult | null,
    status: google.maps.DirectionsStatus
  ) => {
    console.log("Direction service callback:", status);

    setIsCalculating(false);

    if (status === 'OK' && result) {
      console.log("Directions found:", result);
      setDirections(result);

      // Extract and display route information
      if (result.routes[0] && result.routes[0].legs) {
        const legs = result.routes[0].legs;

        // Calculate total distance and duration if there are multiple legs
        if (legs.length > 0) {
          let totalDistance = '';
          let totalDuration = '';

          if (legs.length === 1) {
            // Just one leg
            totalDistance = legs[0].distance?.text || 'Unknown';
            totalDuration = legs[0].duration?.text || 'Unknown';
          } else {
            // Multiple legs, sum them up
            let distanceMeters = 0;
            let durationSeconds = 0;

            legs.forEach(leg => {
              if (leg.distance && leg.distance.value) {
                distanceMeters += leg.distance.value;
              }
              if (leg.duration && leg.duration.value) {
                durationSeconds += leg.duration.value;
              }
            });

            // Format distance in km
            totalDistance = `${(distanceMeters / 1000).toFixed(1)} km`;

            // Format duration
            const hours = Math.floor(durationSeconds / 3600);
            const minutes = Math.floor((durationSeconds % 3600) / 60);

            if (hours > 0) {
              totalDuration = `${hours} hr ${minutes} min`;
            } else {
              totalDuration = `${minutes} min`;
            }
          }

          setDistance(totalDistance);
          setDuration(totalDuration);

          toast({
            title: "Route Found",
            description: `${totalDistance} - ${totalDuration}`,
          });
        }
      }
    } else if (status === 'REQUEST_DENIED') {
      // Special handling for API key issues
      console.error("Direction service failed:", status);
      setDirections(null);

      // If we have locations, calculate a straight-line distance as fallback
      if (currentLocation && source) {
        // Estimate distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const lat1 = currentLocation.latitude * Math.PI/180;
        const lat2 = source.latitude * Math.PI/180;
        const dLat = (source.latitude - currentLocation.latitude) * Math.PI/180;
        const dLon = (source.longitude - currentLocation.longitude) * Math.PI/180;

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Estimate time (assuming average speed of 30 km/h in city traffic)
        const timeHours = distance / 30;
        const timeMinutes = Math.round(timeHours * 60);

        setDistance(`~${distance.toFixed(1)} km (straight line)`);
        setDuration(`~${timeMinutes} min (estimated)`);

        // Make sure the error message reflects the API issue but shows we have a fallback
        setError("Google Maps API key restrictions prevent route calculation. Using straight-line distance instead.");
      } else {
        setDistance('');
        setDuration('');
        setError("Cannot calculate route: Google Maps API key restrictions.");
      }
    } else {
      console.error("Direction service failed:", status);
      setDirections(null);
      setDistance('');
      setDuration('');
      setError(`Could not calculate route: ${status}`);
      toast({
        variant: "destructive",
        title: "Route Error",
        description: `Could not calculate route: ${status}`
      });
    }
  }, [toast, currentLocation, source]);

  // Direction calculation function
  const calculateRoute = useCallback(() => {
    if (!currentLocation) {
      setError('Your current location is not available');
      return;
    }

    // We're good to calculate
    setIsCalculating(true);
    setError(null);

    console.log("Calculating route with:");
    console.log(" - Current location:", currentLocation);
    console.log(" - Source:", source);
    console.log(" - Destination:", destination);
  }, [currentLocation, source, destination]);

  // Toggle map expanded view and auto-calculate directions
  const toggleMapAndDirections = useCallback(() => {
    if (!directions && (source || destination)) {
      setIsCalculating(true);
      // Auto-calculate directions when toggling map
      setTimeout(() => {
        setIsCalculating(false);
        setAutoCalculated(true);
      }, 100);
    }
  }, [directions, source, destination]);

  // Effect to track component mounting and unmounting
  useEffect(() => {
    // Mark component as mounted
    setMapMounted(true);

    // Set up cleanup function for when component unmounts
    return () => {
      mountedRef.current = false;
      setMapMounted(false);
    };
  }, []);

  // Effect to set up map when the API key is available
  useEffect(() => {
    if (googleMapsApiKey && mapMounted) {
      // Wait briefly to ensure DOM is ready
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setMapStable(true);
        }
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [googleMapsApiKey, mapMounted]);

  // Effect to handle route calculation only after everything is stable
  useEffect(() => {
    // Only attempt route calculation when we have all the necessary data
    if (
      mapStable &&
      mapLoaded &&
      currentLocation &&
      (source || destination) &&
      !autoCalculated &&
      !isCalculating &&
      mountedRef.current
    ) {
      console.log("Auto-calculating route...");

      // Add a longer delay to ensure the map is fully initialized
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setAutoCalculated(true);
          setIsCalculating(true);
        }
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [mapStable, mapLoaded, currentLocation, source, destination, autoCalculated, isCalculating]);

  // Prepare points for directions
  const points = getRoutePoints();
  const waypoints = getWaypoints();

  // Render component
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-4">
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Navigation</h3>
          <Badge variant={directions ? "default" : "outline"}>
            {directions ? "Route Found" : "Navigation"}
          </Badge>
        </div>
      </div>

      <div className="p-3">
        {/* Location info panel */}
        <div className="flex flex-col space-y-2 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <Crosshair className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">
              {currentLocation
                ? `Your Location: ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                : 'Current location not available'}
            </span>
          </div>

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
              <LocateFixed className="h-4 w-4 text-green-500" />
              <span className="font-medium truncate">
                Customer: {destination.address}
              </span>
            </div>
          )}

          {distance && duration && (
            <div className="flex items-center gap-2 text-sm">
              <Navigation className="h-4 w-4 text-primary" />
              <span className="font-medium">
                {distance} - {duration}
              </span>
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <Alert variant="destructive" className="mb-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Map section (fixed container height to prevent layout shifts) */}
        <div className="w-full mb-3 border rounded-md overflow-hidden" style={{ height: '350px', position: 'relative', minHeight: '300px' }}>
          {!googleMapsApiKey ? (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <div className="text-center p-4">
                <MapIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p>Google Maps API key not available</p>
              </div>
            </div>
          ) : (
            <LoadScript
              googleMapsApiKey={googleMapsApiKey}
              libraries={libraries}
              onLoad={() => {
                console.log("Google Maps script loaded successfully");
                if (mountedRef.current) {
                  setMapLoaded(true);
                }
              }}
              onError={(error) => {
                console.error("Error loading Google Maps script:", error);
                setError("Failed to load Google Maps. Please try again later.");
              }}
              loadingElement={
                <div className="flex items-center justify-center h-full bg-gray-100">
                  <div className="text-center p-4">
                    <MapIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
                    <p>Loading map...</p>
                  </div>
                </div>
              }
            >
              <GoogleMap
                mapContainerStyle={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                }}
                center={
                  currentLocation
                    ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
                    : source
                      ? { lat: source.latitude, lng: source.longitude }
                      : destination && destination.latitude
                        ? { lat: destination.latitude, lng: destination.longitude }
                        : { lat: 14.5995, lng: 120.9842 } // Manila fallback
                }
                zoom={13}
                options={{
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                  fullscreenControl: false,
                  gestureHandling: 'greedy', // Allows map to be more easily manipulated on mobile
                }}
              >
                {/* Current location marker */}
                {currentLocation && (
                  <Marker
                    position={{
                      lat: currentLocation.latitude,
                      lng: currentLocation.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                      scaledSize: new google.maps.Size(40, 40),
                    }}
                    title="Your Location"
                  />
                )}

                {/* Source marker (restaurant) */}
                {source && (
                  <Marker
                    position={{
                      lat: source.latitude,
                      lng: source.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                      scaledSize: new google.maps.Size(40, 40),
                    }}
                    title={source.name || "Restaurant"}
                  />
                )}

                {/* Destination marker (customer) */}
                {destination && destination.latitude && destination.longitude && (
                  <Marker
                    position={{
                      lat: destination.latitude,
                      lng: destination.longitude,
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                      scaledSize: new google.maps.Size(40, 40),
                    }}
                    title={destination.address || "Customer"}
                  />
                )}

                {/* DirectionsRenderer for the calculated route */}
                {directions && (
                  <DirectionsRenderer
                    options={{
                      directions: directions,
                      suppressMarkers: true,
                      polylineOptions: {
                        strokeColor: '#F06445',
                        strokeWeight: 5,
                      },
                    }}
                  />
                )}
              </GoogleMap>

              {/* Only render DirectionsService when we're calculating */}
              {isCalculating && points && (
                <DirectionsService
                  options={{
                    origin: points.origin,
                    destination: points.destination,
                    waypoints: waypoints,
                    optimizeWaypoints: true,
                    travelMode: google.maps.TravelMode.DRIVING,
                  }}
                  callback={directionsCallback}
                />
              )}
            </LoadScript>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => calculateRoute()}
            disabled={isCalculating || !currentLocation}
          >
            <RouteIcon className="h-4 w-4 mr-2" />
            Calculate Route
          </Button>

          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={toggleMapAndDirections}
            disabled={!currentLocation || (!source && !destination)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Show Directions
          </Button>
        </div>
      </div>
    </div>
  );
}
