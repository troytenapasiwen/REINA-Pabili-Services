import React, { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LoadScript,
  GoogleMap,
  Marker,
  DirectionsRenderer,
  Polyline,
  InfoWindow
} from '@react-google-maps/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  MapPin,
  Navigation,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Define props for RiderRouteMap component
interface RiderRouteMapProps {
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

// Container style for the map
const containerStyle = {
  width: '100%',
  height: '300px'
};

// Default center (Manila)
const defaultCenter = { lat: 14.5995, lng: 120.9842 };

export function RiderRouteMap({ source, destination, currentLocation, orderStatus }: RiderRouteMapProps) {
  const { toast } = useToast();

  // Map state
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<'source' | 'destination' | 'rider' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Route state
  const [pathCoordinates, setPathCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; duration: number } | null>(null);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Detect when map loads
  const handleMapLoad = useCallback(() => {
    setIsMapLoaded(true);
  }, []);

  // Toggle map expanded state
  const toggleMapExpanded = useCallback(() => {
    setMapExpanded(prev => !prev);
  }, []);

  // Calculate route between points
  const calculateRoute = useCallback(() => {
    // Check if we have needed coordinates
    if (!currentLocation) {
      setError('Your current location is not available');
      return;
    }

    if (!destination && !source) {
      setError('No destination coordinates available');
      return;
    }

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

      // Determine target location based on order status
      let targetLocation;
      let targetName;

      if (['accepted', 'going_to_restaurant'].includes(orderStatus || '') && source) {
        // Rider is going to restaurant
        targetLocation = {
          lat: source.latitude,
          lng: source.longitude
        };
        targetName = source.name || 'Restaurant';

        // Add source point
        path.push(targetLocation);
      } else if (destination) {
        // Rider is going to customer
        targetLocation = {
          lat: destination.latitude,
          lng: destination.longitude
        };
        targetName = destination.address || 'Delivery location';

        // If rider already picked up from restaurant, only show rider -> customer
        if (['picked_up', 'on_the_way'].includes(orderStatus || '')) {
          path.push(targetLocation);
        } else {
          // Show full route: rider -> restaurant -> customer
          if (source) {
            path.push({
              lat: source.latitude,
              lng: source.longitude
            });
          }
          path.push(targetLocation);
        }
      }

      // Set the path for polyline
      setPathCoordinates(path);

      // Calculate distance from rider to target location
      if (targetLocation) {
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          targetLocation.lat,
          targetLocation.lng
        );

        // Estimate travel time (assuming average speed of 30 km/h)
        const timeInHours = distance / 30;
        const timeInMinutes = Math.round(timeInHours * 60);

        // Update distance information
        setDistanceInfo({
          distance: distance,
          duration: timeInMinutes
        });

        // Format distance and duration for display
        setDistance(`${distance.toFixed(1)} km`);
        setDuration(`~${timeInMinutes} min`);

        // Center map to show both points
        setMapCenter({
          lat: (currentLocation.latitude + targetLocation.lat) / 2,
          lng: (currentLocation.longitude + targetLocation.lng) / 2
        });

        // Show toast with distance info
        toast({
          title: "Route Calculated",
          description: `Distance to ${targetName}: ${distance.toFixed(1)} km, ETA: ~${timeInMinutes} min`,
        });
      }

      setError(null);
    } catch (error) {
      console.error('Error calculating route:', error);
      setError('Error calculating route. Please try again.');
    }
  }, [currentLocation, source, destination, orderStatus, toast]);

  // Calculate route when component mounts or props change
  useEffect(() => {
    if (isMapLoaded && currentLocation && (source || destination)) {
      calculateRoute();
    }
  }, [isMapLoaded, currentLocation, source, destination, orderStatus, calculateRoute]);

  if (isLoadingMapsKey) {
    return (
      <Card className="w-full mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-center h-[300px]">
            <div className="flex flex-col items-center">
              <span className="loading loading-spinner text-primary"></span>
              <span className="mt-2">Loading map...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full mt-4">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg flex items-center">
            <MapPin className="h-5 w-5 mr-2 text-primary" />
            Route Map
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={toggleMapExpanded}>
            {mapExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="relative w-full" style={{ height: mapExpanded ? '500px' : '300px' }}>
          {/* Show error if any */}
          {error && (
            <Alert variant="destructive" className="mb-2 mx-2 mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Loading Map */}
          {mapsData?.key && (
            <LoadScript
              googleMapsApiKey={mapsData.key}
              libraries={['places']}
              onLoad={handleMapLoad}
            >
              <GoogleMap
                mapContainerStyle={{
                  width: '100%',
                  height: '100%'
                }}
                center={mapCenter}
                zoom={14}
                options={{
                  disableDefaultUI: false,
                  zoomControl: true,
                  streetViewControl: false,
                  mapTypeControl: false,
                }}
              >
                {/* Rider's current location */}
                {isMapLoaded && currentLocation && (
                  <Marker
                    position={{
                      lat: currentLocation.latitude,
                      lng: currentLocation.longitude
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/motorcycling.png',
                      scaledSize: window.google?.maps?.Size ?
                        new window.google.maps.Size(35, 35) : undefined
                    }}
                    onClick={() => setSelectedMarker('rider')}
                  />
                )}

                {/* Restaurant marker */}
                {isMapLoaded && source && (
                  <Marker
                    position={{
                      lat: source.latitude,
                      lng: source.longitude
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/restaurant.png',
                      scaledSize: window.google?.maps?.Size ?
                        new window.google.maps.Size(32, 32) : undefined
                    }}
                    onClick={() => setSelectedMarker('source')}
                  />
                )}

                {/* Customer location marker */}
                {isMapLoaded && destination && (
                  <Marker
                    position={{
                      lat: destination.latitude,
                      lng: destination.longitude
                    }}
                    icon={{
                      url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                      scaledSize: window.google?.maps?.Size ?
                        new window.google.maps.Size(32, 32) : undefined
                    }}
                    onClick={() => setSelectedMarker('destination')}
                  />
                )}

                {/* Restaurant info window */}
                {selectedMarker === 'source' && source && (
                  <InfoWindow
                    position={{
                      lat: source.latitude,
                      lng: source.longitude
                    }}
                    onCloseClick={() => setSelectedMarker(null)}
                  >
                    <div className="p-1">
                      <p className="font-semibold text-sm">{source.name || 'Restaurant'}</p>
                      <p className="text-xs text-gray-600">Pickup Location</p>
                    </div>
                  </InfoWindow>
                )}

                {/* Customer info window */}
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

                {/* Rider info window */}
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
                      <p className="text-xs text-gray-600">Current position</p>
                    </div>
                  </InfoWindow>
                )}

                {/* Polyline to show the route */}
                {isMapLoaded && pathCoordinates.length > 0 && (
                  <Polyline
                    path={pathCoordinates}
                    options={{
                      strokeColor: '#F06445',
                      strokeOpacity: 0.8,
                      strokeWeight: 5,
                      clickable: false,
                    }}
                  />
                )}
              </GoogleMap>
            </LoadScript>
          )}

          {/* Distance information */}
          {distance && duration && (
            <div className="absolute bottom-0 left-0 right-0 bg-white p-2 border-t">
              <div className="font-semibold text-sm flex items-center">
                <Navigation className="h-4 w-4 mr-2 text-primary" />
                {distance} - {duration}
              </div>
              <div className="text-xs text-muted-foreground">
                {['accepted', 'going_to_restaurant'].includes(orderStatus || '') && source?.name
                  ? `To: ${source.name}`
                  : destination?.address
                    ? `To: ${destination.address}`
                    : 'Route distance'}
              </div>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-2 pb-3 px-4">
        <div className="flex justify-between w-full items-center">
          <div>
            <Badge variant="outline" className="mr-2">
              {orderStatus || 'No status'}
            </Badge>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={calculateRoute}
          >
            <Navigation className="h-4 w-4 mr-2" />
            Refresh Route
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
