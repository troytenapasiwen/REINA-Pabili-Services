import { useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Order, OrderStatus, Rider, Restaurant, Customer, Feedback } from "@shared/schema";
import { Eye, CheckCircle, MapPin, Clock, DollarSign, Truck, User, Store, Book, CalendarIcon, AlertCircle, FileText, File, FileImage, Star } from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { format } from 'date-fns';
import { cn } from "@/lib/utils";
import OrderTrackingMap from "@/components/customer/map-order-tracking-fixed";

export default function AdminOrders() {
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedRider, setSelectedRider] = useState<number | null>(null);
  const [orderDate, setOrderDate] = useState<Date | undefined>(undefined);
  const [orderStatus, setOrderStatus] = useState<string>("all");
  const [orderDetailsOpen, setOrderDetailsOpen] = useState<boolean>(false);
  const [orderDetailsId, setOrderDetailsId] = useState<number | null>(null);

  // Fetch all orders
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch restaurants to display names
  const { data: restaurants, isLoading: isLoadingRestaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Fetch riders for assignment
  const { data: riders } = useQuery<Rider[]>({
    queryKey: ["/api/riders"],
  });

  // Fetch next available rider based on queue position
  const { data: nextAvailableRider, isLoading: isLoadingNextRider } = useQuery<Rider & { queuePosition?: number | null }>({
    queryKey: ["/api/riders/next-available"],
    enabled: !!selectedOrder && selectedOrder.status === "ready_for_pickup",
  });

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesStatus = orderStatus === "all" || order.status === orderStatus;

    // Safely handle date comparison
    const matchesDate = !orderDate || (order.createdAt &&
      (new Date(order.createdAt).toDateString() === orderDate.toDateString()));

    return matchesStatus && matchesDate;
  }) || [];

  // Assign rider mutation
  const assignRiderMutation = useMutation({
    mutationFn: async ({ orderId, riderId }: { orderId: number; riderId: number }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}/assign-rider`, { riderId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Rider assigned",
        description: "The rider has been assigned to the order successfully",
      });
      setSelectedOrder(null);
      setSelectedRider(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to assign rider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Prepare order data for export
  const prepareOrderData = () => {
    if (!orders || orders.length === 0) {
      toast({
        title: "No orders to export",
        description: "There are no orders available to export",
        variant: "destructive",
      });
      return null;
    }

    // Define columns/headers for exports
    const headers = [
      "Order ID",
      "Customer ID",
      "Restaurant",
      "Rider ID",
      "Status",
      "Payment Method",
      "Payment Status",
      "Delivery Fee",
      "Distance (km)",
      "Subtotal",
      "Total Amount",
      "Created At",
    ];

    // Prepare rows data
    const rows = filteredOrders.map(order => {
      const distance = order.metadata && (order.metadata as any).deliveryDistance;
      const fee = order.deliveryFee || 0;
      const subtotal = order.totalAmount - fee;
      const createdDate = order.createdAt ? new Date(order.createdAt) : new Date();

      // Find restaurant name
      const restaurant = restaurants?.find(r => r.id === order.restaurantId);
      const restaurantName = restaurant ? restaurant.name : `Restaurant #${order.restaurantId}`;

      return [
        order.id.toString().padStart(4, '0'),
        order.customerId,
        restaurantName,
        order.riderId || "N/A",
        order.status.toUpperCase().replace(/_/g, ' '),
        order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "GCash",
        order.paymentStatus ? order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1) : "Pending",
        `₱${fee.toFixed(2)}`,
        distance ? distance.toFixed(1) : "N/A",
        `₱${subtotal.toFixed(2)}`,
        `₱${order.totalAmount.toFixed(2)}`,
        createdDate.toLocaleString(),
      ];
    });

    return { headers, rows };
  };

  // Export to CSV
  const exportToCSV = () => {
    const data = prepareOrderData();
    if (!data) return;

    const { headers, rows } = data;

    const csvRows = [
      headers.join(","),
      ...rows.map(row => row.join(",")),
    ];

    const csvContent = csvRows.join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Export successful",
      description: "Orders have been exported to CSV",
    });
  };

  // Export to PDF
  const exportToPDF = () => {
    try {
      const data = prepareOrderData();
      if (!data) return;

      const { headers, rows } = data;

      // Using jsPDF and jsPDF-AutoTable
      import('jspdf').then(jsPDFModule => {
        const jsPDF = jsPDFModule.default;

        // We need to import jspdf-autotable to extend the jsPDF prototype
        import('jspdf-autotable').then(autoTableModule => {
          const doc = new jsPDF({
            orientation: 'landscape',
          });

          // Add title
          doc.setFontSize(18);
          doc.text('Orders Report', 14, 22);

          // Add date
          doc.setFontSize(11);
          doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

          // Create the table using the autoTable plugin
          (doc as any).autoTable({
            head: [headers],
            body: rows,
            startY: 35,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [240, 100, 69] }, // Theme color #F06445
            alternateRowStyles: { fillColor: [245, 245, 245] },
          });

          // Save the PDF
          doc.save(`orders-report-${new Date().toISOString().split('T')[0]}.pdf`);

          toast({
            title: "Export successful",
            description: "Orders have been exported to PDF",
          });
        });
      }).catch(error => {
        console.error('Error loading PDF library:', error);
        toast({
          title: "Export failed",
          description: "Could not generate PDF. Please try again later.",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      toast({
        title: "Export failed",
        description: "Could not generate PDF. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const data = prepareOrderData();
      if (!data) return;

      const { headers, rows } = data;

      // Using xlsx library
      import('xlsx').then(xlsx => {
        // Prepare worksheet data
        const worksheet = xlsx.utils.aoa_to_sheet([headers, ...rows]);

        // Create workbook and add the worksheet
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Orders');

        // Generate Excel file and trigger download
        xlsx.writeFile(workbook, `orders-report-${new Date().toISOString().split('T')[0]}.xlsx`);

        toast({
          title: "Export successful",
          description: "Orders have been exported to Excel",
        });
      }).catch(error => {
        console.error('Error loading Excel library:', error);
        toast({
          title: "Export failed",
          description: "Could not generate Excel file. Please try again later.",
          variant: "destructive",
        });
      });
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast({
        title: "Export failed",
        description: "Could not generate Excel file. Please try again later.",
        variant: "destructive",
      });
    }
  };

  // Handle selecting an order for rider assignment
  const handleAssignRider = (order: Order) => {
    setSelectedOrder(order);
    setSelectedRider(null);
  };

  // Handle the assignment submission
  const submitAssignment = () => {
    if (selectedOrder && selectedRider) {
      assignRiderMutation.mutate({
        orderId: selectedOrder.id,
        riderId: selectedRider
      });
    }
  };

  // Order table columns
  const orderColumns: Column<Order>[] = [
    {
      header: "Order ID",
      accessorKey: "id",
      cell: (row: Order) => <span className="font-medium">#{row.id.toString().padStart(4, '0')}</span>,
    },
    {
      header: "Customer",
      accessorKey: (row: Order) => `Customer #${row.customerId}`,
    },
    {
      header: "Restaurant",
      accessorKey: "restaurantId",
      cell: (row: Order) => {
        // Debug to check if restaurant with ID 15 exists
        if (row.restaurantId === 15) {
          console.log("Debug - Restaurant ID: 15 exists?", !!restaurants?.find(r => r.id === 15));
        }

        // Get restaurant name from restaurants array
        const restaurant = restaurants?.find(r => r.id === row.restaurantId);

        // If restaurant found, return name, otherwise return ID
        if (restaurant) {
          return <span>{restaurant.name}</span>;
        } else {
          // Make sure client knows we're still trying to load restaurant name
          return (
            <span>
              {isLoadingRestaurants ? "Loading..." : `Restaurant #${row.restaurantId}`}
            </span>
          );
        }
      }
    },
    {
      header: "Type",
      accessorKey: (row: Order) => row.isPabili ? "Pabili" : "Food",
    },
    {
      header: "Delivery Fee",
      accessorKey: "deliveryFee",
      cell: (row: Order) => {
        const distance = row.metadata && (row.metadata as any).deliveryDistance;
        const fee = row.deliveryFee || 0;
        return (
          <div className="flex flex-col">
            <span>₱ {fee.toFixed(2)}</span>
            {distance && (
              <span className="text-xs text-muted-foreground">
                {distance.toFixed(1)} km
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: "Amount",
      accessorKey: "totalAmount",
      cell: (row: Order) => {
        const fee = row.deliveryFee || 0;
        const subtotal = row.totalAmount - fee;
        return (
          <div className="flex flex-col">
            <span>₱ {row.totalAmount.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">
              ₱ {subtotal.toFixed(2)} + ₱ {fee.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row: Order) => {
        const date = row.createdAt ? new Date(row.createdAt) : null;
        return <span>{date ? date.toLocaleDateString() : "N/A"}</span>;
      }
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: Order) => <StatusBadge status={row.status} />,
    },
    {
      header: "Actions",
      accessorKey: (row: Order) => `Order #${row.id}`,
      cell: (row: Order) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary"
            onClick={(e) => {
              e.stopPropagation();
              setOrderDetailsId(row.id);
              setOrderDetailsOpen(true);
            }}
          >
            <Eye size={16} />
          </Button>
          {row.status === OrderStatus.CONFIRMED && !row.riderId && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-success"
              onClick={(e) => {
                e.stopPropagation();
                handleAssignRider(row);
              }}
            >
              <CheckCircle size={16} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  // Filters component
  const customFilter = (
    <div className="flex gap-2">
      <div className="flex items-center gap-2">
        <Select value={orderStatus} onValueChange={setOrderStatus}>
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
                "justify-start text-left font-normal w-[140px]",
                !orderDate && "text-muted-foreground"
              )}
            >
              {orderDate ? format(orderDate, "PP") : "Pick date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
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
            Clear
          </Button>
        )}
      </div>

      <ExportButton
        data={filteredOrders}
        filename="orders-report"
        headers={[
          "Order ID",
          "Date",
          "Customer",
          "Restaurant",
          "Status",
          "Total Amount",
          "Payment Method",
          "Payment Status",
          "Rider"
        ]}
        rowMapping={(order) => [
          `#${order.id.toString().padStart(4, '0')}`,
          order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A",
          `Customer #${order.customerId}`,
          `Restaurant #${order.restaurantId}`,
          order.status,
          `₱ ${order.totalAmount.toFixed(2)}`,
          order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "GCash",
          order.paymentStatus || "N/A",
          order.riderId ? `Rider #${order.riderId}` : "Not Assigned"
        ]}
      />
    </div>
  );

  return (
    <AdminLayout title="Order Management" description="Manage and track all orders">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium">All Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredOrders}
            columns={orderColumns}
            isLoading={isLoadingOrders}
            searchPlaceholder="Search by order ID or customer..."
            customFilter={customFilter}
          />
        </CardContent>
      </Card>

      {/* Assign Rider Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Rider to Order</DialogTitle>
            <DialogDescription>
              Select a rider to assign to order #{selectedOrder?.id.toString().padStart(4, '0')}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="space-y-4">
              {nextAvailableRider && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 mb-4">
                  <div className="flex items-center">
                    <div className="mr-3 flex-shrink-0 bg-green-100 p-1 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-green-800">Suggested Rider</h3>
                      <p className="text-sm text-green-700">
                        Rider #{nextAvailableRider.id} is next in queue (position {nextAvailableRider.queuePosition || "N/A"})
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 border-green-300 text-green-700 hover:bg-green-100"
                        onClick={() => setSelectedRider(nextAvailableRider.id)}
                      >
                        Select this rider
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="rider">Select Rider</Label>
                <Select value={selectedRider?.toString()} onValueChange={(value) => setSelectedRider(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a rider" />
                  </SelectTrigger>
                  <SelectContent>
                    {riders?.filter(rider => rider.status === "active" || rider.status === "waiting").map((rider) => (
                      <SelectItem
                        key={rider.id}
                        value={rider.id.toString()}
                        className={nextAvailableRider?.id === rider.id ? "bg-green-50 text-green-700 font-medium" : ""}
                      >
                        Rider #{rider.id} - Queue #{rider.queuePosition || "N/A"}
                        {nextAvailableRider?.id === rider.id ? " (Suggested)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitAssignment}
              disabled={!selectedRider || assignRiderMutation.isPending}
            >
              {assignRiderMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                  Assigning...
                </>
              ) : (
                "Assign Rider"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete information about this order and delivery trip
            </DialogDescription>
          </DialogHeader>

          {orderDetailsId && (
            <OrderDetails
              orderId={orderDetailsId}
              onClose={() => {
                setOrderDetailsOpen(false);
                setOrderDetailsId(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

// Order Details Component
function OrderDetails({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const { data: order, isLoading } = useQuery<Order>({
    queryKey: [`/api/orders/${orderId}`],
  });

  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: [`/api/restaurants/${order?.restaurantId}`],
    enabled: !!order?.restaurantId,
  });

  const { data: customer } = useQuery<Customer>({
    queryKey: [`/api/customers/${order?.customerId}`],
    enabled: !!order?.customerId,
  });

  const { data: rider } = useQuery<Rider>({
    queryKey: [`/api/riders/${order?.riderId}`],
    enabled: !!order?.riderId,
  });

  // Fetch feedback for this order (only for delivered orders)
  const { data: orderFeedback } = useQuery<Feedback[]>({
    queryKey: [`/api/feedback/order/${orderId}`],
    enabled: order?.status === OrderStatus.DELIVERED,
  });

  const { toast } = useToast();

  // Confirm payment mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/orders/${order?.id}`, {
        paymentStatus: "completed"
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/orders/${order?.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

      toast({
        title: "Payment confirmed",
        description: "The payment has been verified and marked as completed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to confirm payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive mb-4" />
        <h3 className="text-lg font-medium">Order not found</h3>
        <p className="text-sm text-muted-foreground mt-2">
          We couldn't find any details for this order.
        </p>
        <Button onClick={onClose} className="mt-4">
          Close
        </Button>
      </div>
    );
  }

  // Extract locations from metadata if available
  const restaurantLocation = order.metadata && (order.metadata as any).restaurantLocation;
  const customerLocation = order.metadata && (order.metadata as any).customerLocation;
  const hasLocationData = restaurantLocation && customerLocation;

  const deliveryDistance = order.metadata && (order.metadata as any).deliveryDistance;
  const baseFare = 30; // ₱30 base fare
  const ratePerKm = deliveryDistance ? ((order.deliveryFee || 0) - baseFare) / deliveryDistance : 0;

  // Format date
  const formatDateTime = (date: Date | null | string) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Order Overview */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center mb-4">
            <Book className="mr-2 h-4 w-4" />
            Order Information
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Order ID:</span>
              <span className="text-sm">#{order.id.toString().padStart(4, '0')}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Status:</span>
              <StatusBadge status={order.status} />
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Order Type:</span>
              <span className="text-sm">{order.isPabili ? "Pabili" : "Food Delivery"}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Payment Method:</span>
              <span className="text-sm">{order.paymentMethod === "cash_on_delivery" ? "Cash on Delivery" : "GCash"}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Payment Status:</span>
              <div className="flex items-center">
                <span className="text-sm capitalize">{order.paymentStatus}</span>

                {/* Payment confirmation button - only show for gcash payments that aren't completed */}
                {order.paymentMethod === "gcash" && order.paymentStatus !== "completed" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-2 h-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      if (window.confirm("Are you sure you want to verify this payment and mark it as completed?")) {
                        confirmPaymentMutation.mutate();
                      }
                    }}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Verify
                  </Button>
                )}
              </div>
            </div>

            {/* Payment Reference for GCash */}
            {order.paymentMethod === "gcash" && order.paymentReference && (
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-sm">Payment Reference:</span>
                <span className="text-sm font-mono">{order.paymentReference}</span>
              </div>
            )}

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Created At:</span>
              <span className="text-sm">{formatDateTime(order.createdAt)}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Estimated Delivery:</span>
              <span className="text-sm">{formatDateTime(order.estimatedDeliveryTime)}</span>
            </div>

            {order.actualDeliveryTime && (
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-sm">Actual Delivery:</span>
                <span className="text-sm">{formatDateTime(order.actualDeliveryTime)}</span>
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold flex items-center mb-4">
            <DollarSign className="mr-2 h-4 w-4" />
            Payment Details
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Subtotal:</span>
              <span className="text-sm">₱ {(order.totalAmount - (order.deliveryFee || 0)).toFixed(2)}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Delivery Fee:</span>
              <span className="text-sm">₱ {(order.deliveryFee || 0).toFixed(2)}</span>
            </div>

            {deliveryDistance && (
              <>
                <div className="flex justify-between border-b pb-2 text-xs text-muted-foreground">
                  <span>Base Fare:</span>
                  <span>₱ {baseFare.toFixed(2)}</span>
                </div>

                <div className="flex justify-between border-b pb-2 text-xs text-muted-foreground">
                  <span>Distance ({deliveryDistance.toFixed(2)} km × ₱{ratePerKm.toFixed(2)}/km):</span>
                  <span>₱ {(deliveryDistance * ratePerKm).toFixed(2)}</span>
                </div>
              </>
            )}

            <div className="flex justify-between border-b pb-2 font-bold">
              <span className="text-sm">Total Amount:</span>
              <span className="text-sm">₱ {order.totalAmount.toFixed(2)}</span>
            </div>

            {/* GCash Payment Receipt */}
            {order.paymentMethod === "gcash" && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="font-medium text-sm mb-3 flex items-center">
                  <FileImage className="mr-2 h-4 w-4" />
                  GCash Payment Receipt
                </h4>

                {order.paymentReference ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Reference Number:</span>
                      <span className="font-mono">{order.paymentReference}</span>
                    </div>

                    {/* Receipt Image from metadata */}
                    {order.metadata && (order.metadata as any).receiptImage && (
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Uploaded Receipt:</span>
                        <div className="border rounded-lg overflow-hidden bg-gray-50 p-4">
                          <img
                            src={(order.metadata as any).receiptImage}
                            alt="GCash Payment Receipt"
                            className="w-full max-w-md mx-auto object-contain cursor-pointer hover:scale-105 transition-transform"
                            style={{ maxHeight: '500px', display: 'block' }}
                            onClick={() => {
                              // Open image in new tab for full view
                              window.open((order.metadata as any).receiptImage, '_blank');
                            }}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              // Try to display the image as is if it's a valid data URL
                              const imgSrc = (order.metadata as any).receiptImage;
                              if (imgSrc && imgSrc.startsWith('data:image')) {
                                console.error('Failed to load GCash receipt image:', imgSrc.substring(0, 100) + '...');
                              }
                              target.style.display = 'none';
                              const errorDiv = document.createElement('div');
                              errorDiv.className = 'p-4 text-center text-muted-foreground';
                              errorDiv.innerHTML = `
                                <div class="space-y-2">
                                  <p>Receipt image could not be displayed</p>
                                  <p class="text-xs">Image data exists but may be corrupted</p>
                                </div>
                              `;
                              target.parentNode?.appendChild(errorDiv);
                            }}
                          />
                          <p className="text-xs text-center text-muted-foreground mt-2">
                            Click image to view full size
                          </p>
                        </div>
                      </div>
                    )}

                    {/* If no receipt image, show notice */}
                    {(!order.metadata || !(order.metadata as any).receiptImage) && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <p className="text-sm text-amber-700">
                          Payment reference provided but receipt image not uploaded by customer.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <p className="text-sm text-muted-foreground">
                      No payment reference or receipt uploaded yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delivery Information */}
      <div>
        <h3 className="text-lg font-semibold flex items-center mb-4">
          <Truck className="mr-2 h-4 w-4" />
          Delivery Information
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Customer:</span>
              <span className="text-sm">{`Customer #${order.customerId}`}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Restaurant:</span>
              <span className="text-sm">{restaurant?.name || `Restaurant #${order.restaurantId}`}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Rider:</span>
              <span className="text-sm">{rider ? `Rider #${order.riderId}` : "Not assigned"}</span>
            </div>

            <div className="flex justify-between border-b pb-2">
              <span className="font-medium text-sm">Address:</span>
              <span className="text-sm">{order.deliveryAddress}</span>
            </div>

            {order.deliveryLocationName && (
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-sm">Location Name:</span>
                <span className="text-sm">{order.deliveryLocationName}</span>
              </div>
            )}

            {order.specialInstructions && (
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-sm">Instructions:</span>
                <span className="text-sm">{order.specialInstructions}</span>
              </div>
            )}

            {deliveryDistance && (
              <div className="flex justify-between border-b pb-2">
                <span className="font-medium text-sm">Distance:</span>
                <span className="text-sm">{deliveryDistance.toFixed(2)} km</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-sm">Order Items:</h4>
            <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
              {Array.isArray(order.items) ? order.items.map((rawItem: unknown, index: number) => {
                const item =
                  typeof rawItem === "object" && rawItem !== null
                    ? rawItem as { quantity?: unknown; name?: unknown; totalPrice?: unknown }
                    : {};

                const quantity = typeof item.quantity === "number" ? item.quantity : 1;
                const name = typeof item.name === "string" ? item.name : "Item";
                const totalPrice = typeof item.totalPrice === "number" ? item.totalPrice : 0;

                return (
                  <div key={index} className="flex justify-between text-sm border-b pb-2 last:border-0 last:pb-0">
                    <span>{quantity}× {name}</span>
                    <span>₱ {totalPrice.toFixed(2)}</span>
                  </div>
                );
              }) : <p className="text-sm text-muted-foreground">Order items unavailable.</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Map Section */}
      {hasLocationData && (
        <div>
          <h3 className="text-lg font-semibold flex items-center mb-4">
            <MapPin className="mr-2 h-4 w-4" />
            Delivery Route
          </h3>

          <div className="h-[400px] rounded-md overflow-hidden border">
            <OrderTrackingMap
              order={order}
              restaurant={restaurant}
              rider={
                rider
                  ? {
                      ...rider,
                      currentLocation:
                        typeof rider.currentLocation === "object" &&
                        rider.currentLocation !== null &&
                        "latitude" in rider.currentLocation &&
                        "longitude" in rider.currentLocation &&
                        typeof rider.currentLocation.latitude === "number" &&
                        typeof rider.currentLocation.longitude === "number"
                          ? {
                              latitude: rider.currentLocation.latitude,
                              longitude: rider.currentLocation.longitude,
                            }
                          : undefined,
                    }
                  : null
              }
              isLiveTracking={true}
            />
          </div>
        </div>
      )}

      {/* Customer Feedback Section */}
      {order.status === OrderStatus.DELIVERED && orderFeedback && orderFeedback.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold flex items-center mb-4">
            <Star className="mr-2 h-4 w-4" />
            Customer Feedback
          </h3>

          <div className="space-y-4">
            {orderFeedback.map((fb, index) => (
              <div key={index} className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">Rating:</span>
                    <div className="flex items-center">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= fb.rating
                              ? 'text-yellow-500 fill-yellow-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({fb.rating}/5)
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fb.createdAt ? new Date(fb.createdAt).toLocaleString() : ''}
                  </span>
                </div>

                {fb.comment && (
                  <div className="mt-2">
                    <span className="font-medium text-sm">Comment:</span>
                    <p className="text-sm text-muted-foreground mt-1">{fb.comment}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogFooter>
    </div>
  );
}
