import React, { useEffect, useState, useRef, useMemo } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, LoadScript } from '@react-google-maps/api';
import { Order, Restaurant, Rider } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Enhanced rider type with extra information from API
type EnhancedRider = Rider & {
  name?: string;
  phone?: string | null;
  currentLocation?: unknown;
}

interface MapOrderTrackingProps {
  order: Order & {
    deliveryLatitude?: number | null;
    deliveryLongitude?: number | null;
  };
  restaurant?: (Restaurant & {
    latitude?: number | null;
    longitude?: number | null;
  }) | null;
  rider?: (EnhancedRider & {
    currentLocation?: {
      latitude: number;
      longitude: number;
    };
  }) | null;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 14.5995, // Philippines default (Manila)
  lng: 120.9842
};

export default function MapOrderTracking({ order, restaurant, rider }: MapOrderTrackingProps) {
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Fetch Google Maps API key
  const { data: mapsKeyData, isLoading: isLoadingApiKey } = useQuery<{ key: string }>({
    queryKey: ["/api/maps/key"],
  });

  // Set map center based on coordinates
  useEffect(() => {
    // Set map center based on rider location if available
    if (rider?.currentLocation) {
      setMapCenter({
        lat: parseFloat(rider.currentLocation.latitude.toString()),
        lng: parseFloat(rider.currentLocation.longitude.toString())
      });
    }
    // Else set map center based on restaurant location if available
    else if (restaurant?.latitude && restaurant?.longitude) {
      setMapCenter({
        lat: parseFloat(restaurant.latitude.toString()),
        lng: parseFloat(restaurant.longitude.toString())
      });
    }
    // If delivery location coordinates are available, use those
    else if (order.deliveryLatitude && order.deliveryLongitude) {
      setMapCenter({
        lat: parseFloat(order.deliveryLatitude.toString()),
        lng: parseFloat(order.deliveryLongitude.toString())
      });
    }
  }, [restaurant, order, rider]);

  // Loading state for API key
  if (isLoadingApiKey || !mapsKeyData) {
    return (
      <div className="flex justify-center items-center h-full bg-muted/20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading map...</span>
      </div>
    );
  }

  // No API key provided
  if (!mapsKeyData.key) {
    return (
      <div className="flex flex-col justify-center items-center h-full bg-muted/20 p-4 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <div className="text-sm text-muted-foreground">Map unavailable - No API key configured</div>
      </div>
    );
  }

  return (
    <MapWithKey
      apiKey={mapsKeyData.key}
      mapCenter={mapCenter}
      order={order}
      restaurant={restaurant}
      rider={rider}
    />
  );
}

// Separate component to handle Google Maps loading
function MapWithKey({
  apiKey,
  mapCenter,
  order,
  restaurant,
  rider
}: {
  apiKey: string;
  mapCenter: { lat: number; lng: number };
  order: MapOrderTrackingProps['order'];
  restaurant: MapOrderTrackingProps['restaurant'];
  rider: MapOrderTrackingProps['rider'];
}) {
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const libraries = useMemo(() => ['places', 'geometry'], []);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Function to calculate route between restaurant and delivery address
  const calculateRoute = () => {
    // Make sure Google Maps is properly loaded
    if (!window.google || !window.google.maps) {
      console.error("Google Maps not loaded yet");
      return;
    }

    // Check if we have coordinates
    if (!restaurant?.latitude || !restaurant.longitude ||
        !order.deliveryLatitude || !order.deliveryLongitude) {
      console.error("Missing coordinates for route calculation");
      return;
    }

    try {
      // Create directions service safely
      const directionsService = new window.google.maps.DirectionsService();

      const restaurantLocation = {
        lat: parseFloat(restaurant.latitude.toString()),
        lng: parseFloat(restaurant.longitude.toString())
      };

      const deliveryLocation = {
        lat: parseFloat(order.deliveryLatitude.toString()),
        lng: parseFloat(order.deliveryLongitude.toString())
      };

      // If rider is assigned and has location, use it as waypoint
      let waypoints = [];
      if (rider?.currentLocation && ['picked_up', 'on_the_way'].includes(order.status)) {
        waypoints.push({
          location: {
            lat: parseFloat(rider.currentLocation.latitude.toString()),
            lng: parseFloat(rider.currentLocation.longitude.toString())
          },
          stopover: true
        });
      }

      directionsService.route(
        {
          origin: restaurantLocation,
          destination: deliveryLocation,
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK && result) {
            setDirections(result);
          } else {
            console.error("Error calculating route:", status);
            setDirections(null);
          }
        }
      );
    } catch (error) {
      console.error("Error initializing directions service:", error);
    }
  };

  // Called when the map is fully loaded
  const handleMapLoad = () => {
    setIsMapLoaded(true);
    console.log("Google Maps loaded successfully");
  };

  // Calculate route when component mounts or when rider location changes
  useEffect(() => {
    if (isMapLoaded && window.google && window.google.maps &&
        restaurant?.latitude && restaurant.longitude &&
        order.deliveryLatitude && order.deliveryLongitude) {
      // Give a small delay to ensure maps API is fully initialized
      const timer = setTimeout(() => {
        calculateRoute();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isMapLoaded, restaurant, order, rider?.currentLocation]);

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries as any}
      onLoad={handleMapLoad}
    >
      <div className="relative h-full">
        {/* Expand/collapse button */}
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
            ...containerStyle,
            height: mapExpanded ? '400px' : '100%'
          }}
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
          {/* Restaurant Marker */}
          {isMapLoaded && restaurant?.latitude && restaurant?.longitude && (
            <Marker
              position={{
                lat: parseFloat(restaurant.latitude.toString()),
                lng: parseFloat(restaurant.longitude.toString())
              }}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/restaurant.png",
                scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(32, 32) : undefined
              }}
              title={restaurant.name}
            />
          )}

          {/* Customer Delivery Location Marker */}
          {isMapLoaded && order.deliveryLatitude && order.deliveryLongitude && (
            <Marker
              position={{
                lat: parseFloat(order.deliveryLatitude.toString()),
                lng: parseFloat(order.deliveryLongitude.toString())
              }}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(32, 32) : undefined
              }}
              title="Delivery Location"
            />
          )}

          {/* Rider Location Marker (if assigned and location available) */}
          {isMapLoaded && rider?.currentLocation && (
            <Marker
              position={{
                lat: parseFloat(rider.currentLocation.latitude.toString()),
                lng: parseFloat(rider.currentLocation.longitude.toString())
              }}
              icon={{
                url: "https://maps.google.com/mapfiles/ms/icons/motorcycling.png",
                scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(32, 32) : undefined
              }}
              title={rider.name ? `Rider: ${rider.name}` : `Rider: ${rider.id}`}
            />
          )}

          {/* Display route if available */}
          {isMapLoaded && directions && window.google?.maps && (
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

        {/* Show route details if expanded and directions available */}
        {mapExpanded && directions?.routes[0]?.legs[0] && (
          <div className="p-2 bg-white border-t text-sm">
            <div className="font-semibold flex items-center">
              <Navigation className="h-4 w-4 mr-2 text-primary" />
              {directions.routes[0].legs[0].distance?.text} - {directions.routes[0].legs[0].duration?.text}
            </div>
            <div className="text-xs text-muted-foreground">
              {restaurant?.name || 'Restaurant'} → Delivery Address
            </div>
          </div>
        )}
      </div>
    </LoadScript>
  );
}
