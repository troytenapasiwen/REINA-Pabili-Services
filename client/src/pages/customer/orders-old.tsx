import React from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Order, OrderStatus, Restaurant } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import {
  Clock,
  ChevronRight,
  ShoppingBag,
  AlertTriangle,
  Loader2,
  Store,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function OrdersPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Fetch customer orders
  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/customer"],
  });

  // Cancel order mutation
  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      return apiRequest(`/api/orders/${orderId}/cancel`, 'PATCH');
    },
    onSuccess: () => {
      toast({
        title: "Order Cancelled",
        description: "Your order has been successfully cancelled.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders/customer"] });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel the order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch restaurant data (filter out null restaurantIds)
  const restaurantIds = orders?.map(order => order.restaurantId).filter(id => id !== null) || [];
  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants/list", { ids: restaurantIds }],
    enabled: restaurantIds.length > 0,
  });

  const getRestaurantById = (id: number | null) => {
    if (id === null) return null;
    return restaurants?.find(restaurant => restaurant.id === id);
  };

  // Check if order can be cancelled (only pending orders)
  const canCancelOrder = (order: Order) => {
    return order.status === OrderStatus.PENDING;
  };

  const handleCancelOrder = (orderId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent card click navigation
    cancelOrderMutation.mutate(orderId);
  };

  const getStatusBadgeVariant = (status: string): "default" | "destructive" | "outline" | "secondary" => {
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
        return "secondary";
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

  // Group orders into active and past
  // Active orders include all orders that are not DELIVERED or CANCELLED
  const activeOrders = orders?.filter(order =>
    order.status !== OrderStatus.DELIVERED &&
    order.status !== OrderStatus.CANCELLED
  ) || [];

  // Past orders are only DELIVERED or CANCELLED
  const pastOrders = orders?.filter(order =>
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.CANCELLED
  ) || [];

  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <h1 className="text-2xl font-bold mb-6">Your Orders</h1>
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading your orders...</span>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Your Orders</h1>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="active">
              Active Orders
              {activeOrders.length > 0 && (
                <Badge className="ml-2">{activeOrders.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="past">Past Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeOrders.length > 0 ? (
              activeOrders.map(order => {
                const restaurant = getRestaurantById(order.restaurantId);
                const orderItems = Array.isArray(order.items) ? order.items : [];
                const totalItems = orderItems.reduce((sum, item: any) => sum + (item.quantity || 0), 0);

                return (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setLocation(`/orders/${order.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Store className="h-5 w-5 text-primary mr-2" />
                          <span className="font-medium">{restaurant?.name || 'Restaurant'}</span>
                        </div>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>

                      <div className="my-3 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{totalItems} items</span>
                          <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>Ordered on {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unknown date'}</span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <div>
                          <p className="text-sm">Order #{order.id}</p>
                        </div>
                        <div className="flex gap-2">
                          {canCancelOrder(order) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1 text-destructive hover:bg-destructive/10"
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={cancelOrderMutation.isPending}
                                >
                                  <X className="h-4 w-4" />
                                  Cancel
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel Order</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel order #{order.id}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep Order</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => handleCancelOrder(order.id, e)}
                                    className="bg-destructive hover:bg-destructive/90"
                                  >
                                    Cancel Order
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <Button variant="ghost" size="sm" className="gap-1">
                            Track Order <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-lg">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No active orders</h2>
                <p className="text-muted-foreground mb-6">You don't have any active orders at the moment</p>
                <Button onClick={() => setLocation("/")}>Browse Restaurants</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past" className="space-y-4">
            {pastOrders.length > 0 ? (
              pastOrders.map(order => {
                const restaurant = getRestaurantById(order.restaurantId);
                const orderItems = Array.isArray(order.items) ? order.items : [];
                const totalItems = orderItems.reduce((sum, item: any) => sum + (item.quantity || 0), 0);

                return (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setLocation(`/orders/${order.id}`)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Store className="h-5 w-5 text-primary mr-2" />
                          <span className="font-medium">{restaurant?.name || 'Restaurant'}</span>
                        </div>
                        <Badge variant={getStatusBadgeVariant(order.status)}>
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>

                      <div className="my-3 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">{totalItems} items</span>
                          <span className="font-medium">{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>
                            {order.status === OrderStatus.DELIVERED
                              ? `Delivered on ${order.actualDeliveryTime ? new Date(order.actualDeliveryTime).toLocaleDateString() : (order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unknown date')}`
                              : `Ordered on ${order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'Unknown date'}`
                            }
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center mt-2 pt-2 border-t">
                        <div>
                          <p className="text-sm">Order #{order.id}</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1">
                          View Details <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-12 bg-muted/20 rounded-lg">
                <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No order history</h2>
                <p className="text-muted-foreground mb-6">You haven't placed any orders yet</p>
                <Button onClick={() => setLocation("/")}>Start Ordering</Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CustomerLayout>
  );
}
