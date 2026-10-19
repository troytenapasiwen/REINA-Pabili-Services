import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import AdminLayout from "@/layouts/AdminLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  CalendarIcon, Download, TrendingUp, TrendingDown,
  DollarSign, ShoppingCart, Users, Store, Bike, AlertCircle,
  FileDown, FileSpreadsheet
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add module declaration for jsPDF autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Define types for analytics data
interface DashboardAnalytics {
  summary: {
    totalOrders: number;
    totalRevenue: number;
    totalUsers: number;
    totalRestaurants: number;
    totalRiders: number;
    totalCustomers: number;
    activeRestaurants: number;
    activeRiders: number;
  };
  today: { orders: number; revenue: number };
  thisWeek: { orders: number; revenue: number };
  thisMonth: { orders: number; revenue: number };
  lastMonth: { orders: number; revenue: number };
  orderStatusBreakdown: Record<string, number>;
  userRoleBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  riderStatusBreakdown: Record<string, number>;
  recentOrders: any[];
}

interface TopRestaurant {
  id: number;
  name: string;
  orders: number;
  revenue: number;
  averageOrderValue: number;
  logoUrl?: string;
}

interface RiderPerformance {
  id: number;
  name: string;
  deliveries: number;
  totalEarnings: number;
  completed: number;
  cancelled: number;
  averageDeliveryTime: number;
  status: string;
  vehicleType: string;
  completionRate: string | number;
}

