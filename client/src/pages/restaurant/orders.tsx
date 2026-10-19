import React, { useState, useEffect } from "react";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Order, OrderStatus, Feedback } from "@shared/schema";
import { Calendar, ArrowRight, Clock, CheckCheck, ClipboardList, CheckCircle, ChefHat, PackageCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import { wsService } from "@/lib/websocket-service";

export default function RestaurantOrders() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);

  // Setup queryClient for data fetching and caching
  const queryClient = useQueryClient();

  // Get restaurant data for the logged-in user
  const { data: restaurant } = useQuery({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // Extract restaurant ID for queries
  const restaurantId = restaurant?.id;

  // Setup WebSocket connection for real-time order updates
  useEffect(() => {
    if (!restaurant || !user) return;

    // Function to handle order status updates
    const handleOrderStatusUpdate = (data: any) => {
      console.log('Received order status update via WebSocket:', data);
      if (data.order && data.type === 'order_status_update') {
        // Refetch orders when we receive an update
        queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orders"] });

        // Show toast notification about the update
        toast({
          title: "Order Status Updated",
          description: `Order #${data.order.id} status changed to ${data.order.status}`,
        });
      }
    };

    // Connect to WebSocket server and authenticate
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('restaurant', user.id, restaurant.id);
        wsService.on('order_status_update', handleOrderStatusUpdate);
        console.log('WebSocket connected for order status updates');
      } catch (error) {
        console.error('Error connecting to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      wsService.off('order_status_update', handleOrderStatusUpdate);
    };
  }, [restaurant, user, queryClient, toast]);

  // Fetch orders
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/restaurant-orders"],
    enabled: !!restaurantId,
  });

  // Filter orders
  const filteredOrders = React.useMemo(() => {
    return orders?.filter(order => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      const matchesDate = !orderDate ||
        (new Date(order.createdAt).toDateString() === orderDate.toDateString());

      return matchesStatus && matchesDate;
    }) || [];
  }, [orders, statusFilter, orderDate]);

  // Group orders by status
  const ordersByStatus = React.useMemo(() => {
    const grouped: Record<string, Order[]> = {
      pending: [],
      confirmed: [],
      preparing: [],
      ready_for_pickup: [],
      picked_up: [],
      on_the_way: [],
      delivered: [],
      cancelled: [],
    };

    filteredOrders.forEach(order => {
      if (grouped[order.status]) {
        grouped[order.status].push(order);
      }
    });

    return grouped;
  }, [filteredOrders]);

  // Get orders that are ready for pickup and not yet assigned to riders
  const readyForPickupOrders = React.useMemo(() => {
    return filteredOrders.filter(order =>
      order.status === OrderStatus.READY_FOR_PICKUP && !order.riderId
    );
  }, [filteredOrders]);

  // Split orders into active and completed
  const activeOrders = React.useMemo(() => {
    return filteredOrders.filter(order =>
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.CANCELLED
    );
  }, [filteredOrders]);

  const completedOrders = React.useMemo(() => {
    return filteredOrders.filter(order =>
      order.status === OrderStatus.DELIVERED ||
      order.status === OrderStatus.CANCELLED
    );
  }, [filteredOrders]);

  // State for success dialog (when an order is marked ready for pickup)
  const [readySuccessDialogOpen, setReadySuccessDialogOpen] = useState(false);
  const [readyOrder, setReadyOrder] = useState<Order | null>(null);

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/status`, { status });
      return await res.json();
    },
    onSuccess: (updatedOrder, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant-orders"] });

      // If the order was marked as ready for pickup, show the success dialog
      if (variables.status === OrderStatus.READY_FOR_PICKUP) {
        setReadyOrder(updatedOrder);
        setReadySuccessDialogOpen(true);
      } else {
        toast({
          title: "Order status updated",
          description: "The order status has been updated successfully",
        });
      }
      setStatusDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update order status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle order row click
  const handleOrderRowClick = (order: Order) => {
    setSelectedOrder(order);
  };

  // Handle status update click
  const handleStatusUpdateClick = (order: Order) => {
    setSelectedOrder(order);
    setNewStatus(getNextStatus(order.status));
    setStatusDialogOpen(true);
  };

  // Get next logical status
  const getNextStatus = (currentStatus: string): string => {
    switch (currentStatus) {
      case OrderStatus.PENDING:
        return OrderStatus.CONFIRMED;
      case OrderStatus.CONFIRMED:
        return OrderStatus.READY_FOR_PICKUP;
      case OrderStatus.READY_FOR_PICKUP:
        return OrderStatus.PICKED_UP;
      default:
        return currentStatus;
    }
  };

  // Handle status update submission
  const handleStatusUpdate = () => {
    if (selectedOrder && newStatus) {
      updateOrderStatusMutation.mutate({
        orderId: selectedOrder.id,
        status: newStatus
      });
    }
  };

  // Order table columns
  const orderColumns = [
    {
      header: "Order #",
      accessorKey: "id",
      cell: (row: Order) => <span className="font-medium">#{row.id.toString().padStart(4, '0')}</span>,
    },
    {
      header: "Customer",
      accessorKey: "customerId",
      cell: (row: any) => {
        if (row.customerName) {
          return (
            <div className="flex flex-col">
              <span className="font-medium">{row.customerName}</span>
              {row.customerPhone && (
                <span className="text-xs text-muted-foreground">{row.customerPhone}</span>
              )}
            </div>
          );
        }
        return `Customer #${row.customerId}`;
      },
    },
    {
      header: "Items",
      accessorKey: "items",
      cell: (row: Order) => {
        // Check if items exists and is an array
        if (Array.isArray(row.items)) {
          return row.items.length.toString();
        }
        return "N/A";
      },
    },
    {
      header: "Total",
      accessorKey: "totalAmount",
      cell: (row: Order) => {
        // Check if totalAmount exists and is a number
        if (typeof row.totalAmount === 'number') {
          return `₱${row.totalAmount.toFixed(2)}`;
        }
        return "₱0.00";
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: Order) => <StatusBadge status={row.status} />,
    },
    {
      header: "Time",
      accessorKey: (row: Order) => {
        const date = new Date(row.createdAt);
        return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      },
    },
    {
      header: "Actions",
      accessorKey: (row: Order) => {
        // Different actions based on order status
        return (
          <div className="flex space-x-2">
            {row.status === OrderStatus.PENDING && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  // Set directly to CONFIRMED status
                  setSelectedOrder(row);
                  setNewStatus(OrderStatus.CONFIRMED);
                  setStatusDialogOpen(true);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirm
              </Button>
            )}

            {row.status === OrderStatus.CONFIRMED && (
              <Button
                variant="success"
                size="sm"
                className="flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  // Set directly to READY_FOR_PICKUP status
                  setSelectedOrder(row);
                  setNewStatus(OrderStatus.READY_FOR_PICKUP);
                  setStatusDialogOpen(true);
                }}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                Mark Ready
              </Button>
            )}

            {row.status === OrderStatus.PREPARING && (
              <Button
                variant="success"
                size="sm"
                className="flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  // Set directly to READY_FOR_PICKUP status
                  setSelectedOrder(row);
                  setNewStatus(OrderStatus.READY_FOR_PICKUP);
                  setStatusDialogOpen(true);
                }}
              >
                <PackageCheck className="h-4 w-4 mr-1" />
                Mark Ready
              </Button>
            )}

            {row.status !== OrderStatus.PENDING &&
             row.status !== OrderStatus.CONFIRMED &&
             row.status !== OrderStatus.PREPARING &&
             row.status !== OrderStatus.DELIVERED &&
             row.status !== OrderStatus.CANCELLED && (
              <Button
                variant="outline"
                size="sm"
                className="flex items-center"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdateClick(row);
                }}
              >
                <ArrowRight className="h-4 w-4 mr-1" />
                Update
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  // Order details to show in dialog
  const orderDetails = selectedOrder ? [
    { label: "Order Number", value: `#${selectedOrder.id.toString().padStart(4, '0')}` },
    { label: "Customer", value: (
      <span>
        {(selectedOrder as any).customerName ?
          <>
            <span className="font-medium">{(selectedOrder as any).customerName}</span>
            {(selectedOrder as any).customerPhone && (
              <span className="block text-xs text-muted-foreground">{(selectedOrder as any).customerPhone}</span>
            )}
          </> :
          `Customer #${selectedOrder.customerId}`
        }
      </span>
    ) },
    { label: "Date", value: new Date(selectedOrder.createdAt).toLocaleString() },
    { label: "Total Amount", value: typeof selectedOrder.totalAmount === 'number' ? `₱${selectedOrder.totalAmount.toFixed(2)}` : '₱0.00' },
    { label: "Status", value: <StatusBadge status={selectedOrder.status} /> },
    { label: "Payment Method", value: selectedOrder.paymentMethod },
    { label: "Payment Status", value: selectedOrder.paymentStatus },
    { label: "Delivery Address", value: selectedOrder.deliveryAddress || "N/A" },
  ] : [];

  // Custom filters component
  const customFilter = (
    <div className="flex flex-wrap gap-2">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value={OrderStatus.PENDING}>Pending</SelectItem>
          <SelectItem value={OrderStatus.CONFIRMED}>Confirmed</SelectItem>
          <SelectItem value={OrderStatus.PREPARING}>Preparing</SelectItem>
          <SelectItem value={OrderStatus.READY_FOR_PICKUP}>Ready for Pickup</SelectItem>
          <SelectItem value={OrderStatus.PICKED_UP}>Picked Up</SelectItem>
          <SelectItem value={OrderStatus.ON_THE_WAY}>On the Way</SelectItem>
          <SelectItem value={OrderStatus.DELIVERED}>Delivered</SelectItem>
          <SelectItem value={OrderStatus.CANCELLED}>Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !orderDate && "text-muted-foreground"
            )}
          >
            <Calendar className="mr-2 h-4 w-4" />
            {orderDate ? format(orderDate, "PPP") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={orderDate}
            onSelect={setOrderDate}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {orderDate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOrderDate(undefined)}
        >
          Clear Date
        </Button>
      )}
    </div>
  );

  return (
    <RestaurantLayout title="Order Management" description="Manage and track restaurant orders">
      {/* Orders Ready for Pickup */}
      {readyForPickupOrders.length > 0 && (
        <Card className="mb-6 border-green-500 bg-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-green-700 flex items-center">
              <PackageCheck className="mr-2 h-5 w-5" />
              Orders Ready for Pickup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyForPickupOrders.map(order => (
                <Card key={order.id} className="bg-white border-green-300 hover:border-green-500 cursor-pointer transition-colors"
                  onClick={() => handleOrderRowClick(order)}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-green-800">Order #{order.id.toString().padStart(4, '0')}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      {/* Customer info if available */}
                      {(order as any).customerName && (
                        <div className="mb-2 pb-2 border-b border-green-100">
                          <span className="font-medium text-green-700 block">{(order as any).customerName}</span>
                          {(order as any).customerPhone && (
                            <span className="text-xs text-muted-foreground block">{(order as any).customerPhone}</span>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Items:</span>
                        <span className="font-medium">{Array.isArray(order.items) ? order.items.length : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Total:</span>
                        <span className="font-medium">
                          {typeof order.totalAmount === 'number' ? `₱${order.totalAmount.toFixed(2)}` : '₱0.00'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Time:</span>
                        <span className="font-medium">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Order Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-4 flex items-center">
            <div className="rounded-full bg-amber-100 p-2 mr-4">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600">Pending</p>
              <h3 className="text-2xl font-bold text-amber-800">
                {ordersByStatus.pending?.length || 0}
              </h3>
              <p className="text-xs text-amber-600">
                Need confirmation
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center">
            <div className="rounded-full bg-blue-100 p-2 mr-4">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Processing</p>
              <h3 className="text-2xl font-bold text-blue-800">
                {(ordersByStatus.confirmed?.length || 0) +
                 (ordersByStatus.preparing?.length || 0)}
              </h3>
              <p className="text-xs text-blue-600">
                In progress
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center">
            <div className="rounded-full bg-green-100 p-2 mr-4">
              <CheckCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Ready</p>
              <h3 className="text-2xl font-bold text-green-800">
                {ordersByStatus.ready_for_pickup?.length || 0}
              </h3>
              <p className="text-xs text-green-600">
                For pickup
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 flex items-center">
            <div className="rounded-full bg-purple-100 p-2 mr-4">
              <ArrowRight className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Completed</p>
              <h3 className="text-2xl font-bold text-purple-800">
                {(ordersByStatus.picked_up?.length || 0) +
                 (ordersByStatus.on_the_way?.length || 0) +
                 (ordersByStatus.delivered?.length || 0)}
              </h3>
              <p className="text-xs text-purple-600">
                Today's total
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orders Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="active">
            Active Orders
            {activeOrders.length > 0 && (
              <Badge className="ml-2">{activeOrders.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">Completed Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Active Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={activeOrders}
                columns={orderColumns}
                isLoading={isLoadingOrders || !restaurantId}
                searchPlaceholder="Search orders..."
                onRowClick={handleOrderRowClick}
                customFilter={customFilter}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="completed">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Completed Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={completedOrders}
                columns={orderColumns}
                isLoading={isLoadingOrders || !restaurantId}
                searchPlaceholder="Search orders..."
                onRowClick={handleOrderRowClick}
                customFilter={customFilter}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Status Update Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {selectedOrder && (
                <div className="flex items-center justify-center space-x-4 py-2">
                  <StatusBadge status={selectedOrder.status} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select new status" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedOrder.status === OrderStatus.PENDING && (
                        <SelectItem value={OrderStatus.CONFIRMED}>Confirm Order</SelectItem>
                      )}
                      {selectedOrder.status === OrderStatus.CONFIRMED && (
                        <>
                          <SelectItem value={OrderStatus.PREPARING}>Start Preparing</SelectItem>
                          <SelectItem value={OrderStatus.READY_FOR_PICKUP}>Ready for Pickup</SelectItem>
                        </>
                      )}
                      {selectedOrder.status === OrderStatus.PREPARING && (
                        <SelectItem value={OrderStatus.READY_FOR_PICKUP}>Ready for Pickup</SelectItem>
                      )}
                      {selectedOrder.status === OrderStatus.READY_FOR_PICKUP && (
                        <SelectItem value={OrderStatus.PICKED_UP}>Picked Up</SelectItem>
                      )}
                      <SelectItem value={OrderStatus.CANCELLED}>Cancel Order</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Order Details</h4>
                <div className="text-sm">
                  {selectedOrder && (
                    <div className="rounded-md border p-3 space-y-2">
                      {orderDetails.map((detail, index) => (
                        <div key={index} className="flex justify-between">
                          <span className="text-muted-foreground">{detail.label}:</span>
                          <span className="font-medium">{detail.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={updateOrderStatusMutation.isPending}
            >
              {updateOrderStatusMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                  Updating...
                </>
              ) : (
                newStatus === OrderStatus.CONFIRMED ? "Confirm Order" :
                newStatus === OrderStatus.PREPARING ? "Start Preparing" :
                newStatus === OrderStatus.READY_FOR_PICKUP ? "Mark as Ready" :
                newStatus === OrderStatus.PICKED_UP ? "Mark as Picked Up" :
                newStatus === OrderStatus.CANCELLED ? "Cancel Order" :
                "Update Status"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={!!selectedOrder && !statusDialogOpen} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Order #{selectedOrder.id.toString().padStart(4, '0')}</h3>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              <div className="border rounded-md overflow-hidden">
                <div className="bg-muted px-4 py-2 font-medium">
                  Order Items
                </div>
                <div className="p-4 space-y-3">
                  {selectedOrder.items && Array.isArray(selectedOrder.items) ? (
                    selectedOrder.items.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between">
                        <div>
                          <span className="font-medium">{item.name}</span>
                          <span className="text-muted-foreground ml-2">x{item.quantity}</span>
                        </div>
                        <span>₱{typeof item.price === 'number' && typeof item.quantity === 'number' ? (item.price * item.quantity).toFixed(2) : '0.00'}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground">No item details available</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Customer</p>
                  <p className="text-sm">Customer #{selectedOrder.customerId}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Contact</p>
                  <p className="text-sm">{selectedOrder.customerPhone || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Payment Method</p>
                  <p className="text-sm">{selectedOrder.paymentMethod}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">Payment Status</p>
                  <Badge variant={selectedOrder.paymentStatus === "completed" ? "success" : "outline"}>
                    {selectedOrder.paymentStatus ?
                      (selectedOrder.paymentStatus.charAt(0).toUpperCase() + selectedOrder.paymentStatus.slice(1)) :
                      "Pending"}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium">Delivery Address</p>
                <p className="text-sm">{selectedOrder.deliveryAddress || "N/A"}</p>
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between">
                  <span className="font-medium">Subtotal</span>
                  <span>₱{typeof selectedOrder.totalAmount === 'number' ? (selectedOrder.totalAmount - (selectedOrder.deliveryFee || 0)).toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Delivery Fee</span>
                  <span>₱{selectedOrder.deliveryFee ? selectedOrder.deliveryFee.toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-lg font-bold">₱{typeof selectedOrder.totalAmount === 'number' ? selectedOrder.totalAmount.toFixed(2) : '0.00'}</span>
                </div>
              </div>

              {[OrderStatus.PENDING, OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP].includes(selectedOrder.status as OrderStatus) && (
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setNewStatus(OrderStatus.CANCELLED);
                      setStatusDialogOpen(true);
                    }}
                  >
                    Cancel Order
                  </Button>
                  <Button
                    onClick={() => {
                      setNewStatus(getNextStatus(selectedOrder.status));
                      setStatusDialogOpen(true);
                    }}
                  >
                    {selectedOrder.status === OrderStatus.PENDING ? "Confirm Order" :
                     selectedOrder.status === OrderStatus.CONFIRMED ? "Mark as Ready" :
                     selectedOrder.status === OrderStatus.PREPARING ? "Mark as Ready" :
                     "Mark as Picked Up"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Ready for Pickup Success Dialog */}
      <Dialog open={readySuccessDialogOpen} onOpenChange={setReadySuccessDialogOpen}>
        <DialogContent className="sm:max-w-md bg-green-50 border-green-300">
          <div className="flex flex-col items-center justify-center py-4">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-14 w-14 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-green-800 mb-2">Order Ready for Pickup!</h2>
            <p className="text-center text-green-700 mb-6">
              Order #{readyOrder?.id.toString().padStart(4, '0')} has been marked as ready for pickup.
              It will now appear in the pickup section for riders.
            </p>

            <div className="bg-white p-4 rounded-md border border-green-200 w-full mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">Next Steps:</h3>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <div className="bg-green-100 rounded-full p-1 mr-2 mt-0.5">
                    <PackageCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm">Prepare the order for handoff to a delivery rider</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-100 rounded-full p-1 mr-2 mt-0.5">
                    <CheckCheck className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm">Verify order contents before giving to rider</span>
                </li>
                <li className="flex items-start">
                  <div className="bg-green-100 rounded-full p-1 mr-2 mt-0.5">
                    <ArrowRight className="h-4 w-4 text-green-600" />
                  </div>
                  <span className="text-sm">Mark order as "Picked Up" once a rider collects it</span>
                </li>
              </ul>
            </div>

            <Button
              onClick={() => setReadySuccessDialogOpen(false)}
              className="w-full"
              variant="success"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </RestaurantLayout>
  );
}
