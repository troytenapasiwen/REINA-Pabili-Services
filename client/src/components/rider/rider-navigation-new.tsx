import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LoadScript, GoogleMap, Marker, DirectionsService, DirectionsRenderer, Polyline, Libraries } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, Navigation, LocateFixed, Route as RouteIcon, Crosshair } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the Google Maps libraries to load
const libraries: Libraries = ['places', 'geometry'];

// Define props for RiderNavigation component
interface RiderNavigationProps {
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
  // Current order status
  orderStatus?: string;
}

export function RiderNavigation({ source, destination, currentLocation, orderStatus }: RiderNavigationProps) {
  const { toast } = useToast();

  // Map references and state
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(true); // Default to expanded
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [autoCalculated, setAutoCalculated] = useState(false);

  // Display states
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  // Fallback states for when Directions API fails
  const [pathCoordinates, setPathCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; duration: number } | null>(null);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingKey } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Format a time in 24-hour format
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Manual route calculation with Haversine distance
  const calculateManualRoute = useCallback(() => {
    if (!currentLocation) {
      setError('Your current location is not available');
      return;
    }

    // Determine target coordinates
    let targetDestination;
    if (destination && destination.latitude && destination.longitude) {
      // Use customer coordinates directly
      targetDestination = destination;
    } else if (destination && destination.address) {
      // We have an address but not coordinates - could use Geocoding API
      // For now, we'll show an error
      setError('Customer coordinates not available. Please try again.');
      return;
    } else if (!source) {
      setError('No destination or restaurant location available');
      return;
    }

    // We're good to calculate
    setIsCalculating(true);
    setError(null);

    try {
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

      // Create path coordinates for the polyline
      const path = [];

      // Add rider's current location
      path.push({
        lat: currentLocation.latitude,
        lng: currentLocation.longitude
      });

      // Add source point (restaurant) if we're going to pick up
      if (source && ['accepted', 'going_to_restaurant'].includes(orderStatus || '')) {
        path.push({
          lat: source.latitude,
          lng: source.longitude
        });
      }

      // Add destination point (customer)
      if (targetDestination) {
        path.push({
          lat: targetDestination.latitude,
          lng: targetDestination.longitude
        });
      }

      // Set the path for polyline
      setPathCoordinates(path);

      // Calculate distance (either rider to restaurant or rider to customer depending on status)
      let startLat, startLng, endLat, endLng;

      if (['accepted', 'going_to_restaurant'].includes(orderStatus || '') && source) {
        // Calculate distance from rider to restaurant
        startLat = currentLocation.latitude;
        startLng = currentLocation.longitude;
        endLat = source.latitude;
        endLng = source.longitude;
      } else if (targetDestination) {
        // Calculate distance from rider to customer delivery location
        startLat = currentLocation.latitude;
        startLng = currentLocation.longitude;
        endLat = targetDestination.latitude;
        endLng = targetDestination.longitude;
      } else {
        throw new Error('Unable to determine route endpoints');
      }

      const distance = calculateDistance(startLat, startLng, endLat, endLng);

      // Estimate travel time (assuming average speed of 30 km/h)
      const timeInHours = distance / 30;
      const timeInMinutes = Math.round(timeInHours * 60);

      // Set distance information
      setDistanceInfo({
        distance: distance,
        duration: timeInMinutes
      });

      // Update display information
      setDistance(`${distance.toFixed(1)} km`);
      setDuration(`~${timeInMinutes} min`);

      toast({
        title: "Route Calculated",
        description: `Distance: ${distance.toFixed(1)} km, ETA: ~${timeInMinutes} min`,
      });

      setIsCalculating(false);
    } catch (error) {
      console.error('Error calculating manual route:', error);
      setError('Error calculating route. Please try again.');
      setIsCalculating(false);
    }
  }, [currentLocation, source, destination, orderStatus, toast]);

  // Direction calculation function implementation
  const calculateRouteForDirections = useCallback(() => {
    if (!currentLocation) {
      setError('Your current location is not available');
      return;
    }

    // Determine target coordinates
    let targetDestination;
    if (destination && destination.latitude && destination.longitude) {
      // Use customer coordinates directly
      targetDestination = destination;
    } else if (destination && destination.address) {
      // We have an address but not coordinates - could use Geocoding API
      // For now, we'll show an error
      setError('Customer coordinates not available. Please try again.');
      return;
    } else if (!source) {
      setError('No destination or restaurant location available');
      return;
    }

    // We're good to calculate
    setIsCalculating(true);
    setError(null);

    console.log("Calculating route with:");
    console.log(" - Current location:", currentLocation);
    console.log(" - Source:", source);
    console.log(" - Destination:", targetDestination || destination);

    // Force the DirectionsService to be rendered
    const points = getRoutePoints();
    if (points) {
      console.log("Route points ready for calculation:", points);
    } else {
      setError('Could not determine route points');
      setIsCalculating(false);
    }
  }, [currentLocation, source, destination]);

  // Effect to automatically calculate route when component mounts or props change
  useEffect(() => {
    if (
      googleMapsApiKey &&
      currentLocation &&
      (source || destination) &&
      !autoCalculated &&
      !isCalculating
    ) {
      console.log("Auto-calculating route...");
      setAutoCalculated(true);
      setTimeout(() => {
        calculateRouteForDirections();
      }, 1000); // Slight delay to ensure everything is loaded
    }
  }, [googleMapsApiKey, currentLocation, source, destination, autoCalculated, isCalculating, calculateRouteForDirections]);

  // Direction calculation function implementation
  const calculateRouteForDirections = useCallback(() => {
    if (!currentLocation) {
      setError('Your current location is not available');
      return;
    }

    // Determine target coordinates
    let targetDestination;
    if (destination && destination.latitude && destination.longitude) {
      // Use customer coordinates directly
      targetDestination = destination;
    } else if (destination && destination.address) {
      // We have an address but not coordinates - could use Geocoding API
      // For now, we'll show an error
      setError('Customer coordinates not available. Please try again.');
      return;
    } else if (!source) {
      setError('No destination or restaurant location available');
      return;
    }

    // We're good to calculate
    setIsCalculating(true);
    setError(null);

    console.log("Calculating route with:");
    console.log(" - Current location:", currentLocation);
    console.log(" - Source:", source);
    console.log(" - Destination:", targetDestination || destination);

    // Force the DirectionsService to be rendered
    const points = getRoutePoints();
    if (points) {
      console.log("Route points ready for calculation:", points);
    } else {
      setError('Could not determine route points');
      setIsCalculating(false);
    }
  }, [currentLocation, source, destination]);

  // Handle direction results
  const directionsCallback = useCallback((
    result: google.maps.DirectionsResult | null,
    status: google.maps.DirectionsStatus
  ) => {
    console.log("Direction service callback:", status);
    console.log("Direction result:", result);

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
          setMapExpanded(true);
        }
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
  }, [toast]);

  // Open in Google Maps app
  const openInGoogleMaps = () => {
    let url = "https://www.google.com/maps/dir/?api=1";

    if (currentLocation) {
      url += `&origin=${currentLocation.latitude},${currentLocation.longitude}`;
    }

    if (source && destination) {
      url += `&destination=${destination.latitude},${destination.longitude}`;
      url += `&destination_name=${encodeURIComponent(destination.address || 'Customer')}`;
      url += `&waypoints=${source.latitude},${source.longitude}`;
      url += `&waypoint_names=${encodeURIComponent(source.name || 'Restaurant')}`;
    } else if (source) {
      url += `&destination=${source.latitude},${source.longitude}`;
      url += `&destination_name=${encodeURIComponent(source.name || 'Restaurant')}`;
    } else if (destination) {
      url += `&destination=${destination.latitude},${destination.longitude}`;
      url += `&destination_name=${encodeURIComponent(destination.address || 'Customer')}`;
    }

    url += `&travelmode=driving`;
    window.open(url, '_blank');
  };

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

  if (isLoadingKey) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="animate-pulse flex flex-col items-center py-4">
            <div className="h-10 w-10 bg-slate-200 rounded-full mb-3"></div>
            <div className="h-4 w-40 bg-slate-200 rounded mb-2"></div>
            <div className="h-3 w-32 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const points = getRoutePoints();
  const waypoints = getWaypoints();

  return (
    <div className={`rounded-lg border bg-card text-card-foreground shadow-sm ${mapExpanded ? 'mb-4' : 'max-h-[240px] overflow-hidden mb-4'}`}>
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Navigation</h3>
          <Badge variant={directions ? "default" : "outline"}>
            {directions ? "Route Found" : "No Route"}
          </Badge>
        </div>
      </div>

      <div className="p-3">
        {!directions ? (
          <div className="flex flex-col">
            <div className="mb-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full mb-2"
                onClick={calculateManualRoute}
                disabled={!currentLocation || (!source && !destination) || isCalculating}
              >
                {isCalculating ? (
                  <>Calculating...</>
                ) : (
                  <>
                    <RouteIcon className="h-4 w-4 mr-2" />
                    Calculate Route
                  </>
                )}
              </Button>
            </div>

            <div className="flex flex-col space-y-2 mb-2">
              <div className="flex items-center gap-2 text-sm">
                <Crosshair className="h-4 w-4 text-blue-500" />
                <span className="text-muted-foreground">
                  {currentLocation
                    ? `Current: ${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                    : 'Current location not available'}
                </span>
              </div>

              {source && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-red-500" />
                  <span className="text-muted-foreground truncate">
                    Restaurant: {source.name}
                  </span>
                </div>
              )}

              {destination && (
                <div className="flex items-center gap-2 text-sm">
                  <LocateFixed className="h-4 w-4 text-green-500" />
                  <span className="text-muted-foreground truncate">
                    Customer: {destination.address}
                  </span>
                </div>
              )}
            </div>

            {error && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="h-full relative">
            <div className="absolute top-2 right-2 z-10 flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMapExpanded(!mapExpanded)}
                className="bg-white"
              >
                {mapExpanded ? 'Collapse' : 'Expand'}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={openInGoogleMaps}
                className="bg-white"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>

            <div className="w-full h-full">
              {googleMapsApiKey && (
                <LoadScript googleMapsApiKey={googleMapsApiKey} libraries={libraries} onLoad={() => setMapLoaded(true)}>
                  {/* Render DirectionsService only when calculating */}
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

                  <GoogleMap
                    mapContainerStyle={{
                      width: '100%',
                      height: mapExpanded ? '400px' : '120px',
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
                    zoom={14}
                    options={{
                      zoomControl: mapExpanded,
                      streetViewControl: false,
                      mapTypeControl: false,
                      fullscreenControl: false,
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
                        }}
                      />
                    )}

                    {/* Source marker (Restaurant) */}
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

                    {/* Destination marker (Customer) */}
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

                    {/* Render directions */}
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
                </LoadScript>
              )}
            </div>

            {directions && (
              <div className="p-2 bg-white border-t text-sm mt-2">
                {distance && duration && (
                  <div className="font-semibold flex items-center">
                    <Navigation className="h-4 w-4 mr-2 text-primary" />
                    {distance} - {duration}
                  </div>
                )}
                <div className="text-muted-foreground text-xs mt-1">
                  {source && destination ? (
                    <>From: {source.name} → To: {destination.address}</>
                  ) : source ? (
                    <>To: {source.name}</>
                  ) : destination ? (
                    <>To: {destination.address}</>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!directions && (
        <div className="flex items-center p-3 pt-0">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={openInGoogleMaps}
            disabled={!currentLocation || (!source && !destination)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Open in Google Maps
          </Button>
        </div>
      )}
    </div>
  );
}
