import React, { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Order, OrderStatus, Restaurant, Rider } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { wsService } from "@/lib/websocket-service";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// Enhanced rider type with extra information from API
type EnhancedRider = Rider & {
  name?: string;
  phone?: string | null;
  currentLocation?: unknown;
}
import {
  ArrowLeft,
  Clock,
  MapPin,
  ChevronRight,
  Check,
  Truck,
  Package,
  ShoppingBag,
  AlertTriangle,
  Loader2,
  Store,
  Home,
  Briefcase
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import MapOrderTrackingFixed from "../../components/customer/map-order-tracking-fixed";
import RiderChat from "../../components/customer/rider-chat";
import FeedbackForm from "../../components/customer/feedback-form";

// Define enhanced types for use with map component
type EnhancedRiderForMap = EnhancedRider & {
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

const orderStatusSteps = [
  { status: OrderStatus.PENDING, label: "Order Placed", icon: ShoppingBag },
  { status: OrderStatus.CONFIRMED, label: "Confirmed", icon: Check },
  { status: OrderStatus.PREPARING, label: "Preparing", icon: Package },
  { status: OrderStatus.READY_FOR_PICKUP, label: "Ready for Pickup", icon: Package },
  { status: OrderStatus.PICKED_UP, label: "Picked Up", icon: Truck },
  { status: OrderStatus.ON_THE_WAY, label: "On the Way", icon: Truck },
  { status: OrderStatus.DELIVERED, label: "Delivered", icon: Check },
];

export default function OrderDetailsPage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/orders/:id");
  const orderId = params?.id;
  const [progress, setProgress] = useState(0);
  const [riderLocation, setRiderLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch order data
  const { data: order, isLoading: isLoadingOrder } = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
    enabled: !!orderId,
    // We'll replace polling with WebSocket
  });

  // Fetch restaurant data
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: [`/api/restaurants/${order?.restaurantId}`],
    enabled: !!order?.restaurantId,
  });

  // Fetch rider data if assigned
  const { data: rider } = useQuery<EnhancedRider>({
    queryKey: [`/api/riders/${order?.riderId}`],
    enabled: !!order?.riderId,
  });

  // Setup WebSocket connection for real-time order updates
  useEffect(() => {
    if (!user || !user.id || !order || !order.id) return;

    // Function to handle order status updates
    const handleOrderStatusUpdate = (data: any) => {
      console.log('Received order status update via WebSocket:', data);
      if (data.order && data.type === 'order_status_update') {
        // Only refetch this specific order if it matches our current order ID
        if (data.order.id.toString() === orderId) {
          queryClient.invalidateQueries({ queryKey: [`/api/orders/${orderId}`] });

          // If rider was assigned, fetch rider data
          if (data.order.riderId && !order.riderId) {
            queryClient.invalidateQueries({ queryKey: [`/api/riders/${data.order.riderId}`] });
          }

          // Show toast notification about the update
          toast({
            title: "Order Status Updated",
            description: `Your order status has changed to ${data.order.status}`,
          });
        }
      }
    };

    // Function to handle rider location updates
    const handleRiderLocationUpdate = (data: any) => {
      console.log('Received rider location update via WebSocket:', data);

      if (data.type === 'rider_location_update' && data.orderId && data.orderId.toString() === orderId) {
        // Check if this update is for our order
        if (order.riderId && data.riderId === order.riderId) {
          console.log('Updating rider location on map');
          // Update the rider location state
          setRiderLocation({
            latitude: data.location.latitude,
            longitude: data.location.longitude
          });

          // Update the rider in query cache with the new location
          const currentRider = queryClient.getQueryData([`/api/riders/${order.riderId}`]);
          if (currentRider) {
            queryClient.setQueryData([`/api/riders/${order.riderId}`], {
              ...currentRider,
              currentLocation: data.location
            });
          }
        }
      }
    };

    // Connect to WebSocket server and authenticate
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('customer', user.id, undefined, order.customerId);

        // Listen for order status updates
        wsService.on('order_status_update', handleOrderStatusUpdate);

        // Listen for rider location updates (if order is being delivered)
        if (['picked_up', 'on_the_way'].includes(order.status) && order.riderId) {
          wsService.on('rider_location_update', handleRiderLocationUpdate);
          console.log('WebSocket listening for rider location updates');
        }

        console.log('WebSocket connected for order status updates');
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      wsService.off('order_status_update', handleOrderStatusUpdate);
      wsService.off('rider_location_update', handleRiderLocationUpdate);
    };
  }, [user, order, orderId, queryClient, toast]);

  // Calculate progress when order status changes
  useEffect(() => {
    if (order) {
      // Calculate progress percentage based on order status
      const statusIndex = orderStatusSteps.findIndex(step => step.status === order.status);
      const progressPercentage = statusIndex === -1 ? 0 : (statusIndex / (orderStatusSteps.length - 1)) * 100;

      // Animate progress
      setProgress(progressPercentage);
    }
  }, [order]);

  const handleGoBack = () => {
    setLocation("/orders");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case OrderStatus.PENDING:
        return "outline";
      case OrderStatus.CONFIRMED:
      case OrderStatus.PREPARING:
      case OrderStatus.READY_FOR_PICKUP:
        return "secondary";
      case OrderStatus.PICKED_UP:
      case OrderStatus.ON_THE_WAY:
        return "default";
      case OrderStatus.DELIVERED:
        return "success";
      case OrderStatus.CANCELLED:
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case OrderStatus.PENDING:
        return "Pending";
      case OrderStatus.CONFIRMED:
        return "Confirmed";
      case OrderStatus.PREPARING:
        return "Preparing";
      case OrderStatus.READY_FOR_PICKUP:
        return "Ready for Pickup";
      case OrderStatus.PICKED_UP:
        return "Picked Up";
      case OrderStatus.ON_THE_WAY:
        return "On the Way";
      case OrderStatus.DELIVERED:
        return "Delivered";
      case OrderStatus.CANCELLED:
        return "Cancelled";
      default:
        return status;
    }
  };

  if (isLoadingOrder) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading order details...</span>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  if (!order) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground mb-6">
              We couldn't find the order you're looking for.
            </p>
            <Button onClick={() => setLocation("/orders")}>View All Orders</Button>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  const orderItems = Array.isArray(order.items) ? order.items : [];

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              className="mr-2"
              onClick={handleGoBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Orders
            </Button>
            <h1 className="text-2xl font-bold">Order #{orderId}</h1>
          </div>

          <Badge variant={getStatusBadgeVariant(order.status) as "default" | "destructive" | "outline" | "secondary"}>
            {getStatusLabel(order.status)}
          </Badge>
        </div>

        {/* Order Progress Tracker */}
        <Card className="mb-8">
          <CardContent className="p-6">
            {/* Progress Bar */}
            <div className="mb-8">
              <Progress value={progress} className="h-2" />
            </div>

            {/* Status Steps */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
              {orderStatusSteps.map((step, index) => {
                const currentStatusIndex = orderStatusSteps.findIndex(s => s.status === order.status);
                const isCompleted = index <= currentStatusIndex;
                const isActive = step.status === order.status;

                const IconComponent = step.icon;

                return (
                  <div
                    key={step.status}
                    className={`flex flex-col items-center text-center p-2 ${isActive ? 'bg-muted/50 rounded-lg' : ''}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                        isCompleted ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <span className={`text-xs font-medium ${
                      isActive ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Estimated Time */}
            {order.estimatedDeliveryTime && (
              <div className="mt-6 flex items-center justify-center text-sm">
                <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                <span>Estimated delivery by {new Date(order.estimatedDeliveryTime).toLocaleTimeString()}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            {/* Order Map */}
            <Card className="mb-6 overflow-hidden">
              <CardContent className="p-0 h-[450px]">
                <MapOrderTrackingFixed
                  order={{
                    ...order,
                    deliveryLatitude: parseFloat(order.deliveryAddress.split('(')[1]?.split(',')[0] || '0'),
                    deliveryLongitude: parseFloat(order.deliveryAddress.split(', ')[1]?.split(')')[0] || '0')
                  }}
                  restaurant={restaurant}
                  rider={{
                    ...(rider as EnhancedRiderForMap || {}),
                    // Override with real-time location updates if available
                    currentLocation: riderLocation || (rider as EnhancedRiderForMap)?.currentLocation
                  }}
                  isLiveTracking={riderLocation !== null && ['picked_up', 'on_the_way'].includes(order.status)}
                />
              </CardContent>
            </Card>

            {/* Order Details */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">Order Details</h2>

                <div className="space-y-4">
                  {/* Restaurant */}
                  <div className="flex items-start">
                    <div className="bg-muted rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-0.5">
                      <Store className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium">{restaurant?.name || 'Restaurant'}</h3>
                      <p className="text-sm text-muted-foreground">{restaurant?.address || 'Loading address...'}</p>
                    </div>
                  </div>

                  {/* Delivery Address */}
                  <div className="flex items-start">
                    <div className="bg-muted rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-0.5">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium">
                        Delivery Address
                      </h3>
                      <div className="flex items-center">
                        {order.deliveryLocationName && (
                          <div className="flex items-center mr-2">
                            {order.deliveryLocationName === "Home" && (
                              <div className="flex items-center text-primary">
                                <Home className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-medium">Home</span>
                              </div>
                            )}
                            {order.deliveryLocationName === "Work" && (
                              <div className="flex items-center text-indigo-500">
                                <Briefcase className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-medium">Work</span>
                              </div>
                            )}
                            {order.deliveryLocationName !== "Home" && order.deliveryLocationName !== "Work" && (
                              <Badge variant="outline" className="font-normal">
                                {order.deliveryLocationName}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Order Time */}
                  <div className="flex items-start">
                    <div className="bg-muted rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-0.5">
                      <Clock className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-medium">Order Time</h3>
                      <p className="text-sm text-muted-foreground">
                        {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  {order.specialInstructions && (
                    <div className="flex items-start">
                      <div className="bg-muted rounded-full w-8 h-8 flex items-center justify-center mr-3 mt-0.5">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-medium">Special Instructions</h3>
                        <p className="text-sm text-muted-foreground">{order.specialInstructions}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rider Information (if assigned) */}
            {rider && ['ready_for_pickup', 'picked_up', 'on_the_way', 'delivered'].includes(order.status) && (
              <Card className="mb-6">
                <CardContent className="p-6">
                  <h2 className="text-lg font-bold mb-4">Delivery Partner</h2>

                  <div className="flex items-center">
                    <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center mr-4">
                      <span className="text-primary font-bold">
                        {(rider.name && rider.name[0] || 'R').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-medium">{rider.name || 'Your Rider'}</h3>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          <span className="inline-block w-24 font-medium">Vehicle Type:</span>
                          {rider.vehicleType || 'Not specified'}
                        </p>
                        <p>
                          <span className="inline-block w-24 font-medium">Plate Number:</span>
                          {rider.vehiclePlateNumber || 'Not specified'}
                        </p>
                      </div>
                    </div>
                    {rider.phone && (
                      <Button
                        variant="outline"
                        className="ml-auto"
                        onClick={() => window.open(`tel:${rider.phone}`)}
                      >
                        Contact
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="md:col-span-1 space-y-6">
            {/* Rider Communication - Show when order is picked up */}
            {order.riderId && ['picked_up', 'on_the_way'].includes(order.status) && rider && (
              <RiderChat
                orderId={order.id}
                riderId={order.riderId}
                riderName={rider.name || `Rider ${order.riderId}`}
                riderPhone={rider.phone ?? undefined}
                customerId={order.customerId}
                orderStatus={order.status}
              />
            )}

            {/* Order Summary */}
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">Order Summary</h2>

                {/* Order Items */}
                <div className="space-y-3 mb-4">
                  {orderItems.map((item: any, index: number) => (
                    <div key={index} className="flex justify-between">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>

                <Separator className="my-4" />

                {/* Cost Breakdown */}
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.totalAmount - (order.deliveryFee || 0))}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      {order.metadata && (order.metadata as any).deliveryDistance && (
                        <span className="text-xs text-muted-foreground mt-1">
                          {((order.metadata as any).deliveryDistance).toFixed(1)} km distance
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(order.deliveryFee || 0)}</span>
                      {order.metadata && (order.metadata as any).deliveryDistance && order.deliveryFee && (
                        <span className="text-xs text-muted-foreground mt-1">
                          ₱30 base + ₱{(order.deliveryFee - 30).toFixed(2)} distance
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>

                {/* Payment Info */}
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Payment Method</span>
                    <span className="text-sm">
                      {order.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'GCash'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Payment Status</span>
                    <Badge variant={order.paymentStatus === 'paid' ? 'outline' : 'outline'}>
                      {order.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                    </Badge>
                  </div>
                </div>

                {/* Actions */}
                {order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED && (
                  <Button
                    variant="outline"
                    className="w-full mt-4"
                    onClick={() => setLocation(`/support/orders/${orderId}`)}
                  >
                    Need Help with Order?
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Feedback Form - Show after order is delivered */}
        {order.status === OrderStatus.DELIVERED && (
          <div className="mt-8">
            <FeedbackForm
              order={order}
              onFeedbackSubmitted={() => {
                toast({
                  title: "Feedback submitted!",
                  description: "Thank you for sharing your experience.",
                });
              }}
            />
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
