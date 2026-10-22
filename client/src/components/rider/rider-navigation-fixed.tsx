import React, { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Libraries } from '@react-google-maps/api';
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
}

export function RiderNavigation({ source, destination, currentLocation }: RiderNavigationProps) {
  const { toast } = useToast();
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number>(0);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isKeyLoading, isError: isKeyError } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
    retry: 3,
  });

  const googleMapsApiKey = mapsData?.key || '';

  useEffect(() => {
    if (mapsData?.key) {
      console.log("Successfully loaded Google Maps API key");
      // Store key in window for easier access
      (window as any).GOOGLE_MAPS_API_KEY = mapsData.key;
    } else if (isKeyError) {
      console.error("Failed to load Google Maps API key");
      setError("Could not load Google Maps API key");
    }
  }, [mapsData, isKeyError]);

  // Get directions when the map is loaded
  const calculateRoute = () => {
    if (!currentLocation) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Location services unavailable. Please enable location access."
      });
      return;
    }

    // Make sure Google Maps is loaded
    if (typeof window.google === 'undefined' || !window.google.maps) {
      console.log("Google Maps not loaded yet. Re-trying in 2 seconds...");
      setError("Google Maps API not loaded yet. Please wait...");

      // Try again in 2 seconds
      setTimeout(() => {
        if (typeof window.google !== 'undefined' && window.google.maps) {
          console.log("Google Maps loaded on retry");
          calculateRoute();
        } else {
          console.error("Google Maps still not loaded after waiting");
          setError("Could not load Google Maps API. Please refresh the page.");
        }
      }, 2000);
      return;
    }

    console.log("Starting route calculation with Google Maps API");
    console.log("API Key:", googleMapsApiKey ? "Key present" : "No key found");
    console.log("Current location:", currentLocation);
    console.log("Source:", source);
    console.log("Destination:", destination);

    let directionsService: google.maps.DirectionsService;
    try {
      directionsService = new google.maps.DirectionsService();
    } catch (err) {
      console.error("Error creating DirectionsService:", err);
      setError("Failed to initialize Google Maps services");
      return;
    }

    // Handle destination with missing/invalid coordinates
    if (destination && (!destination.latitude || !destination.longitude) && destination.address) {
      console.log("Destination has address but no valid coordinates, attempting geocoding");
      toast({
        title: "Processing",
        description: "Geocoding destination address...",
      });

      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { address: destination.address },
          (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
              const location = results[0].geometry.location;
              console.log("Successfully geocoded address to:", location.lat(), location.lng());

              // Create a new destination object with the geocoded coordinates
              const geocodedDestination = {
                ...destination,
                latitude: location.lat(),
                longitude: location.lng()
              };

              // Call route calculation with corrected coordinates
              calculateRouteWithValidCoordinates(
                currentLocation,
                source,
                geocodedDestination,
                directionsService
              );
            } else {
              console.error("Geocoding failed:", status);
              setError(`Failed to geocode address: ${status}`);
              toast({
                variant: "destructive",
                title: "Geocoding Error",
                description: "Could not find coordinates for the destination address."
              });
            }
          }
        );
      } catch (err) {
        console.error("Geocoding error:", err);
        setError("Failed to geocode address");
      }
    } else {
      // We have all the coordinates we need, proceed with directions
      calculateRouteWithValidCoordinates(
        currentLocation,
        source,
        destination,
        directionsService
      );
    }
  };

  // Helper function to calculate route once we have valid coordinates
  const calculateRouteWithValidCoordinates = (
    currentLocation: { latitude: number; longitude: number },
    source?: { latitude: number; longitude: number; name: string },
    destination?: { latitude: number; longitude: number; address: string },
    directionsService?: google.maps.DirectionsService
  ) => {
    if (!directionsService) {
      directionsService = new google.maps.DirectionsService();
    }

    // If we have both source and destination
    if (source && destination) {
      console.log("Calculating route from current -> restaurant -> customer");
      // Configure request with waypoints
      const request = {
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        waypoints: [{
          location: { lat: source.latitude, lng: source.longitude },
          stopover: true
        }],
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true,
      };

      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          console.log("Route calculated successfully", result);
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Show toast with route details
          if (result.routes && result.routes.length > 0 &&
              result.routes[0].legs && result.routes[0].legs.length > 0) {
            const leg = result.routes[0].legs[0];
            toast({
              title: "Route Found",
              description: `${leg.distance?.text} - ${leg.duration?.text}`,
            });
          }
        } else {
          console.error("Route calculation failed:", status);
          setError(`Could not calculate route: ${status}`);
          setDirections(null);
          toast({
            title: "Route Error",
            description: `Could not calculate route: ${status}`,
            variant: "destructive",
          });
        }
      });
    }
    // If we only have source (restaurant)
    else if (source) {
      console.log("Calculating route from current -> restaurant");
      const request = {
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: source.latitude, lng: source.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      };

      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          console.log("Route to restaurant calculated successfully");
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Show toast with route details
          if (result.routes && result.routes.length > 0 &&
              result.routes[0].legs && result.routes[0].legs.length > 0) {
            const leg = result.routes[0].legs[0];
            toast({
              title: "Route to Restaurant",
              description: `${leg.distance?.text} - ${leg.duration?.text}`,
            });
          }
        } else {
          console.error("Route to restaurant calculation failed:", status);
          setError(`Could not calculate route to restaurant: ${status}`);
          setDirections(null);
          toast({
            title: "Route Error",
            description: `Could not calculate route to restaurant: ${status}`,
            variant: "destructive",
          });
        }
      });
    }
    // If we only have destination (customer)
    else if (destination) {
      console.log("Calculating route from current -> customer");
      const request = {
        origin: { lat: currentLocation.latitude, lng: currentLocation.longitude },
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode: google.maps.TravelMode.DRIVING,
      };

      directionsService.route(request, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          console.log("Route to customer calculated successfully");
          setDirections(result);
          setError(null);
          setMapExpanded(true);

          // Show toast with route details
          if (result.routes && result.routes.length > 0 &&
              result.routes[0].legs && result.routes[0].legs.length > 0) {
            const leg = result.routes[0].legs[0];
            toast({
              title: "Route to Customer",
              description: `${leg.distance?.text} - ${leg.duration?.text}`,
            });
          }
        } else {
          console.error("Route to customer calculation failed:", status);
          setError(`Could not calculate route to customer: ${status}`);
          setDirections(null);
          toast({
            title: "Route Error",
            description: `Could not calculate route to customer: ${status}`,
            variant: "destructive",
          });
        }
      });
    } else {
      console.error("No source or destination provided");
      setError("No source or destination provided for route calculation");
    }
  };

  // Toggle map expanded view
  const toggleMapView = () => {
    setMapExpanded(!mapExpanded);
    if (!directions && (source || destination)) {
      calculateRoute();
    }
  };

  if (isKeyLoading) {
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
                onClick={() => {
                  console.log("Calculate route clicked");
                  console.log("Current location:", currentLocation);
                  console.log("Source:", source);
                  console.log("Destination:", destination);
                  console.log("Google available:", typeof window.google !== 'undefined');

                  // Add a slight delay to ensure Google Maps API is fully loaded
                  setTimeout(() => {
                    calculateRoute();
                  }, 500);
                }}
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

            <LoadScript
                googleMapsApiKey={googleMapsApiKey}
                libraries={libraries}
                onLoad={() => {
                  console.log("Google Maps script loaded successfully with API key:", googleMapsApiKey ? "present" : "missing");

                  // Give window.google object time to initialize fully
                  setTimeout(() => {
                    if (currentLocation && (source || destination)) {
                      calculateRoute();
                    }
                  }, 1000);
                }}
              >
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
                      scaledSize: new window.google.maps.Size(32, 32),
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
                      scaledSize: new window.google.maps.Size(32, 32),
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
                      scaledSize: new window.google.maps.Size(32, 32),
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
            </LoadScript>

            {/* Display route details */}
            {directions && directions.routes && directions.routes.length > 0 && (
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
                          onClick={() => setSelectedRouteIndex(index)}
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
