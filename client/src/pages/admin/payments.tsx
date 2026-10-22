import { useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Order, PaymentMethod } from "@shared/schema";
import { Calendar as CalendarIcon, DollarSign, CreditCard, Wallet, BarChart4, FileDown } from "lucide-react";
import { ExportButton } from "@/components/admin/export-button";
import { StatCard } from "@/components/ui/stat-card";
import { Calendar } from "@/components/ui/calendar";
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
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from "@/hooks/use-toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Add module declaration for jsPDF autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

// Sample payment data for visualization
const paymentMethodData = [
  { name: "Cash on Delivery", value: 65 },
  { name: "GCash", value: 35 },
];

const paymentTrendData = [
  { name: "Jan", cod: 15000, gcash: 8000 },
  { name: "Feb", cod: 13000, gcash: 10000 },
  { name: "Mar", cod: 14000, gcash: 11000 },
  { name: "Apr", cod: 16000, gcash: 12000 },
  { name: "May", cod: 14000, gcash: 13000 },
  { name: "Jun", cod: 13000, gcash: 14000 },
];

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))"];

export default function AdminPayments() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<string>("week");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<string>("all");

  // Fetch orders for payment data
  const { data: orders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Filter orders by date and payment status
  const filteredOrders = orders?.filter(order => {
    const matchesStatus = paymentStatus === "all" || order.paymentStatus === paymentStatus;
    const orderDate = order.createdAt ? new Date(order.createdAt) : null;

    const matchesDateRange = !startDate || !endDate ||
      (orderDate !== null && orderDate >= startDate && orderDate <= endDate);

    return matchesStatus && matchesDateRange;
  }) || [];

  // Calculate payment metrics
  const totalPayments = filteredOrders.reduce((acc, order) => acc + order.totalAmount, 0);
  const successfulPayments = filteredOrders
    .filter(order => order.paymentStatus === "completed")
    .reduce((acc, order) => acc + order.totalAmount, 0);
  const pendingPayments = filteredOrders
    .filter(order => order.paymentStatus === "pending")
    .reduce((acc, order) => acc + order.totalAmount, 0);

  const codPayments = filteredOrders
    .filter(order => order.paymentMethod === PaymentMethod.COD)
    .reduce((acc, order) => acc + order.totalAmount, 0);

  const gcashPayments = filteredOrders
    .filter(order => order.paymentMethod === PaymentMethod.GCASH)
    .reduce((acc, order) => acc + order.totalAmount, 0);

  // Payment records table columns
  const paymentColumns: Column<Order>[] = [
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
      header: "Payment Method",
      accessorKey: "paymentMethod",
      cell: (row: Order) => {
        const methods: Record<string, { icon: React.ReactNode; label: string }> = {
          [PaymentMethod.COD]: {
            icon: <Wallet className="h-4 w-4 text-green-600 mr-2" />,
            label: "Cash on Delivery"
          },
          [PaymentMethod.GCASH]: {
            icon: <CreditCard className="h-4 w-4 text-blue-600 mr-2" />,
            label: "GCash"
          },
        };

        const method = methods[row.paymentMethod] || {
          icon: <CreditCard className="h-4 w-4 mr-2" />,
          label: row.paymentMethod
        };

        return (
          <div className="flex items-center">
            {method.icon}
            <span>{method.label}</span>
          </div>
        );
      },
    },
    {
      header: "Status",
      accessorKey: "paymentStatus",
      cell: (row: Order) => {
        const statusClasses: Record<string, string> = {
          completed: "text-green-600",
          pending: "text-amber-600",
          failed: "text-red-600",
        };

        const status = row.paymentStatus ?? "unknown";

        return (
          <span className={statusClasses[status] || ""}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      },
    },
    {
      header: "Date",
      accessorKey: (row: Order) => row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "N/A",
    },
    {
      header: "Reference",
      accessorKey: "paymentReference",
      cell: (row: Order) => row.paymentReference || "N/A",
    },
  ];

  // Export payments to PDF
  const exportPaymentsToPDF = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      toast({
        title: "No Data",
        description: "No payment data available to export",
        variant: "destructive",
      });
      return;
    }

    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.width;

    // Title and header
    doc.setFontSize(20);
    doc.text("Payment Report", pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    const dateRange = period === "custom" && startDate && endDate
      ? `${format(startDate, 'PP')} - ${format(endDate, 'PP')}`
      : period === "today" ? "Today"
      : period === "week" ? "This Week"
      : period === "month" ? "This Month"
      : period === "year" ? "This Year"
      : "All Time";
    doc.text(`Period: ${dateRange}`, pageWidth / 2, 30, { align: 'center' });
    doc.text(`Generated: ${format(new Date(), 'PPpp')}`, pageWidth / 2, 36, { align: 'center' });

    // Summary Statistics
    doc.setFontSize(14);
    doc.text("Payment Summary", 14, 50);
    doc.setFontSize(10);
    doc.text(`Total Payments: ₱${totalPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 14, 58);
    doc.text(`Successful Payments: ₱${successfulPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 14, 64);
    doc.text(`Pending Payments: ₱${pendingPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 14, 70);
    doc.text(`Total Transactions: ${filteredOrders.length}`, 14, 76);

    // Payment Method Breakdown
    doc.text(`Cash on Delivery: ₱${codPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 100, 58);
    doc.text(`GCash: ₱${gcashPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, 100, 64);

    // Payment Records Table
    const tableData = filteredOrders.map(order => ([
      `#${order.id.toString().padStart(4, '0')}`,
      order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A',
      `Customer #${order.customerId}`,
      `₱${order.totalAmount.toFixed(2)}`,
      order.paymentMethod === PaymentMethod.COD ? 'COD' : 'GCash',
      (order.paymentStatus ?? 'unknown').replace(/^./, c => c.toUpperCase()),
      order.paymentReference || 'N/A'
    ]));

    autoTable(doc, {
      head: [['Order ID', 'Date', 'Customer', 'Amount', 'Method', 'Status', 'Reference']],
      body: tableData,
      startY: 85,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 25 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 'auto' },
      },
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
    });

    // Save the PDF
    const fileName = `payment_report_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(fileName);

    toast({
      title: "Report Generated",
      description: `Payment report has been downloaded as ${fileName}`,
    });
  };

  // Export payments to CSV
  const exportPaymentsToCSV = () => {
    if (!filteredOrders || filteredOrders.length === 0) {
      return;
    }

    // Create CSV content
    const headers = [
      "Order ID",
      "Customer ID",
      "Restaurant ID",
      "Amount",
      "Payment Method",
      "Payment Status",
      "Payment Reference",
      "Date",
    ];

    const csvRows = [
      headers.join(","),
      ...filteredOrders.map(order => [
        order.id,
        order.customerId,
        order.restaurantId,
        order.totalAmount,
        order.paymentMethod,
        order.paymentStatus,
        order.paymentReference || "N/A",
        order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A',
      ].join(",")),
    ];

    const csvContent = csvRows.join("\n");

    // Create and download file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payments_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Custom filters component
  const customFilter = (
    <div className="flex flex-wrap gap-2">
      <Select value={period} onValueChange={setPeriod}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Period" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="year">This Year</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>

      {period === "custom" && (
        <>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-[140px]",
                  !startDate && "text-muted-foreground"
                )}
              >
                {startDate ? format(startDate, "PP") : "Start date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={setStartDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "justify-start text-left font-normal w-[140px]",
                  !endDate && "text-muted-foreground"
                )}
              >
                {endDate ? format(endDate, "PP") : "End date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={endDate}
                onSelect={setEndDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </>
      )}

      <Select value={paymentStatus} onValueChange={setPaymentStatus}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Payment Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        onClick={exportPaymentsToPDF}
        disabled={!filteredOrders || filteredOrders.length === 0}
        data-testid="button-export-pdf"
      >
        <FileDown className="h-4 w-4 mr-2" />
        Export PDF
      </Button>

      <ExportButton
        data={filteredOrders}
        filename="payment-records"
        headers={[
          "Order ID",
          "Date",
          "Customer",
          "Total Amount",
          "Payment Method",
          "Payment Status",
          "Reference"
        ]}
        rowMapping={(order) => [
          `#${order.id.toString().padStart(4, '0')}`,
          order.createdAt ? new Date(order.createdAt).toLocaleString() : "N/A",
          `Customer #${order.customerId}`,
          `₱ ${order.totalAmount.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`,
          PaymentMethod[order.paymentMethod as keyof typeof PaymentMethod] || order.paymentMethod,
          order.paymentStatus,
          order.paymentReference || "N/A"
        ]}
      />
    </div>
  );

  return (
    <AdminLayout title="Payment Management" description="Track and manage all payment transactions">
      {/* Payment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Payments"
          value={`₱ ${totalPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<DollarSign size={18} />}
          iconBgColor="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          title="Successful Payments"
          value={`₱ ${successfulPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<CheckCircle size={18} />}
          iconBgColor="bg-green-500/10"
          iconColor="text-green-500"
        />
        <StatCard
          title="Pending Payments"
          value={`₱ ${pendingPayments.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={<Clock size={18} />}
          iconBgColor="bg-amber-500/10"
          iconColor="text-amber-500"
        />
        <StatCard
          title="Total Transactions"
          value={filteredOrders.length}
          icon={<FileText size={18} />}
          iconBgColor="bg-blue-500/10"
          iconColor="text-blue-500"
        />
      </div>

      {/* Payment Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Payment Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--foreground))" }} />
                  <YAxis
                    tickFormatter={(value) => `₱${value.toLocaleString()}`}
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <Tooltip
                    formatter={(value) => [`₱${(value as number).toLocaleString()}`, ""]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      borderColor: "hsl(var(--border))",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Legend
                    wrapperStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="cod" name="Cash on Delivery" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="gcash" name="GCash" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Payment Methods</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    label={(entry) => `${entry.name}: ${entry.value}%`}
                  >
                    {paymentMethodData.map((entry, index) => (
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

      {/* Payment Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Payment Records</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredOrders}
            columns={paymentColumns}
            isLoading={isLoadingOrders}
            searchPlaceholder="Search by order ID, reference..."
            customFilter={customFilter}
          />
        </CardContent>
      </Card>
    </AdminLayout>
  );
}

// Import missing components
import { CheckCircle, Clock, FileText } from "lucide-react";