// Chart colors
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function AdminAnalytics() {
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined
  });
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');

  // Fetch dashboard analytics
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardAnalytics>({
    queryKey: ['/api/admin/analytics/dashboard'],
  });

  // Fetch order analytics with date range
  const { data: orderAnalytics, isLoading: orderLoading } = useQuery({
    queryKey: ['/api/admin/analytics/orders', dateRange.from, dateRange.to, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateRange.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange.to) params.append('endDate', dateRange.to.toISOString());
      params.append('groupBy', groupBy);
      const response = await fetch(`/api/admin/analytics/orders?${params}`);
      if (!response.ok) throw new Error('Failed to fetch order analytics');
      return response.json();
    },
    enabled: !!dateRange.from && !!dateRange.to,
  });

  // Fetch top restaurants
  const { data: topRestaurants, isLoading: restaurantsLoading } = useQuery<TopRestaurant[]>({
    queryKey: ['/api/admin/analytics/top-restaurants'],
  });

  // Fetch rider performance
  const { data: riderPerformance, isLoading: ridersLoading } = useQuery<RiderPerformance[]>({
    queryKey: ['/api/admin/analytics/rider-performance'],
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async ({ format, reportType }: { format: string; reportType: string }) => {
      const response = await fetch('/api/admin/analytics/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          format,
          reportType,
          startDate: dateRange.from?.toISOString(),
          endDate: dateRange.to?.toISOString(),
        }),
      });
      if (!response.ok) throw new Error('Export failed');
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.format === 'json') {
        // Download JSON file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-report-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
  });

  // Export to Excel
  const exportToExcel = () => {
    if (!dashboardData) return;

    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Orders', dashboardData.summary.totalOrders],
      ['Total Revenue', `₱${dashboardData.summary.totalRevenue.toFixed(2)}`],
      ['Total Users', dashboardData.summary.totalUsers],
      ['Total Restaurants', dashboardData.summary.totalRestaurants],
      ['Total Riders', dashboardData.summary.totalRiders],
      ['Total Customers', dashboardData.summary.totalCustomers],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    // Top restaurants sheet
    if (topRestaurants) {
      const restaurantData = [
        ['Restaurant', 'Orders', 'Revenue', 'Avg Order Value'],
        ...topRestaurants.map(r => [
          r.name,
          r.orders,
          `₱${r.revenue.toFixed(2)}`,
          `₱${r.averageOrderValue.toFixed(2)}`
        ])
      ];
      const restaurantSheet = XLSX.utils.aoa_to_sheet(restaurantData);
      XLSX.utils.book_append_sheet(wb, restaurantSheet, 'Top Restaurants');
    }

    // Rider performance sheet
    if (riderPerformance) {
      const riderData = [
        ['Rider', 'Deliveries', 'Earnings', 'Completed', 'Completion Rate', 'Avg Delivery Time'],
        ...riderPerformance.map(r => [
          r.name,
          r.deliveries,
          `₱${r.totalEarnings.toFixed(2)}`,
          r.completed,
          `${r.completionRate}%`,
          `${r.averageDeliveryTime} mins`
        ])
      ];
      const riderSheet = XLSX.utils.aoa_to_sheet(riderData);
      XLSX.utils.book_append_sheet(wb, riderSheet, 'Rider Performance');
    }

    // Download the Excel file
    XLSX.writeFile(wb, `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    if (!dashboardData) return;

    const doc = new jsPDF() as any; // Type assertion needed for autoTable
    const pageWidth = doc.internal.pageSize.getWidth();

    // Title
    doc.setFontSize(20);
    doc.text('Analytics Report', pageWidth / 2, 20, { align: 'center' });

    // Date
    doc.setFontSize(12);
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, pageWidth / 2, 30, { align: 'center' });

    // Summary section
    doc.setFontSize(16);
    doc.text('Summary', 14, 45);

    const summaryData = [
      ['Total Orders', dashboardData.summary.totalOrders.toString()],
      ['Total Revenue', `₱${dashboardData.summary.totalRevenue.toFixed(2)}`],
      ['Total Users', dashboardData.summary.totalUsers.toString()],
      ['Total Restaurants', dashboardData.summary.totalRestaurants.toString()],
      ['Total Riders', dashboardData.summary.totalRiders.toString()],
      ['Total Customers', dashboardData.summary.totalCustomers.toString()],
    ];

    autoTable(doc, {
      head: [['Metric', 'Value']],
      body: summaryData,
      startY: 50,
      theme: 'striped',
    });

    // Top Restaurants
    if (topRestaurants && topRestaurants.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Top Restaurants', 14, 20);

      const restaurantData = topRestaurants.map(r => [
        r.name,
        r.orders.toString(),
        `₱${r.revenue.toFixed(2)}`,
        `₱${r.averageOrderValue.toFixed(2)}`
      ]);

      autoTable(doc, {
        head: [['Restaurant', 'Orders', 'Revenue', 'Avg Order']],
        body: restaurantData,
        startY: 30,
        theme: 'striped',
      });
    }

    // Rider Performance
    if (riderPerformance && riderPerformance.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('Rider Performance', 14, 20);

      const riderData = riderPerformance.slice(0, 10).map(r => [
        r.name,
        r.deliveries.toString(),
        `₱${r.totalEarnings.toFixed(2)}`,
        `${r.completionRate}%`
      ]);

      autoTable(doc, {
        head: [['Rider', 'Deliveries', 'Earnings', 'Completion']],
        body: riderData,
        startY: 30,
        theme: 'striped',
      });
    }

    // Save the PDF
    doc.save(`analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  // Format currency
  const formatCurrency = (amount: number) => `₱${amount.toFixed(2)}`;

  // Format percentage change
  const formatPercentageChange = (current: number, previous: number) => {
    if (previous === 0) return { value: '—', isPositive: true };
    const change = ((current - previous) / previous) * 100;
    return {
      value: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
      isPositive: change >= 0
    };
  };

  // Prepare chart data
  const orderStatusData = dashboardData ? Object.entries(dashboardData.orderStatusBreakdown).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value
  })) : [];

  const paymentMethodData = dashboardData ? Object.entries(dashboardData.paymentMethodBreakdown).map(([key, value]) => ({
    name: key === 'cash' ? 'Cash on Delivery' : 'GCash',
    value
  })) : [];

  const userRoleData = dashboardData ? Object.entries(dashboardData.userRoleBreakdown).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value
  })) : [];

  return (
    <AdminLayout title="Analytics Dashboard" description="Monitor your business performance and insights">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="page-title">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor your business performance and insights</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={exportToExcel}
              disabled={!dashboardData}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={exportToPDF}
              disabled={!dashboardData}
              data-testid="button-export-pdf"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button
              onClick={() => exportMutation.mutate({ format: 'json', reportType: 'summary' })}
              disabled={!dashboardData || exportMutation.isPending}
              data-testid="button-export-json"
            >
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        {dashboardLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-20 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : dashboardData ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {/* Total Revenue */}
            <Card data-testid="card-total-revenue">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.totalRevenue)}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">This month:</span>
                  <span className="text-xs font-medium">{formatCurrency(dashboardData.thisMonth.revenue)}</span>
                </div>
              </CardContent>
            </Card>

            {/* Total Orders */}
            <Card data-testid="card-total-orders">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.summary.totalOrders}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Today:</span>
                  <span className="text-xs font-medium">{dashboardData.today.orders}</span>
                </div>
              </CardContent>
            </Card>

            {/* Active Restaurants */}
            <Card data-testid="card-active-restaurants">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
                <Store className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.summary.activeRestaurants}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Total:</span>
                  <span className="text-xs font-medium">{dashboardData.summary.totalRestaurants}</span>
                </div>
              </CardContent>
            </Card>

            {/* Active Riders */}
            <Card data-testid="card-active-riders">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Riders</CardTitle>
                <Bike className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.summary.activeRiders}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-muted-foreground">Total:</span>
                  <span className="text-xs font-medium">{dashboardData.summary.totalRiders}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Date Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Date Range Analysis</CardTitle>
            <CardDescription>Select a date range to analyze order trends</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !dateRange.from && "text-muted-foreground"
                    )}
                    data-testid="button-date-from"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? format(dateRange.from, "PPP") : "Pick start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                  />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[280px] justify-start text-left font-normal",
                      !dateRange.to && "text-muted-foreground"
                    )}
                    data-testid="button-date-to"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? format(dateRange.to, "PPP") : "Pick end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                  />
                </PopoverContent>
              </Popover>

              <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
                <SelectTrigger className="w-[180px]" data-testid="select-group-by">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily</SelectItem>
                  <SelectItem value="week">Weekly</SelectItem>
                  <SelectItem value="month">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Order Trends Chart */}
            {orderAnalytics && orderAnalytics.chartData && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">Order Trends</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={orderAnalytics.chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="orders" stroke="#3b82f6" name="Orders" />
                    <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="restaurants">Restaurants</TabsTrigger>
            <TabsTrigger value="riders">Riders</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Order Status Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Status Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={orderStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {orderStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Payment Methods Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={paymentMethodData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {paymentMethodData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* User Roles Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={userRoleData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {userRoleData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Restaurants Tab */}
          <TabsContent value="restaurants">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Restaurants</CardTitle>
                <CardDescription>Restaurants ranked by total revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {restaurantsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : topRestaurants ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topRestaurants.slice(0, 10)}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (₱)" />
                        <Bar dataKey="orders" fill="#10b981" name="Orders" />
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="rounded-md border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-4">Restaurant</th>
                            <th className="text-right p-4">Orders</th>
                            <th className="text-right p-4">Revenue</th>
                            <th className="text-right p-4">Avg Order Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topRestaurants.map((restaurant, index) => (
                            <tr key={restaurant.id} className="border-b" data-testid={`row-restaurant-${restaurant.id}`}>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <Badge variant={index < 3 ? "default" : "outline"}>#{index + 1}</Badge>
                                  <span className="font-medium">{restaurant.name}</span>
                                </div>
                              </td>
                              <td className="text-right p-4">{restaurant.orders}</td>
                              <td className="text-right p-4">{formatCurrency(restaurant.revenue)}</td>
                              <td className="text-right p-4">{formatCurrency(restaurant.averageOrderValue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No restaurant data available</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Riders Tab */}
          <TabsContent value="riders">
            <Card>
              <CardHeader>
                <CardTitle>Rider Performance Metrics</CardTitle>
                <CardDescription>Track rider delivery statistics and earnings</CardDescription>
              </CardHeader>
              <CardContent>
                {ridersLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : riderPerformance ? (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4">Rider</th>
                          <th className="text-right p-4">Status</th>
                          <th className="text-right p-4">Deliveries</th>
                          <th className="text-right p-4">Completed</th>
                          <th className="text-right p-4">Completion Rate</th>
                          <th className="text-right p-4">Earnings</th>
                          <th className="text-right p-4">Avg Delivery Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {riderPerformance.map((rider) => (
                          <tr key={rider.id} className="border-b" data-testid={`row-rider-${rider.id}`}>
                            <td className="p-4">
                              <div className="font-medium">{rider.name}</div>
                              <div className="text-xs text-muted-foreground">{rider.vehicleType}</div>
                            </td>
                            <td className="text-right p-4">
                              <Badge variant={rider.status === 'active' ? 'default' : 'secondary'}>
                                {rider.status}
                              </Badge>
                            </td>
                            <td className="text-right p-4">{rider.deliveries}</td>
                            <td className="text-right p-4">{rider.completed}</td>
                            <td className="text-right p-4">
                              <Badge variant={Number(rider.completionRate) >= 90 ? 'default' : 'secondary'}>
                                {rider.completionRate}%
                              </Badge>
                            </td>
                            <td className="text-right p-4">{formatCurrency(rider.totalEarnings)}</td>
                            <td className="text-right p-4">
                              {rider.averageDeliveryTime > 0 ? `${rider.averageDeliveryTime} mins` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No rider performance data available</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
                <CardDescription>Latest order activity in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {dashboardLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : dashboardData?.recentOrders ? (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-4">Order ID</th>
                          <th className="text-left p-4">Status</th>
                          <th className="text-right p-4">Amount</th>
                          <th className="text-right p-4">Delivery Fee</th>
                          <th className="text-left p-4">Payment</th>
                          <th className="text-left p-4">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboardData.recentOrders.map((order) => (
                          <tr key={order.id} className="border-b" data-testid={`row-order-${order.id}`}>
                            <td className="p-4">#{order.id}</td>
                            <td className="p-4">
                              <Badge variant={
                                order.status === 'delivered' ? 'default' :
                                order.status === 'cancelled' ? 'destructive' :
                                'secondary'
                              }>
                                {order.status}
                              </Badge>
                            </td>
                            <td className="text-right p-4">{formatCurrency(order.totalAmount)}</td>
                            <td className="text-right p-4">{formatCurrency(order.deliveryFee || 0)}</td>
                            <td className="p-4">
                              <Badge variant="outline">
                                {order.paymentMethod === 'cash_on_delivery' ? 'COD' : 'GCash'}
                              </Badge>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {order.createdAt ? format(new Date(order.createdAt), 'PPp') : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>No recent orders available</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
