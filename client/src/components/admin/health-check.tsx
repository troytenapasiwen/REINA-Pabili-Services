import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Server,
  Database,
  Cloud,
  Wifi,
  Users,
  ShoppingBag,
  Clock,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface HealthStatus {
  status: "healthy" | "warning" | "critical";
  message: string;
  responseTime?: number;
  details?: Record<string, any>;
}

interface SystemHealth {
  overall: HealthStatus;
  database: HealthStatus;
  objectStorage: HealthStatus;
  websocket: HealthStatus;
  emailService: HealthStatus;
  externalAPIs: HealthStatus;
  uptime: number;
  timestamp: string;
}

interface SystemMetrics {
  totalUsers: number;
  activeOrders: number;
  totalRestaurants: number;
  totalRiders: number;
  ordersToday: number;
  averageResponseTime: number;
  errorRate: number;
}

export function HealthCheck() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Fetch health status
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ["/api/admin/health"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch system metrics
  const { data: metricsData, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ["/api/admin/metrics"],
    refetchInterval: 60000, // Refresh every minute
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchHealth(), refetchMetrics()]);
      toast({
        title: "Health Check Updated",
        description: "System status has been refreshed successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to update system status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "critical":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-700 border-green-300">Healthy</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Warning</Badge>;
      case "critical":
        return <Badge className="bg-red-100 text-red-700 border-red-300">Critical</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const health: SystemHealth = healthData || {
    overall: { status: "critical", message: "Unable to connect to server" },
    database: { status: "critical", message: "Connection failed" },
    objectStorage: { status: "critical", message: "Connection failed" },
    websocket: { status: "critical", message: "Connection failed" },
    emailService: { status: "critical", message: "Connection failed" },
    externalAPIs: { status: "critical", message: "Connection failed" },
    uptime: 0,
    timestamp: new Date().toISOString(),
  };

  const metrics: SystemMetrics = metricsData || {
    totalUsers: 0,
    activeOrders: 0,
    totalRestaurants: 0,
    totalRiders: 0,
    ordersToday: 0,
    averageResponseTime: 0,
    errorRate: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Health Monitor</h2>
          <p className="text-muted-foreground">
            Real-time monitoring of system components and performance
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || healthLoading}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(health.overall.status)}
              System Status
            </CardTitle>
            {getStatusBadge(health.overall.status)}
          </div>
          <CardDescription>
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <div className="font-semibold">Uptime</div>
              <div className="text-sm text-muted-foreground">{formatUptime(health.uptime)}</div>
            </div>
            <div className="text-center">
              <Activity className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <div className="font-semibold">Response Time</div>
              <div className="text-sm text-muted-foreground">{metrics.averageResponseTime}ms</div>
            </div>
            <div className="text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <div className="font-semibold">Active Orders</div>
              <div className="text-sm text-muted-foreground">{metrics.activeOrders}</div>
            </div>
            <div className="text-center">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <div className="font-semibold">Orders Today</div>
              <div className="text-sm text-muted-foreground">{metrics.ordersToday}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Health Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-600" />
                Database
              </div>
              {getStatusBadge(health.database.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{health.database.message}</p>
            {health.database.responseTime && (
              <div className="text-xs text-muted-foreground">
                Response: {health.database.responseTime}ms
              </div>
            )}
          </CardContent>
        </Card>

        {/* Object Storage */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-purple-600" />
                Object Storage
              </div>
              {getStatusBadge(health.objectStorage.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{health.objectStorage.message}</p>
            {health.objectStorage.responseTime && (
              <div className="text-xs text-muted-foreground">
                Response: {health.objectStorage.responseTime}ms
              </div>
            )}
          </CardContent>
        </Card>

        {/* WebSocket */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Wifi className="h-5 w-5 text-green-600" />
                WebSocket
              </div>
              {getStatusBadge(health.websocket.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{health.websocket.message}</p>
            {health.websocket.responseTime && (
              <div className="text-xs text-muted-foreground">
                Response: {health.websocket.responseTime}ms
              </div>
            )}
          </CardContent>
        </Card>

        {/* Email Service */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-orange-600" />
                Email Service
              </div>
              {getStatusBadge(health.emailService.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{health.emailService.message}</p>
            {health.emailService.responseTime && (
              <div className="text-xs text-muted-foreground">
                Response: {health.emailService.responseTime}ms
              </div>
            )}
          </CardContent>
        </Card>

        {/* External APIs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-600" />
                External APIs
              </div>
              {getStatusBadge(health.externalAPIs.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">{health.externalAPIs.message}</p>
            {health.externalAPIs.responseTime && (
              <div className="text-xs text-muted-foreground">
                Response: {health.externalAPIs.responseTime}ms
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
          <CardDescription>Current system statistics and performance indicators</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Users</span>
                <span className="text-2xl font-bold">{metrics.totalUsers}</span>
              </div>
              <Progress value={Math.min((metrics.totalUsers / 1000) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Restaurants</span>
                <span className="text-2xl font-bold">{metrics.totalRestaurants}</span>
              </div>
              <Progress value={Math.min((metrics.totalRestaurants / 100) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Riders</span>
                <span className="text-2xl font-bold">{metrics.totalRiders}</span>
              </div>
              <Progress value={Math.min((metrics.totalRiders / 50) * 100, 100)} className="h-2" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Error Rate</span>
                <span className="text-2xl font-bold">{metrics.errorRate.toFixed(1)}%</span>
              </div>
              <Progress
                value={Math.min(metrics.errorRate * 10, 100)}
                className="h-2"
                // Red progress bar for error rate
                style={{
                  "--progress-background": metrics.errorRate > 5 ? "rgb(239 68 68)" : "rgb(34 197 94)"
                } as any}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {(healthLoading || metricsLoading) && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading system health data...
          </div>
        </div>
      )}
    </div>
  );
}
