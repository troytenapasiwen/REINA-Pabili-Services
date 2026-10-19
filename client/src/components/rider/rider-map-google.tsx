import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GoogleMap,
  LoadScript,
  DirectionsRenderer,
  Marker,
  InfoWindow,
  DirectionsService
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
import { useToast } from '@/hooks/use-toast';

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
  // Order status to determine route target
  orderStatus?: string;
}

// Map container style
const containerStyle = {
  width: '100%',
  height: '100%'
};

// Libraries to load
const libraries: ["places"] = ['places'];

export function RiderMapGoogle({ source, destination, currentLocation, orderStatus }: RiderMapProps) {
  // State variables
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: 14.5995, lng: 120.9842 }); // Default to Manila
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<'source' | 'destination' | 'rider' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [shouldFetchDirections, setShouldFetchDirections] = useState(false);

  const { toast } = useToast();

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

  // Process directions response
  const directionsCallback = useCallback(
    (result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
      setIsCalculating(false);

      if (status === 'OK' && result) {
        setDirections(result);
        setError(null);
        setShouldFetchDirections(false);

        // Log the distance and duration
        if (result.routes?.[0]?.legs?.[0]) {
          const leg = result.routes[0].legs[0];
          console.log(`Route found: ${leg.distance?.text}, ${leg.duration?.text}`);
        }
      } else {
        if (status === 'ZERO_RESULTS') {
          setError('No route found between these locations.');
        } else {
          setError(`Directions request failed: ${status}`);
        }
        setShouldFetchDirections(false);
      }
    },
    []
  );

  // Helper function to get route information
  const createDirectionsRequest = (
    riderLocation: { latitude: number; longitude: number } | null | undefined,
    sourceLocation: { latitude: number; longitude: number; name: string } | undefined,
    destLocation: { latitude: number; longitude: number; address: string } | undefined,
    status: string | undefined
  ) => {
    let origin: google.maps.LatLngLiteral | undefined;
    let destPoint: google.maps.LatLngLiteral | undefined;

    // For active deliveries, always use the rider's current location as origin if available
    if (riderLocation) {
      if (!isNaN(riderLocation.latitude) && !isNaN(riderLocation.longitude)) {
        origin = {
          lat: riderLocation.latitude,
          lng: riderLocation.longitude
        };
      }
    }

    // For ready_for_pickup orders, route to restaurant (from rider's location)
    if (status === 'ready_for_pickup' || status === 'assigned' || status === 'accepted') {
      if (sourceLocation && !isNaN(sourceLocation.latitude) && !isNaN(sourceLocation.longitude)) {
        destPoint = {
          lat: sourceLocation.latitude,
          lng: sourceLocation.longitude
        };
      }
    }
    // For picked_up orders, route to customer (from rider's location)
    else if (status === 'out_for_delivery' || status === 'picked_up') {
      if (destLocation && !isNaN(destLocation.latitude) && !isNaN(destLocation.longitude)) {
        destPoint = {
          lat: destLocation.latitude,
          lng: destLocation.longitude
        };
      }
    }
    // Default behavior if no specific order status or missing current location
    else {
      // If no rider location available, use restaurant as origin
      if (!origin && sourceLocation && !isNaN(sourceLocation.latitude) && !isNaN(sourceLocation.longitude)) {
        origin = {
          lat: sourceLocation.latitude,
          lng: sourceLocation.longitude
        };
      }

      // Set customer location as destination if available
      if (destLocation && !isNaN(destLocation.latitude) && !isNaN(destLocation.longitude)) {
        destPoint = {
          lat: destLocation.latitude,
          lng: destLocation.longitude
        };
      }
    }

    return { origin, destination: destPoint };
  };

  // Get directions request parameters
  const getRouteParams = useCallback(() => {
    const result = createDirectionsRequest(currentLocation, source, destination, orderStatus);

    console.log("Direction route planning:", {
      currentLocation,
      source,
      destination,
      orderStatus,
      result
    });

    // Update map center if we're missing an endpoint but have one point
    if (!result.origin && result.destination) {
      setMapCenter({ lat: result.destination.lat, lng: result.destination.lng });
    } else if (result.origin && !result.destination) {
      setMapCenter({ lat: result.origin.lat, lng: result.origin.lng });
    }

    return result;
  }, [currentLocation, source, destination, orderStatus]);

  // Calculate route using Google Maps Directions API
  const calculateRoute = useCallback(() => {
    if (!window.google || !isMapLoaded) {
      console.log("Google Maps not loaded yet");
      return;
    }

    // Get the origin and destination points using our helper
    const routes = getRouteParams();
    const origin = routes.origin;
    const destPoint = routes.destination;

    // If we don't have both points, show appropriate error
    if (!origin && !destPoint) {
      setError('Cannot calculate route: missing location data');
      return;
    }

    if (!origin) {
      setError('Missing rider location data. Cannot calculate route to destination.');
      return;
    }

    if (!destPoint) {
      // If no destination but we have origin, just center on origin
      setMapCenter({ lat: origin.lat, lng: origin.lng });
      return;
    }

    // We have both origin and destination, calculate route
    console.log("Calculating route from", origin, "to", destPoint);
    setIsCalculating(true);
    setShouldFetchDirections(true);
    setError(null);

    // Update map center to include both points
    const centerLat = (origin.lat + destPoint.lat) / 2;
    const centerLng = (origin.lng + destPoint.lng) / 2;
    setMapCenter({ lat: centerLat, lng: centerLng });

  }, [getRouteParams, isMapLoaded]);

  // Trigger route calculation when dependencies change
  useEffect(() => {
    if (isMapLoaded && (source || destination || currentLocation)) {
      // Small delay to ensure map is fully loaded
      const timer = setTimeout(() => {
        calculateRoute();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [calculateRoute, isMapLoaded, source, destination, currentLocation]);

  // Handle map load event
  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
    console.log('Google Maps loaded successfully');
  }, []);

  // Determine route origin and destination based on current state and order status
  const getDirectionsRequestV2 = useCallback(() => {
    // Default to current location as origin if available
    let origin: google.maps.LatLngLiteral | undefined;
    let destPoint: google.maps.LatLngLiteral | undefined;

    console.log("Current location:", currentLocation);
    console.log("Source:", source);
    console.log("Destination:", destination);
    console.log("Order status:", orderStatus);

    // For active deliveries, always use the rider's current location as origin if available
    if (currentLocation) {
      // Validate coordinates to avoid NaN
      if (!isNaN(currentLocation.latitude) && !isNaN(currentLocation.longitude)) {
        origin = {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude
        };
        console.log("Using rider location as origin:", origin);
      } else {
        console.error("Invalid rider location coordinates", currentLocation);
      }
    }

    // For ready_for_pickup orders, route to restaurant (from rider's location)
    if (orderStatus === 'ready_for_pickup' || orderStatus === 'assigned' || orderStatus === 'accepted') {
      // If we have restaurant coordinates, route to restaurant
      if (source && source.latitude && source.longitude &&
          !isNaN(source.latitude) && !isNaN(source.longitude)) {
        destPoint = {
          lat: source.latitude,
          lng: source.longitude
        };
        console.log("Routing to restaurant for pickup:", destPoint);
      }
    }
    // For picked_up orders, route to customer (from rider's location)
    else if (orderStatus === 'out_for_delivery' || orderStatus === 'picked_up') {
      if (destination && destination.latitude && destination.longitude &&
          !isNaN(destination.latitude) && !isNaN(destination.longitude)) {
        destPoint = {
          lat: destination.latitude,
          lng: destination.longitude
        };
        console.log("Routing to customer for delivery:", destPoint);
      }
    }
    // Default behavior if no specific order status or missing current location
    else {
      // If no rider location available, use restaurant as origin
      if (!origin && source && source.latitude && source.longitude &&
          !isNaN(source.latitude) && !isNaN(source.longitude)) {
        origin = {
          lat: source.latitude,
          lng: source.longitude
        };
        console.log("Using restaurant as fallback origin:", origin);
      }

      // Set customer location as destination if available
      if (destination && destination.latitude && destination.longitude &&
          !isNaN(destination.latitude) && !isNaN(destination.longitude)) {
        destPoint = {
          lat: destination.latitude,
          lng: destination.longitude
        };
        console.log("Using customer address as fallback destination:", destPoint);
      }
    }

    // If we have both origin and destination, return them
    if (origin && destPoint) {
      console.log("Complete route found:", { origin, destination: destPoint });
      return { origin, destination: destPoint };
    }

    // If missing origin but have destination, use destination as center
    if (!origin && destPoint) {
      console.log("Missing origin, using destination as center");
      setMapCenter({ lat: destPoint.lat, lng: destPoint.lng });
    }
    // If missing destination but have origin, use origin as center
    else if (origin && !destPoint) {
      console.log("Missing destination, using origin as center");
      setMapCenter({ lat: origin.lat, lng: origin.lng });
    }

    return { origin, destination: destPoint };
  }, [currentLocation, source, destination, orderStatus]);

  // Focus on navigation route within the app
  const focusOnRoute = useCallback(() => {
    if (!isMapLoaded) return;

    // Recalculate and center the route
    calculateRoute();

    // Show toast notification
    toast({
      title: "Route Updated",
      description: "Map centered on your delivery route",
    });
  }, [calculateRoute, isMapLoaded, toast]);

  // Toggle map expansion
  const toggleMapExpansion = () => {
    setIsMapExpanded(!isMapExpanded);
  };

  // If API key is loading, show loading state
  if (isLoadingMapsKey) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Map</h3>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-center h-[200px]">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </div>
      </div>
    );
  }

  // If we don't have any locations to show, display a message
  if (!source && !destination && !currentLocation) {
    return (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <div className="flex flex-col space-y-1.5 p-6 pb-2">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Map</h3>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-center h-[200px] text-center p-4">
            <p className="text-muted-foreground">No location information available.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get request params for the DirectionsService
  const { origin, destination: destPoint } = getDirectionsRequestV2();

  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${isMapExpanded ? 'mb-4' : 'max-h-[420px] overflow-hidden mb-4'}`}>
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Map</h3>
          <Badge variant={directions ? "default" : "outline"}>
            {directions ? "Route Found" : "Loading Route"}
          </Badge>
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
          <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries}>
            <GoogleMap
              mapContainerStyle={containerStyle}
              center={mapCenter}
              zoom={14}
              onLoad={handleMapLoad}
            >
              {/* Source marker */}
              {source && (
                <Marker
                  position={{ lat: source.latitude, lng: source.longitude }}
                  onClick={() => setSelectedMarker('source')}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                  }}
                >
                  {selectedMarker === 'source' && (
                    <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-xs">Restaurant</p>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              )}

              {/* Destination marker */}
              {destination && (
                <Marker
                  position={{ lat: destination.latitude, lng: destination.longitude }}
                  onClick={() => setSelectedMarker('destination')}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                  }}
                >
                  {selectedMarker === 'destination' && (
                    <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
                      <div>
                        <p className="font-medium">Delivery Address</p>
                        <p className="text-xs">{destination.address}</p>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              )}

              {/* Current rider location marker */}
              {currentLocation && (
                <Marker
                  position={{ lat: currentLocation.latitude, lng: currentLocation.longitude }}
                  onClick={() => setSelectedMarker('rider')}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png'
                  }}
                >
                  {selectedMarker === 'rider' && (
                    <InfoWindow onCloseClick={() => setSelectedMarker(null)}>
                      <div>
                        <p className="font-medium">Your Location</p>
                        <p className="text-xs">
                          {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
                        </p>
                      </div>
                    </InfoWindow>
                  )}
                </Marker>
              )}

              {/* Directions service */}
              {shouldFetchDirections && (() => {
                const reqDirections = getDirectionsRequestV2();
                if (reqDirections.origin && reqDirections.destination) {
                  // Using the ! non-null assertion as we've already checked they exist
                  return (
                    <DirectionsService
                      options={{
                        origin: reqDirections.origin!,
                        destination: reqDirections.destination!,
                        travelMode: google.maps.TravelMode.DRIVING,
                      }}
                      callback={directionsCallback}
                    />
                  );
                }
                return null;
              })()}

              {/* Display directions if available */}
              {directions && (
                <DirectionsRenderer
                  options={{
                    directions,
                    suppressMarkers: true, // We'll use our custom markers
                  }}
                />
              )}
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
                {directions.routes[0].legs[0].distance?.text} - {directions.routes[0].legs[0].duration?.text}
              </div>
              <div className="text-xs text-muted-foreground">
                {source?.name || 'Restaurant'} → {destination?.address || 'Delivery Address'}
              </div>
            </div>
          )}

          {/* Toggle map size button */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-white"
            onClick={toggleMapExpansion}
          >
            {isMapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={calculateRoute}
            disabled={isCalculating || (!source && !destination && !currentLocation)}
          >
            {isCalculating ? 'Calculating...' : 'Refresh Route'}
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            onClick={focusOnRoute}
            disabled={!isMapLoaded}
          >
            Center on Route
          </Button>
        </div>
      </div>
    </div>
  );
}
