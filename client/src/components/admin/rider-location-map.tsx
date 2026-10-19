import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  DirectionsRenderer,
} from "@react-google-maps/api";
import { useQuery } from "@tanstack/react-query";
import { Order, Restaurant, Rider, User } from "@shared/schema";
import { wsService } from "@/lib/websocket-service";
import { Loader2, MapPin, Navigation, Route } from "lucide-react";

// Map styles
const mapContainerStyle = {
  width: "100%",
  height: "600px",
  borderRadius: "8px",
};

// Default center (Manila, Philippines)
const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

// Custom marker colors based on rider status
const statusColors = {
  active: "green",
  inactive: "gray",
  waiting: "orange",
  offline: "red",
};

type LatLng = {
  lat: number;
  lng: number;
};

interface RiderWithLocation extends Rider {
  displayName?: string;
  currentLocationObject?: LatLng;
  lastUpdate?: string;
  activeOrderId?: number;
  currentRestaurant?: {
    id: number;
    name: string;
    location: LatLng;
  };
  currentDelivery?: {
    orderId: number;
    address: string;
    location: LatLng;
  };
}

interface RiderLocationMapProps {
  riders: Rider[];
  users: User[];
  orders?: Order[];
  restaurants?: Restaurant[];
}

const parseLocation = (location: unknown): LatLng | null => {
  if (!location || typeof location !== "object") {
    return null;
  }

  const loc = location as Record<string, unknown>;
  const latValue = loc.latitude ?? loc.lat;
  const lngValue = loc.longitude ?? loc.lng;

  if (typeof latValue === "number" && typeof lngValue === "number") {
    return { lat: latValue, lng: lngValue };
  }

  if (typeof latValue === "string" && typeof lngValue === "string") {
    const lat = parseFloat(latValue);
    const lng = parseFloat(lngValue);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng };
    }
  }

  return null;
};

