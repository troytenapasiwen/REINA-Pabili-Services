import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import RiderLayout from "@/layouts/RiderLayout";
import { useAuth } from "@/hooks/use-auth";
import { Order, Rider } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Map, Navigation, Route, Crosshair } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RiderMapGoogleFixed } from "@/components/rider/rider-map-google-fixed";
import { RiderLocationTracker } from "@/components/rider/rider-location-tracker";

// Extend Order type with restaurant details
interface EnhancedOrder extends Order {
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantLatitude?: number;
  restaurantLongitude?: number;
  customerName?: string;
  customerPhone?: string;
}

// Helper functions for extracting coordinates from address strings
function extractLatitude(address: string): number {
  try {
    // Try to extract from format like "Name (13.123456, 123.456789)"
    const match = address.match(/\((-?\d+\.\d+),/);
    if (match && match[1]) {
      const lat = parseFloat(match[1]);
      return !isNaN(lat) ? lat : 14.5995; // Default to Manila if parsing fails
    }
    return 14.5995; // Default to Manila
  } catch (error) {
    console.error("Error extracting latitude", error);
    return 14.5995; // Default to Manila
  }
}

function extractLongitude(address: string): number {
  try {
    // Try to extract from format like "Name (13.123456, 123.456789)"
    const match = address.match(/,\s*(-?\d+\.\d+)\)/);
    if (match && match[1]) {
      const lng = parseFloat(match[1]);
      return !isNaN(lng) ? lng : 120.9842; // Default to Manila if parsing fails
    }
    return 120.9842; // Default to Manila
  } catch (error) {
    console.error("Error extracting longitude", error);
    return 120.9842; // Default to Manila
  }
}

export default function RiderMapPage() {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<EnhancedOrder | null>(null);
  const queryClient = useQueryClient();

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );

      // Clean up by clearing the watch when component unmounts
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      console.error("Geolocation is not supported by this browser");
    }
  }, []);

  // Fetch rider details
  const { data: rider } = useQuery<Rider>({
    queryKey: ["/api/riders/current"],
    enabled: !!user?.id,
  });

  // Fetch current deliveries
  const { data: currentOrders = [] } = useQuery<EnhancedOrder[]>({
    queryKey: ["/api/riders/orders/current"],
    enabled: !!user?.id,
  });

  // Find the active delivery if there is one
  useEffect(() => {
    if (currentOrders && currentOrders.length > 0) {
      // Auto-select the first active order for navigation
      setSelectedOrder(currentOrders[0]);
    } else {
      setSelectedOrder(null);
    }
  }, [currentOrders]);

  // When a different order is selected
  const handleSelectOrder = (order: EnhancedOrder) => {
    setSelectedOrder(order);
  };

  return (
    <RiderLayout
      title="Navigation Map"
      description="View your delivery routes and navigate to destinations"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Map - Takes 2/3 of the screen on larger devices */}
        <div className="md:col-span-2">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle>Route Navigation</CardTitle>
            </CardHeader>
            <CardContent>
              {!userLocation ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Enable location services to see your position and get directions.
                  </AlertDescription>
                </Alert>
              ) : !selectedOrder ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-center">
                  <Map className="h-16 w-16 text-muted-foreground mb-4 opacity-20" />
                  <h3 className="text-lg font-medium mb-2">No Active Deliveries</h3>
                  <p className="text-muted-foreground mb-4 max-w-md">
                    You don't have any active deliveries to navigate to. Accept a delivery to see navigation directions.
                  </p>
                </div>
              ) : (
                <RiderMapGoogleFixed
                  currentLocation={userLocation}
                  source={selectedOrder.restaurantLatitude && selectedOrder.restaurantLongitude ? {
                    latitude: selectedOrder.restaurantLatitude,
                    longitude: selectedOrder.restaurantLongitude,
                    name: selectedOrder.restaurantName || `Restaurant #${selectedOrder.restaurantId}`
                  } : undefined}
                  destination={{
                    latitude: extractLatitude(selectedOrder.deliveryAddress),
                    longitude: extractLongitude(selectedOrder.deliveryAddress),
                    address: selectedOrder.deliveryAddress
                  }}
                  orderStatus={selectedOrder.status}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Control Panel - Takes 1/3 of the screen on larger devices */}
        <div>
          <div className="space-y-6">
            {/* Location Tracker */}
            {rider?.id && (
              <RiderLocationTracker
                riderId={rider.id}
                userLocation={userLocation}
              />
            )}

            {/* Current Deliveries */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Active Deliveries</CardTitle>
              </CardHeader>
              <CardContent>
                {currentOrders.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No active deliveries</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentOrders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-3 border rounded-md cursor-pointer ${
                          selectedOrder?.id === order.id ? 'border-primary bg-primary/5' : 'bg-card'
                        }`}
                        onClick={() => handleSelectOrder(order)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium">Order #{order.id}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {order.restaurantName || `Restaurant #${order.restaurantId}`}
                            </p>
                          </div>
                          <Badge variant="outline">{order.status.replace('_', ' ')}</Badge>
                        </div>

                        <div className="flex items-center gap-2 text-sm">
                          <Crosshair className="h-4 w-4 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {order.deliveryAddress}
                          </span>
                        </div>

                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOrder(order);
                            }}
                            className={selectedOrder?.id === order.id ? 'bg-primary text-primary-foreground' : ''}
                          >
                            <Navigation className="h-4 w-4 mr-1" />
                            {selectedOrder?.id === order.id ? 'Selected' : 'Navigate'}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </RiderLayout>
  );
}
