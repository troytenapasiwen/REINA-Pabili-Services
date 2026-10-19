import RestaurantLayout from "@/layouts/RestaurantLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQuery } from "@tanstack/react-query";
import { Order, OrderStatus } from "@shared/schema";
import { ShoppingBag, Clock, DollarSign, TrendingUp, PackageCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function RestaurantDashboard() {
  const { user } = useAuth();

  // Fetch restaurant and orders data
  const { data: restaurant } = useQuery({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  const restaurantId = restaurant?.id;

  // Fetch orders
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/restaurant-orders"],
    enabled: !!restaurantId,
  });

  // Today's order stats
  const todayOrders = orders?.filter(order =>
    order.createdAt && new Date(order.createdAt).toDateString() === new Date().toDateString()
  ) || [];

  // Today's revenue
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalAmount, 0);

  // Pending orders
  const pendingOrders = orders?.filter(order =>
    ['pending', 'confirmed', 'preparing', 'ready_for_pickup'].includes(order.status)
  ) || [];

  // Average prep time in minutes (mock data)
  const avgPrepTime = 18;

  // Recent orders for table
  const recentOrders = orders?.slice(0, 10) || [];

  // Get orders that are ready for pickup and not yet assigned to riders
  const readyForPickupOrders = orders?.filter(order =>
    order.status === OrderStatus.READY_FOR_PICKUP && !order.riderId
  ) || [];

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
      header: "Total",
      accessorKey: (row: Order) => `₱${row.totalAmount ? row.totalAmount.toFixed(2) : '0.00'}`,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: Order) => <StatusBadge status={row.status} />,
    },
    {
      header: "Time",
      accessorKey: (row: Order) => {
        if (!row.createdAt) return 'N/A';
        const date = new Date(row.createdAt);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
  ];

  // Helper function to navigate to orders details
  const handleOrderClick = (order) => {
    window.location.href = `/restaurant/orders?order=${order.id}`;
  };

  return (
    <RestaurantLayout title="Dashboard" description="Overview of your restaurant">
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
                  onClick={() => handleOrderClick(order)}>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Today's Orders"
          value={todayOrders.length}
          icon={<ShoppingBag size={18} />}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          title="Pending Orders"
          value={pendingOrders.length}
          icon={<Clock size={18} />}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
          change={{ value: 3, isPositive: false, label: "since last hour" }}
        />
        <StatCard
          title="Today's Revenue"
          value={`₱${todayRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<DollarSign size={18} />}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-500"
          change={{ value: 8.2, isPositive: true, label: "vs yesterday" }}
        />
        <StatCard
          title="Avg. Prep Time"
          value={`${avgPrepTime} min`}
          icon={<TrendingUp size={18} />}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
          change={{ value: 2, isPositive: true, label: "faster than avg" }}
        />
      </div>

      {/* Recent Orders */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={recentOrders}
            columns={orderColumns}
            isLoading={isLoadingOrders}
            searchPlaceholder="Search orders..."
            pageSize={5}
          />
        </CardContent>
      </Card>

      {/* Order Notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Pending Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pendingOrders.length > 0 ? (
              pendingOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <div className="font-medium">Order #{order.id.toString().padStart(4, '0')}</div>
                    <div className="text-sm text-muted-foreground">
                      {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                No pending orders at the moment
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </RestaurantLayout>
  );
}
