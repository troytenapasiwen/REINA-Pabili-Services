import { Badge } from "@/components/ui/badge";
import { OrderStatus, RiderStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: string;
  type?: "order" | "rider" | "restaurant";
  size?: "default" | "sm";
}

export function StatusBadge({ status, type = "order", size = "default" }: StatusBadgeProps) {
  // Configuration for badge styling based on status
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline" | "success", label?: string }> = {
    // Order statuses
    [OrderStatus.PENDING]: { variant: "outline", label: "Pending" },
    [OrderStatus.CONFIRMED]: { variant: "secondary", label: "Confirmed" },
    [OrderStatus.PREPARING]: { variant: "secondary", label: "Preparing" },
    [OrderStatus.READY_FOR_PICKUP]: { variant: "secondary", label: "Ready for Pickup" },
    [OrderStatus.PICKED_UP]: { variant: "secondary", label: "Picked Up" },
    [OrderStatus.ON_THE_WAY]: { variant: "secondary", label: "On the Way" },
    [OrderStatus.DELIVERED]: { variant: "success", label: "Delivered" },
    [OrderStatus.CANCELLED]: { variant: "destructive", label: "Cancelled" },

    // Rider statuses
    [RiderStatus.ACTIVE]: { variant: "success", label: "Active" },
    [RiderStatus.WAITING]: { variant: "secondary", label: "Waiting" },
    [RiderStatus.OFFLINE]: { variant: "outline", label: "Offline" },
    [RiderStatus.BUSY]: { variant: "secondary", label: "Busy" },

    // Restaurant active status
    "active": { variant: "success", label: "Active" },
    "inactive": { variant: "destructive", label: "Inactive" },
  };

  // Get config or fallback to default
  const config = statusConfig[status] || { variant: "default", label: status };
  const label = config.label || status;

  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "";

  return (
    <Badge variant={config.variant} className={sizeClasses}>
      {label}
    </Badge>
  );
}

// Create a custom variant for success badge
Badge.displayName = "Badge";
