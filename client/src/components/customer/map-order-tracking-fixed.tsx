import React, { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, InfoWindow, Polyline } from '@react-google-maps/api';
import { Order, Restaurant, Rider } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertTriangle, Navigation, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Enhanced rider type with extra information from API
type EnhancedRider = Rider & {
  name?: string;
  phone?: string | null;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
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
  isLiveTracking?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 14.5995, // Philippines default (Manila)
  lng: 120.9842
};

export default function MapOrderTrackingFixed({ order, restaurant, rider, isLiveTracking = false }: MapOrderTrackingProps) {
  const [mapCenter, setMapCenter] = useState(defaultCenter);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [markerPulse, setMarkerPulse] = useState(false);
  const [lastLocationUpdate, setLastLocationUpdate] = useState<Date | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<'restaurant' | 'customer' | 'rider' | null>(null);
  const [pathCoordinates, setPathCoordinates] = useState<Array<{ lat: number; lng: number }>>([]);
  const [distanceInfo, setDistanceInfo] = useState<{ distance: number; duration: number } | null>(null);
  const libraries: ["places"] = ['places'];

  // Fetch Google Maps API key
  const { data: mapsKeyData, isLoading: isLoadingApiKey } = useQuery<{ key: string }>({
    queryKey: ["/api/maps/key"],
    staleTime: Infinity,
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

  // Function to calculate route between restaurant and delivery address
  const calculateRoute = useCallback(() => {
    // Make sure Google Maps is properly loaded
    if (!window.google || !isMapLoaded) {
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
      // Just use the polyline approach instead of the Directions API
      setDirections(null);

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

      const restaurantLocation = {
        lat: parseFloat(restaurant.latitude.toString()),
        lng: parseFloat(restaurant.longitude.toString())
      };

      const deliveryLocation = {
        lat: parseFloat(order.deliveryLatitude.toString()),
        lng: parseFloat(order.deliveryLongitude.toString())
      };

      // Create path coordinates for the polyline
      const path = [];

      // Add restaurant point
      path.push(restaurantLocation);

      // Add rider location as waypoint if available
      if (rider?.currentLocation && ['picked_up', 'on_the_way'].includes(order.status)) {
        path.push({
          lat: parseFloat(rider.currentLocation.latitude.toString()),
          lng: parseFloat(rider.currentLocation.longitude.toString())
        });
      }

      // Add delivery location
      path.push(deliveryLocation);

      // Set the path for polyline
      setPathCoordinates(path);

      // Calculate distance between restaurant and delivery location
      const distance = calculateDistance(
        restaurantLocation.lat,
        restaurantLocation.lng,
        deliveryLocation.lat,
        deliveryLocation.lng
      );

      // Estimate travel time (assuming average speed of 30 km/h)
      const timeInHours = distance / 30;
      const timeInMinutes = Math.round(timeInHours * 60);

      // Set distance information
      setDistanceInfo({
        distance: distance,
        duration: timeInMinutes
      });

      // Update the map center to show all points
      const centerLat = (restaurantLocation.lat + deliveryLocation.lat) / 2;
      const centerLng = (restaurantLocation.lng + deliveryLocation.lng) / 2;
      setMapCenter({ lat: centerLat, lng: centerLng });

      // Log distance information
      console.log(`Distance: ${distance.toFixed(2)} km, Estimated time: ${timeInMinutes} minutes`);
    } catch (error) {
      console.error("Error calculating route:", error);
    }
  }, [isMapLoaded, order, restaurant, rider]);

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
  }, [isMapLoaded, restaurant, order, rider?.currentLocation, calculateRoute]);

  // Handle live tracking effects (pulse animation, auto center)
  useEffect(() => {
    if (isLiveTracking && rider?.currentLocation) {
      // Set the last update time
      setLastLocationUpdate(new Date());

      // Pulse the marker to indicate a fresh update
      setMarkerPulse(true);
      const pulseTimeout = setTimeout(() => {
        setMarkerPulse(false);
      }, 2000);

      // Center the map on rider if tracking is active
      if (window.google && isMapLoaded) {
        setMapCenter({
          lat: parseFloat(rider.currentLocation.latitude.toString()),
          lng: parseFloat(rider.currentLocation.longitude.toString())
        });
      }

      return () => clearTimeout(pulseTimeout);
    }
  }, [isLiveTracking, rider?.currentLocation, isMapLoaded]);

  // Open in Google Maps app
  const openInGoogleMaps = () => {
    let url = "https://www.google.com/maps/dir/?api=1";

    if (restaurant?.latitude && restaurant.longitude) {
      url += `&origin=${restaurant.latitude},${restaurant.longitude}`;
      url += `&origin_name=${encodeURIComponent(restaurant.name || 'Restaurant')}`;
    }

    if (order.deliveryLatitude && order.deliveryLongitude) {
      url += `&destination=${order.deliveryLatitude},${order.deliveryLongitude}`;
      url += `&destination_name=${encodeURIComponent('Delivery Address')}`;
    }

    if (rider?.currentLocation) {
      url += `&waypoints=${rider.currentLocation.latitude},${rider.currentLocation.longitude}`;
      url += `&waypoint_names=${encodeURIComponent('Rider')}`;
    }

    url += `&travelmode=driving`;
    window.open(url, '_blank');
  };

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
    <div className="relative h-full">
      {/* Expand/collapse button */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMapExpanded(!mapExpanded)}
          className="bg-white shadow-md h-8 w-8 p-0"
        >
          {mapExpanded ?
            <Minimize2 className="h-4 w-4" /> :
            <Maximize2 className="h-4 w-4" />
          }
        </Button>
      </div>

      <LoadScript
        googleMapsApiKey={mapsKeyData.key}
        libraries={libraries}
        onLoad={handleMapLoad}
      >
        <GoogleMap
          mapContainerStyle={{
            ...containerStyle,
            height: mapExpanded ? '500px' : '100%'
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
                scaledSize: window.google?.maps?.Size ?
                  new window.google.maps.Size(32, 32) : undefined
              }}
              title={restaurant.name}
              onClick={() => setSelectedMarker('restaurant')}
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
                scaledSize: window.google?.maps?.Size ?
                  new window.google.maps.Size(32, 32) : undefined
              }}
              title="Delivery Location"
              onClick={() => setSelectedMarker('customer')}
            />
          )}

          {/* Rider Location Marker (if assigned and location available) */}
          {isMapLoaded && rider?.currentLocation && (
            <>
              {/* Pulsing circle for live tracking */}
              {isLiveTracking && (
                <Marker
                  position={{
                    lat: parseFloat(rider.currentLocation.latitude.toString()),
                    lng: parseFloat(rider.currentLocation.longitude.toString())
                  }}
                  icon={{
                    path: window.google?.maps?.SymbolPath ? window.google.maps.SymbolPath.CIRCLE : 0,
                    fillColor: '#F06445',
                    fillOpacity: markerPulse ? 0.3 : 0.1,
                    strokeColor: '#F06445',
                    strokeWeight: 2,
                    scale: 20
                  }}
                  zIndex={1}
                  clickable={false}
                />
              )}

              {/* Rider marker */}
              <Marker
                position={{
                  lat: parseFloat(rider.currentLocation.latitude.toString()),
                  lng: parseFloat(rider.currentLocation.longitude.toString())
                }}
                icon={{
                  url: "https://maps.google.com/mapfiles/ms/icons/motorcycling.png",
                  scaledSize: window.google?.maps?.Size ?
                    new window.google.maps.Size(32, 32) : undefined
                }}
                title={rider.name ? `Rider: ${rider.name}` : `Rider: ${rider.id}`}
                onClick={() => setSelectedMarker('rider')}
                zIndex={2}
                animation={isLiveTracking && markerPulse && window.google?.maps?.Animation ?
                  window.google.maps.Animation.BOUNCE : undefined}
              />
            </>
          )}

          {/* InfoWindows for markers */}
          {selectedMarker === 'restaurant' && restaurant?.latitude && restaurant?.longitude && (
            <InfoWindow
              position={{
                lat: parseFloat(restaurant.latitude.toString()),
                lng: parseFloat(restaurant.longitude.toString())
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1">
                <p className="font-semibold text-sm">{restaurant.name}</p>
                <p className="text-xs text-gray-600">{restaurant.address}</p>
              </div>
            </InfoWindow>
          )}

          {selectedMarker === 'customer' && order.deliveryLatitude && order.deliveryLongitude && (
            <InfoWindow
              position={{
                lat: parseFloat(order.deliveryLatitude.toString()),
                lng: parseFloat(order.deliveryLongitude.toString())
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1">
                <p className="font-semibold text-sm">Delivery Location</p>
                <p className="text-xs text-gray-600">{order.deliveryAddress}</p>
              </div>
            </InfoWindow>
          )}

          {selectedMarker === 'rider' && rider?.currentLocation && (
            <InfoWindow
              position={{
                lat: parseFloat(rider.currentLocation.latitude.toString()),
                lng: parseFloat(rider.currentLocation.longitude.toString())
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-1">
                <p className="font-semibold text-sm">
                  {rider.name ? `Rider: ${rider.name}` : `Rider #${rider.id}`}
                </p>
                {rider.phone && (
                  <p className="text-xs text-gray-600">Contact: {rider.phone}</p>
                )}
              </div>
            </InfoWindow>
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

          {/* Show polyline when directions API isn't available but we have path coordinates */}
          {isMapLoaded && pathCoordinates.length > 0 && !directions && (
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

      {/* Show route details if expanded and directions or distance info available */}
      {mapExpanded && (directions?.routes[0]?.legs[0] || distanceInfo) && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-white border-t text-sm">
          <div className="font-semibold flex items-center">
            <Navigation className="h-4 w-4 mr-2 text-primary" />
            {directions?.routes[0]?.legs[0] ? (
              // Show Google's calculated distance/time if available
              <>{directions.routes[0].legs[0].distance?.text} - {directions.routes[0].legs[0].duration?.text}</>
            ) : distanceInfo ? (
              // Show our calculated distance/time
              <>{distanceInfo.distance.toFixed(2)} km - ~{distanceInfo.duration} mins</>
            ) : null}
          </div>

          <div className="text-xs text-muted-foreground">
            {restaurant?.name || 'Restaurant'} → Delivery Address
          </div>

          {/* Live tracking indicator */}
          {isLiveTracking && rider?.currentLocation && lastLocationUpdate && (
            <div className="flex items-center mt-1 text-xs text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-600 mr-1.5 animate-pulse"></div>
              <span>Live tracking active - Last update: {lastLocationUpdate.toLocaleTimeString()}</span>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={openInGoogleMaps}
            className="mt-2 text-xs h-8"
          >
            Open in Google Maps
          </Button>
        </div>
      )}

      {/* Show live tracking notification if not expanded */}
      {!mapExpanded && isLiveTracking && rider?.currentLocation && (
        <div className="absolute bottom-2 left-2 right-2 p-2 bg-white/90 rounded-md shadow-md text-xs border border-green-200">
          <div className="flex items-center text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-600 mr-1.5 animate-pulse"></div>
            <span className="font-medium">Rider location updating in real-time</span>
          </div>
        </div>
      )}
    </div>
  );
}
