import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import RiderLayout from "@/layouts/RiderLayout";
import { apiRequest } from "@/lib/queryClient";
import { wsService } from "@/lib/websocket-service";
import { useLanguage } from "@/contexts/language-context";
import { Order, Rider, RiderStatus } from "@shared/schema";

// Extend Order type with restaurant and customer details
interface EnhancedOrder extends Order {
  // Restaurant details
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  restaurantLatitude?: number;
  restaurantLongitude?: number;

  // Customer details
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;

  // Queue information
  queueInfo?: {
    priority: number;
    isHighPriority: boolean;
    yourPosition: number;
    totalRiders: number;
  };
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

// Type for orders with restaurant location data
declare global {
  interface Window {
    GOOGLE_MAPS_API_KEY?: string;
  }
}
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Activity, Calendar, Clock, DollarSign, MapPin, Radio, ShoppingBag,
  Star, Navigation, CheckCircle, Users, TrendingUp, MapIcon, Route, Map, MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { RiderLocationTracker } from "@/components/rider/rider-location-tracker";
import { RestaurantDirections } from "@/components/rider/restaurant-directions";
import { RiderMapGoogleFixed } from "@/components/rider/rider-map-google-fixed";
import { OrderChat } from "@/components/messaging/order-chat";
import CustomerFeedbackForm from "@/components/rider/customer-feedback-form";

export default function RiderDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [viewOrderDetails, setViewOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<EnhancedOrder | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [chatOrderId, setChatOrderId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackOrder, setFeedbackOrder] = useState<EnhancedOrder | null>(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
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

  // Fetch available orders based on queue position
  const { data: availableOrders = [] } = useQuery<EnhancedOrder[]>({
    queryKey: ["/api/riders/available-orders"],
    enabled: !!user?.id && rider?.status === RiderStatus.ACTIVE,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch order history
  const { data: orderHistory = [] } = useQuery<Order[]>({
    queryKey: ["/api/riders/orders/history"],
    enabled: !!user?.id,
    refetchInterval: false,
  });

  // Accept order mutation
  const acceptOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/accept`, {});
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders/orders/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/riders/available-orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/riders/current"] });
      toast({
        title: "Order accepted",
        description: "You have accepted the delivery request and moved to the end of the queue",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/riders/orders/${orderId}/status`, { status });
      return await res.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders/orders/current"] });
      queryClient.invalidateQueries({ queryKey: ["/api/riders/orders/history"] });
      setViewOrderDetails(false);

      // Show feedback dialog if the order was marked as delivered
      if (variables.status === "delivered") {
        const deliveredOrder = currentOrders.find(order => order.id === variables.orderId);
        if (deliveredOrder) {
          setFeedbackOrder(deliveredOrder);
          setShowFeedbackDialog(true);
        }
      }

      toast({
        title: "Order updated",
        description: variables.status === "delivered" ? "Order delivered successfully!" : "The order status has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle accepting an order
  const handleAcceptOrder = (order: EnhancedOrder) => {
    acceptOrderMutation.mutate(order.id);
  };

  // Handle viewing order details
  const handleViewOrder = (order: EnhancedOrder) => {
    setSelectedOrder(order);
    setViewOrderDetails(true);
  };

  // Handle opening chat
  const handleOpenChat = (orderId: number) => {
    setChatOrderId(orderId);
    setShowChat(true);
  };

  // Function to render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">Pending</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Confirmed</Badge>;
      case "preparing":
        return <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200">Preparing</Badge>;
      case "ready_for_pickup":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-600 border-indigo-200">Ready for pickup</Badge>;
      case "picked_up":
        return <Badge variant="outline" className="bg-cyan-50 text-cyan-600 border-cyan-200">Picked up</Badge>;
      case "on_the_way":
        return <Badge variant="outline" className="bg-teal-50 text-teal-600 border-teal-200">On the way</Badge>;
      case "delivered":
        return <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">Delivered</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Check if rider can update to this status
  const canUpdateStatus = (currentStatus: string, newStatus: string) => {
    const statusFlow = {
      "confirmed": ["picked_up"],
      "ready_for_pickup": ["picked_up"],
      "picked_up": ["on_the_way"],
      "on_the_way": ["delivered"]
    };

    return statusFlow[currentStatus as keyof typeof statusFlow]?.includes(newStatus);
  };

  // Calculate rider's metrics
  const totalCompletedOrders = orderHistory.filter(order => order.status === "delivered").length;
  const totalEarnings = orderHistory
    .filter(order => order.status === "delivered")
    .reduce((sum, order) => sum + (order.deliveryFee || 0), 0);
  const todayEarnings = orderHistory
    .filter(order =>
      order.status === "delivered" &&
      order.createdAt &&
      new Date(order.createdAt).toDateString() === new Date().toDateString()
    )
    .reduce((sum, order) => sum + (order.deliveryFee || 0), 0);

  // Setup WebSocket connection for real-time order updates
  useEffect(() => {
    if (!user || !user.id || !rider || !rider.id) return;

    // Function to handle order status updates
    const handleOrderStatusUpdate = (data: any) => {
      console.log('Received order status update via WebSocket:', data);
      if (data.order && data.type === 'order_status_update') {
        // Refetch orders when we receive an update
        queryClient.invalidateQueries({ queryKey: ["/api/riders/orders/current"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders/available"] });

        // Show toast notification about the update
        toast({
          title: "Order Status Updated",
          description: `Order #${data.order.id} status changed to ${data.order.status}`,
        });
      }
    };

    // Function to handle queue position updates
    const handleQueuePositionUpdate = (data: any) => {
      console.log('Received queue position update via WebSocket:', data);
      if (data.type === 'queue_position_update') {
        // Refetch rider data to get updated queue position
        queryClient.invalidateQueries({ queryKey: ["/api/riders/current"] });

        // Show toast notification about the update
        toast({
          title: "Queue Position Updated",
          description: data.queuePosition !== null
            ? `Your queue position has been updated to #${data.queuePosition}`
            : "You have been removed from the queue",
        });
      }
    };

    // Connect to WebSocket server and authenticate
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('rider', user.id, rider.id);
        wsService.on('order_status_update', handleOrderStatusUpdate);
        wsService.on('queue_position_update', handleQueuePositionUpdate);
        console.log('WebSocket connected for order status and queue updates');
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      wsService.off('order_status_update', handleOrderStatusUpdate);
      wsService.off('queue_position_update', handleQueuePositionUpdate);
    };
  }, [user, rider, queryClient, toast]);

  return (
    <RiderLayout
      title="Rider Dashboard"
      description="Manage your deliveries and earnings"
    >
      {/* Rider Queue Status */}
      {rider && rider.status === RiderStatus.ACTIVE && (
        <Card className="mb-6 bg-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-primary mb-1">Queue Status</h3>
                {rider.queuePosition !== null ? (
                  <p className="text-sm">
                    You are in <span className="font-bold">position #{rider.queuePosition}</span> in the delivery queue. Orders will be suggested to you based on your position.
                  </p>
                ) : (
                  <p className="text-sm">
                    You are not currently in the delivery queue. Contact admin to be added to the queue.
                  </p>
                )}
              </div>
              <div className="p-3 bg-primary/20 rounded-full text-primary">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Today's Earnings</p>
                <h3 className="text-2xl font-bold">₱{todayEarnings.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-green-100 rounded-lg text-green-600">
                <DollarSign className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Total Earnings</p>
                <h3 className="text-2xl font-bold">₱{totalEarnings.toFixed(2)}</h3>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <TrendingUp className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Completed Orders</p>
                <h3 className="text-2xl font-bold">{totalCompletedOrders}</h3>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Current Status</p>
                <h3 className="text-2xl font-bold">{rider?.status || "Offline"}</h3>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                <Radio className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Navigation Button */}
      <div className="flex justify-end mb-4">
        <Link href="/rider/map">
          <a className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
            <Map className="h-4 w-4" />
            <span>Open Full Navigation Map</span>
          </a>
        </Link>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="current">
        <TabsList className="mb-4 grid w-full grid-cols-2 lg:grid-cols-4 h-auto p-1">
          <TabsTrigger value="current" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 sm:px-3 text-xs sm:text-sm">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Active Deliveries</span>
            <span className="sm:hidden">Active</span>
            {currentOrders.length > 0 && (
              <span className="bg-primary text-white rounded-full px-1.5 py-0.5 text-xs min-w-[18px] text-center">
                {currentOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="available" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 sm:px-3 text-xs sm:text-sm">
            <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Available Orders</span>
            <span className="sm:hidden">Available</span>
            {availableOrders.length > 0 && (
              <span className="bg-primary text-white rounded-full px-1.5 py-0.5 text-xs min-w-[18px] text-center">
                {availableOrders.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 sm:px-3 text-xs sm:text-sm">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Order History</span>
            <span className="sm:hidden">History</span>
          </TabsTrigger>
          <TabsTrigger value="location" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-2 sm:px-3 text-xs sm:text-sm">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Location Tracker</span>
            <span className="sm:hidden">Location</span>
          </TabsTrigger>
        </TabsList>

        {/* Current Deliveries */}
        <TabsContent value="current" className="mt-0">
          <div className="space-y-4">
            {currentOrders.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="flex flex-col items-center justify-center py-8">
                    <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No active deliveries</h3>
                    <p className="text-muted-foreground mb-4">You don't have any active deliveries at the moment.</p>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const element = document.querySelector('[data-value="available"]') as HTMLElement;
                        if (element) element.click();
                      }}
                    >
                      Check Available Orders
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              currentOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
                      <div className="flex-grow">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg">Order #{order.id}</h3>
                          {renderStatusBadge(order.status)}
                        </div>
                        <div className="grid gap-2 text-sm mb-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span className="text-xs sm:text-sm">{order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy - HH:mm') : 'N/A'}</span>
                          </div>
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm break-words">{order.deliveryAddress}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge variant="outline" className="bg-gray-50 text-xs">
                            ₱{order.deliveryFee?.toFixed(2) || '0.00'} Fee
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50 text-xs">
                            {order.paymentMethod === "cash_on_delivery" ? "COD" : order.paymentMethod}
                          </Badge>
                        </div>

                        {/* Restaurant & Customer Info */}
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Restaurant info */}
                          <div className="p-2 bg-muted/30 rounded-md">
                            <div className="font-medium text-sm mb-1">Restaurant</div>
                            <div className="text-sm flex items-center gap-1">
                              <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                              <span className="font-semibold">{order.restaurantName || `Restaurant #${order.restaurantId}`}</span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {order.restaurantAddress || 'Address unavailable'}
                            </div>
                          </div>

                          {/* Customer info - already accepted orders */}
                          <div className="p-2 bg-blue-50/50 rounded-md">
                            <div className="font-medium text-sm mb-1">Customer</div>
                            <div className="text-sm flex items-center gap-1">
                              <Users className="h-3 w-3 text-muted-foreground" />
                              <span className="font-semibold">{order.customerName || `Customer #${order.customerId}`}</span>
                            </div>
                            {order.customerPhone && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <span>Phone:</span> {order.customerPhone}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Navigation for Current Delivery */}
                        {order.restaurantLatitude && order.restaurantLongitude && (
                          <div className="mt-3">
                            <RiderMapGoogleFixed
                              currentLocation={userLocation}
                              source={{
                                latitude: order.restaurantLatitude,
                                longitude: order.restaurantLongitude,
                                name: order.restaurantName || `Restaurant #${order.restaurantId}`
                              }}
                              destination={{
                                latitude: extractLatitude(order.deliveryAddress),
                                longitude: extractLongitude(order.deliveryAddress),
                                address: order.deliveryAddress
                              }}
                              orderStatus={order.status}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button
                          onClick={() => handleViewOrder(order)}
                          className="w-full sm:flex-1 text-xs sm:text-sm"
                          size="sm"
                        >
                          View Details
                        </Button>

                        {/* Chat button - available when order is picked up or on the way */}
                        {(order.status === "picked_up" || order.status === "on_the_way" || order.status === "purchasing") && (
                          <Button
                            onClick={() => handleOpenChat(order.id)}
                            variant="outline"
                            className="w-full sm:flex-1 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 text-xs sm:text-sm"
                            size="sm"
                          >
                            <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Chat with Customer</span>
                            <span className="sm:hidden">Chat</span>
                          </Button>
                        )}
                        {/* Pabili Order Status Options */}
                        {order.isPabili && order.status === "purchasing" && (
                          <Button
                            variant="outline"
                            className="w-full sm:flex-1 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 text-xs sm:text-sm"
                            size="sm"
                            onClick={() => updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "on_the_way"
                            })}
                          >
                            <span className="hidden sm:inline">Items Purchased - On The Way</span>
                            <span className="sm:hidden">Purchased</span>
                          </Button>
                        )}

                        {/* Regular Restaurant Order Status Options */}
                        {!order.isPabili && order.status === "ready_for_pickup" && (
                          <Button
                            variant="outline"
                            className="w-full sm:flex-1 text-xs sm:text-sm"
                            size="sm"
                            onClick={() => updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "picked_up"
                            })}
                          >
                            Picked Up
                          </Button>
                        )}
                        {!order.isPabili && order.status === "picked_up" && (
                          <Button
                            variant="outline"
                            className="w-full sm:flex-1 text-xs sm:text-sm"
                            size="sm"
                            onClick={() => updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "on_the_way"
                            })}
                          >
                            On The Way
                          </Button>
                        )}

                        {/* Common "On The Way" to "Delivered" for both order types */}
                        {order.status === "on_the_way" && (
                          <Button
                            variant="outline"
                            className="w-full sm:flex-1 bg-green-50 text-green-600 border-green-200 hover:bg-green-100 hover:text-green-700 text-xs sm:text-sm"
                            size="sm"
                            onClick={() => updateOrderStatusMutation.mutate({
                              orderId: order.id,
                              status: "delivered"
                            })}
                          >
                            <span className="hidden sm:inline">Mark Delivered</span>
                            <span className="sm:hidden">Delivered</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Available Orders */}
        <TabsContent value="available" className="mt-0">
          {/* Queue Position Info */}
          {rider && rider.status === RiderStatus.ACTIVE && (
            <Card className="mb-4 bg-primary/10 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-primary mb-1">Queue-Based Order System</h3>
                    <p className="text-sm text-muted-foreground">
                      {rider.queuePosition !== null ? (
                        <>You are in position <span className="font-bold text-primary">#{rider.queuePosition}</span>. You can only see orders assigned to your queue position.</>
                      ) : (
                        <>You are not currently in the delivery queue. Contact admin to be added.</>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-primary/20 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {rider?.status !== RiderStatus.ACTIVE ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <Radio className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">You're currently offline</h3>
                  <p className="text-muted-foreground mb-4">Set your status to online to view and accept orders.</p>
                </div>
              </CardContent>
            </Card>
          ) : availableOrders.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No orders assigned to you</h3>
                  <p className="text-muted-foreground mb-4">
                    {rider?.queuePosition !== null
                      ? "No orders are currently assigned to your queue position. You'll be notified when one becomes available."
                      : "You need to be added to the rider queue to receive orders."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {availableOrders.map((order) => (
                <Card key={order.id} className="overflow-hidden border-primary/20 hover:border-primary/80 transition-colors">
                  <CardContent className="p-0">
                    <div className="p-3 sm:p-4 flex flex-col gap-3 sm:gap-4">
                      <div className="flex-grow">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                          <h3 className="font-semibold text-base sm:text-lg">Order #{order.id}</h3>
                          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            {renderStatusBadge(order.status)}
                            <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                              Ready for Pickup
                            </Badge>
                            {/* Queue Priority Indicator */}
                            {order.queueInfo && (
                              <Badge
                                variant={order.queueInfo.isHighPriority ? "default" : "outline"}
                                className={`text-xs ${
                                  order.queueInfo.isHighPriority
                                    ? "bg-green-600 text-white border-green-600"
                                    : "bg-gray-50 text-gray-600 border-gray-300"
                                }`}
                              >
                                {order.queueInfo.isHighPriority ? "Your Priority" : `Priority #${order.queueInfo.priority}`}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Queue Information Display */}
                        {order.queueInfo && order.queueInfo.totalRiders > 0 && (
                          <div className="mb-3 p-2 bg-blue-50/50 rounded-md border border-blue-200">
                            <div className="text-xs text-blue-700 font-medium mb-1">Queue Information</div>
                            <div className="text-xs text-blue-600">
                              Your position: #{order.queueInfo.yourPosition} of {order.queueInfo.totalRiders} riders
                              {order.queueInfo.isHighPriority && (
                                <span className="ml-2 font-semibold text-green-600">• You have priority for this order</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Restaurant info */}
                        <div className="mb-3 p-2 bg-muted/30 rounded-md">
                          <div className="font-medium text-sm mb-1">Restaurant Information</div>
                          <div className="text-sm flex items-center gap-1">
                            <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                            <span className="font-semibold">{order.restaurantName || `Restaurant #${order.restaurantId}`}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {order.restaurantAddress || 'Address unavailable'}
                          </div>
                        </div>

                        {/* Hide customer details on available orders */}
                        <div className="mb-3 p-2 bg-blue-50/50 rounded-md">
                          <div className="font-medium text-sm mb-1">Customer</div>
                          <div className="text-sm flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Details available after accepting order</span>
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm mb-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span className="text-xs sm:text-sm">{order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy - HH:mm') : 'N/A'}</span>
                          </div>
                          <div className="flex items-start gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                              <div className="font-medium text-xs">Delivery Address:</div>
                              <span className="text-xs sm:text-sm break-words">{order.deliveryAddress}</span>
                            </div>
                          </div>
                        </div>

                        {/* Restaurant Directions */}
                        {order.restaurantLatitude && order.restaurantLongitude && (
                          <div className="mb-3">
                            <RestaurantDirections
                              restaurantLocation={{
                                latitude: order.restaurantLatitude,
                                longitude: order.restaurantLongitude
                              }}
                              restaurantName={order.restaurantName || `Restaurant #${order.restaurantId}`}
                              userLocation={userLocation}
                            />
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200 text-xs">
                            ₱{order.deliveryFee?.toFixed(2) || '0.00'} Fee
                          </Badge>
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 text-xs">
                            {order.paymentMethod === "cash_on_delivery" ? "COD" :
                             order.paymentMethod === "gcash" ? "GCash" : order.paymentMethod}
                          </Badge>
                          <Badge variant="outline" className="bg-purple-50 text-purple-600 border-purple-200 text-xs">
                            {(order.items && typeof order.items === 'object' && Array.isArray(order.items) ? order.items.length : 0)} items
                          </Badge>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button
                          onClick={() => handleViewOrder(order)}
                          variant="outline"
                          className="w-full sm:flex-1 text-xs sm:text-sm"
                          size="sm"
                        >
                          View Details
                        </Button>
                        <Button
                          onClick={() => handleAcceptOrder(order)}
                          disabled={acceptOrderMutation.isPending}
                          className="w-full sm:flex-1 bg-primary hover:bg-primary/90 text-white text-xs sm:text-sm"
                          size="sm"
                        >
                          {acceptOrderMutation.isPending ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span className="hidden sm:inline">Processing...</span>
                              <span className="sm:hidden">...</span>
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Accept Order</span>
                              <span className="sm:hidden">Accept</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Location Tracker */}
        <TabsContent value="location" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {rider && (
                <RiderLocationTracker
                  riderId={rider.id}
                  hasActiveOrders={currentOrders && currentOrders.length > 0}
                />
              )}
            </div>
            <div>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">About Location Tracking</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <h4 className="font-medium">How it works</h4>
                    <p className="text-muted-foreground">
                      When you enable location tracking, your current position will be sent to our system every 20 seconds.
                      This helps customers and restaurants track their deliveries in real-time.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Privacy</h4>
                    <p className="text-muted-foreground">
                      Your location is only shared while you are on duty and have active deliveries.
                      Location data is not stored permanently and is only used for the purpose of delivery tracking.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">Battery Usage</h4>
                    <p className="text-muted-foreground">
                      Location tracking may use additional battery. For optimal battery life, you can stop tracking when not actively delivering.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Order History */}
        <TabsContent value="history" className="mt-0">
          {orderHistory.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center">
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No order history</h3>
                  <p className="text-muted-foreground">You haven't completed any deliveries yet.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {orderHistory.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-grow">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg">Order #{order.id}</h3>
                          {renderStatusBadge(order.status)}
                        </div>
                        <div className="grid gap-1 text-sm mb-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy - HH:mm') : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                            <span className="truncate">{order.deliveryAddress}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-gray-50">
                            ₱{order.deliveryFee?.toFixed(2) || '0.00'} Delivery Fee
                          </Badge>
                          <Badge variant="outline" className="bg-gray-50">
                            {order.paymentMethod === "cash_on_delivery" ? "COD" : order.paymentMethod}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <Button
                          onClick={() => handleViewOrder(order)}
                          variant="outline"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={viewOrderDetails} onOpenChange={setViewOrderDetails}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Review the details of this order.
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="grid gap-4 py-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="font-medium">Order #{selectedOrder.id}</h3>
                {renderStatusBadge(selectedOrder.status)}
              </div>

              <div className="text-sm grid gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {selectedOrder.createdAt
                      ? format(new Date(selectedOrder.createdAt), 'MMM dd, yyyy - HH:mm')
                      : 'N/A'}
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <span>{selectedOrder.deliveryAddress}</span>
                </div>

                {/* Customer info - show details only for accepted orders */}
                {selectedOrder.riderId ? (
                  <div className="p-2 bg-blue-50/50 rounded-md">
                    <div className="font-medium text-sm mb-1">Customer Information</div>
                    <div className="text-sm flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="font-semibold">{selectedOrder.customerName || `Customer #${selectedOrder.customerId}`}</span>
                    </div>
                    {selectedOrder.customerPhone && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <span>Phone:</span> {selectedOrder.customerPhone}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2 bg-blue-50/50 rounded-md">
                    <div className="font-medium text-sm mb-1">Customer</div>
                    <div className="text-sm flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Details available after accepting order</span>
                    </div>
                  </div>
                )}

                {/* Restaurant info */}
                <div className="p-2 bg-muted/30 rounded-md">
                  <div className="font-medium text-sm mb-1">Restaurant Information</div>
                  <div className="text-sm flex items-center gap-1">
                    <ShoppingBag className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">{selectedOrder.restaurantName || `Restaurant #${selectedOrder.restaurantId}`}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedOrder.restaurantAddress || 'Address unavailable'}
                  </div>
                </div>
              </div>

              <div className="border rounded-md p-3">
                <h4 className="font-medium mb-2">Order Items</h4>
                <ul className="space-y-2 text-sm">
                  {(selectedOrder.items as any[])?.map((item, index) => (
                    <li key={index} className="flex justify-between">
                      <span>
                        {item.quantity || 1}x {item.name || `Item #${index + 1}`}
                      </span>
                      <span className="font-medium">₱{item.price?.toFixed(2) || '0.00'}</span>
                    </li>
                  )) || <li>No items found</li>}
                </ul>
                <div className="border-t mt-2 pt-2 flex justify-between font-medium">
                  <span>Subtotal</span>
                  <span>₱{selectedOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Delivery Fee</span>
                  <span>₱{selectedOrder.deliveryFee?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="border-t mt-2 pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>₱{(selectedOrder.totalAmount + (selectedOrder.deliveryFee || 0)).toFixed(2)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-1">Payment Method</h4>
                  <p className="capitalize">{selectedOrder.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : selectedOrder.paymentMethod}</p>
                </div>
                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-1">Payment Status</h4>
                  <p className="capitalize">{selectedOrder.paymentStatus || "Pending"}</p>
                </div>
              </div>

              {selectedOrder.specialInstructions && (
                <div className="border rounded-md p-3">
                  <h4 className="font-medium mb-1">Special Instructions</h4>
                  <p className="text-sm">{selectedOrder.specialInstructions}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button onClick={() => setViewOrderDetails(false)} variant="outline" className="sm:flex-1">
              Close
            </Button>

            {/* Show update status buttons based on current status */}
            {selectedOrder && selectedOrder.status === "ready_for_pickup" && (
              <Button
                onClick={() => updateOrderStatusMutation.mutate({
                  orderId: selectedOrder.id,
                  status: "picked_up"
                })}
                className="sm:flex-1"
              >
                Mark as Picked Up
              </Button>
            )}

            {selectedOrder && selectedOrder.status === "picked_up" && (
              <Button
                onClick={() => updateOrderStatusMutation.mutate({
                  orderId: selectedOrder.id,
                  status: "on_the_way"
                })}
                className="sm:flex-1"
              >
                Mark as On The Way
              </Button>
            )}

            {selectedOrder && selectedOrder.status === "on_the_way" && (
              <Button
                onClick={() => updateOrderStatusMutation.mutate({
                  orderId: selectedOrder.id,
                  status: "delivered"
                })}
                className="sm:flex-1 bg-green-600 hover:bg-green-700"
              >
                Mark as Delivered
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Dialog */}
      {showChat && chatOrderId && (
        <OrderChat
          orderId={chatOrderId}
          isOpen={showChat}
          onClose={() => {
            setShowChat(false);
            setChatOrderId(null);
          }}
          currentUserRole="rider"
        />
      )}

      {/* Customer Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rate Customer Experience</DialogTitle>
            <DialogDescription>
              Please take a moment to rate your experience with this customer.
            </DialogDescription>
          </DialogHeader>
          {feedbackOrder && (
            <CustomerFeedbackForm
              order={feedbackOrder as Order}
              onFeedbackSubmitted={() => {
                setShowFeedbackDialog(false);
                setFeedbackOrder(null);
                toast({
                  title: "Thank you!",
                  description: "Your feedback helps improve our service.",
                });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </RiderLayout>
  );
}
