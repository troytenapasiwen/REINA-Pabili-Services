import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Store, Bike, DollarSign } from "lucide-react";
import { useLocation } from "wouter";
import { StatusBadge } from "@/components/ui/status-badge";
import { Restaurant, Order, Rider } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Sample data for charts (in a real app, this would come from API)
const salesData = [
  { name: "Mon", sales: 12500 },
  { name: "Tue", sales: 15000 },
  { name: "Wed", sales: 18000 },
  { name: "Thu", sales: 16500 },
  { name: "Fri", sales: 21000 },
  { name: "Sat", sales: 25000 },
  { name: "Sun", sales: 23000 },
];

const orderTypeData = [
  { name: "Food Orders", value: 68 },
  { name: "Pabili Service", value: 32 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();

  // Fetch restaurants data
  const {
    data: restaurants,
    isLoading: isLoadingRestaurants,
  } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Fetch recent orders
  const {
    data: orders,
    isLoading: isLoadingOrders,
  } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch rider data
  const {
    data: riders,
    isLoading: isLoadingRiders,
  } = useQuery<Rider[]>({
    queryKey: ["/api/riders"],
  });

  // Calculate dashboard metrics
  const totalOrders = orders?.length || 0;
  const activeRestaurants = restaurants?.filter((restaurant) => restaurant.isActive).length || 0;
  const activeRiders = riders?.filter((rider) => rider.status === "active").length || 0;
  const totalRevenue = orders?.reduce((acc, order) => acc + (order.totalAmount || 0), 0) || 0;

  // Columns for the recent orders table
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
      accessorKey: (row: Order) => `Restaurant #${row.restaurantId}`,
    },
    {
      header: "Amount",
      accessorKey: (row: Order) => `₱ ${row.totalAmount.toFixed(2)}`,
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: Order) => <StatusBadge status={row.status} />,
    },
  ];

  // Handler for row click
  const handleOrderRowClick = (order: Order) => {
    setLocation(`/admin/orders/${order.id}`);
  };

  return (
    <AdminLayout title="Dashboard" description="Overview of your delivery platform">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Orders"
          value={totalOrders}
          icon={<ShoppingBag size={18} />}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
          change={{ value: 12.5, isPositive: true, label: "vs last week" }}
        />
        <StatCard
          title="Active Restaurants"
          value={activeRestaurants}
          icon={<Store size={18} />}
          iconBgColor="bg-secondary/10"
          iconColor="text-secondary"
          change={{ value: 4, isPositive: true, label: "new this month" }}
        />
        <StatCard
          title="Active Riders"
          value={activeRiders}
          icon={<Bike size={18} />}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
          change={{ value: 3, isPositive: false, label: "vs yesterday" }}
        />
        <StatCard
          title="Total Revenue"
          value={`₱ ${totalRevenue.toLocaleString()}`}
          icon={<DollarSign size={18} />}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-500"
          change={{ value: 18.2, isPositive: true, label: "vs last month" }}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Weekly Sales Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--foreground))" }} />
                  <YAxis
                    tickFormatter={(value) => `₱${value.toLocaleString()}`}
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    formatter={(value) => [`₱${(value as number).toLocaleString()}`, "Sales"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Order Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={orderTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                  >
                    {orderTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    align="center"
                    wrapperStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Percentage"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={orders || []}
            columns={orderColumns}
            isLoading={isLoadingOrders}
            onRowClick={handleOrderRowClick}
            searchPlaceholder="Search orders..."
            pageSize={5}
          />
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
