import React, { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, Navigation, LocateFixed, Route as RouteIcon, Crosshair } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define the Google Maps libraries to load
const libraries = ['places', 'routes', 'geometry'] as any;

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
}

export function RiderNavigation({ source, destination, currentLocation }: RiderNavigationProps) {
  const { toast } = useToast();
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [routeOptions, setRouteOptions] = useState<{
    travelMode: google.maps.TravelMode;
    avoidTolls: boolean;
    avoidHighways: boolean;
  }>({
    travelMode: google.maps.TravelMode.DRIVING,
    avoidTolls: false,
    avoidHighways: false,
  });
  const [alternativeRoutes, setAlternativeRoutes] = useState<boolean>(true);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isKeyLoading } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || window.GOOGLE_MAPS_API_KEY || '';

  // State to track if Google Maps script is loaded
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);

  // Get directions using Routes API
  const getDirections = useCallback(() => {
    if (!isGoogleLoaded || !currentLocation) {
      return;
    }

    // If we have both source and destination
    if (source && destination) {
      const directionsService = new google.maps.DirectionsService();

      // Configure the directions request
      const request: google.maps.DirectionsRequest = {
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: routeOptions.travelMode,
        avoidTolls: routeOptions.avoidTolls,
        avoidHighways: routeOptions.avoidHighways,
        provideRouteAlternatives: alternativeRoutes,
        optimizeWaypoints: true,
      };

      // Add source as waypoint if different from current location
      if (source) {
        request.waypoints = [{
          location: { lat: source.latitude, lng: source.longitude },
          stopover: true
        }];
      }

      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Log route details
          if (result.routes && result.routes.length > 0) {
            const route = result.routes[0];
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0];

              console.log('Route found:', {
                distance: leg.distance?.text,
                duration: leg.duration?.text,
                start_address: leg.start_address,
                end_address: leg.end_address
              });

              toast({
                title: "Route found",
                description: `${leg.distance?.text} - ${leg.duration?.text}`,
              });
            }
          }
        } else {
          setError(`Couldn't calculate route: ${status}`);
          setDirections(null);

          toast({
            title: "Error",
            description: `Couldn't calculate route: ${status}`,
            variant: "destructive",
          });
        }
      });
    }
    // If we only have source (restaurant)
    else if (source) {
      const directionsService = new google.maps.DirectionsService();

      directionsService.route({
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: source.latitude, lng: source.longitude },
        travelMode: routeOptions.travelMode,
        avoidTolls: routeOptions.avoidTolls,
        avoidHighways: routeOptions.avoidHighways,
        provideRouteAlternatives: alternativeRoutes,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Log route details
          if (result.routes && result.routes.length > 0) {
            const route = result.routes[0];
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0];

              toast({
                title: "Route to restaurant found",
                description: `${leg.distance?.text} - ${leg.duration?.text}`,
              });
            }
          }
        } else {
          setError(`Couldn't calculate route to restaurant: ${status}`);
          setDirections(null);

          toast({
            title: "Error",
            description: `Couldn't calculate route: ${status}`,
            variant: "destructive",
          });
        }
      });
    }
    // If we only have destination (customer)
    else if (destination) {
      const directionsService = new google.maps.DirectionsService();

      directionsService.route({
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: routeOptions.travelMode,
        avoidTolls: routeOptions.avoidTolls,
        avoidHighways: routeOptions.avoidHighways,
        provideRouteAlternatives: alternativeRoutes,
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Log route details
          if (result.routes && result.routes.length > 0) {
            const route = result.routes[0];
            if (route.legs && route.legs.length > 0) {
              const leg = route.legs[0];

              toast({
                title: "Route to customer found",
                description: `${leg.distance?.text} - ${leg.duration?.text}`,
              });
            }
          }
        } else {
          setError(`Couldn't calculate route to customer: ${status}`);
          setDirections(null);

          toast({
            title: "Error",
            description: `Couldn't calculate route: ${status}`,
            variant: "destructive",
          });
        }
      });
    }
  }, [isLoaded, currentLocation, source, destination, routeOptions, alternativeRoutes, toast]);

  // Select a different route when alternatives are available
  const selectRoute = (index: number) => {
    if (directions && directions.routes.length > index) {
      setSelectedRouteIndex(index);
    }
  };

  // Toggle map expanded view
  const toggleMapView = () => {
    setMapExpanded(!mapExpanded);
    if (!directions && (source || destination)) {
      getDirections();
    }
  };

  // Automatically recalculate route when current location changes
  useEffect(() => {
    if (currentLocation && (source || destination) && directions) {
      // Only recalculate if there's a significant change in position (> 100m)
      const currentOrigin = directions.routes[0].legs[0].start_location;
      const currentLatLng = new google.maps.LatLng(currentLocation.latitude, currentLocation.longitude);

      if (google.maps.geometry && isLoaded) {
        const distance = google.maps.geometry.spherical.computeDistanceBetween(
          currentOrigin,
          currentLatLng
        );

        // If moved more than 100 meters, recalculate
        if (distance > 100) {
          getDirections();
        }
      }
    }
  }, [currentLocation, getDirections, directions, source, destination, isLoaded]);

  if (loadError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Could not load Google Maps. Please try again later.</AlertDescription>
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
    <Card className={mapExpanded ? 'overflow-hidden' : 'max-h-[210px] overflow-hidden'}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Navigation</CardTitle>
          <Badge variant={directions ? "default" : "outline"}>
            {directions ? "Route Found" : "No Route"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {!directions ? (
          <div className="flex flex-col">
            <div className="flex justify-between w-full mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={getDirections}
                disabled={!currentLocation || (!source && !destination)}
                className="mb-2 w-full"
              >
                <RouteIcon className="h-4 w-4 mr-2" />
                Calculate Route
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

            {!currentLocation && (
              <Alert className="mt-2 bg-amber-50 text-amber-600 border-amber-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>Location tracking must be enabled to get directions</AlertDescription>
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
                onClick={toggleMapView}
                className="bg-white"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            </div>

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
                    : { lat: destination?.latitude || 0, lng: destination?.longitude || 0 }
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
                    scaledSize: new google.maps.Size(32, 32),
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
                    scaledSize: new google.maps.Size(32, 32),
                  }}
                />
              )}

              {/* Destination marker (Customer) */}
              {destination && (
                <Marker
                  position={{
                    lat: destination.latitude,
                    lng: destination.longitude,
                  }}
                  icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                    scaledSize: new google.maps.Size(32, 32),
                  }}
                />
              )}

              {/* Render selected route */}
              {directions && (
                <DirectionsRenderer
                  directions={directions}
                  routeIndex={selectedRouteIndex}
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

            {/* Display route details */}
            {directions?.routes && directions.routes.length > 0 && (
              <div className="p-2 bg-white border-t text-sm">
                <div className="font-semibold flex justify-between items-center">
                  <div className="flex items-center">
                    <Navigation className="h-4 w-4 mr-2 text-primary" />
                    {directions.routes[selectedRouteIndex].legs[0].distance?.text} - {directions.routes[selectedRouteIndex].legs[0].duration?.text}
                  </div>

                  {/* If multiple routes are available, show route selector */}
                  {directions.routes.length > 1 && (
                    <div className="flex gap-1">
                      {directions.routes.map((_, index) => (
                        <Button
                          key={index}
                          variant={selectedRouteIndex === index ? "default" : "outline"}
                          size="sm"
                          onClick={() => selectRoute(index)}
                          className="h-6 w-6 p-0"
                        >
                          {index + 1}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  {source && destination ? (
                    <>From: {source.name} → To: {destination.address}</>
                  ) : source ? (
                    <>Destination: {source.name}</>
                  ) : destination ? (
                    <>Destination: {destination.address}</>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="p-3 pt-0 flex justify-between">
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleMapView}
          disabled={!currentLocation || (!source && !destination)}
          className="w-full"
        >
          <Navigation className="h-4 w-4 mr-2" />
          {mapExpanded ? 'Collapse Map' : 'Expand Map'}
        </Button>
      </CardFooter>
    </Card>
  );
}