export function RiderLocationMap({ riders, users, orders = [], restaurants = [] }: RiderLocationMapProps) {
  // State for riders with parsed location data
  const [ridersWithLocation, setRidersWithLocation] = useState<RiderWithLocation[]>([]);
  const [selectedRider, setSelectedRider] = useState<RiderWithLocation | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [directions, setDirections] = useState<Record<number, any>>({});
  const websocketConnected = useRef(false);
  const libraries = useMemo(() => ["places", "geometry"], []);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Process riders and extract location data
  useEffect(() => {
    if (riders.length > 0) {
      const processedRiders = riders.map(rider => {
        // Find the associated user
        const user = users.find(u => u.id === rider.userId);
        const displayName = user?.fullName || user?.username || `Rider #${rider.id}`;

        // Parse currentLocation if it exists
        let currentLocationObject = null;
        if (rider.currentLocation) {
          try {
            // If it's a string, parse it
            if (typeof rider.currentLocation === 'string') {
              const locationData = JSON.parse(rider.currentLocation);
              if (locationData.latitude && locationData.longitude) {
                currentLocationObject = {
                  lat: parseFloat(locationData.latitude),
                  lng: parseFloat(locationData.longitude),
                };
              }
            }
            // If it's already an object
            else if (
              typeof rider.currentLocation === 'object' &&
              rider.currentLocation !== null
            ) {
              const location = rider.currentLocation as any;
              if (location.latitude && location.longitude) {
                currentLocationObject = {
                  lat: parseFloat(location.latitude),
                  lng: parseFloat(location.longitude),
                };
              } else if (location.lat && location.lng) {
                currentLocationObject = {
                  lat: parseFloat(location.lat),
                  lng: parseFloat(location.lng),
                };
              }
            }
          } catch (error) {
            console.error("Error parsing rider location:", error);
          }
        }

        // Find any active orders for this rider
        let activeOrderId: number | undefined;
        let currentRestaurant: RiderWithLocation['currentRestaurant'] = undefined;
        let currentDelivery: RiderWithLocation['currentDelivery'] = undefined;

        if (orders && orders.length > 0) {
          const activeOrder = orders.find(order =>
            order.riderId === rider.id &&
            ['picked_up', 'on_the_way'].includes(order.status)
          );

          if (activeOrder) {
            activeOrderId = activeOrder.id;

            // Get restaurant info
            const orderRestaurant = restaurants.find(r => r.id === activeOrder.restaurantId);
            if (orderRestaurant && orderRestaurant.latitude && orderRestaurant.longitude) {
              currentRestaurant = {
                id: orderRestaurant.id,
                name: orderRestaurant.name,
                location: {
                  lat: parseFloat(orderRestaurant.latitude.toString()),
                  lng: parseFloat(orderRestaurant.longitude.toString())
                }
              };
            }

            // For pabili orders, use the delivery address location
            if (activeOrder.deliveryAddress) {
              // Try to extract coordinates from the order metadata or use a default location
              currentDelivery = {
                orderId: activeOrder.id,
                address: activeOrder.deliveryAddress,
                location: {
                  lat: 14.5995, // Default Manila coordinates
                  lng: 120.9842
                }
              };
            }
          }
        }

        return {
          ...rider,
          displayName,
          currentLocationObject: currentLocationObject as any,
          lastUpdate: new Date().toISOString(),
          activeOrderId,
          currentRestaurant,
          currentDelivery
        };
      });

      setRidersWithLocation(processedRiders);
    }
  }, [riders, users, orders, restaurants]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    if (websocketConnected.current) return;

    // Connect and authenticate with WebSocket server
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('admin');
        websocketConnected.current = true;
        console.log('WebSocket connected and authenticated as admin');

        // Add listener for rider location updates
        wsService.on('rider_location_update', handleRiderLocationUpdate);
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (websocketConnected.current) {
        wsService.off('rider_location_update', handleRiderLocationUpdate);
        websocketConnected.current = false;
      }
    };
  }, []);

  // Handle rider location update from WebSocket
  const handleRiderLocationUpdate = (data: any) => {
    const { riderId, location, timestamp, orderId } = data;

    setRidersWithLocation(prevRiders => {
      return prevRiders.map(rider => {
        if (rider.id === riderId) {
          let locationObject = undefined;

          if (location) {
            if (location.latitude && location.longitude) {
              locationObject = {
                lat: parseFloat(location.latitude),
                lng: parseFloat(location.longitude),
              };
            } else if (location.lat && location.lng) {
              locationObject = {
                lat: parseFloat(location.lat),
                lng: parseFloat(location.lng),
              };
            }
          }

          return {
            ...rider,
            currentLocationObject: locationObject,
            lastUpdate: timestamp || new Date().toISOString(),
            activeOrderId: orderId || rider.activeOrderId,
          };
        }
        return rider;
      });
    });
  };

  // Calculate route for a rider
  const calculateRoute = (rider: RiderWithLocation) => {
    const googleMaps = (window as any).google;
    if (!googleMaps?.maps || !rider.currentLocationObject) return;

    const directionsService = new googleMaps.maps.DirectionsService();
    const origin: LatLng = {
      lat: rider.currentLocationObject.lat,
      lng: rider.currentLocationObject.lng,
    };

    const destination = rider.currentDelivery?.location ?? rider.currentRestaurant?.location;
    if (!destination) return;

    const request: any = {
      origin,
      destination,
      travelMode: googleMaps.maps.TravelMode.DRIVING,
    };

    if (rider.currentDelivery?.location && rider.currentRestaurant?.location) {
      request.waypoints = [
        { location: rider.currentRestaurant.location, stopover: false },
      ];
      request.optimizeWaypoints = false;
    }

    directionsService.route(request, (result: any, status: any) => {
      if (status === googleMaps.maps.DirectionsStatus.OK && result) {
        setDirections(prev => ({
          ...prev,
          [rider.id]: result,
        }));
      } else {
        console.error(`Error calculating route for rider ${rider.id}:`, status);
      }
    });
  };

  // Handle rider location update from WebSocket
  const handleRiderLocationUpdate = (data: any) => {
    const { riderId, location, timestamp, orderId } = data;

    setRidersWithLocation((prevRiders: RiderWithLocation[]) => {
      return prevRiders.map((rider) => {
        if (rider.id !== riderId) {
          return rider;
        }

        const locationObject = parseLocation(location) ?? rider.currentLocationObject;

        return {
          ...rider,
          currentLocationObject: locationObject,
          lastUpdate: timestamp || new Date().toISOString(),
          activeOrderId: orderId ?? rider.activeOrderId,
        };
      });
    });
  };

  // Count riders with valid locations
  const activeLocations = ridersWithLocation.filter(
    rider => rider.currentLocationObject?.lat && rider.currentLocationObject?.lng
  ).length;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Rider Locations</CardTitle>
          <div className="flex items-center space-x-2">
            <Button
              variant={showRoutes ? "default" : "outline"}
              size="sm"
              onClick={() => setShowRoutes(!showRoutes)}
              className="h-8"
            >
              <Route className="h-4 w-4 mr-2" />
              {showRoutes ? "Hide Routes" : "Show Routes"}
            </Button>
            <Badge variant="outline" className="ml-2">
              {activeLocations} active trackers
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time location of all riders on the platform. Click a rider to view details.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        {isLoadingMapsKey ? (
          <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-md">
            <div className="flex flex-col items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          </div>
        ) : !mapsData || !mapsData.key ? (
          <div className="flex items-center justify-center h-[600px] bg-muted/20 rounded-md">
            <div className="text-center max-w-md p-4">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">Map API Key Missing</p>
              <p className="text-muted-foreground mb-4">
                Google Maps API key is required to display the rider location map.
              </p>
            </div>
          </div>
        ) : (
          <LoadScript
            googleMapsApiKey={mapsData.key}
            libraries={libraries as any}
          >
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={
                // Center on the first rider with location if available
                ridersWithLocation.find(r => r.currentLocationObject)?.currentLocationObject ||
                defaultCenter
              }
              zoom={12}
              options={{
                fullscreenControl: true,
                streetViewControl: false,
                mapTypeControl: true,
                zoomControl: true,
              }}
            >
              {/* Render direction routes for riders with active deliveries */}
              {showRoutes && Object.entries(directions).map(([riderId, direction]) =>
                direction ? (
                  <DirectionsRenderer
                    key={`route-${riderId}`}
                    directions={direction}
                    options={{
                      suppressMarkers: true,
                      polylineOptions: {
                        strokeColor: '#F06445',
                        strokeWeight: 4,
                        strokeOpacity: 0.8
                      }
                    }}
                  />
                ) : null
              )}

              {/* Render restaurant markers */}
              {ridersWithLocation
                .filter(rider => rider.currentRestaurant?.location)
                .map(rider => (
                  <Marker
                    key={`restaurant-${rider.currentRestaurant!.id}-${rider.id}`}
                    position={rider.currentRestaurant!.location}
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                      scaledSize: new window.google.maps.Size(32, 32),
                    }}
                    title={`Restaurant: ${rider.currentRestaurant!.name}`}
                  />
                ))}

              {/* Render delivery location markers */}
              {ridersWithLocation
                .filter(rider => rider.currentDelivery?.location)
                .map(rider => (
                  <Marker
                    key={`delivery-${rider.currentDelivery!.orderId}-${rider.id}`}
                    position={rider.currentDelivery!.location}
                    icon={{
                      url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                      scaledSize: new window.google.maps.Size(32, 32),
                    }}
                    title={`Delivery: ${rider.currentDelivery!.address}`}
                  />
                ))}

              {/* Render markers for riders with location data */}
              {ridersWithLocation
                .filter(rider => rider.currentLocationObject?.lat && rider.currentLocationObject?.lng)
                .map(rider => (
                  <Marker
                    key={rider.id}
                    position={{
                      lat: rider.currentLocationObject!.lat,
                      lng: rider.currentLocationObject!.lng,
                    }}
                    onClick={() => setSelectedRider(rider)}
                    icon={{
                      url: rider.activeOrderId
                        ? "https://maps.google.com/mapfiles/ms/icons/motorcycling.png"
                        : `http://maps.google.com/mapfiles/ms/icons/${
                            statusColors[rider.status as keyof typeof statusColors] || 'red'
                          }-dot.png`,
                      scaledSize: new window.google.maps.Size(40, 40),
                    }}
                  />
                ))}

              {/* Show info window for selected rider */}
              {selectedRider && selectedRider.currentLocationObject && (
                <InfoWindow
                  position={{
                    lat: selectedRider.currentLocationObject.lat,
                    lng: selectedRider.currentLocationObject.lng,
                  }}
                  onCloseClick={() => setSelectedRider(null)}
                >
                  <div className="p-1 max-w-[220px]">
                    <h3 className="font-medium text-sm">{selectedRider.displayName}</h3>
                    <p className="text-xs text-gray-600">ID: RDR-{selectedRider.id}</p>
                    <div className="mt-1 text-xs">
                      <span className="font-medium">Status: </span>
                      <span className={`capitalize text-${
                        statusColors[selectedRider.status as keyof typeof statusColors] || 'gray'
                      }-600`}>
                        {selectedRider.status}
                      </span>
                    </div>
                    <div className="text-xs mt-1">
                      <span className="font-medium">Vehicle: </span>
                      {selectedRider.vehicleType}
                      {selectedRider.vehiclePlateNumber && ` (${selectedRider.vehiclePlateNumber})`}
                    </div>
                    {selectedRider.activeOrderId && (
                      <div className="text-xs mt-1">
                        <span className="font-medium">Active Order: </span>
                        #{selectedRider.activeOrderId}
                      </div>
                    )}
                    {selectedRider.lastUpdate && (
                      <div className="text-xs text-gray-500 mt-1">
                        Last updated: {new Date(selectedRider.lastUpdate).toLocaleTimeString()}
                      </div>
                    )}
                    {directions[selectedRider.id] && directions[selectedRider.id]?.routes[0]?.legs[0] && (
                      <div className="mt-1 pt-1 border-t border-gray-200">
                        <div className="flex items-center text-xs">
                          <Navigation className="h-3 w-3 mr-1 text-primary" />
                          <span className="font-medium">ETA: </span>
                          <span className="ml-1">
                            {directions[selectedRider.id]?.routes[0].legs[0].duration?.text}
                          </span>
                        </div>
                        <div className="text-xs">
                          <span className="font-medium">Distance: </span>
                          <span>
                            {directions[selectedRider.id]?.routes[0].legs[0].distance?.text}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>
        )}
      </CardContent>
    </Card>
  );
}
