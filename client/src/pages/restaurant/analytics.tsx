import React, { useState } from "react";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Order, Restaurant } from "@shared/schema";
import { Download, CalendarRange, BarChart4, PieChart, LineChart, TrendingUp, DollarSign, ShoppingBag, FileText, FileSpreadsheet } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart as RechartsLineChart,
  Line,
} from "recharts";
import { format, subDays, subMonths, differenceInDays, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Chart colors
const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444"
];

export default function RestaurantAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<string>("week");

  // Get restaurant data for the logged-in user
  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // Fetch orders for this restaurant
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/restaurant-orders"],
    enabled: !!restaurant?.id,
  });

  // Calculate date range based on selected time range
  const getDateRange = () => {
    const now = new Date();

    switch (timeRange) {
      case "today":
        return { start: now, end: now };
      case "week":
        return { start: subDays(now, 7), end: now };
      case "month":
        return { start: subDays(now, 30), end: now };
      case "quarter":
        return { start: subDays(now, 90), end: now };
      case "year":
        return { start: subDays(now, 365), end: now };
      default:
        return { start: subDays(now, 7), end: now };
    }
  };

  const dateRange = getDateRange();

  // Filter orders by date range
  const filteredOrders = React.useMemo(() => {
    return orders?.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= dateRange.start && orderDate <= dateRange.end;
    }) || [];
  }, [orders, dateRange]);

  // Calculate revenue metrics
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0;

  // Generate sales by day data
  const salesByDay = React.useMemo(() => {
    const daysMap = new Map<string, number>();

    // Initialize with all days in the range
    const dayDiff = Math.min(differenceInDays(dateRange.end, dateRange.start) + 1, 30);

    for (let i = 0; i < dayDiff; i++) {
      const date = subDays(dateRange.end, i);
      daysMap.set(format(date, 'yyyy-MM-dd'), 0);
    }

    // Add sales data
    filteredOrders.forEach(order => {
      const orderDate = format(new Date(order.createdAt), 'yyyy-MM-dd');
      if (daysMap.has(orderDate)) {
        daysMap.set(orderDate, (daysMap.get(orderDate) || 0) + order.totalAmount);
      }
    });

    // Convert to array for chart
    return Array.from(daysMap.entries())
      .map(([date, sales]) => ({
        date: format(new Date(date), timeRange === 'month' ? 'MMM d' : 'd MMM'),
        sales
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredOrders, dateRange, timeRange]);

  // Sales by hour data
  const salesByHour = React.useMemo(() => {
    const hoursMap = new Map<number, { orders: number, sales: number }>();

    // Initialize hours
    for (let i = 0; i < 24; i++) {
      hoursMap.set(i, { orders: 0, sales: 0 });
    }

    // Add data
    filteredOrders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      const current = hoursMap.get(hour) || { orders: 0, sales: 0 };
      hoursMap.set(hour, {
        orders: current.orders + 1,
        sales: current.sales + order.totalAmount
      });
    });

    // Convert to array for chart
    return Array.from(hoursMap.entries())
      .map(([hour, data]) => ({
        hour: `${hour}:00`,
        orders: data.orders,
        sales: data.sales,
      }))
      .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
  }, [filteredOrders]);

  // Top menu items data
  const topItems = React.useMemo(() => {
    const itemsMap = new Map<string, { count: number, revenue: number }>();

    filteredOrders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item: any) => {
          const name = item.name || 'Unknown Item';
          const current = itemsMap.get(name) || { count: 0, revenue: 0 };
          itemsMap.set(name, {
            count: current.count + (item.quantity || 1),
            revenue: current.revenue + ((item.price || 0) * (item.quantity || 1))
          });
        });
      }
    });

    return Array.from(itemsMap.entries())
      .map(([name, data]) => ({
        name,
        count: data.count,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [filteredOrders]);

  // Orders by status data
  const ordersByStatus = React.useMemo(() => {
    const statusMap = new Map<string, number>();

    filteredOrders.forEach(order => {
      const status = order.status;
      statusMap.set(status, (statusMap.get(status) || 0) + 1);
    });

    return Array.from(statusMap.entries())
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
        value: count,
      }));
  }, [filteredOrders]);

  // Calculate order comparison
  const getComparisonStats = () => {
    const now = new Date();
    let previousPeriodOrders: Order[] = [];

    switch (timeRange) {
      case "today":
        previousPeriodOrders = orders?.filter(order => {
          const orderDate = new Date(order.createdAt);
          return isSameDay(orderDate, subDays(now, 1));
        }) || [];
        break;
      case "week":
        previousPeriodOrders = orders?.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= subDays(dateRange.start, 7) && orderDate < dateRange.start;
        }) || [];
        break;
      case "month":
        previousPeriodOrders = orders?.filter(order => {
          const orderDate = new Date(order.createdAt);
          return orderDate >= subDays(dateRange.start, 30) && orderDate < dateRange.start;
        }) || [];
        break;
      default:
        previousPeriodOrders = [];
    }

    const previousRevenue = previousPeriodOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const revenueChange = previousRevenue > 0
      ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
      : 0;

    const orderChange = previousPeriodOrders.length > 0
      ? ((filteredOrders.length - previousPeriodOrders.length) / previousPeriodOrders.length) * 100
      : 0;

    return {
      revenueChange,
      orderChange,
    };
  };

  const comparison = getComparisonStats();

  // Export to Excel
  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['Restaurant Analytics Report'],
      ['Generated on:', format(new Date(), 'PPP')],
      ['Restaurant:', restaurant?.name || 'Unknown'],
      ['Period:', timeRange],
      [''],
      ['Summary Metrics'],
      ['Total Revenue', `₱${totalRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`],
      ['Total Orders', filteredOrders.length],
      ['Average Order Value', `₱${avgOrderValue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`],
      ['Revenue Change', `${comparison.revenueChange.toFixed(1)}%`],
      ['Order Change', `${comparison.orderChange.toFixed(1)}%`]
    ];

    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Sales by day sheet
    const salesData = [
      ['Date', 'Orders', 'Revenue'],
      ...salesByDay.map(day => [
        day.date,
        filteredOrders.filter(order => format(new Date(order.createdAt), timeRange === 'month' ? 'MMM d' : 'd MMM') === day.date).length,
        day.sales
      ])
    ];

    const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
    XLSX.utils.book_append_sheet(workbook, salesSheet, 'Daily Sales');

    // Top items sheet
    const itemsData = [
      ['Menu Item', 'Orders', 'Revenue'],
      ...topItems.map(item => [item.name, item.count, item.revenue])
    ];

    const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
    XLSX.utils.book_append_sheet(workbook, itemsSheet, 'Top Items');

    // Hourly sales sheet
    const hourlyData = [
      ['Hour', 'Orders', 'Revenue'],
      ...salesByHour.map(hour => [hour.hour, hour.orders, hour.sales])
    ];

    const hourlySheet = XLSX.utils.aoa_to_sheet(hourlyData);
    XLSX.utils.book_append_sheet(workbook, hourlySheet, 'Hourly Distribution');

    // Order details sheet
    const orderDetails = [
      ['Order ID', 'Date', 'Customer', 'Status', 'Total Amount', 'Payment Method'],
      ...filteredOrders.map(order => [
        order.id,
        order.createdAt ? format(new Date(order.createdAt), 'PPP') : 'Unknown',
        (order as any).customerName || 'Unknown',
        order.status,
        order.totalAmount,
        order.paymentMethod
      ])
    ];

    const ordersSheet = XLSX.utils.aoa_to_sheet(orderDetails);
    XLSX.utils.book_append_sheet(workbook, ordersSheet, 'Order Details');

    // Save file
    XLSX.writeFile(workbook, `restaurant_analytics_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text('Restaurant Analytics Report', 20, 25);

    doc.setFontSize(12);
    doc.text(`Restaurant: ${restaurant?.name || 'Unknown'}`, 20, 40);
    doc.text(`Period: ${timeRange}`, 20, 50);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 20, 60);

    // Summary metrics
    doc.setFontSize(16);
    doc.text('Summary Metrics', 20, 80);

    doc.setFontSize(12);
    const summaryY = 95;
    doc.text(`Total Revenue: ₱${totalRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 20, summaryY);
    doc.text(`Total Orders: ${filteredOrders.length}`, 20, summaryY + 10);
    doc.text(`Average Order Value: ₱${avgOrderValue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 20, summaryY + 20);
    doc.text(`Revenue Change: ${comparison.revenueChange.toFixed(1)}%`, 20, summaryY + 30);
    doc.text(`Order Change: ${comparison.orderChange.toFixed(1)}%`, 20, summaryY + 40);

    // Daily sales table
    doc.setFontSize(16);
    doc.text('Daily Sales', 20, summaryY + 60);

    const salesTableData = salesByDay.map(day => [
      day.date,
      filteredOrders.filter(order => format(new Date(order.createdAt), timeRange === 'month' ? 'MMM d' : 'd MMM') === day.date).length.toString(),
      `₱${day.sales.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [['Date', 'Orders', 'Revenue']],
      body: salesTableData,
      startY: summaryY + 70,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [241, 100, 69] }
    });

    // Top items table (new page)
    doc.addPage();
    doc.setFontSize(16);
    doc.text('Top Menu Items', 20, 25);

    const itemsTableData = topItems.map(item => [
      item.name,
      item.count.toString(),
      `₱${item.revenue.toFixed(2)}`
    ]);

    autoTable(doc, {
      head: [['Menu Item', 'Orders', 'Revenue']],
      body: itemsTableData,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [241, 100, 69] }
    });

    // Orders by status
    let finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(16);
    doc.text('Orders by Status', 20, finalY);

    const statusTableData = ordersByStatus.map(status => [
      status.name,
      status.value.toString(),
      `${((status.value / filteredOrders.length) * 100).toFixed(1)}%`
    ]);

    autoTable(doc, {
      head: [['Status', 'Count', 'Percentage']],
      body: statusTableData,
      startY: finalY + 10,
      theme: 'grid',
      styles: { fontSize: 10 },
      headStyles: { fillColor: [241, 100, 69] }
    });

    // Save PDF
    doc.save(`restaurant_analytics_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  return (
    <RestaurantLayout title="Analytics" description="Analyze restaurant performance and sales data">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Performance Analytics</h2>
          <p className="text-muted-foreground text-sm">
            Track your restaurant's performance metrics
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[160px]">
              <CalendarRange className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="quarter">Last 90 days</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" /> Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToPDF}>
                <FileText className="h-4 w-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={`₱ ${totalRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<DollarSign size={18} />}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-500"
          change={{
            value: Math.round(comparison.revenueChange * 10) / 10,
            isPositive: comparison.revenueChange >= 0,
            label: timeRange === "today" ? "vs yesterday" : `vs previous ${timeRange}`
          }}
        />
        <StatCard
          title="Total Orders"
          value={filteredOrders.length}
          icon={<ShoppingBag size={18} />}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
          change={{
            value: Math.round(comparison.orderChange * 10) / 10,
            isPositive: comparison.orderChange >= 0,
            label: timeRange === "today" ? "vs yesterday" : `vs previous ${timeRange}`
          }}
        />
        <StatCard
          title="Average Order Value"
          value={`₱ ${avgOrderValue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<TrendingUp size={18} />}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center">
              <BarChart4 className="h-4 w-4 mr-2" />
              Sales Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByDay} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--foreground))" }}
                    tickFormatter={(value) => value}
                  />
                  <YAxis
                    tickFormatter={(value) => `₱${value}`}
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    formatter={(value) => [`₱${(value as number).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, "Sales"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Bar
                    dataKey="sales"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center">
              <PieChart className="h-4 w-4 mr-2" />
              Orders by Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Pie
                    data={ordersByStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="hsl(var(--primary))"
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {ordersByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${value} orders`, ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Legend
                    formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
                  />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center">
              <LineChart className="h-4 w-4 mr-2" />
              Hourly Order Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsLineChart
                  data={salesByHour}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <YAxis
                    yAxisId="left"
                    orientation="left"
                    tickFormatter={(value) => `${value}`}
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tickFormatter={(value) => `₱${value}`}
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'orders') return [`${value} orders`, "Orders"];
                      if (name === 'sales') return [`₱${(value as number).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, "Sales"];
                      return [value, name];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))"
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="orders"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    name="Orders"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="sales"
                    stroke="hsl(var(--secondary))"
                    strokeWidth={2}
                    name="Sales"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Top Menu Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {topItems.map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                    <span className="text-sm">
                      {item.count} orders · ₱{item.revenue.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{
                        width: `${Math.min(100, (item.revenue / (topItems[0]?.revenue || 1)) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              ))}

              {topItems.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <ShoppingBag className="h-12 w-12 mb-2 opacity-20" />
                  <p>No order data available</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </RestaurantLayout>
  );
}
