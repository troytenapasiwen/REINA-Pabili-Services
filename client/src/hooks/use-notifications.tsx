import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { useAuth } from "./use-auth";
import { Order } from "@shared/schema";
import { useToast } from "./use-toast";

// Define notification types
export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  timestamp: Date;
  isRead: boolean;
  relatedId?: number;
  relatedType?: "order" | "restaurant" | "rider";
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  addNotification: (notification: Omit<Notification, "id" | "timestamp" | "isRead">) => void;
}

// Create the context
const NotificationContext = createContext<NotificationContextType | null>(null);

// Generate unique ID for notifications
const generateId = () => {
  return Math.random().toString(36).substring(2, 11);
};

// Provider component
export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const { toast } = useToast();

  // Calculate unread count
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  // Mark a single notification as read
  const markAsRead = (id: string) => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) =>
        notification.id === id ? { ...notification, isRead: true } : notification
      )
    );
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications((prevNotifications) =>
      prevNotifications.map((notification) => ({ ...notification, isRead: true }))
    );
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
  };

  // Add a new notification
  const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "isRead">) => {
    const newNotification: Notification = {
      ...notification,
      id: generateId(),
      timestamp: new Date(),
      isRead: false,
    };

    setNotifications((prevNotifications) => [newNotification, ...prevNotifications]);

    // Also show as toast
    toast({
      title: notification.type.charAt(0).toUpperCase() + notification.type.slice(1),
      description: notification.message,
      variant: notification.type === "error" ? "destructive" : "default",
    });
  };

  // Setup WebSocket connection for real-time notifications
  useEffect(() => {
    if (!user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log("WebSocket connected for notifications");
      // Authenticate the WebSocket connection
      socket.send(
        JSON.stringify({
          type: "auth",
          role: user.role,
          userId: user.id,
        })
      );
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle different message types
        if (data.type === "order_update") {
          const order = data.order as Order;

          // Create notification message based on order status and user role
          let message = "";
          let type: NotificationType = "info";

          switch (order.status) {
            case "pending":
              if (user.role === "restaurant") {
                message = `New order #${order.id} received!`;
                type = "success";
              }
              break;
            case "accepted":
              if (user.role === "customer") {
                message = `Your order #${order.id} has been accepted by the restaurant.`;
                type = "success";
              } else if (user.role === "rider") {
                message = `New order #${order.id} ready for pickup!`;
                type = "info";
              }
              break;
            case "preparing":
              if (user.role === "customer") {
                message = `Your order #${order.id} is being prepared.`;
                type = "info";
              }
              break;
            case "ready_for_pickup":
              if (user.role === "rider") {
                message = `Order #${order.id} is ready for pickup!`;
                type = "success";
              } else if (user.role === "customer") {
                message = `Your order #${order.id} is ready for pickup!`;
                type = "info";
              }
              break;
            case "picked_up":
              if (user.role === "customer") {
                message = `Your order #${order.id} has been picked up and is on the way!`;
                type = "info";
              } else if (user.role === "restaurant") {
                message = `Order #${order.id} has been picked up by the rider.`;
                type = "info";
              }
              break;
            case "delivered":
              if (user.role === "customer") {
                message = `Your order #${order.id} has been delivered. Enjoy!`;
                type = "success";
              } else if (user.role === "restaurant") {
                message = `Order #${order.id} has been successfully delivered.`;
                type = "success";
              } else if (user.role === "rider") {
                message = `Order #${order.id} marked as delivered. Thank you!`;
                type = "success";
              }
              break;
            case "cancelled":
              message = `Order #${order.id} has been cancelled.`;
              type = "warning";
              break;
          }

          // Add notification if message is not empty
          if (message) {
            addNotification({
              message,
              type,
              relatedId: order.id,
              relatedType: "order"
            });
          }
        }
        // Handle restaurant approval notifications
        else if (data.type === "restaurant_approval" && user.role === "restaurant") {
          const { restaurantId, isApproved } = data;

          addNotification({
            message: isApproved
              ? "Your restaurant has been approved! You can now receive orders."
              : "Your restaurant approval request was rejected. Please contact support for more information.",
            type: isApproved ? "success" : "warning",
            relatedId: restaurantId,
            relatedType: "restaurant"
          });
        }
        // Handle rider assignment notifications
        else if (data.type === "rider_assignment" && (user.role === "customer" || user.role === "rider")) {
          const { orderId, riderName } = data;

          if (user.role === "customer") {
            addNotification({
              message: `Rider ${riderName} has been assigned to your order #${orderId}.`,
              type: "info",
              relatedId: orderId,
              relatedType: "order"
            });
          } else if (user.role === "rider") {
            addNotification({
              message: `You have been assigned to order #${orderId}.`,
              type: "info",
              relatedId: orderId,
              relatedType: "order"
            });
          }
        }
      } catch (error) {
        console.error("Error processing notification:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    // Clean up function
    return () => {
      socket.close();
    };
  }, [user, addNotification]);

  // Provide context values
  const value = {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotifications,
    addNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// Hook for using the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
