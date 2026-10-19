import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { generatePasswordResetToken, validatePasswordResetToken, resetPassword } from "./password-reset";
import { saveEmailSettings, testEmailSettings, EmailSettings } from "./email-service";
import {
  insertRestaurantSchema,
  insertMenuItemSchema,
  insertRiderSchema,
  insertCustomerSchema,
  insertOrderSchema,
  insertFeedbackSchema,
  insertRiderFeedbackSchema,
  UserRole,
  RiderStatus,
  OrderStatus,
  users,
  restaurants,
  riders,
  customers,
  menuItems,
  orders,
  MenuItem,
  feedback,
  riderFeedback,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up API routes
  // Set up authentication routes
  await setupAuth(app);

  // Expose Google Maps API Key to frontend
  app.get("/api/maps/key", (req, res) => {
    res.json({ key: process.env.GOOGLE_MAPS_API_KEY || "" });
  });

  // Geocoding endpoint to convert coordinates to address
  app.get("/api/maps/geocode", async (req, res) => {
    try {
      const { lat, lng } = req.query;

      if (!lat || !lng) {
        return res.status(400).json({ error: "Missing lat or lng parameters" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        // If no API key, just return formatted coordinates
        return res.json({
          address: `Location (${parseFloat(lat as string).toFixed(6)}, ${parseFloat(lng as string).toFixed(6)})`,
        });
      }

      // Make request to Google Maps Geocoding API
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

      const response = await fetch(geocodeUrl);
      const data = await response.json();

      if (data.status === "OK" && data.results && data.results.length > 0) {
        // Get the most detailed address
        const formattedAddress = data.results[0].formatted_address;
        return res.json({ address: formattedAddress });
      } else {
        // Fallback to coordinates if geocoding fails
        return res.json({
          address: `Location (${parseFloat(lat as string).toFixed(6)}, ${parseFloat(lng as string).toFixed(6)})`,
        });
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      return res.status(500).json({
        error: "Failed to geocode coordinates",
        address: `Location (${parseFloat(req.query.lat as string).toFixed(6)}, ${parseFloat(req.query.lng as string).toFixed(6)})`,
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Create WebSocket server on a different path than Vite's HMR websocket
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // Store connected clients by user role and ID
  const connectedRiders = new Map<number, WebSocket>();
  const connectedRestaurants = new Map<number, WebSocket>();
  const connectedCustomers = new Map<number, WebSocket>();

  // Store admin connections for broadcasting updates
  const adminConnections: WebSocket[] = [];

  // WebSocket connection handler
  wss.on("connection", (ws, req) => {
    console.log("WebSocket connection established");

    // Set up message handler
    ws.on("message", async (message) => {
      try {
        // Parse the incoming message
        const data = JSON.parse(message.toString());

        // Handle client authentication/identification
        if (data.type === "auth") {
          console.log(
            `WebSocket client identified: role=${data.role}, id=${data.userId}`,
          );

          if (data.role === "rider" && data.riderId) {
            // Store the rider connection
            connectedRiders.set(data.riderId, ws);

            // Send confirmation to the rider
            ws.send(
              JSON.stringify({
                type: "auth_success",
                message: "Successfully authenticated as rider",
              }),
            );
          } else if (data.role === "restaurant" && data.restaurantId) {
            // Store the restaurant connection
            connectedRestaurants.set(data.restaurantId, ws);

            // Send confirmation to the restaurant
            ws.send(
              JSON.stringify({
                type: "auth_success",
                message: "Successfully authenticated as restaurant",
              }),
            );
          } else if (data.role === "customer" && data.customerId) {
            // Store the customer connection
            connectedCustomers.set(data.customerId, ws);

            // Send confirmation to the customer
            ws.send(
              JSON.stringify({
                type: "auth_success",
                message: "Successfully authenticated as customer",
              }),
            );
          } else if (data.role === "admin") {
            // Store admin connection for broadcasting
            adminConnections.push(ws);

            // Send confirmation to the admin
            ws.send(
              JSON.stringify({
                type: "auth_success",
                message: "Successfully authenticated as admin",
              }),
            );

            // Send current active riders to admin
            try {
              const activeRiders = await storage.getActiveRiders();
              ws.send(
                JSON.stringify({
                  type: "active_riders",
                  riders: activeRiders,
                }),
              );
            } catch (error) {
              console.error("Error fetching active riders:", error);
              ws.send(
                JSON.stringify({
                  type: "error",
                  message: "Failed to fetch active riders",
                }),
              );
            }
          }
        }

        // Handle rider location updates
        else if (
          data.type === "location_update" &&
          data.riderId &&
          data.location
        ) {
          console.log(
            `Received location update from rider ${data.riderId}:`,
            data.location,
          );

          // Update rider location in the database
          await storage.updateRider(data.riderId, {
            currentLocation: data.location,
          });

          // Create the location update message
          const locationUpdate = {
            type: "rider_location_update",
            riderId: data.riderId,
            location: data.location,
            timestamp: new Date().toISOString(),
          };

          // Broadcast to all admin connections
          adminConnections.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(locationUpdate));
            }
          });

          try {
            // Find orders that are currently being delivered by this rider
            const currentOrders = await storage.getOrdersByRiderId(
              data.riderId,
            );
            const activeOrders = currentOrders.filter((order) =>
              ["picked_up", "on_the_way"].includes(order.status),
            );

            // For each active order, notify the customer and restaurant
            for (const order of activeOrders) {
              // Notify the customer
              const customerWs = connectedCustomers.get(order.customerId);
              if (customerWs && customerWs.readyState === WebSocket.OPEN) {
                customerWs.send(
                  JSON.stringify({
                    ...locationUpdate,
                    orderId: order.id,
                    customerView: true,
                  }),
                );
                console.log(
                  `Sent location update to customer ${order.customerId} for order ${order.id}`,
                );
              }

              // Notify the restaurant
              if (order.restaurantId) {
                const restaurantWs = connectedRestaurants.get(order.restaurantId);
                if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
                restaurantWs.send(
                  JSON.stringify({
                    ...locationUpdate,
                    orderId: order.id,
                    restaurantView: true,
                  }),
                );
                  console.log(
                    `Sent location update to restaurant ${order.restaurantId} for order ${order.id}`,
                  );
                }
              }
            }
          } catch (error) {
            console.error(
              "Error sending rider location updates to customers/restaurants:",
              error,
            );
          }
        }

        // Handle chat messages
        else if (data.type === "send_chat_message") {
          console.log("Sending chat message:", data);

          const { orderId, riderId, customerId, message, senderType } = data;

          if (!orderId || !message || !senderType) {
            ws.send(JSON.stringify({
              type: "error",
              message: "Invalid message format"
            }));
            return;
          }

          // Create message object
          const chatMessage = {
            type: "chat_message",
            messageId: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            orderId,
            riderId,
            customerId,
            senderId: senderType === 'customer' ? customerId : riderId,
            senderType,
            message,
            timestamp: new Date().toISOString()
          };

          // Send to rider if sender is customer
          if (senderType === 'customer' && riderId) {
            const riderWs = connectedRiders.get(riderId);
            if (riderWs && riderWs.readyState === WebSocket.OPEN) {
              riderWs.send(JSON.stringify(chatMessage));
            }
          }

          // Send to customer if sender is rider
          if (senderType === 'rider' && customerId) {
            const customerWs = connectedCustomers.get(customerId);
            if (customerWs && customerWs.readyState === WebSocket.OPEN) {
              customerWs.send(JSON.stringify(chatMessage));
            }
          }

          // Echo back to sender for confirmation
          ws.send(JSON.stringify({
            type: "message_sent",
            messageId: chatMessage.messageId
          }));
        }

        // Handle notification sending
        else if (data.type === "send_notification") {
          console.log("Sending notification:", data.notification);

          const { recipients, notification } = data;

          // Make sure notification has required fields
          if (!notification || !notification.message || !notification.type) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: "Invalid notification format",
              }),
            );
            return;
          }

          // Add timestamp if not provided
          if (!notification.timestamp) {
            notification.timestamp = new Date().toISOString();
          }

          // Add unique ID if not provided
          if (!notification.id) {
            notification.id = `notification_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          }

          // Set isRead to false if not provided
          if (notification.isRead === undefined) {
            notification.isRead = false;
          }

          // Send to all admin recipients
          if (recipients.admins) {
            adminConnections.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(
                  JSON.stringify({
                    type: "notification",
                    notification,
                  }),
                );
              }
            });
          }

          // Send to specific restaurant recipients
          if (recipients.restaurantIds && recipients.restaurantIds.length > 0) {
            recipients.restaurantIds.forEach((restaurantId: number) => {
              const restaurantWs = connectedRestaurants.get(restaurantId);
              if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
                restaurantWs.send(
                  JSON.stringify({
                    type: "notification",
                    notification,
                  }),
                );
              }
            });
          }

          // Send to specific customer recipients
          if (recipients.customerIds && recipients.customerIds.length > 0) {
            recipients.customerIds.forEach((customerId: number) => {
              const customerWs = connectedCustomers.get(customerId);
              if (customerWs && customerWs.readyState === WebSocket.OPEN) {
                customerWs.send(
                  JSON.stringify({
                    type: "notification",
                    notification,
                  }),
                );
              }
            });
          }

          // Send to specific rider recipients
          if (recipients.riderIds && recipients.riderIds.length > 0) {
            recipients.riderIds.forEach((riderId: number) => {
              const riderWs = connectedRiders.get(riderId);
              if (riderWs && riderWs.readyState === WebSocket.OPEN) {
                riderWs.send(
                  JSON.stringify({
                    type: "notification",
                    notification,
                  }),
                );
              }
            });
          }

          // Send success response to sender
          ws.send(
            JSON.stringify({
              type: "notification_sent",
              message: "Notification sent successfully",
            }),
          );
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    });

    // Handle disconnection
    ws.on("close", () => {
      console.log("WebSocket connection closed");

      // Remove from rider connections if applicable
      for (const [riderId, client] of Array.from(connectedRiders.entries())) {
        if (client === ws) {
          console.log(`Rider ${riderId} disconnected`);
          connectedRiders.delete(riderId);
          break;
        }
      }

      // Remove from restaurant connections if applicable
      for (const [restaurantId, client] of Array.from(connectedRestaurants.entries())) {
        if (client === ws) {
          console.log(`Restaurant ${restaurantId} disconnected`);
          connectedRestaurants.delete(restaurantId);
          break;
        }
      }

      // Remove from customer connections if applicable
      for (const [customerId, client] of Array.from(connectedCustomers.entries())) {
        if (client === ws) {
          console.log(`Customer ${customerId} disconnected`);
          connectedCustomers.delete(customerId);
          break;
        }
      }

      // Remove from admin connections if applicable
      const adminIndex = adminConnections.indexOf(ws);
      if (adminIndex !== -1) {
        console.log("Admin disconnected");
        adminConnections.splice(adminIndex, 1);
      }
    });
  });

  // Add rider location update endpoint (for webhook)
  app.post("/api/riders/location", async (req, res) => {
    // Get riderId and location from request body
    const { riderId, location } = req.body;

    if (!riderId || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({ message: "Invalid rider location data" });
    }

    try {
      // Verify rider exists
      const rider = await storage.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
      }

      // Update rider location in database
      await storage.updateRider(riderId, {
        currentLocation: location,
      });

      // Create the location update message
      const locationUpdate = {
        type: "rider_location_update",
        riderId,
        location,
        timestamp: new Date().toISOString(),
      };

      // Broadcast to admin connections via WebSocket
      adminConnections.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(locationUpdate));
        }
      });

      // Find orders that are currently being delivered by this rider
      const currentOrders = await storage.getOrdersByRiderId(riderId);
      const activeOrders = currentOrders.filter((order) =>
        ["picked_up", "on_the_way"].includes(order.status),
      );

      // For each active order, notify the customer and restaurant
      for (const order of activeOrders) {
        // Notify the customer
        const customerWs = connectedCustomers.get(order.customerId);
        if (customerWs && customerWs.readyState === WebSocket.OPEN) {
          customerWs.send(
            JSON.stringify({
              ...locationUpdate,
              orderId: order.id,
              customerView: true,
            }),
          );
        }

        // Notify the restaurant
        if (order.restaurantId) {
          const restaurantWs = connectedRestaurants.get(order.restaurantId);
          if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
          restaurantWs.send(
            JSON.stringify({
              ...locationUpdate,
              orderId: order.id,
              restaurantView: true,
            }),
          );
          }
        }
      }

      res.status(200).json({ message: "Location updated successfully" });
    } catch (error) {
      console.error("Error updating rider location:", error);
      res.status(500).json({ message: "Error updating rider location" });
    }
  });

  // ==================== Password Reset API ====================


  // Request password reset
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Pass request object for dynamic URL detection
      await generatePasswordResetToken(email, req);

      // Always return success to prevent email enumeration
      res.status(200).json({
        success: true,
        message: 'If your email exists in our system, you will receive a password reset link'
      });
    } catch (error) {
      console.error('Error in forgot password:', error);
      res.status(500).json({ message: 'An error occurred during the password reset request' });
    }
  });

  // Validate reset token
  app.get("/api/reset-password/validate", async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: 'Invalid token' });
      }

      const userId = await validatePasswordResetToken(token);

      if (!userId) {
        return res.status(400).json({
          valid: false,
          message: 'The password reset link is invalid or has expired'
        });
      }

      res.status(200).json({ valid: true });
    } catch (error) {
      console.error('Error validating reset token:', error);
      res.status(500).json({ message: 'An error occurred while validating the token' });
    }
  });

  // Reset password
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: 'Token and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters long' });
      }

      const success = await resetPassword(token, password);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'The password reset link is invalid or has expired'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Your password has been reset successfully'
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      res.status(500).json({ message: 'An error occurred while resetting your password' });
    }
  });

  // Verify email endpoint
  app.post("/api/verify-email", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ message: 'Verification token is required' });
      }

      // Find user by verification token
      const users = await storage.getAllUsers();
      const user = users.find(u => {
        if (u.emailVerificationToken !== token) return false;
        if (!u.emailVerificationExpires) return false;

        // emailVerificationExpires is already a Date object from the database
        const expiresDate = u.emailVerificationExpires instanceof Date
          ? u.emailVerificationExpires
          : new Date(u.emailVerificationExpires);

        const now = new Date();
        const isValid = expiresDate > now;

        return isValid;
      });

      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired verification token'
        });
      }

      // Update user to mark email as verified
      await storage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null
      });

      res.status(200).json({
        success: true,
        message: 'Email verified successfully! You can now login.'
      });
    } catch (error) {
      console.error('Error verifying email:', error);
      res.status(500).json({ message: 'An error occurred while verifying your email' });
    }
  });

  // Resend verification email endpoint
  app.post("/api/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      // Find user by email
      const user = await storage.getUserByEmail(email);

      if (!user) {
        // Don't reveal if email exists or not for security
        return res.status(200).json({
          success: true,
          message: 'If an account exists with this email, a verification email has been sent.'
        });
      }

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }

      // Generate new verification token
      const { randomBytes } = await import('crypto');
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Update user with new token
      await storage.updateUser(user.id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires
      });

      // Send verification email
      const { sendEmailVerificationEmail, getBaseUrl } = await import('./email-service');
      const baseUrl = getBaseUrl(req);
      await sendEmailVerificationEmail(email, user.fullName || user.username, verificationToken, baseUrl);

      res.status(200).json({
        success: true,
        message: 'Verification email has been sent to your email address.'
      });
    } catch (error) {
      console.error('Error resending verification email:', error);
      res.status(500).json({ message: 'An error occurred while sending verification email' });
    }
  });

  // ==================== Email Settings API (Admin only) ====================

  // Get email settings
  app.get("/api/admin/email-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const settings = await storage.getSetting('email_settings');
      let emailSettings = {};

      if (settings && settings.value) {
        try {
          emailSettings = JSON.parse(settings.value);
        } catch (e) {
          console.error('Failed to parse email settings:', e);
        }
      }

      // Don't return password in response
      if (emailSettings.hasOwnProperty('password')) {
        emailSettings = { ...emailSettings, password: '********' };
      }

      res.status(200).json(emailSettings);
    } catch (error) {
      console.error('Error fetching email settings:', error);
      res.status(500).json({ message: 'An error occurred while fetching email settings' });
    }
  });

  // Save email settings
  app.post("/api/admin/email-settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const emailSettings = req.body as EmailSettings;

      // Validate required fields
      if (!emailSettings.host || !emailSettings.username || !emailSettings.password) {
        return res.status(400).json({ message: 'Host, username, and password are required' });
      }

      // Save settings
      const success = await saveEmailSettings(emailSettings);

      if (!success) {
        return res.status(500).json({ message: 'Failed to save email settings' });
      }

      res.status(200).json({
        success: true,
        message: 'Email settings saved successfully'
      });
    } catch (error) {
      console.error('Error saving email settings:', error);
      res.status(500).json({ message: 'An error occurred while saving email settings' });
    }
  });

  // Test email settings
  app.post("/api/admin/email-settings/test", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: 'Access denied' });
    }

    try {
      const emailSettings = req.body as EmailSettings;

      // Test the settings
      const success = await testEmailSettings(emailSettings);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to connect with the provided email settings'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Email settings connection test successful'
      });
    } catch (error) {
      console.error('Error testing email settings:', error);
      res.status(500).json({ message: 'An error occurred while testing email settings' });
    }
  });

  // ==================== Loyalty Program API ====================

  // Get current user's loyalty account
  app.get("/api/loyalty/account", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      let loyaltyAccount = await storage.getLoyaltyAccountByCustomerId(customer.id);

      // Auto-create loyalty account if it doesn't exist
      if (!loyaltyAccount) {
        loyaltyAccount = await storage.createLoyaltyAccount({
          customerId: customer.id,
          pointsBalance: 0,
          lifetimePoints: 0,
          tier: "bronze",
        });
      }

      // Get points to next tier with full progress info
      const { getPointsToNextTier, LOYALTY_TIER_THRESHOLDS, calculateTierFromPoints } = await import("@shared/schema");
      const basicProgress = getPointsToNextTier(loyaltyAccount.lifetimePoints);
      const currentTier = calculateTierFromPoints(loyaltyAccount.lifetimePoints);

      // Calculate progress percentage
      let progressPercent = 0;
      let currentTierThreshold = 0;
      let nextTierThreshold = 0;

      if (currentTier === "bronze") {
        currentTierThreshold = 0;
        nextTierThreshold = LOYALTY_TIER_THRESHOLDS.SILVER;
      } else if (currentTier === "silver") {
        currentTierThreshold = LOYALTY_TIER_THRESHOLDS.SILVER;
        nextTierThreshold = LOYALTY_TIER_THRESHOLDS.GOLD;
      }

      if (nextTierThreshold > currentTierThreshold) {
        const pointsInCurrentTier = loyaltyAccount.lifetimePoints - currentTierThreshold;
        const pointsNeededForNextTier = nextTierThreshold - currentTierThreshold;
        progressPercent = Math.min(100, Math.floor((pointsInCurrentTier / pointsNeededForNextTier) * 100));
      }

      const isMaxTier = currentTier === "gold";

      return res.json({
        ...loyaltyAccount,
        progressToNextTier: {
          currentTier,
          nextTier: basicProgress.nextTier,
          currentPoints: loyaltyAccount.lifetimePoints,
          pointsNeeded: isMaxTier ? loyaltyAccount.lifetimePoints : (currentTier === "bronze" ? LOYALTY_TIER_THRESHOLDS.SILVER : LOYALTY_TIER_THRESHOLDS.GOLD),
          progressPercent,
          isMaxTier,
        },
        tierThresholds: LOYALTY_TIER_THRESHOLDS,
      });
    } catch (error) {
      console.error("Error fetching loyalty account:", error);
      return res.status(500).json({ message: "Error fetching loyalty account" });
    }
  });

  // Get current user's loyalty transactions
  app.get("/api/loyalty/transactions", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      const loyaltyAccount = await storage.getLoyaltyAccountByCustomerId(customer.id);
      if (!loyaltyAccount) {
        return res.json([]);
      }

      const transactions = await storage.getLoyaltyTransactions(loyaltyAccount.id);
      return res.json(transactions);
    } catch (error) {
      console.error("Error fetching loyalty transactions:", error);
      return res.status(500).json({ message: "Error fetching loyalty transactions" });
    }
  });

  // Admin: Get all loyalty accounts
  app.get("/api/admin/loyalty/accounts", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const accounts = await storage.getAllLoyaltyAccounts();

      // Enrich with customer info
      const enrichedAccounts = await Promise.all(
        accounts.map(async (account) => {
          const customer = await storage.getCustomer(account.customerId);
          const user = customer ? await storage.getUser(customer.userId) : null;
          return {
            ...account,
            customerName: user?.fullName || user?.username || "Unknown",
            customerEmail: user?.email || "Unknown",
          };
        })
      );

      return res.json(enrichedAccounts);
    } catch (error) {
      console.error("Error fetching loyalty accounts:", error);
      return res.status(500).json({ message: "Error fetching loyalty accounts" });
    }
  });

  // Admin: Get loyalty stats
  app.get("/api/admin/loyalty/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const stats = await storage.getLoyaltyStats();
      return res.json(stats);
    } catch (error) {
      console.error("Error fetching loyalty stats:", error);
      return res.status(500).json({ message: "Error fetching loyalty stats" });
    }
  });

  // Admin: Adjust points manually
  app.post("/api/admin/loyalty/adjust", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { accountId, pointsDelta, description } = req.body;

      if (!accountId || pointsDelta === undefined) {
        return res.status(400).json({ message: "Account ID and points delta are required" });
      }

      const account = await storage.getLoyaltyAccount(accountId);
      if (!account) {
        return res.status(404).json({ message: "Loyalty account not found" });
      }

      // Create transaction
      const { LoyaltyTransactionType, calculateTierFromPoints } = await import("@shared/schema");
      await storage.createLoyaltyTransaction({
        accountId,
        type: LoyaltyTransactionType.ADJUST,
        pointsDelta,
        description: description || "Manual adjustment by admin",
        createdBy: req.user.id,
      });

      // Update account balance
      const newBalance = Math.max(0, account.pointsBalance + pointsDelta);
      const newLifetimePoints = pointsDelta > 0
        ? account.lifetimePoints + pointsDelta
        : account.lifetimePoints;
      const newTier = calculateTierFromPoints(newLifetimePoints);

      const updatedAccount = await storage.updateLoyaltyAccount(accountId, {
        pointsBalance: newBalance,
        lifetimePoints: newLifetimePoints,
        tier: newTier,
        lastActivityAt: new Date(),
        lastTierChangeAt: newTier !== account.tier ? new Date() : account.lastTierChangeAt,
      });

      return res.json({
        success: true,
        account: updatedAccount,
        message: `Points adjusted by ${pointsDelta > 0 ? '+' : ''}${pointsDelta}`
      });
    } catch (error) {
      console.error("Error adjusting loyalty points:", error);
      return res.status(500).json({ message: "Error adjusting loyalty points" });
    }
  });

  // Admin: Retroactively award loyalty points for delivered orders without transactions
  app.post("/api/admin/loyalty/retroactive", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { calculatePointsFromOrder, calculateTierFromPoints, LoyaltyTransactionType } = await import("@shared/schema");

      // Get all delivered orders
      const allOrders = await storage.getAllOrders();
      const deliveredOrders = allOrders.filter(order => order.status === OrderStatus.DELIVERED);

      let processedCount = 0;
      let skippedCount = 0;
      let totalPointsAwarded = 0;
      const results: { orderId: number; customerId: number; points: number; isPabili: boolean }[] = [];

      for (const order of deliveredOrders) {
        // Check if points already awarded for this order
        const existingTransaction = await storage.getLoyaltyTransactionByOrderId(order.id);
        if (existingTransaction) {
          skippedCount++;
          continue;
        }

        // Get or create loyalty account
        let loyaltyAccount = await storage.getLoyaltyAccountByCustomerId(order.customerId);
        if (!loyaltyAccount) {
          loyaltyAccount = await storage.createLoyaltyAccount({
            customerId: order.customerId,
            pointsBalance: 0,
            lifetimePoints: 0,
            tier: "bronze",
          });
        }

        // Calculate points (subtotal = totalAmount - deliveryFee)
        const orderSubtotal = (order.totalAmount || 0) - (order.deliveryFee || 0);
        const pointsEarned = calculatePointsFromOrder(orderSubtotal, (order.tipAmount || 0), loyaltyAccount.tier);

        if (pointsEarned > 0) {
          // Create transaction
          await storage.createLoyaltyTransaction({
            accountId: loyaltyAccount.id,
            orderId: order.id,
            type: LoyaltyTransactionType.EARN,
            pointsDelta: pointsEarned,
            description: `Retroactive points from order #${order.id}${order.isPabili ? ' (Pabili)' : ''}`,
          });

          // Update account balance
          const newBalance = loyaltyAccount.pointsBalance + pointsEarned;
          const newLifetimePoints = loyaltyAccount.lifetimePoints + pointsEarned;
          const newTier = calculateTierFromPoints(newLifetimePoints);

          await storage.updateLoyaltyAccount(loyaltyAccount.id, {
            pointsBalance: newBalance,
            lifetimePoints: newLifetimePoints,
            tier: newTier,
            lastActivityAt: new Date(),
            lastTierChangeAt: newTier !== loyaltyAccount.tier ? new Date() : loyaltyAccount.lastTierChangeAt,
          });

          // Update local reference for next iteration with same customer
          loyaltyAccount.pointsBalance = newBalance;
          loyaltyAccount.lifetimePoints = newLifetimePoints;
          loyaltyAccount.tier = newTier;

          results.push({
            orderId: order.id,
            customerId: order.customerId,
            points: pointsEarned,
            isPabili: order.isPabili || false,
          });

          totalPointsAwarded += pointsEarned;
          processedCount++;
        }
      }

      console.log(`Retroactive loyalty points: processed ${processedCount} orders, skipped ${skippedCount}, awarded ${totalPointsAwarded} total points`);

      return res.json({
        success: true,
        message: `Processed ${processedCount} orders, skipped ${skippedCount} (already had points)`,
        totalPointsAwarded,
        processedCount,
        skippedCount,
        results,
      });
    } catch (error) {
      console.error("Error processing retroactive loyalty points:", error);
      return res.status(500).json({ message: "Error processing retroactive loyalty points" });
    }
  });

  // ==================== Health Check API ====================

  // Get system health status (admin only)
  app.get("/api/admin/health", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const startTime = Date.now();

    try {
      // Test database connection
      const dbStartTime = Date.now();
      await db.select().from(users).limit(1);
      const dbResponseTime = Date.now() - dbStartTime;

      // Test object storage
      const storageStartTime = Date.now();
      let objectStorageStatus = { status: "healthy", message: "Object storage operational", responseTime: 0 };
      try {
        const objectStorageService = new ObjectStorageService();
        objectStorageService.getPublicObjectSearchPaths();
        objectStorageStatus.responseTime = Date.now() - storageStartTime;
      } catch (error) {
        objectStorageStatus = {
          status: "warning",
          message: "Object storage configuration issue",
          responseTime: Date.now() - storageStartTime
        };
      }

      // Test external APIs (Google Maps)
      const apiStartTime = Date.now();
      let externalAPIStatus = { status: "healthy", message: "External APIs operational", responseTime: 0 };
      try {
        const apiKey = process.env.GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
          externalAPIStatus = { status: "warning", message: "Google Maps API key not configured", responseTime: 0 };
        } else {
          const testResponse = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=test&key=${apiKey}`);
          externalAPIStatus.responseTime = Date.now() - apiStartTime;
          if (!testResponse.ok) {
            externalAPIStatus = { status: "warning", message: "Google Maps API response error", responseTime: externalAPIStatus.responseTime };
          }
        }
      } catch (error) {
        externalAPIStatus = {
          status: "critical",
          message: "External API connection failed",
          responseTime: Date.now() - apiStartTime
        };
      }

      // Calculate uptime
      const uptime = process.uptime();

      // Overall system status
      const componentsHealthy = [
        dbResponseTime < 1000,
        objectStorageStatus.status === "healthy",
        externalAPIStatus.status !== "critical"
      ];
      const allHealthy = componentsHealthy.every(Boolean);
      const anyWarning = [objectStorageStatus.status, externalAPIStatus.status].includes("warning");

      const overallStatus = allHealthy ? (anyWarning ? "warning" : "healthy") : "critical";

      const healthData = {
        overall: {
          status: overallStatus,
          message: `System is ${overallStatus}`,
          responseTime: Date.now() - startTime
        },
        database: {
          status: dbResponseTime < 1000 ? "healthy" : "warning",
          message: dbResponseTime < 1000 ? "Database connection healthy" : "Database response slow",
          responseTime: dbResponseTime
        },
        objectStorage: objectStorageStatus,
        websocket: {
          status: "healthy",
          message: "WebSocket server operational",
          responseTime: 0
        },
        emailService: {
          status: "healthy",
          message: "Email service configured",
          responseTime: 0
        },
        externalAPIs: externalAPIStatus,
        uptime: uptime,
        timestamp: new Date().toISOString()
      };

      res.json(healthData);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(500).json({
        overall: { status: "critical", message: "Health check failed" },
        database: { status: "critical", message: "Database connection failed" },
        objectStorage: { status: "critical", message: "Object storage unavailable" },
        websocket: { status: "critical", message: "WebSocket unavailable" },
        emailService: { status: "critical", message: "Email service unavailable" },
        externalAPIs: { status: "critical", message: "External APIs unavailable" },
        uptime: 0,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get system metrics (admin only)
  app.get("/api/admin/metrics", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Get total counts
      const [totalUsers, totalRestaurants, totalRiders, allOrders] = await Promise.all([
        storage.getAllUsers(),
        storage.getAllRestaurants(),
        storage.getAllRiders(),
        storage.getAllOrders()
      ]);

      // Get active orders
      const activeOrders = allOrders.filter(order =>
        !["delivered", "cancelled"].includes(order.status)
      );

      // Get today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const ordersToday = allOrders.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      });

      const metrics = {
        totalUsers: totalUsers.length,
        activeOrders: activeOrders.length,
        totalRestaurants: totalRestaurants.length,
        totalRiders: totalRiders.length,
        ordersToday: ordersToday.length,
        averageResponseTime: 150,
        errorRate: 0.5
      };

      res.json(metrics);
    } catch (error) {
      console.error("Metrics fetch error:", error);
      res.status(500).json({
        message: "Failed to fetch system metrics",
        error: error.message
      });
    }
  });

  // ==================== Chat/Messaging API ====================

  // Get chat messages for an order
  app.get("/api/orders/:orderId/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      // Get the order to verify access
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user has access to this order
      let hasAccess = false;

      console.log('Checking access for GET messages:', {
        orderId,
        userRole: req.user.role,
        userId: req.user.id,
        orderCustomerId: order.customerId,
        orderRiderId: order.riderId
      });

      if (req.user.role === UserRole.ADMIN) {
        hasAccess = true;
        console.log('Admin access granted');
      } else if (req.user.role === UserRole.CUSTOMER) {
        const customer = await storage.getCustomerByUserId(req.user.id);
        hasAccess = customer && customer.id === order.customerId;
        console.log('Customer check:', { customerId: customer?.id, orderCustomerId: order.customerId, hasAccess });
      } else if (req.user.role === UserRole.RIDER) {
        const rider = await storage.getRiderByUserId(req.user.id);
        hasAccess = rider && rider.id === order.riderId;
        console.log('Rider check:', { riderId: rider?.id, orderRiderId: order.riderId, hasAccess });
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get messages from database
      const messages = await storage.getMessagesByOrderId(orderId);

      // Mark messages from other user as read if current user is not the sender
      if (req.user.role === UserRole.RIDER) {
        await storage.markAllMessagesAsRead(orderId, req.user.id);
      } else if (req.user.role === UserRole.CUSTOMER) {
        await storage.markAllMessagesAsRead(orderId, req.user.id);
      }

      res.status(200).json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Server error fetching messages" });
    }
  });

  // Send a chat message for an order
  app.post("/api/orders/:orderId/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orderId = parseInt(req.params.orderId);
      if (isNaN(orderId)) {
        return res.status(400).json({ message: "Invalid order ID" });
      }

      const { message } = req.body;
      if (!message || !message.trim()) {
        return res.status(400).json({ message: "Message cannot be empty" });
      }

      // Get the order to verify access
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user has access to this order
      let hasAccess = false;

      if (req.user.role === UserRole.ADMIN) {
        hasAccess = true;
      } else if (req.user.role === UserRole.CUSTOMER) {
        const customer = await storage.getCustomerByUserId(req.user.id);
        hasAccess = customer && customer.id === order.customerId;
      } else if (req.user.role === UserRole.RIDER) {
        const rider = await storage.getRiderByUserId(req.user.id);
        hasAccess = rider && rider.id === order.riderId;
      }

      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Determine sender type based on user role and access
      const messageSenderType: 'customer' | 'rider' = req.user.role === UserRole.CUSTOMER ? 'customer' : 'rider';

      // Save message to database
      const newMessage = await storage.createMessage({
        orderId,
        senderId: req.user.id,
        senderType: messageSenderType,
        message: message.trim(),
        messageType: 'text',
        isRead: false,
        metadata: {},
        createdAt: new Date()
      });

      // Send real-time notification via WebSocket
      let targetUserId: number | null = null;

      if (messageSenderType === 'customer') {
        // Customer sent message, notify the rider
        if (order.riderId) {
          const riderProfile = await storage.getRider(order.riderId);
          targetUserId = riderProfile?.userId || null;
        }
      } else {
        // Rider sent message, notify the customer
        const customerProfile = await storage.getCustomer(order.customerId);
        targetUserId = customerProfile?.userId || null;
      }

      if (targetUserId) {
        const targetWs = messageSenderType === 'customer'
          ? connectedRiders.get(targetUserId)
          : connectedCustomers.get(targetUserId);

        if (targetWs && targetWs.readyState === WebSocket.OPEN) {
          targetWs.send(JSON.stringify({
            type: 'new_message',
            orderId,
            message: newMessage,
            senderName: req.user.username
          }));
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error saving message:", error);
      res.status(500).json({ message: "Server error saving message" });
    }
  });

  // ==================== Orders API ====================

  // Create a new order
  app.post("/api/orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Validate the request body
      const orderData = req.body;

      // Validate order total calculation
      const expectedTotal = orderData.subtotal + orderData.deliveryFee + (orderData.tipAmount || 0);
      if (Math.abs(orderData.totalAmount - expectedTotal) > 0.01) {
        console.error("Order total validation failed:", {
          received: orderData.totalAmount,
          expected: expectedTotal,
          subtotal: orderData.subtotal,
          deliveryFee: orderData.deliveryFee,
          tipAmount: orderData.tipAmount || 0
        });
        return res.status(400).json({
          message: "Invalid order total. Please refresh and try again."
        });
      }
      console.log("Received order data:", JSON.stringify(orderData));

      // Ensure customerId matches the authenticated user's customer ID
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        console.log("Customer not found for user ID:", req.user.id);
        return res.status(404).json({ message: "Customer profile not found" });
      }
      console.log("Customer found:", customer.id);


      // Set the customer ID to the authenticated user's customer ID
      orderData.customerId = customer.id;

      // Ensure the restaurant exists
      console.log("Looking for restaurant with ID:", orderData.restaurantId);
      const restaurant = await storage.getRestaurant(orderData.restaurantId);
      if (!restaurant) {
        console.log("Restaurant not found with ID:", orderData.restaurantId);
        return res.status(404).json({ message: "Restaurant not found" });
      }
      console.log("Restaurant found:", restaurant.id, restaurant.name);

      // Validate items and calculate total amount
      if (!Array.isArray(orderData.items) || orderData.items.length === 0) {
        return res
          .status(400)
          .json({ message: "Order must have at least one item" });
      }

      // Set initial order status
      orderData.status = OrderStatus.PENDING;

      // Add estimated delivery time (30-45 minutes from now)
      const estimatedDeliveryTime = new Date();
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 45);
      orderData.estimatedDeliveryTime = estimatedDeliveryTime;

      // Create the order
      const order = await storage.createOrder(orderData);

      // Send notification to the restaurant via WebSocket
      const restaurantWs = connectedRestaurants.get(restaurant.id);
      if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
        restaurantWs.send(
          JSON.stringify({
            type: "new_order",
            order,
          }),
        );
      }

      // Send notification to the customer via WebSocket
      const customerWs = connectedCustomers.get(customer.id);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(
          JSON.stringify({
            type: "order_status_update",
            order,
          }),
        );
      }

      return res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      return res.status(500).json({ message: "Error creating order" });
    }
  });

  // Create a new pabili order (errand service)
  app.post("/api/pabili-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Validate the request body
      const orderData = req.body;
      console.log("Received pabili order data:", JSON.stringify(orderData));

      // Validate pabili order total calculation
      // For pabili orders: totalAmount = subtotal + deliveryFee + tipAmount
      const expectedTotal = orderData.subtotal + orderData.deliveryFee + (orderData.tipAmount || 0);
      if (Math.abs(orderData.totalAmount - expectedTotal) > 0.01) {
        console.error("Pabili order total validation failed:", {
          received: orderData.totalAmount,
          expected: expectedTotal,
          subtotal: orderData.subtotal,
          deliveryFee: orderData.deliveryFee,
          tipAmount: orderData.tipAmount || 0
        });
        return res.status(400).json({
          message: "Invalid order total. Please refresh and try again."
        });
      }

      // Ensure customerId matches the authenticated user's customer ID
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        console.log("Customer not found for user ID:", req.user.id);
        return res.status(404).json({ message: "Customer profile not found" });
      }
      console.log("Customer found for pabili order:", customer.id);

      // Set the customer ID to the authenticated user's customer ID
      orderData.customerId = customer.id;

      // Mark as pabili order with isPabili flag
      orderData.isPabili = true;

      // Set initial order status
      orderData.status = OrderStatus.PENDING;

      // Add estimated delivery time (45-60 minutes from now for pabili orders)
      const estimatedDeliveryTime = new Date();
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 60);
      orderData.estimatedDeliveryTime = estimatedDeliveryTime;

      // Create the order
      const order = await storage.createOrder(orderData);

      // Notify available riders about the new order
      const activeRiders = await storage.getActiveRiders();
      for (const rider of activeRiders) {
        const riderWs = connectedRiders.get(rider.id);
        if (riderWs && riderWs.readyState === WebSocket.OPEN) {
          riderWs.send(
            JSON.stringify({
              type: "new_pabili_order",
              order,
            })
          );
        }
      }

      // Send notification to the customer via WebSocket
      const customerWs = connectedCustomers.get(customer.id);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(
          JSON.stringify({
            type: "order_status_update",
            order,
          })
        );
      }

      return res.status(201).json(order);
    } catch (error) {
      console.error("Error creating pabili order:", error);
      return res.status(500).json({ message: "Error creating pabili order" });
    }
  });

  // Get orders for the authenticated customer - SPECIFIC PATHS BEFORE PARAMETER PATHS
  app.get("/api/orders/customer", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      console.log("Fetching orders for customer user ID:", req.user.id);

      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        console.log("Customer profile not found for user ID:", req.user.id);
        return res.status(404).json({ message: "Customer profile not found" });
      }

      console.log("Found customer profile with ID:", customer.id);

      const orders = await storage.getOrdersByCustomerId(customer.id);
      console.log("Retrieved orders for customer:", orders.length);

      return res.json(orders);
    } catch (error) {
      console.error("Error fetching customer orders:", error);
      return res
        .status(500)
        .json({ message: "Error fetching customer orders" });
    }
  });

  // Removed duplicate route - Using consolidated route at the end of the file

  // Configure multer for memory storage
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });

  // Upload receipt for GCash payment
  app.post("/api/uploads/receipt", upload.single('receipt'), async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ message: "No receipt file uploaded" });
      }

      // Convert file buffer to base64 data URL
      const base64Data = req.file.buffer.toString('base64');
      const dataUrl = `data:${req.file.mimetype};base64,${base64Data}`;

      console.log('Receipt uploaded successfully:', {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size
      });

      return res.json({
        success: true,
        receiptUrl: dataUrl,
        message: "Receipt uploaded successfully",
      });

    } catch (error) {
      console.error("Error uploading receipt:", error);
      return res.status(500).json({ message: "Error uploading receipt" });
    }
  });

  // Cancel order (for customers only, only pending orders)
  app.patch("/api/orders/:id/cancel", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const orderId = parseInt(req.params.id);

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get customer profile to verify ownership
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      // Check if the order belongs to the customer
      if (order.customerId !== customer.id) {
        return res.status(403).json({ message: "You can only cancel your own orders" });
      }

      // Check if order can be cancelled (only pending orders)
      if (order.status !== OrderStatus.PENDING) {
        return res.status(400).json({
          message: "Order cannot be cancelled. Restaurant may have already confirmed it."
        });
      }

      // Update order status to cancelled
      const updatedOrder = await storage.updateOrder(orderId, {
        status: OrderStatus.CANCELLED
      });

      // Send notification to restaurant if order has restaurantId
      if (order.restaurantId) {
        const restaurantWs = connectedRestaurants.get(order.restaurantId);
        if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
          restaurantWs.send(
            JSON.stringify({
              type: "order_cancelled",
              order: updatedOrder,
            }),
          );
        }
      }

      // Send notification to customer
      const customerWs = connectedCustomers.get(order.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(
          JSON.stringify({
            type: "order_status_update",
            order: updatedOrder,
          }),
        );
      }

      return res.json(updatedOrder);
    } catch (error) {
      console.error("Error cancelling order:", error);
      return res.status(500).json({ message: "Error cancelling order" });
    }
  });

  // Update order status (for restaurant/rider/admin)
  app.patch("/api/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const orderId = parseInt(req.params.id);
      const { status } = req.body;

      if (!status || !Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ message: "Invalid order status" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Authorization check based on role and status transition
      if (req.user.role === UserRole.RESTAURANT) {
        // Restaurant can only update orders for their restaurant
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant || restaurant.id !== order.restaurantId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        // Restaurant can only update to these statuses
        const allowedStatusesForRestaurant = [
          OrderStatus.CONFIRMED,
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_PICKUP,
          OrderStatus.CANCELLED,
        ];

        if (!allowedStatusesForRestaurant.includes(status)) {
          return res
            .status(403)
            .json({ message: "Restaurant cannot set this status" });
        }
      } else if (req.user.role === UserRole.RIDER) {
        // Rider can only update orders assigned to them
        const rider = await storage.getRiderByUserId(req.user.id);
        if (!rider || rider.id !== order.riderId) {
          return res.status(403).json({ message: "Unauthorized" });
        }

        // Rider can only update to these statuses
        const allowedStatusesForRider = [
          OrderStatus.PICKED_UP,
          OrderStatus.ON_THE_WAY,
          OrderStatus.DELIVERED,
        ];

        if (!allowedStatusesForRider.includes(status)) {
          return res
            .status(403)
            .json({ message: "Rider cannot set this status" });
        }
      } else if (req.user.role !== UserRole.ADMIN) {
        // Customers cannot update order status
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Update the order status
      const updatedOrder = await storage.updateOrder(orderId, { status });

      // If delivered, set actual delivery time and award loyalty points
      if (status === OrderStatus.DELIVERED) {
        await storage.updateOrder(orderId, { actualDeliveryTime: new Date() });

        // Award loyalty points to customer
        try {
          const { calculatePointsFromOrder, calculateTierFromPoints, LoyaltyTransactionType } = await import("@shared/schema");

          // Get or create loyalty account
          let loyaltyAccount = await storage.getLoyaltyAccountByCustomerId(order.customerId);
          if (!loyaltyAccount) {
            loyaltyAccount = await storage.createLoyaltyAccount({
              customerId: order.customerId,
              pointsBalance: 0,
              lifetimePoints: 0,
              tier: "bronze",
            });
          }

          // Check if points already awarded for this order
          const existingTransaction = await storage.getLoyaltyTransactionByOrderId(orderId);
          if (!existingTransaction) {
            // Calculate points (1 point per ₱20 on subtotal + tips, excluding delivery fee)
            const orderSubtotal = (order.totalAmount || 0) - (order.deliveryFee || 0);
            const pointsEarned = calculatePointsFromOrder(orderSubtotal, (order.tipAmount || 0), loyaltyAccount.tier);

            if (pointsEarned > 0) {
              // Create transaction
              await storage.createLoyaltyTransaction({
                accountId: loyaltyAccount.id,
                orderId: orderId,
                type: LoyaltyTransactionType.EARN,
                pointsDelta: pointsEarned,
                description: `Points earned from order #${orderId}`,
              });

              // Update account balance
              const newBalance = loyaltyAccount.pointsBalance + pointsEarned;
              const newLifetimePoints = loyaltyAccount.lifetimePoints + pointsEarned;
              const newTier = calculateTierFromPoints(newLifetimePoints);

              await storage.updateLoyaltyAccount(loyaltyAccount.id, {
                pointsBalance: newBalance,
                lifetimePoints: newLifetimePoints,
                tier: newTier,
                lastActivityAt: new Date(),
                lastTierChangeAt: newTier !== loyaltyAccount.tier ? new Date() : loyaltyAccount.lastTierChangeAt,
              });

              console.log(`Awarded ${pointsEarned} loyalty points to customer ${order.customerId} for order ${orderId}`);
            }
          }
        } catch (loyaltyError) {
          // Log but don't fail the order status update
          console.error("Error awarding loyalty points:", loyaltyError);
        }
      }

      // Send notification to customer
      const customerWs = connectedCustomers.get(order.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(
          JSON.stringify({
            type: "order_status_update",
            order: updatedOrder,
          }),
        );
      }

      // Send notification to restaurant
      const restaurantWs = connectedRestaurants.get(order.restaurantId);
      if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
        restaurantWs.send(
          JSON.stringify({
            type: "order_status_update",
            order: updatedOrder,
          }),
        );
      }

      // Send notification to rider if assigned
      if (order.riderId) {
        const riderWs = connectedRiders.get(order.riderId);
        if (riderWs && riderWs.readyState === WebSocket.OPEN) {
          riderWs.send(
            JSON.stringify({
              type: "order_status_update",
              order: updatedOrder,
            }),
          );
        }
      }

      return res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.status(500).json({ message: "Error updating order status" });
    }
  });

  // ==================== Customer Feedback API ====================

  // Submit feedback (customers only, for delivered orders)
  app.post("/api/feedback", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const feedbackData = insertFeedbackSchema.parse(req.body);

      // Get customer profile
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      // Verify the order exists and belongs to the customer
      const order = await storage.getOrder(feedbackData.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.customerId !== customer.id) {
        return res.status(403).json({ message: "You can only provide feedback for your own orders" });
      }

      // Only allow feedback for delivered orders
      if (order.status !== OrderStatus.DELIVERED) {
        return res.status(400).json({ message: "Feedback can only be submitted for delivered orders" });
      }

      // Check if feedback already exists for this order
      const existingFeedback = await db
        .select()
        .from(feedback)
        .where(eq(feedback.orderId, feedbackData.orderId));

      if (existingFeedback.length > 0) {
        return res.status(400).json({ message: "Feedback already submitted for this order" });
      }

      // Create feedback with customer ID
      const newFeedback = await db
        .insert(feedback)
        .values({
          ...feedbackData,
          customerId: customer.id,
        })
        .returning();

      return res.json(newFeedback[0]);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      return res.status(500).json({ message: "Error submitting feedback" });
    }
  });

  // Get all feedback (admin only)
  app.get("/api/feedback", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const allFeedback = await db
        .select()
        .from(feedback)
        .orderBy(feedback.createdAt);

      return res.json(allFeedback);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // Get feedback for a specific restaurant (restaurant owners and admin)
  app.get("/api/feedback/restaurant/:restaurantId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const restaurantId = parseInt(req.params.restaurantId);

    try {
      // Authorization check
      if (req.user.role === UserRole.RESTAURANT) {
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant || restaurant.id !== restaurantId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const restaurantFeedback = await db
        .select()
        .from(feedback)
        .where(eq(feedback.restaurantId, restaurantId))
        .orderBy(feedback.createdAt);

      return res.json(restaurantFeedback);
    } catch (error) {
      console.error("Error fetching restaurant feedback:", error);
      return res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // Get feedback for a specific order (admin and restaurant owners)
  app.get("/api/feedback/order/:orderId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const orderId = parseInt(req.params.orderId);

    try {
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Authorization check - admin or restaurant owner
      if (req.user.role === UserRole.RESTAURANT) {
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant || restaurant.id !== order.restaurantId) {
          return res.status(403).json({ message: "Unauthorized" });
        }
      } else if (req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const orderFeedback = await db
        .select()
        .from(feedback)
        .where(eq(feedback.orderId, orderId))
        .orderBy(feedback.createdAt);

      return res.json(orderFeedback);
    } catch (error) {
      console.error("Error fetching order feedback:", error);
      return res.status(500).json({ message: "Error fetching order feedback" });
    }
  });

  // ==================== Rider Feedback API (Riders rating customers) ====================

  // Submit rider feedback about customer (riders only, for delivered orders)
  app.post("/api/rider-feedback", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const feedbackData = insertRiderFeedbackSchema.parse(req.body);

      // Get rider profile
      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
      }

      // Verify the order exists and was delivered by this rider
      const order = await storage.getOrder(feedbackData.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.riderId !== rider.id) {
        return res.status(403).json({ message: "You can only provide feedback for orders you delivered" });
      }

      // Only allow feedback for delivered orders
      if (order.status !== OrderStatus.DELIVERED) {
        return res.status(400).json({ message: "Feedback can only be submitted for delivered orders" });
      }

      // Check if feedback already exists for this order
      const existingFeedback = await db
        .select()
        .from(riderFeedback)
        .where(eq(riderFeedback.orderId, feedbackData.orderId));

      if (existingFeedback.length > 0) {
        return res.status(400).json({ message: "Feedback already submitted for this order" });
      }

      // Create rider feedback with rider ID
      const newFeedback = await db
        .insert(riderFeedback)
        .values({
          ...feedbackData,
          riderId: rider.id,
        })
        .returning();

      return res.json(newFeedback[0]);
    } catch (error) {
      console.error("Error submitting rider feedback:", error);
      return res.status(500).json({ message: "Error submitting feedback" });
    }
  });

  // Check if rider feedback exists for an order (riders only)
  app.get("/api/rider-feedback/order/:orderId", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const orderId = parseInt(req.params.orderId);

    try {
      // Get rider profile
      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
      }

      const riderFeedbackData = await db
        .select()
        .from(riderFeedback)
        .where(eq(riderFeedback.orderId, orderId));

      return res.json(riderFeedbackData);
    } catch (error) {
      console.error("Error fetching rider feedback:", error);
      return res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // Get all rider feedback for a customer (admin only)
  app.get("/api/rider-feedback/customer/:customerId", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const customerId = parseInt(req.params.customerId);

    try {
      const customerFeedback = await db
        .select()
        .from(riderFeedback)
        .where(eq(riderFeedback.customerId, customerId))
        .orderBy(riderFeedback.createdAt);

      return res.json(customerFeedback);
    } catch (error) {
      console.error("Error fetching customer feedback:", error);
      return res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // Get all rider feedback (admin only)
  app.get("/api/rider-feedback", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const allRiderFeedback = await db
        .select()
        .from(riderFeedback)
        .orderBy(riderFeedback.createdAt);

      return res.json(allRiderFeedback);
    } catch (error) {
      console.error("Error fetching rider feedback:", error);
      return res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // ==================== Restaurant API ====================

  // ==================== User API ====================

  // Get all users (admin only)
  app.get("/api/users", async (req, res) => {
    console.log(
      "GET /api/users - Auth status:",
      req.isAuthenticated(),
      "Role:",
      req.user?.role,
    );

    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Direct database query to ensure we get all users
      const result = await db.select().from(users);
      console.log("Users retrieved from db:", result.length);

      // Remove sensitive info from users
      const sanitizedUsers = result.map((user) => {
        const { password, otpSecret, ...userWithoutSensitiveInfo } = user;
        return userWithoutSensitiveInfo;
      });

      console.log("Sanitized users:", sanitizedUsers.length);

      // Send the response
      return res.json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Error fetching users" });
    }
  });

  // REMOVED: Duplicate admin-only user update endpoint
  // The proper endpoint that allows both admin updates and self-updates is defined later in the file

  // Delete user (admin only)
  app.delete("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Prevent admin from deleting themselves
    if (req.user.id === id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    try {
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      console.log(`Admin ${req.user.id} deleting user ${id} (${user.username}) with role ${user.role}`);

      // Use a transaction to ensure all deletes succeed or all fail
      await db.transaction(async (tx) => {
        // Delete from ALL related tables regardless of current role
        // (user might have changed roles and have records in multiple tables)

        // First, find and delete dependent records
        // Get restaurant ID if user has a restaurant
        const userRestaurants = await tx.select().from(restaurants).where(eq(restaurants.userId, id));

        if (userRestaurants.length > 0) {
          // Delete menu items for all restaurants owned by this user
          for (const restaurant of userRestaurants) {
            const deletedMenuItems = await tx.delete(menuItems).where(eq(menuItems.restaurantId, restaurant.id));
            console.log(`Deleted ${deletedMenuItems.rowCount} menu items for restaurant ${restaurant.id}`);
          }

          // Delete the restaurant records
          const deletedRestaurants = await tx.delete(restaurants).where(eq(restaurants.userId, id));
          console.log(`Deleted ${deletedRestaurants.rowCount} restaurant records for user ${id}`);
        }

        // Delete rider records (user might have been a rider at some point)
        const deletedRiders = await tx.delete(riders).where(eq(riders.userId, id));
        if (deletedRiders.rowCount && deletedRiders.rowCount > 0) {
          console.log(`Deleted ${deletedRiders.rowCount} rider records for user ${id}`);
        }

        // Delete customer records (user might have been a customer at some point)
        const deletedCustomers = await tx.delete(customers).where(eq(customers.userId, id));
        if (deletedCustomers.rowCount && deletedCustomers.rowCount > 0) {
          console.log(`Deleted ${deletedCustomers.rowCount} customer records for user ${id}`);
        }

        // Note: Orders are kept for historical records even if user is deleted
        // This maintains order history and financial records

        // Finally, delete the user record
        const deletedRows = await tx.delete(users).where(eq(users.id, id));

        if (!deletedRows.rowCount || deletedRows.rowCount === 0) {
          throw new Error("Failed to delete user record");
        }

        console.log(`Successfully deleted user ${id} and all associated records`);
      });

      res.json({ message: "User and all associated records deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Server error deleting user" });
    }
  });

  // Get restaurant by current user ID - PUT SPECIFIC PATHS BEFORE PARAM PATHS
  app.get("/api/restaurants/by-user", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const restaurant = await storage.getRestaurantByUserId(req.user.id);

      // If no restaurant found, return 404 with null data explicitly
      if (!restaurant) {
        return res.status(404).json(null);
      }

      res.json(restaurant);
    } catch (error) {
      console.error("Error fetching restaurant by user ID:", error);
      res.status(500).json({ message: "Server error fetching restaurant" });
    }
  });

  // Get active restaurants
  app.get("/api/restaurants/active", async (req, res) => {
    const restaurants = await storage.getApprovedRestaurants();
    res.json(restaurants);
  });

  // Get restaurant list (alias for all restaurants)
  app.get("/api/restaurants/list", async (req, res) => {
    try {
      console.log("Fetching restaurant list");
      const restaurants = await storage.getAllRestaurants();
      console.log(`Retrieved ${restaurants.length} restaurants`);
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching restaurant list:", error);
      res.status(500).json({ message: "Error fetching restaurant list" });
    }
  });

  // Get all restaurants
  app.get("/api/restaurants", async (req, res) => {
    try {
      const restaurants = await storage.getAllRestaurants();
      res.json(restaurants);
    } catch (error) {
      console.error("Error fetching all restaurants:", error);
      res.status(500).json({ message: "Error fetching restaurants" });
    }
  });

  // Get restaurant by ID - PUT PARAMETER ROUTES LAST
  app.get("/api/restaurants/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const restaurant = await storage.getRestaurant(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    res.json(restaurant);
  });

  // Create restaurant
  app.post("/api/restaurants", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Allow both ADMIN and RESTAURANT roles to create restaurants
    if (
      req.user.role !== UserRole.ADMIN &&
      req.user.role !== UserRole.RESTAURANT
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // If restaurant user, ensure they don't already have a restaurant
    if (req.user.role === UserRole.RESTAURANT) {
      const existingRestaurant = await storage.getRestaurantByUserId(
        req.user.id,
      );
      if (existingRestaurant) {
        return res
          .status(400)
          .json({ message: "You already have a restaurant" });
      }

      // Ensure the userId in the request matches the current user
      req.body.userId = req.user.id;
    }

    try {
      const validatedData = insertRestaurantSchema.parse(req.body);

      // Check radius limit settings for new restaurant applications
      const settings = await storage.getAllSettings();
      const radiusEnabled = settings.find(s => s.key === 'restaurantApplicationRadiusEnabled')?.value === 'true';

      if (radiusEnabled) {
        // Import utilities
        const { calculateDistance, validateLatitude, validateLongitude, validateRadius } = await import('./utils');

        // Get radius limit settings
        const centerLat = parseFloat(settings.find(s => s.key === 'restaurantApplicationCenterLat')?.value || '0');
        const centerLng = parseFloat(settings.find(s => s.key === 'restaurantApplicationCenterLng')?.value || '0');
        const radiusKm = parseFloat(settings.find(s => s.key === 'restaurantApplicationRadiusKm')?.value || '10');

        // Check if restaurant location is provided
        if (validatedData.latitude === null || validatedData.longitude === null ||
            validatedData.latitude === undefined || validatedData.longitude === undefined) {
          return res.status(400).json({
            message: "Restaurant location (latitude and longitude) is required when radius limit is enabled"
          });
        }

        // Validate coordinates
        if (!validateLatitude(validatedData.latitude) || !validateLongitude(validatedData.longitude)) {
          return res.status(400).json({
            message: "Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180"
          });
        }

        if (!validateLatitude(centerLat) || !validateLongitude(centerLng) || !validateRadius(radiusKm)) {
          console.error('Invalid radius limit configuration:', { centerLat, centerLng, radiusKm });
          // Allow creation if settings are invalid (don't break the feature)
        } else {
          // Calculate distance from center
          const distance = calculateDistance(
            centerLat,
            centerLng,
            validatedData.latitude,
            validatedData.longitude
          );

          // Check if restaurant is within allowed radius
          if (distance > radiusKm) {
            return res.status(400).json({
              message: `Restaurant location is outside the allowed application radius (${distance.toFixed(2)} km > ${radiusKm} km). Restaurants can only apply within ${radiusKm} km of the service area.`
            });
          }
        }
      }

      const restaurant = await storage.createRestaurant(validatedData);
      res.status(201).json(restaurant);
    } catch (error) {
      res.status(400).json({ message: "Invalid restaurant data", error });
    }
  });

  // Update restaurant
  app.patch("/api/restaurants/:id", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== UserRole.ADMIN &&
        req.user.role !== UserRole.RESTAURANT)
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // If restaurant user, verify they own this restaurant
    if (req.user.role === UserRole.RESTAURANT) {
      const restaurant = await storage.getRestaurantByUserId(req.user.id);
      if (!restaurant || restaurant.id !== id) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      // Restaurant owners cannot update approval status
      if (req.body.hasOwnProperty("isApproved")) {
        delete req.body.isApproved;
      }
    }

    try {
      const updatedRestaurant = await storage.updateRestaurant(id, req.body);
      if (!updatedRestaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      res.json(updatedRestaurant);
    } catch (error) {
      res.status(400).json({ message: "Invalid restaurant data", error });
    }
  });

  // Approve/Reject restaurant (admin only)
  app.patch("/api/restaurants/:id/approval", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const { isApproved } = req.body;
    if (typeof isApproved !== "boolean") {
      return res
        .status(400)
        .json({ message: "isApproved must be a boolean value" });
    }

    try {
      const updatedRestaurant = await storage.updateRestaurant(id, {
        isApproved,
      });
      if (!updatedRestaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      res.json(updatedRestaurant);
    } catch (error) {
      res
        .status(400)
        .json({
          message: "Failed to update restaurant approval status",
          error,
        });
    }
  });

  // Update restaurant business permit
  app.put("/api/restaurants/business-permit", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RESTAURANT) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { businessPermitUrl } = req.body;

      if (!businessPermitUrl) {
        return res.status(400).json({ message: "Business permit URL is required" });
      }

      // Get the restaurant associated with this user
      const restaurant = await storage.getRestaurantByUserId(req.user.id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      // Normalize the object path using object storage service
      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(businessPermitUrl);

      // Update the restaurant with the business permit URL
      const updatedRestaurant = await storage.updateRestaurant(restaurant.id, {
        businessPermitUrl: objectPath,
      });

      if (!updatedRestaurant) {
        return res.status(500).json({ message: "Failed to update business permit" });
      }

      res.json({
        message: "Business permit uploaded successfully",
        objectPath: objectPath,
        restaurant: updatedRestaurant
      });

    } catch (error) {
      console.error("Error updating business permit:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Archive restaurant (admin only)
  app.delete("/api/restaurants/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    try {
      // Check if restaurant exists
      const restaurant = await storage.getRestaurant(id);
      if (!restaurant) {
        return res.status(404).json({ message: "Restaurant not found" });
      }

      // Check for active orders
      const orders = await storage.getOrdersByRestaurantId(id);
      const activeOrders = orders.filter(order =>
        ![OrderStatus.DELIVERED, OrderStatus.CANCELLED].includes(order.status as any)
      );

      if (activeOrders.length > 0) {
        return res.status(400).json({
          message: "Cannot remove restaurant with active orders",
          activeOrdersCount: activeOrders.length
        });
      }

      // Archive the restaurant (soft delete)
      const updatedRestaurant = await storage.updateRestaurant(id, {
        isArchived: true,
        isActive: false,
      });

      if (!updatedRestaurant) {
        return res.status(500).json({ message: "Failed to archive restaurant" });
      }

      res.status(200).json({
        message: "Restaurant removed successfully",
        id
      });
    } catch (error) {
      console.error("Error removing restaurant:", error);
      res.status(500).json({ message: "Error removing restaurant", error });
    }
  });

  // ==================== Menu Item API ====================

  // Get all menu items (admin only)
  app.get("/api/menu-items", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Get all restaurants first
      const restaurants = await storage.getAllRestaurants();

      // Fetch menu items for each restaurant
      let allMenuItems: MenuItem[] = [];
      for (const restaurant of restaurants) {
        const menuItems = await storage.getMenuItemsByRestaurantId(
          restaurant.id,
        );
        allMenuItems = [...allMenuItems, ...menuItems];
      }

      res.json(allMenuItems);
    } catch (error) {
      console.error("Error fetching menu items:", error);
      res.status(500).json({ message: "Server error fetching menu items" });
    }
  });

  // Get menu item by ID
  app.get("/api/menu-items/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }

    try {
      const menuItem = await storage.getMenuItem(id);
      if (!menuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      res.json(menuItem);
    } catch (error) {
      console.error("Error fetching menu item:", error);
      res.status(500).json({ message: "Server error fetching menu item" });
    }
  });

  // Get menu items for the authenticated restaurant
  app.get("/api/restaurants/my/menu", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RESTAURANT) {
      return res
        .status(403)
        .json({
          message:
            "Unauthorized. Only restaurant owners can access this endpoint",
        });
    }

    try {
      const restaurant = await storage.getRestaurantByUserId(req.user.id);

      if (!restaurant) {
        return res
          .status(404)
          .json({ message: "Restaurant not found for this user" });
      }

      console.log(`Fetching menu items for restaurant ID: ${restaurant.id}`);
      const menuItems = await storage.getMenuItemsByRestaurantId(restaurant.id);
      res.json(menuItems);
    } catch (error) {
      console.error("Error fetching restaurant menu:", error);
      res.status(400).json({ message: "Invalid restaurant ID" });
    }
  });

  // Get menu items by restaurant ID
  app.get("/api/restaurants/:id/menu", async (req, res) => {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // If authenticated as a restaurant, ensure they can only access their own menu
    if (req.isAuthenticated() && req.user.role === UserRole.RESTAURANT) {
      const userRestaurant = await storage.getRestaurantByUserId(req.user.id);

      // If requesting a different restaurant's menu, deny access
      if (userRestaurant && userRestaurant.id !== restaurantId) {
        return res
          .status(403)
          .json({ message: "You can only access your own restaurant's menu" });
      }
    }

    const menuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
    res.json(menuItems);
  });

  // Get menu items by restaurant ID (alternate endpoint for consistency)
  app.get("/api/restaurants/:id/menu-items", async (req, res) => {
    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    const menuItems = await storage.getMenuItemsByRestaurantId(restaurantId);
    res.json(menuItems);
  });

  // Add menu item to a specific restaurant
  app.post("/api/restaurants/:id/menu-items", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== UserRole.RESTAURANT &&
        req.user.role !== UserRole.ADMIN)
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    try {
      // If restaurant user, verify the restaurant belongs to this user
      if (req.user.role === UserRole.RESTAURANT) {
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant || restaurant.id !== restaurantId) {
          return res
            .status(403)
            .json({
              message: "Unauthorized to add menu items to this restaurant",
            });
        }
      }
      // Admin can add menu items to any restaurant

      const validatedData = insertMenuItemSchema.parse({
        ...req.body,
        restaurantId,
      });

      const menuItem = await storage.createMenuItem(validatedData);
      res.status(201).json(menuItem);
    } catch (error) {
      console.error("Error adding menu item:", error);
      res.status(400).json({ message: "Invalid menu item data", error });
    }
  });

  // Add menu item
  app.post("/api/menu-items", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== UserRole.RESTAURANT &&
        req.user.role !== UserRole.ADMIN)
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      let restaurantId = req.body.restaurantId;

      if (req.user.role === UserRole.RESTAURANT) {
        // If restaurant user, verify the restaurant belongs to this user and use their restaurant ID
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant) {
          return res
            .status(403)
            .json({ message: "No restaurant found for this user" });
        }
        restaurantId = restaurant.id;
      } else if (req.user.role === UserRole.ADMIN) {
        // If admin, verify the provided restaurant ID exists
        if (!restaurantId) {
          return res.status(400).json({ message: "Restaurant ID is required" });
        }

        const restaurant = await storage.getRestaurant(restaurantId);
        if (!restaurant) {
          return res.status(404).json({ message: "Restaurant not found" });
        }
      }

      const validatedData = insertMenuItemSchema.parse({
        ...req.body,
        restaurantId,
      });

      const menuItem = await storage.createMenuItem(validatedData);
      res.status(201).json(menuItem);
    } catch (error) {
      res.status(400).json({ message: "Invalid menu item data", error });
    }
  });

  // Update menu item
  app.patch("/api/menu-items/:id", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== UserRole.RESTAURANT &&
        req.user.role !== UserRole.ADMIN)
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }

    try {
      // Get the menu item first
      const menuItem = await storage.getMenuItem(id);
      if (!menuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      if (req.user.role === UserRole.RESTAURANT) {
        // If restaurant user, verify the restaurant belongs to this user
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant) {
          return res
            .status(403)
            .json({ message: "No restaurant found for this user" });
        }

        // Verify the menu item belongs to this restaurant
        if (menuItem.restaurantId !== restaurant.id) {
          return res
            .status(403)
            .json({ message: "Unauthorized to modify this menu item" });
        }
      }

      // Admin can edit any menu item, no additional checks needed

      const updatedMenuItem = await storage.updateMenuItem(id, req.body);
      if (!updatedMenuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      res.json(updatedMenuItem);
    } catch (error) {
      res.status(400).json({ message: "Invalid menu item data", error });
    }
  });

  // Delete menu item
  app.delete("/api/menu-items/:id", async (req, res) => {
    if (
      !req.isAuthenticated() ||
      (req.user.role !== UserRole.RESTAURANT &&
        req.user.role !== UserRole.ADMIN)
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid menu item ID" });
    }

    try {
      // Get the menu item first
      const menuItem = await storage.getMenuItem(id);
      if (!menuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      if (req.user.role === UserRole.RESTAURANT) {
        // If restaurant user, verify the restaurant belongs to this user
        const restaurant = await storage.getRestaurantByUserId(req.user.id);
        if (!restaurant) {
          return res
            .status(403)
            .json({ message: "No restaurant found for this user" });
        }

        // Verify the menu item belongs to this restaurant
        if (menuItem.restaurantId !== restaurant.id) {
          return res
            .status(403)
            .json({ message: "Unauthorized to delete this menu item" });
        }
      }

      // Admin can delete any menu item, no additional checks needed

      // For simplicity, we'll just mark it as unavailable instead of deleting
      const updatedMenuItem = await storage.updateMenuItem(id, {
        isAvailable: false,
      });
      if (!updatedMenuItem) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      res.json({ message: "Menu item marked as unavailable" });
    } catch (error) {
      res.status(400).json({ message: "Invalid request", error });
    }
  });

  // ==================== Rider API ====================

  // Get all riders (admin only)
  app.get("/api/riders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const riders = await storage.getAllRiders();
    res.json(riders);
  });

  // Get active riders (admin only)
  app.get("/api/riders/active", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const riders = await storage.getActiveRiders();
    res.json(riders);
  });

  // Get waiting riders queue (admin only)
  app.get("/api/riders/queue", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const riders = await storage.getWaitingRiders();
    res.json(riders);
  });

  // Get available orders for current rider based on queue position
  app.get("/api/riders/available-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
      }

      // Only show orders to riders with ACTIVE status
      if (rider.status !== RiderStatus.ACTIVE) {
        return res.json([]);
      }

      // Get all orders that are available for riders to accept
      // Regular orders: confirmed and ready_for_pickup status
      // Pabili orders: pending status (they start as pending and can be accepted immediately)
      const confirmedOrders = await storage.getOrdersByStatus("confirmed");
      const readyOrders = await storage.getOrdersByStatus("ready_for_pickup");
      const pendingOrders = await storage.getOrdersByStatus("pending");

      // Filter pending orders to only include pabili orders
      const pendingPabiliOrders = pendingOrders.filter(order => order.isPabili);

      const allAvailableOrders = [...confirmedOrders, ...readyOrders, ...pendingPabiliOrders];
      const unassignedOrders = allAvailableOrders.filter(order => !order.riderId);

      console.log(`Total available orders before filtering: ${allAvailableOrders.length}`);
      console.log(`Pabili orders in available: ${allAvailableOrders.filter(o => o.isPabili).length}`);
      console.log(`Unassigned orders: ${unassignedOrders.length}`);
      console.log(`Unassigned pabili orders: ${unassignedOrders.filter(o => o.isPabili).length}`);

      // If no orders available, return empty array
      if (unassignedOrders.length === 0) {
        return res.json([]);
      }

      // Get all active riders ordered by queue position
      const activeRiders = await storage.getActiveRiders();
      const queuedRiders = activeRiders
        .filter(r => r.queuePosition !== null)
        .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

      // Find current rider's position in queue
      let riderQueueIndex = queuedRiders.findIndex(r => r.id === rider.id);

      if (riderQueueIndex === -1) {
        // Rider not in queue, assign them next available position
        const nextPosition = queuedRiders.length > 0
          ? Math.max(...queuedRiders.map(r => r.queuePosition || 0)) + 1
          : 1;

        await storage.updateRider(rider.id, { queuePosition: nextPosition });
        riderQueueIndex = queuedRiders.length; // They're now at the end
      }

      // Show ALL available orders to rider, but add queue priority information
      const availableOrdersForRider = unassignedOrders;

      console.log(`Queue Info - Rider ${rider.id}: Queue position ${rider.queuePosition || 'none'}, Total riders: ${queuedRiders.length}, Available orders: ${unassignedOrders.length}`);

      // Add queue priority metadata to each order for display purposes
      const ordersWithQueueInfo = availableOrdersForRider.map((order, index) => {
        const queuePriority = queuedRiders.length > 0 ? (index % queuedRiders.length) + 1 : 1;
        const isHighPriority = riderQueueIndex >= 0 && queuePriority === (riderQueueIndex + 1);

        return {
          ...order,
          queueInfo: {
            priority: queuePriority,
            isHighPriority,
            yourPosition: rider.queuePosition || 0,
            totalRiders: queuedRiders.length
          }
        };
      });

      // Enhance orders with restaurant and customer details
      const enhancedOrders = await Promise.all(
        ordersWithQueueInfo.map(async (order) => {
          try {
            const customer = await storage.getCustomer(order.customerId);
            const customerUser = customer ? await storage.getUser(customer.userId) : null;

            if (order.isPabili) {
              const pabiliDetails = order.pabiliDetails as any;
              return {
                ...order,
                restaurantName: "Pabili Order",
                restaurantAddress: pabiliDetails?.pickupLocation?.address || "Unknown location",
                customerName: customerUser?.fullName || customerUser?.username || "Unknown Customer",
                customerPhone: customerUser?.phone || "Not provided",
                pickupLocation: pabiliDetails?.pickupLocation || null,
              };
            } else {
              const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;
              const restaurantUser = restaurant ? await storage.getUser(restaurant.userId) : null;

              return {
                ...order,
                restaurantName: restaurant?.name || "Unknown Restaurant",
                restaurantAddress: restaurant?.address || "Unknown address",
                restaurantPhone: restaurantUser?.phone || "Not provided",
                customerName: customerUser?.fullName || customerUser?.username || "Unknown Customer",
                customerPhone: customerUser?.phone || "Not provided",
              };
            }
          } catch (err) {
            console.error(`Error enhancing order ${order.id}:`, err);
            return order;
          }
        })
      );

      res.json(enhancedOrders);
    } catch (error) {
      console.error("Error fetching available orders for rider:", error);
      res.status(500).json({ message: "Server error fetching available orders" });
    }
  });

  // Get current rider (for rider dashboard)
  app.get("/api/riders/current", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      console.log("Fetching rider profile for user ID:", req.user.id);

      // First check if there's a rider with this userId
      let rider = await storage.getRiderByUserId(req.user.id);

      if (!rider) {
        console.log("No rider profile found for user ID:", req.user.id);

        // Create a rider profile automatically if a rider doesn't exist
        console.log("Creating default rider profile for rider user");

        // Create a basic rider profile with ACTIVE status by default
        rider = await storage.createRider({
          userId: req.user.id,
          licenseNumber: "PENDING",
          vehicleType: "motorcycle",
          vehiclePlateNumber: "PENDING",
          status: RiderStatus.ACTIVE, // ACTIVE by default when logged in
          currentLocation: {},
          isVerified: false,
        });

        console.log("Created rider profile with ID:", rider.id);
      } else {
        // Update to ACTIVE status if rider already exists
        if (rider.status !== RiderStatus.ACTIVE) {
          console.log("Setting rider to ACTIVE status, ID:", rider.id);
          const updatedRider = await storage.updateRider(rider.id, { status: RiderStatus.ACTIVE });
          if (updatedRider) {
            rider = updatedRider;
          }
        }
      }

      if (!rider) {
        return res.status(500).json({ message: "Failed to get or create rider profile" });
      }

      console.log("Returning rider profile with ID:", rider.id);
      res.json(rider);
    } catch (error) {
      console.error("Error getting/creating rider profile:", error);
      return res.status(500).json({ message: "Error accessing rider profile" });
    }
  });

  // Get current rider orders
  app.get("/api/riders/orders/current", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      console.log("Fetching rider profile for orders, user ID:", req.user.id);
      const rider = await storage.getRiderByUserId(req.user.id);

      if (!rider) {
        console.log("No rider profile found for user ID:", req.user.id);
        // If we don't have a rider profile yet, just return empty orders
        return res.json([]);
      }

      console.log("Found rider profile with ID:", rider.id);

      // Get orders that are assigned to this rider and are in progress
      const orders = await storage.getOrdersByRiderId(rider.id);
      const activeOrders = orders.filter((order) =>
        ["confirmed", "ready_for_pickup", "picked_up", "on_the_way", "purchasing"].includes(
          order.status,
        ),
      );

      // Enhance orders with restaurant and customer details including location
      const enhancedOrders = await Promise.all(
        activeOrders.map(async (order) => {
          const customer = await storage.getCustomer(order.customerId);
          const customerUser = customer ? await storage.getUser(customer.userId) : null;

          // Handle pabili orders differently
          if (order.isPabili) {
            const pabiliDetails = order.pabiliDetails as any;
            return {
              ...order,
              restaurantName: "Pabili Order",
              restaurantAddress: pabiliDetails?.pickupLocation?.address || "Pickup Location",
              restaurantLatitude: pabiliDetails?.pickupLocation?.lat,
              restaurantLongitude: pabiliDetails?.pickupLocation?.lng,
              customerName: customerUser ? customerUser.fullName : undefined,
              customerPhone: customerUser ? customerUser.phone : undefined,
              customerAddress: order.deliveryAddress || undefined,
            };
          }

          // Handle regular restaurant orders
          const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;
          return {
            ...order,
            restaurantName: restaurant ? restaurant.name : undefined,
            restaurantAddress: restaurant ? restaurant.address : undefined,
            restaurantPhone: restaurant ? restaurant.phone : undefined,
            restaurantLatitude: restaurant ? restaurant.latitude : undefined,
            restaurantLongitude: restaurant ? restaurant.longitude : undefined,
            customerName: customerUser ? customerUser.fullName : undefined,
            customerPhone: customerUser ? customerUser.phone : undefined,
            customerAddress: order.deliveryAddress || undefined,
          };
        }),
      );

      res.json(enhancedOrders);
    } catch (error) {
      console.error("Error getting rider orders:", error);
      return res.status(500).json({ message: "Error retrieving rider orders" });
    }
  });

  // Get rider order history
  app.get("/api/riders/orders/history", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Get completed or cancelled orders for this rider
    const orders = await storage.getOrdersByRiderId(rider.id);
    const completedOrders = orders.filter((order) =>
      ["delivered", "cancelled"].includes(order.status),
    );

    res.json(completedOrders);
  });

  // Get orders for a specific restaurant (restaurant owner or admin only)
  app.get("/api/restaurants/:id/orders", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const restaurantId = parseInt(req.params.id);
    if (isNaN(restaurantId)) {
      return res.status(400).json({ message: "Invalid restaurant ID" });
    }

    // If restaurant user, verify they own this restaurant
    if (req.user.role === UserRole.RESTAURANT) {
      const restaurant = await storage.getRestaurantByUserId(req.user.id);
      if (!restaurant || restaurant.id !== restaurantId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    } else if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Get base orders
      const orders = await storage.getOrdersByRestaurantId(restaurantId);

      // Enhanced orders with customer details
      const enhancedOrders = await Promise.all(
        orders.map(async (order) => {
          try {
            // Get customer data
            const customer = await storage.getCustomer(order.customerId);
            if (customer) {
              // Get user data for the customer
              const user = await storage.getUser(customer.userId);
              if (user) {
                return {
                  ...order,
                  customerName: user.fullName || user.username,
                  customerPhone: user.phone || "Not provided",
                };
              }
            }
            return order;
          } catch (err) {
            console.error(`Error enhancing order ${order.id}:`, err);
            return order;
          }
        }),
      );

      return res.json(enhancedOrders);
    } catch (error) {
      console.error(
        `Error fetching orders for restaurant ${restaurantId}:`,
        error,
      );
      return res
        .status(500)
        .json({ message: "Error fetching restaurant orders" });
    }
  });

  // Get rider by ID (for customer order tracking)
  app.get("/api/riders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    try {
      const rider = await storage.getRider(id);
      if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
      }

      // Get user details to get the rider's name
      const riderUser = await storage.getUser(rider.userId);

      // For customers viewing orders, include these fields
      const riderWithName = {
        ...rider,
        name: riderUser
          ? riderUser.fullName || riderUser.username
          : "Unknown Rider",
        phone: riderUser ? riderUser.phone : null,
      };

      res.json(riderWithName);
    } catch (error) {
      console.error("Error fetching rider:", error);
      res.status(500).json({ message: "Server error fetching rider" });
    }
  });

  // Update rider status
  app.patch("/api/riders/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const { status } = req.body;
    if (!status || !Object.values(RiderStatus).includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    try {
      const updatedRider = await storage.updateRider(rider.id, { status });

      // Sync user's isActive field based on rider status
      const isActive = status === RiderStatus.ACTIVE || status === RiderStatus.BUSY || status === RiderStatus.WAITING;
      await storage.updateUser(req.user.id, { isActive });
      console.log(`Synced user ${req.user.id} isActive to ${isActive} based on rider status: ${status}`);

      res.json(updatedRider);
    } catch (error) {
      res.status(500).json({ message: "Error updating status", error });
    }
  });

  // Accept order
  app.post("/api/riders/orders/:id/accept", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Only active riders can accept orders
    if (rider.status !== "active") {
      return res
        .status(400)
        .json({ message: "Rider must be active to accept orders" });
    }

    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if order is available for acceptance
    const isRegularOrder = (order.status === "confirmed" || order.status === "ready_for_pickup") && !order.riderId;
    const isPabiliOrder = order.isPabili && (order.status === "pending" || order.status === "confirmed") && !order.riderId;

    if (!isRegularOrder && !isPabiliOrder) {
      return res
        .status(400)
        .json({ message: "Order is not available for pickup" });
    }

    try {
      // Update rider status to busy
      await storage.updateRider(rider.id, { status: RiderStatus.BUSY });

      // For pabili orders, set status to "purchasing" immediately
      // For regular orders, transition from "confirmed" to "ready_for_pickup"
      const newStatus = order.isPabili ? "purchasing" : "ready_for_pickup";

      // Assign rider to order and update status if needed
      const updatedOrder = await storage.updateOrder(id, {
        riderId: rider.id,
        status: newStatus
      });

      // Notify customer about order acceptance
      const customer = await storage.getCustomer(order.customerId);
      if (customer) {
        const customerWs = connectedCustomers.get(customer.id);
        if (customerWs && customerWs.readyState === WebSocket.OPEN) {
          customerWs.send(
            JSON.stringify({
              type: "order_status_update",
              order: updatedOrder,
            })
          );
        }
      }

      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Error accepting order", error });
    }
  });

  // Update order status (for rider)
  app.patch("/api/riders/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const allowedStatuses = ["picked_up", "on_the_way", "delivered"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status for rider" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Verify the order is assigned to this rider
    if (order.riderId !== rider.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized: Order not assigned to this rider" });
    }

    try {
      const updatedOrder = await storage.updateOrder(id, { status });

      // If order is delivered, update rider status back to active
      if (status === "delivered") {
        await storage.updateRider(rider.id, { status: RiderStatus.ACTIVE });
      }

      // Get related entities for notifications
      const customer = await storage.getCustomer(order.customerId);
      const restaurant = await storage.getRestaurant(order.restaurantId);

      // Create notification data based on the status change
      let notificationMessage = "";
      let notificationType: "info" | "success" | "warning" | "error" = "info";

      switch (status) {
        case "picked_up":
          notificationMessage = `Order #${order.id} has been picked up by the rider`;
          notificationType = "info";
          break;
        case "on_the_way":
          notificationMessage = `Order #${order.id} is on the way to delivery`;
          notificationType = "info";
          break;
        case "delivered":
          notificationMessage = `Order #${order.id} has been delivered successfully`;
          notificationType = "success";
          break;
        default:
          notificationMessage = `Order #${order.id} status changed to ${status}`;
          notificationType = "info";
      }

      // Determine recipients based on the status
      const recipients: {
        admins?: boolean;
        restaurantIds?: number[];
        customerIds?: number[];
      } = {
        admins: true, // Always notify admins about order status changes
      };

      // Always notify the customer
      if (customer) {
        recipients.customerIds = [order.customerId];
      }

      // Notify restaurant for certain statuses (picked_up)
      if (status === "picked_up") {
        recipients.restaurantIds = [order.restaurantId];
      }

      // Create notification object
      const notification = {
        id: `order_${order.id}_${status}_${Date.now()}`,
        message: notificationMessage,
        type: notificationType,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification via WebSocket
      // Send to all admin recipients
      if (recipients.admins) {
        adminConnections.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      // Send to specific restaurant recipients
      if (recipients.restaurantIds && recipients.restaurantIds.length > 0) {
        recipients.restaurantIds.forEach((restaurantId) => {
          const restaurantWs = connectedRestaurants.get(restaurantId);
          if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
            restaurantWs.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      // Send to specific customer recipients
      if (recipients.customerIds && recipients.customerIds.length > 0) {
        recipients.customerIds.forEach((customerId) => {
          const customerWs = connectedCustomers.get(customerId);
          if (customerWs && customerWs.readyState === WebSocket.OPEN) {
            customerWs.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      res.json(updatedOrder);
    } catch (error) {
      res.status(500).json({ message: "Error updating order status", error });
    }
  });

  // Register rider (admin only or during registration)
  app.post("/api/riders", async (req, res) => {
    // For security, we need to ensure this is either:
    // 1. An admin creating a rider
    // 2. During registration process (session flag set)

    // Check if the user is authenticated as an admin
    const isAdmin = req.isAuthenticated() && req.user.role === UserRole.ADMIN;

    // Check if it's during registration (a session that just created a user)
    const isRegistration = req.session && req.session.justRegisteredRider === true;

    if (!isAdmin && !isRegistration) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const validatedData = insertRiderSchema.parse(req.body);

      // Verify the user exists and has the rider role
      const user = await storage.getUser(validatedData.userId);
      if (!user || user.role !== UserRole.RIDER) {
        return res.status(400).json({ message: "User must have rider role" });
      }

      // Check if rider profile already exists
      const existingRider = await storage.getRiderByUserId(validatedData.userId);
      if (existingRider) {
        return res.status(400).json({ message: "Rider profile already exists for this user" });
      }

      const rider = await storage.createRider(validatedData);

      // Clear the registration flag
      if (req.session) {
        req.session.justRegisteredRider = false;
      }

      res.status(201).json(rider);
    } catch (error) {
      console.error("Error creating rider:", error);
      res.status(400).json({ message: "Invalid rider data", error });
    }
  });

  // Update rider (admin or rider updating their own profile)
  app.patch("/api/riders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid rider ID" });
    }

    // Check authorization: riders can only update their own profile, admins can update any
    if (req.user.role === UserRole.RIDER) {
      const rider = await storage.getRider(id);
      if (!rider || rider.userId !== req.user.id) {
        return res.status(403).json({ message: "You can only update your own profile" });
      }
    } else if (req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const updatedRider = await storage.updateRider(id, req.body);
      if (!updatedRider) {
        return res.status(404).json({ message: "Rider not found" });
      }

      // Sync user's isActive field if rider status changed
      if (req.body.status !== undefined) {
        const rider = await storage.getRider(id);
        if (rider) {
          const isActive = req.body.status === RiderStatus.ACTIVE || req.body.status === RiderStatus.BUSY || req.body.status === RiderStatus.WAITING;
          await storage.updateUser(rider.userId, { isActive });
          console.log(`Synced user ${rider.userId} isActive to ${isActive} based on rider status: ${req.body.status}`);
        }
      }

      // If queue position was updated, notify the rider via WebSocket
      if (req.body.queuePosition !== undefined) {
        const riderWs = connectedRiders.get(id);
        if (riderWs && riderWs.readyState === WebSocket.OPEN) {
          riderWs.send(JSON.stringify({
            type: "queue_position_update",
            queuePosition: updatedRider.queuePosition
          }));
        }
      }

      res.json(updatedRider);
    } catch (error) {
      res.status(400).json({ message: "Invalid rider data", error });
    }
  });

  // Get next available rider based on queue position (for order assignment suggestion)
  app.get("/api/riders/next-available", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Get all active riders
      const activeRiders = await storage.getActiveRiders();

      // Filter riders with online status
      const onlineRiders = activeRiders.filter(rider =>
        rider.status === RiderStatus.ACTIVE
      );

      // Sort riders by queue position (null values come last)
      const sortedRiders = onlineRiders.sort((a, b) => {
        // If both have queue positions, sort by position
        if (a.queuePosition !== null && b.queuePosition !== null) {
          return a.queuePosition - b.queuePosition;
        }
        // If only a has queue position, a comes first
        if (a.queuePosition !== null) return -1;
        // If only b has queue position, b comes first
        if (b.queuePosition !== null) return 1;
        // If neither have queue position, sort by ID
        return a.id - b.id;
      });

      // Return the first rider in the queue
      if (sortedRiders.length > 0) {
        res.json(sortedRiders[0]);
      } else {
        res.status(404).json({ message: "No available riders" });
      }
    } catch (error) {
      console.error("Error getting next available rider:", error);
      return res.status(500).json({ message: "Error retrieving next available rider" });
    }
  });

  // ==================== Order API ====================

  // Get all orders (admin only)
  app.get("/api/orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const orders = await storage.getAllOrders();
    res.json(orders);
  });

  // IMPORTANT: Route order matters - SPECIFIC PATHS BEFORE PARAMETER PATHS
  // Get available orders for rider
  app.get("/api/orders/available", async (req, res) => {
    console.log("Get available orders endpoint reached");
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    // Only active riders can see available orders
    if (rider.status !== "active") {
      return res.json([]);
    }

    // Get orders that are ready for pickup and don't have a rider assigned
    // Also include pending pabili orders which can be accepted immediately
    const allOrders = await storage.getAllOrders();
    const readyOrders = allOrders.filter(
      (order) =>
        (order.status === "ready_for_pickup" && !order.riderId) ||
        (order.isPabili && order.status === "pending" && !order.riderId),
    );

    // Get restaurant details for each order (no customer details for available orders)
    const availableOrders = await Promise.all(
      readyOrders.map(async (order) => {
        try {
          // For pabili orders, use pickup location instead of restaurant
          if (order.isPabili) {
            const pabiliDetails = order.pabiliDetails as any;
            return {
              ...order,
              // For pabili orders, show pickup location details
              restaurantName: "Pabili Order",
              restaurantAddress: pabiliDetails?.pickupLocation?.address || "Pickup Location",
              restaurantLatitude: pabiliDetails?.pickupLocation?.lat,
              restaurantLongitude: pabiliDetails?.pickupLocation?.lng,
              // Include delivery address (location only) but not customer personal info
              customerAddress: order.deliveryAddress || undefined,
            };
          }

          // For regular orders, get restaurant details
          const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;

          // Enhance order with restaurant information only (not customer info)
          // Customer info will only be available after the rider accepts the order
          return {
            ...order,
            restaurantName: restaurant ? restaurant.name : undefined,
            restaurantAddress: restaurant ? restaurant.address : undefined,
            restaurantPhone: restaurant ? restaurant.phone : undefined,
            restaurantLatitude: restaurant ? restaurant.latitude : undefined,
            restaurantLongitude: restaurant ? restaurant.longitude : undefined,
            // Include delivery address (location only) but not customer personal info
            customerAddress: order.deliveryAddress || undefined,
          };
        } catch (error) {
          console.error(
            `Error fetching details for order ${order.id}:`,
            error,
          );
          return order;
        }
      }),
    );

    console.log("Returning available orders:", availableOrders.length);
    res.json(availableOrders);
  });

  // Get orders by status (admin only)
  app.get("/api/orders/status/:status", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const status = req.params.status;
    const orders = await storage.getOrdersByStatus(status);
    res.json(orders);
  });

  // Get restaurant orders (restaurant only)
  app.get("/api/restaurant-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RESTAURANT) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const restaurant = await storage.getRestaurantByUserId(req.user.id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    try {
      // Get base orders
      const orders = await storage.getOrdersByRestaurantId(restaurant.id);

      // Enhanced orders with customer details
      const enhancedOrders = await Promise.all(
        orders.map(async (order) => {
          try {
            // Get customer data
            const customer = await storage.getCustomer(order.customerId);
            if (customer) {
              // Get user data for the customer
              const user = await storage.getUser(customer.userId);
              if (user) {
                return {
                  ...order,
                  customerName: user.fullName || user.username,
                  customerPhone: user.phone || "Not provided",
                };
              }
            }
            return order;
          } catch (err) {
            console.error(`Error enhancing order ${order.id}:`, err);
            return order;
          }
        }),
      );

      res.json(enhancedOrders);
    } catch (error) {
      console.error(
        `Error fetching orders for restaurant ${restaurant.id}:`,
        error,
      );
      return res
        .status(500)
        .json({ message: "Error fetching restaurant orders" });
    }
  });

  // Get customer orders
  app.get("/api/customer-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const customer = await storage.getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const orders = await storage.getOrdersByCustomerId(customer.id);
    res.json(orders);
  });

  // Get rider orders
  app.get("/api/rider-orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const rider = await storage.getRiderByUserId(req.user.id);
    if (!rider) {
      return res.status(404).json({ message: "Rider not found" });
    }

    const orders = await storage.getOrdersByRiderId(rider.id);
    res.json(orders);
  });

  // Get order by ID
  app.get("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check authorization based on role
    if (req.user.role === UserRole.CUSTOMER) {
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer || customer.id !== order.customerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    } else if (req.user.role === UserRole.RESTAURANT) {
      const restaurant = await storage.getRestaurantByUserId(req.user.id);
      if (!restaurant || restaurant.id !== order.restaurantId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    } else if (req.user.role === UserRole.RIDER) {
      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider || rider.id !== order.riderId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    }

    try {
      // Get customer data if this is a restaurant or rider looking at the order
      if (
        req.user.role === UserRole.RESTAURANT ||
        req.user.role === UserRole.RIDER ||
        req.user.role === UserRole.ADMIN
      ) {
        const customer = await storage.getCustomer(order.customerId);
        if (customer) {
          const user = await storage.getUser(customer.userId);
          if (user) {
            const enhancedOrder = {
              ...order,
              customerName: user.fullName || user.username,
              customerPhone: user.phone || "Not provided",
            };
            return res.json(enhancedOrder);
          }
        }
      }

      // Return the regular order if no enhancement was done
      res.json(order);
    } catch (error) {
      console.error(`Error fetching order details for order ${id}:`, error);
      return res.status(500).json({ message: "Error fetching order details" });
    }
  });

  // This section was removed to resolve a duplicate route issue.
  // The /api/orders POST route is defined earlier in the file.

  // Update order status
  app.patch("/api/orders/:id/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const order = await storage.getOrder(id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check authorization based on role and new status
    if (req.user.role === UserRole.CUSTOMER) {
      // Customers can only cancel their own orders
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer || customer.id !== order.customerId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      if (status !== "cancelled") {
        return res
          .status(403)
          .json({ message: "Customers can only cancel orders" });
      }
    } else if (req.user.role === UserRole.RESTAURANT) {
      // Restaurants can confirm, prepare, or mark orders as ready
      const restaurant = await storage.getRestaurantByUserId(req.user.id);
      if (!restaurant || restaurant.id !== order.restaurantId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const allowedStatuses = [
        "confirmed",
        "preparing",
        "ready_for_pickup",
        "cancelled",
      ];
      if (!allowedStatuses.includes(status)) {
        return res
          .status(403)
          .json({ message: "Invalid status for restaurant" });
      }
    } else if (req.user.role === UserRole.RIDER) {
      // Riders can update orders assigned to them
      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider || rider.id !== order.riderId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      const allowedStatuses = ["picked_up", "on_the_way", "delivered"];
      if (!allowedStatuses.includes(status)) {
        return res.status(403).json({ message: "Invalid status for rider" });
      }
    }

    try {
      const updatedOrder = await storage.updateOrder(id, { status });

      // Get related entities for notifications
      const customer = await storage.getCustomer(order.customerId);
      const restaurant = await storage.getRestaurant(order.restaurantId);
      const rider = order.riderId
        ? await storage.getRider(order.riderId)
        : null;

      // Create notification data based on the status change
      let notificationMessage = "";
      let notificationType: "info" | "success" | "warning" | "error" = "info";

      switch (status) {
        case "confirmed":
          notificationMessage = `Order #${order.id} has been confirmed by the restaurant`;
          notificationType = "success";
          break;
        case "preparing":
          notificationMessage = `Order #${order.id} is now being prepared`;
          notificationType = "info";
          break;
        case "ready_for_pickup":
          notificationMessage = `Order #${order.id} is ready for pickup`;
          notificationType = "info";
          break;
        case "picked_up":
          notificationMessage = `Order #${order.id} has been picked up for delivery`;
          notificationType = "info";
          break;
        case "on_the_way":
          notificationMessage = `Order #${order.id} is on the way to you`;
          notificationType = "info";
          break;
        case "delivered":
          notificationMessage = `Order #${order.id} has been delivered successfully`;
          notificationType = "success";
          break;
        case "cancelled":
          notificationMessage = `Order #${order.id} has been cancelled`;
          notificationType = "error";
          break;
        default:
          notificationMessage = `Order #${order.id} status changed to ${status}`;
          notificationType = "info";
      }

      // Determine recipients based on the status
      const recipients: {
        admins?: boolean;
        restaurantIds?: number[];
        customerIds?: number[];
        riderIds?: number[];
      } = {
        admins: true, // Always notify admins about order status changes
      };

      // Always notify the customer
      if (customer) {
        recipients.customerIds = [order.customerId];
      }

      // Notify restaurant for certain statuses
      if (
        [
          "confirmed",
          "preparing",
          "ready_for_pickup",
          "cancelled",
          "picked_up",
        ].includes(status)
      ) {
        recipients.restaurantIds = [order.restaurantId];
      }

      // Notify rider for certain statuses
      if (rider && ["picked_up", "on_the_way", "delivered"].includes(status)) {
        recipients.riderIds = [order.riderId!];
      }

      // Create notification object
      const notification = {
        id: `order_${order.id}_${status}_${Date.now()}`,
        message: notificationMessage,
        type: notificationType,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification via WebSocket to all admin recipients
      if (recipients.admins) {
        adminConnections.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      // Send to specific restaurant recipients
      if (recipients.restaurantIds && recipients.restaurantIds.length > 0) {
        recipients.restaurantIds.forEach((restaurantId) => {
          const restaurantWs = connectedRestaurants.get(restaurantId);
          if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
            restaurantWs.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      // Send to specific customer recipients
      if (recipients.customerIds && recipients.customerIds.length > 0) {
        recipients.customerIds.forEach((customerId) => {
          const customerWs = connectedCustomers.get(customerId);
          if (customerWs && customerWs.readyState === WebSocket.OPEN) {
            customerWs.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      // Send to specific rider recipients
      if (recipients.riderIds && recipients.riderIds.length > 0) {
        recipients.riderIds.forEach((riderId) => {
          const riderWs = connectedRiders.get(riderId);
          if (riderWs && riderWs.readyState === WebSocket.OPEN) {
            riderWs.send(
              JSON.stringify({
                type: "notification",
                notification,
              }),
            );
          }
        });
      }

      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: "Error updating order status", error });
    }
  });

  // Update order details (admin only)
  app.patch("/api/orders/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);

    try {
      // Get existing order to check if it exists
      const existingOrder = await storage.getOrder(id);
      if (!existingOrder) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Update order with provided fields
      const updatedOrder = await storage.updateOrder(id, req.body);

      // If updating payment status to completed, send notifications
      if (req.body.paymentStatus === "completed" && existingOrder.paymentStatus !== "completed") {
        // Notify restaurant about payment completion
        const restaurantWs = connectedRestaurants.get(existingOrder.restaurantId);
        if (restaurantWs && restaurantWs.readyState === WebSocket.OPEN) {
          restaurantWs.send(
            JSON.stringify({
              type: "payment_confirmed",
              orderId: id,
            }),
          );
        }

        // Notify customer about payment confirmation
        const customerWs = connectedCustomers.get(existingOrder.customerId);
        if (customerWs && customerWs.readyState === WebSocket.OPEN) {
          customerWs.send(
            JSON.stringify({
              type: "payment_confirmed",
              orderId: id,
            }),
          );
        }
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Error updating order", error });
    }
  });

  // Accept order by rider (rider only)
  app.patch("/api/orders/:id/accept", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.RIDER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    try {
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if order is available for acceptance
      // Regular orders: confirmed or ready_for_pickup
      // Pabili orders: pending status (they start as pending and can be accepted immediately)
      const validStatuses = ["confirmed", "ready_for_pickup"];
      const isPabiliPending = order.isPabili && order.status === "pending";

      if (order.riderId || (!validStatuses.includes(order.status) && !isPabiliPending)) {
        return res.status(400).json({ message: "Order is no longer available" });
      }

      const rider = await storage.getRiderByUserId(req.user.id);
      if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
      }

      // Get queue information for logging and rotation purposes
      const activeRiders = await storage.getActiveRiders();
      const queuedRiders = activeRiders
        .filter(r => r.queuePosition !== null)
        .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));

      const riderQueueIndex = queuedRiders.findIndex(r => r.id === rider.id);

      // Log queue information but don't block acceptance
      console.log(`Rider ${rider.id} (queue position ${rider.queuePosition || 'none'}) accepting order ${order.id}`);

      // Allow any rider to accept any available order

      // Assign the order to the rider
      // For pabili orders, set status to "purchasing" immediately
      // For regular orders, set status to "ready_for_pickup"
      const newStatus = order.isPabili ? "purchasing" : "ready_for_pickup";

      const updatedOrder = await storage.updateOrder(id, {
        riderId: rider.id,
        status: newStatus,
      });

      // Rotate the queue - move the accepting rider to the end of the queue (if they were in queue)
      if (riderQueueIndex >= 0 && queuedRiders.length > 0) {
        const maxQueuePosition = Math.max(...queuedRiders.map(r => r.queuePosition || 0));
        await storage.updateRider(rider.id, { queuePosition: maxQueuePosition + 1 });

        // Update queue positions for other riders - move them up by 1
        for (let i = riderQueueIndex + 1; i < queuedRiders.length; i++) {
          const riderToUpdate = queuedRiders[i];
          if (riderToUpdate.queuePosition && riderToUpdate.queuePosition > 1) {
            await storage.updateRider(riderToUpdate.id, {
              queuePosition: riderToUpdate.queuePosition - 1
            });
          }
        }
      }

      // Get the restaurant for notifications
      const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;

      // Create notification for the rider
      const notification = {
        id: `order_${order.id}_accepted_${Date.now()}`,
        message: `You have accepted Order #${order.id}${restaurant ? ` from ${restaurant.name}` : ''}`,
        type: "success" as const,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification to all riders about queue update
      const queueUpdateNotification = {
        id: `queue_update_${Date.now()}`,
        message: "Queue positions have been updated",
        type: "info" as const,
        timestamp: new Date().toISOString(),
        isRead: false,
      };

      // Notify all riders about queue changes
      connectedRiders.forEach((ws, riderId) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "queue_update",
            notification: queueUpdateNotification
          }));
        }
      });

      // Create notification for the customer
      const customerNotification = {
        id: `order_${order.id}_rider_assigned_${Date.now()}`,
        message: `A rider has been assigned to your Order #${order.id}`,
        type: "info" as const,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification to the customer
      const customerWs = connectedCustomers.get(order.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(JSON.stringify({
          type: "notification",
          notification: customerNotification,
        }));
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error accepting order:", error);
      res.status(500).json({ message: "Error accepting order", error });
    }
  });

  // Assign rider to order (admin only)
  app.patch("/api/orders/:id/assign-rider", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const { riderId } = req.body;
    if (!riderId) {
      return res.status(400).json({ message: "Rider ID is required" });
    }

    try {
      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const rider = await storage.getRider(riderId);
      if (!rider) {
        return res.status(404).json({ message: "Rider not found" });
      }

      // Get the restaurant for the notification
      const restaurant = order.restaurantId ? await storage.getRestaurant(order.restaurantId) : null;

      // Update rider status and order
      await storage.updateRider(riderId, { status: "active" });
      const updatedOrder = await storage.updateOrder(id, {
        riderId,
        status: "ready_for_pickup",
      });

      // Create notification for the rider
      const notification = {
        id: `order_${order.id}_assigned_${Date.now()}`,
        message: `You have been assigned to deliver Order #${order.id} from ${restaurant?.name || "restaurant"}`,
        type: "info" as const,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification to the assigned rider
      const riderWs = connectedRiders.get(riderId);
      if (riderWs && riderWs.readyState === WebSocket.OPEN) {
        riderWs.send(
          JSON.stringify({
            type: "notification",
            notification,
          }),
        );
      }

      // Create notification for the customer
      const customerNotification = {
        id: `order_${order.id}_rider_assigned_${Date.now()}`,
        message: `A rider has been assigned to your Order #${order.id}`,
        type: "info" as const,
        timestamp: new Date().toISOString(),
        isRead: false,
        relatedId: order.id,
        relatedType: "order",
      };

      // Send notification to the customer
      const customerWs = connectedCustomers.get(order.customerId);
      if (customerWs && customerWs.readyState === WebSocket.OPEN) {
        customerWs.send(
          JSON.stringify({
            type: "notification",
            notification: customerNotification,
          }),
        );
      }

      res.json(updatedOrder);
    } catch (error) {
      res.status(400).json({ message: "Error assigning rider", error });
    }
  });

  // ==================== Messaging API ====================

  // Send message
  app.post('/api/orders/:orderId/messages', async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const orderId = parseInt(req.params.orderId);
      const { message, messageType = 'text', metadata = {} } = req.body;

      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message content is required' });
      }

      // Verify user has access to this order (either customer or assigned rider)
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check access - admin, customer, or assigned rider
      const customer = await storage.getCustomerByUserId(req.user.id);
      const rider = await storage.getRiderByUserId(req.user.id);

      const isAdmin = req.user.role === 'admin';
      const isCustomer = customer && customer.id === order.customerId;
      const isAssignedRider = rider && rider.id === order.riderId;

      console.log('Send message access check:', {
        orderId,
        userId: req.user.id,
        userRole: req.user.role,
        customerId: customer?.id,
        orderCustomerId: order.customerId,
        riderId: rider?.id,
        orderRiderId: order.riderId,
        isAdmin,
        isCustomer,
        isAssignedRider
      });

      if (!isAdmin && !isCustomer && !isAssignedRider) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Determine sender type
      let senderType: 'customer' | 'rider';
      if (isCustomer) {
        senderType = 'customer';
      } else {
        senderType = 'rider'; // For riders and admins
      }

      const newMessage = await storage.createMessage({
        orderId,
        senderId: req.user.id,
        senderType,
        message: message.trim(),
        messageType,
        metadata,
      });

      // Send real-time notification via WebSocket
      if (senderType === 'customer' && order.riderId) {
        // Customer sending to rider
        const targetRiderWs = connectedRiders.get(order.riderId);
        if (targetRiderWs && targetRiderWs.readyState === WebSocket.OPEN) {
          targetRiderWs.send(JSON.stringify({
            type: 'new_message',
            orderId,
            message: newMessage,
            senderName: req.user.username
          }));
        }
      } else if (senderType === 'rider') {
        // Rider sending to customer
        const targetCustomerWs = connectedCustomers.get(order.customerId);
        if (targetCustomerWs && targetCustomerWs.readyState === WebSocket.OPEN) {
          targetCustomerWs.send(JSON.stringify({
            type: 'new_message',
            orderId,
            message: newMessage,
            senderName: req.user.username
          }));
        }
      }

      res.status(201).json(newMessage);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ message: 'Failed to create message' });
    }
  });

  // Get messages for an order
  app.get('/api/orders/:orderId/messages', async (req, res) => {
    try {
      console.log('GET messages route called:', {
        orderId: req.params.orderId,
        isAuthenticated: req.isAuthenticated(),
        userId: req.user?.id,
        userRole: req.user?.role
      });

      if (!req.isAuthenticated()) {
        console.log('Authentication failed for messages route');
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const orderId = parseInt(req.params.orderId);

      // Verify user has access to this order
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.log('Order not found:', orderId);
        return res.status(404).json({ message: 'Order not found' });
      }

      // Check access - admin, customer, or assigned rider
      const customer = await storage.getCustomerByUserId(req.user.id);
      const rider = await storage.getRiderByUserId(req.user.id);

      const isAdmin = req.user.role === 'admin';
      const isCustomer = customer && customer.id === order.customerId;
      const isAssignedRider = rider && rider.id === order.riderId;

      console.log('Message access check:', {
        orderId,
        userId: req.user.id,
        userRole: req.user.role,
        customerId: customer?.id,
        orderCustomerId: order.customerId,
        riderId: rider?.id,
        orderRiderId: order.riderId,
        isAdmin,
        isCustomer,
        isAssignedRider
      });

      if (!isAdmin && !isCustomer && !isAssignedRider) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const messages = await storage.getMessagesByOrderId(orderId);

      // Mark messages from other user as read
      await storage.markAllMessagesAsRead(orderId, req.user.id);

      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ message: 'Failed to fetch messages' });
    }
  });

  // ==================== User API ====================

  // Update user profile
  app.patch("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const requestedUserId = parseInt(req.params.id);
      const userId = req.user.id;

      // Security check: Users can only update their own profile unless they're an admin
      if (requestedUserId !== userId && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Unauthorized: Cannot modify other users' profiles" });
      }

      const { fullName, email, phone } = req.body;

      // If email is being changed, check if it's already taken
      if (email) {
        const currentUser = await storage.getUser(requestedUserId);
        if (currentUser && currentUser.email !== email) {
          const existingEmail = await storage.getUserByEmail(email);
          if (existingEmail) {
            const roleText = existingEmail.role ? `already registered as ${existingEmail.role}` : "already registered";
            return res.status(400).json({
              message: `This email address is ${roleText}. Please use a different email.`
            });
          }
        }
      }

      // Update user profile
      const updatedUser = await storage.updateUser(requestedUserId, {
        fullName,
        email,
        phone: phone || null
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive data before sending response
      const { password, otpSecret, ...userWithoutSensitiveInfo } = updatedUser;
      res.json(userWithoutSensitiveInfo);
    } catch (error) {
      console.error("Error updating user profile:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(400).json({ message: "Invalid user data", error: errorMessage });
    }
  });

  // User profile self-update endpoint
  app.patch("/api/user/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const { fullName, email, phone } = req.body;

      // If email is being changed, check if it's already taken
      if (email) {
        const currentUser = await storage.getUser(userId);
        if (currentUser && currentUser.email !== email) {
          const existingEmail = await storage.getUserByEmail(email);
          if (existingEmail) {
            const roleText = existingEmail.role ? `already registered as ${existingEmail.role}` : "already registered";
            return res.status(400).json({
              message: `This email address is ${roleText}. Please use a different email.`
            });
          }
        }
      }

      // Update the user's own profile
      const updatedUser = await storage.updateUser(userId, {
        fullName,
        email,
        phone: phone || null
      });

      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Remove sensitive data before sending response
      const { password, otpSecret, ...userWithoutSensitiveInfo } = updatedUser;

      // Manually update the session user to reflect changes
      req.user.fullName = updatedUser.fullName;
      req.user.email = updatedUser.email;
      req.user.phone = updatedUser.phone;

      res.json(userWithoutSensitiveInfo);
    } catch (error) {
      console.error("Error updating user profile:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(400).json({ message: "Invalid user data", error: errorMessage });
    }
  });

  // ==================== Customer API ====================

  // Create customer profile
  app.post("/api/customers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Check if customer already exists
      const existingCustomer = await storage.getCustomerByUserId(req.user.id);
      if (existingCustomer) {
        return res
          .status(400)
          .json({ message: "Customer profile already exists" });
      }

      const validatedData = insertCustomerSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const customer = await storage.createCustomer(validatedData);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ message: "Invalid customer data", error });
    }
  });

  // Update customer profile
  app.patch("/api/customers", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      // Allow any authenticated customer to update their own profile
      // No need for additional role checking because we're only updating the current user's customer profile
      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      const updatedCustomer = await storage.updateCustomer(
        customer.id,
        req.body,
      );
      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating customer profile:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      res.status(400).json({ message: "Invalid customer data", error: errorMessage });
    }
  });

  // Update customer location
  app.patch("/api/customers/location", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { lat, lng, defaultAddress, locationName } = req.body;

      if (typeof lat !== "number" || typeof lng !== "number") {
        return res
          .status(400)
          .json({
            message:
              "Invalid location data. Latitude and longitude must be numbers.",
          });
      }

      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      const location = { lat, lng };
      const updateData: any = { location };

      // Add the address if provided
      if (defaultAddress) {
        updateData.defaultAddress = defaultAddress;
      }

      // Add the location name if provided
      if (locationName !== undefined) {
        updateData.locationName = locationName;
      }

      const updatedCustomer = await storage.updateCustomer(
        customer.id,
        updateData,
      );
      res.json(updatedCustomer);
    } catch (error) {
      res.status(400).json({ message: "Error updating location", error });
    }
  });

  // Update customer saved addresses
  app.patch("/api/customers/saved-addresses", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.CUSTOMER) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { savedAddresses } = req.body;

      if (!Array.isArray(savedAddresses)) {
        return res.status(400).json({
          message: "Invalid saved addresses data. Expected an array."
        });
      }

      const customer = await storage.getCustomerByUserId(req.user.id);
      if (!customer) {
        return res.status(404).json({ message: "Customer profile not found" });
      }

      // Update customer with saved addresses
      const updatedCustomer = await storage.updateCustomer(
        customer.id,
        { savedAddresses }
      );

      // If there's a default address in the saved addresses, also set it as the customer's default
      const defaultAddress = savedAddresses.find((addr: any) => addr.isDefault);
      if (defaultAddress) {
        await storage.updateCustomer(customer.id, {
          defaultAddress: defaultAddress.address,
          locationName: defaultAddress.name,
          location: {
            lat: defaultAddress.lat,
            lng: defaultAddress.lng
          }
        });
      }

      res.json(updatedCustomer);
    } catch (error) {
      console.error("Error updating saved addresses:", error);
      res.status(400).json({ message: "Error updating saved addresses", error });
    }
  });

  // Get customer profile
  app.get("/api/customers/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const customer = await storage.getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer profile not found" });
    }

    res.json(customer);
  });

  // ==================== Settings API ====================

  // Public endpoint to check maintenance mode
  app.get("/api/public/maintenance-status", async (req, res) => {
    try {
      const maintenanceSetting = await storage.getSetting("maintenanceMode");
      const isMaintenanceMode = maintenanceSetting?.value === "true";
      res.json({ isMaintenanceMode });
    } catch (error) {
      console.error("Error checking maintenance mode:", error);
      res.json({ isMaintenanceMode: false }); // Default to false on error
    }
  });

  // Public endpoint to get GCash payment configuration
  app.get("/api/public/gcash-config", async (req, res) => {
    try {
      // Get all GCash-related settings
      const enabled = await storage.getSetting("gcashEnabled");
      const displayMode = await storage.getSetting("gcashDisplayMode");
      const phoneNumber = await storage.getSetting("gcashPhoneNumber");
      const qrCodeUrl = await storage.getSetting("gcashQrCodeUrl");

      // Default to phone number mode with the existing hardcoded number if not configured
      const mode = displayMode?.value || "phone";
      const config = {
        enabled: enabled?.value ? enabled.value === "true" : true,
        displayMode: mode,
        phoneNumber: phoneNumber?.value || "09467102826", // Default to existing number
        qrCodeUrl: qrCodeUrl?.value || null,
      };

      res.json(config);
    } catch (error) {
      console.error("Error fetching GCash configuration:", error);
      // Return default configuration on error
      res.json({
        enabled: true,
        displayMode: "phone",
        phoneNumber: "09467102826",
        qrCodeUrl: null,
      });
    }
  });

  // Get all settings (admin only)
  app.get("/api/settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const settings = await storage.getAllSettings();
    res.json(settings);
  });

  // Get setting by key
  app.get("/api/settings/:key", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const key = req.params.key;
    const setting = await storage.getSetting(key);

    if (!setting) {
      return res.status(404).json({ message: "Setting not found" });
    }

    res.json(setting);
  });

  // Create setting (admin only)
  app.post("/api/settings", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { key, value, description } = req.body;

      // Check if setting already exists
      const existingSetting = await storage.getSetting(key);
      if (existingSetting) {
        return res.status(400).json({ message: "Setting already exists" });
      }

      const setting = await storage.createSetting({ key, value, description });
      res.status(201).json(setting);
    } catch (error) {
      res.status(400).json({ message: "Invalid setting data", error });
    }
  });

  // Update setting (admin only)
  app.patch("/api/settings/:key", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const key = req.params.key;
      const { value } = req.body;

      if (value === undefined || value === null || value === "") {
        return res.status(400).json({ message: "Value is required" });
      }

      // Try to update the setting first
      const updatedSetting = await storage.updateSetting(key, value);

      if (!updatedSetting) {
        // If the setting doesn't exist, create it
        const newSetting = await storage.createSetting({
          key,
          value,
          description: `Auto-created setting for ${key}`
        });
        res.json(newSetting);
      } else {
        res.json(updatedSetting);
      }
    } catch (error) {
      res.status(400).json({ message: "Invalid setting data", error });
    }
  });

  // ==================== Analytics Routes ====================

  // Get admin dashboard analytics
  app.get("/api/admin/analytics/dashboard", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      // Get all data
      const orders = await storage.getAllOrders();
      const users = await storage.getAllUsers();
      const restaurants = await storage.getAllRestaurants();
      const riders = await storage.getAllRiders();
      const customers = await storage.getAllCustomers();

      // Calculate metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisWeekStart = new Date(today);
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

      // Filter orders
      const todayOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt || '');
        return orderDate >= today;
      });

      const thisWeekOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt || '');
        return orderDate >= thisWeekStart;
      });

      const thisMonthOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt || '');
        return orderDate >= thisMonthStart;
      });

      const lastMonthOrders = orders.filter(o => {
        const orderDate = new Date(o.createdAt || '');
        return orderDate >= lastMonthStart && orderDate <= lastMonthEnd;
      });

      // Calculate revenue
      const calculateRevenue = (orderList: typeof orders) => {
        return orderList.reduce((sum, order) => {
          if (order.status !== OrderStatus.CANCELLED) {
            // totalAmount already includes delivery fee and tip, so don't add deliveryFee again
            return sum + (order.totalAmount || 0);
          }
          return sum;
        }, 0);
      };

      // Order status breakdown
      const orderStatusBreakdown = {
        pending: orders.filter(o => o.status === OrderStatus.PENDING).length,
        confirmed: orders.filter(o => o.status === OrderStatus.CONFIRMED).length,
        preparing: orders.filter(o => o.status === OrderStatus.PREPARING).length,
        readyForPickup: orders.filter(o => o.status === OrderStatus.READY_FOR_PICKUP).length,
        pickedUp: orders.filter(o => o.status === OrderStatus.PICKED_UP).length,
        onTheWay: orders.filter(o => o.status === OrderStatus.ON_THE_WAY).length,
        delivered: orders.filter(o => o.status === OrderStatus.DELIVERED).length,
        cancelled: orders.filter(o => o.status === OrderStatus.CANCELLED).length,
      };

      // User role breakdown
      const userRoleBreakdown = {
        admin: users.filter(u => u.role === UserRole.ADMIN).length,
        restaurant: users.filter(u => u.role === UserRole.RESTAURANT).length,
        rider: users.filter(u => u.role === UserRole.RIDER).length,
        customer: users.filter(u => u.role === UserRole.CUSTOMER).length,
      };

      // Payment method breakdown
      const paymentMethodBreakdown = {
        cash: orders.filter(o => o.paymentMethod === "cash_on_delivery").length,
        gcash: orders.filter(o => o.paymentMethod === "gcash").length,
      };

      // Active riders breakdown
      const riderStatusBreakdown = {
        active: riders.filter(r => r.status === RiderStatus.ACTIVE).length,
        busy: riders.filter(r => r.status === RiderStatus.BUSY).length,
        waiting: riders.filter(r => r.status === RiderStatus.WAITING).length,
        offline: riders.filter(r => r.status === RiderStatus.OFFLINE).length,
      };

      const analytics = {
        summary: {
          totalOrders: orders.length,
          totalRevenue: calculateRevenue(orders),
          totalUsers: users.length,
          totalRestaurants: restaurants.length,
          totalRiders: riders.length,
          totalCustomers: customers.length,
          activeRestaurants: restaurants.filter(r => r.isActive && r.isApproved).length,
          activeRiders: riders.filter(r => r.status !== RiderStatus.OFFLINE).length,
        },
        today: {
          orders: todayOrders.length,
          revenue: calculateRevenue(todayOrders),
        },
        thisWeek: {
          orders: thisWeekOrders.length,
          revenue: calculateRevenue(thisWeekOrders),
        },
        thisMonth: {
          orders: thisMonthOrders.length,
          revenue: calculateRevenue(thisMonthOrders),
        },
        lastMonth: {
          orders: lastMonthOrders.length,
          revenue: calculateRevenue(lastMonthOrders),
        },
        orderStatusBreakdown,
        userRoleBreakdown,
        paymentMethodBreakdown,
        riderStatusBreakdown,
        recentOrders: orders
          .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
          .slice(0, 10),
      };

      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Error fetching analytics data" });
    }
  });

  // Get orders analytics with date range
  app.get("/api/admin/analytics/orders", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { startDate, endDate, groupBy = 'day' } = req.query;
      const orders = await storage.getAllOrders();

      let filteredOrders = orders;

      if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);

        filteredOrders = orders.filter(o => {
          const orderDate = new Date(o.createdAt || '');
          return orderDate >= start && orderDate <= end;
        });
      }

      // Group orders by date
      const groupedData: Record<string, any> = {};

      filteredOrders.forEach(order => {
        const date = new Date(order.createdAt || '');
        let key: string;

        if (groupBy === 'day') {
          key = date.toISOString().split('T')[0];
        } else if (groupBy === 'week') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
        } else if (groupBy === 'month') {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          key = date.toISOString().split('T')[0];
        }

        if (!groupedData[key]) {
          groupedData[key] = {
            date: key,
            orders: 0,
            revenue: 0,
            delivered: 0,
            cancelled: 0,
          };
        }

        groupedData[key].orders++;
        if (order.status !== OrderStatus.CANCELLED) {
          // totalAmount already includes delivery fee and tip, so don't add deliveryFee again
          groupedData[key].revenue += (order.totalAmount || 0);
        }
        if (order.status === OrderStatus.DELIVERED) {
          groupedData[key].delivered++;
        }
        if (order.status === OrderStatus.CANCELLED) {
          groupedData[key].cancelled++;
        }
      });

      const chartData = Object.values(groupedData).sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      res.json({
        total: filteredOrders.length,
        totalRevenue: filteredOrders.reduce((sum, o) => {
          if (o.status !== OrderStatus.CANCELLED) {
            // totalAmount already includes delivery fee and tip, so don't add deliveryFee again
            return sum + (o.totalAmount || 0);
          }
          return sum;
        }, 0),
        chartData,
      });
    } catch (error) {
      console.error("Error fetching order analytics:", error);
      res.status(500).json({ message: "Error fetching order analytics" });
    }
  });

  // Get top performing restaurants
  app.get("/api/admin/analytics/top-restaurants", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const orders = await storage.getAllOrders();
      const restaurants = await storage.getAllRestaurants();

      // Calculate restaurant metrics
      const restaurantMetrics = new Map();

      orders.forEach(order => {
        if (!order.restaurantId || order.status === OrderStatus.CANCELLED) return;

        if (!restaurantMetrics.has(order.restaurantId)) {
          restaurantMetrics.set(order.restaurantId, {
            id: order.restaurantId,
            orders: 0,
            revenue: 0,
            averageOrderValue: 0,
          });
        }

        const metrics = restaurantMetrics.get(order.restaurantId);
        metrics.orders++;
        metrics.revenue += (order.totalAmount || 0);
      });

      // Calculate averages and add restaurant details
      const topRestaurants = Array.from(restaurantMetrics.values()).map(metrics => {
        metrics.averageOrderValue = metrics.orders > 0 ? metrics.revenue / metrics.orders : 0;
        const restaurant = restaurants.find(r => r.id === metrics.id);
        return {
          ...metrics,
          name: restaurant?.name || 'Unknown',
          logoUrl: restaurant?.logoUrl,
        };
      });

      // Sort by revenue
      topRestaurants.sort((a, b) => b.revenue - a.revenue);

      res.json(topRestaurants.slice(0, 10));
    } catch (error) {
      console.error("Error fetching top restaurants:", error);
      res.status(500).json({ message: "Error fetching top restaurants" });
    }
  });

  // Get rider performance analytics
  app.get("/api/admin/analytics/rider-performance", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const orders = await storage.getAllOrders();
      const riders = await storage.getAllRiders();
      const users = await storage.getAllUsers();

      // Calculate rider metrics
      const riderMetrics = new Map();

      orders.forEach(order => {
        if (!order.riderId) return;

        if (!riderMetrics.has(order.riderId)) {
          riderMetrics.set(order.riderId, {
            id: order.riderId,
            deliveries: 0,
            totalEarnings: 0,
            completed: 0,
            cancelled: 0,
            averageDeliveryTime: 0,
            deliveryTimes: [],
          });
        }

        const metrics = riderMetrics.get(order.riderId);
        metrics.deliveries++;
        metrics.totalEarnings += (order.deliveryFee || 0) + (order.tipAmount || 0);

        if (order.status === OrderStatus.DELIVERED) {
          metrics.completed++;

          // Calculate delivery time if available
          if (order.createdAt && order.actualDeliveryTime) {
            const deliveryTime = new Date(order.actualDeliveryTime).getTime() -
                                new Date(order.createdAt).getTime();
            metrics.deliveryTimes.push(deliveryTime);
          }
        }

        if (order.status === OrderStatus.CANCELLED) {
          metrics.cancelled++;
        }
      });

      // Calculate averages and add rider details
      const riderPerformance = Array.from(riderMetrics.values()).map(metrics => {
        // Calculate average delivery time
        if (metrics.deliveryTimes.length > 0) {
          const avgTime = metrics.deliveryTimes.reduce((a: number, b: number) => a + b, 0) / metrics.deliveryTimes.length;
          metrics.averageDeliveryTime = Math.round(avgTime / (1000 * 60)); // Convert to minutes
        }
        delete metrics.deliveryTimes;

        const rider = riders.find(r => r.id === metrics.id);
        const user = rider ? users.find(u => u.id === rider.userId) : undefined;

        return {
          ...metrics,
          name: user?.fullName || user?.username || 'Unknown',
          status: rider?.status || 'unknown',
          vehicleType: rider?.vehicleType,
          completionRate: metrics.deliveries > 0 ? (metrics.completed / metrics.deliveries * 100).toFixed(1) : 0,
        };
      });

      // Sort by number of deliveries
      riderPerformance.sort((a, b) => b.deliveries - a.deliveries);

      res.json(riderPerformance);
    } catch (error) {
      console.error("Error fetching rider performance:", error);
      res.status(500).json({ message: "Error fetching rider performance" });
    }
  });

  // Export analytics report
  app.post("/api/admin/analytics/export", async (req, res) => {
    if (!req.isAuthenticated() || req.user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    try {
      const { format = 'json', reportType = 'summary', startDate, endDate } = req.body;

      // Gather all analytics data
      const orders = await storage.getAllOrders();
      const users = await storage.getAllUsers();
      const restaurants = await storage.getAllRestaurants();
      const riders = await storage.getAllRiders();
      const customers = await storage.getAllCustomers();

      // Filter by date if provided
      let filteredOrders = orders;
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        filteredOrders = orders.filter(o => {
          const orderDate = new Date(o.createdAt || '');
          return orderDate >= start && orderDate <= end;
        });
      }

      // Prepare report data
      const reportData = {
        generatedAt: new Date().toISOString(),
        reportType,
        dateRange: {
          startDate: startDate || 'All time',
          endDate: endDate || 'Present',
        },
        summary: {
          totalOrders: filteredOrders.length,
          totalRevenue: filteredOrders.reduce((sum, o) => {
            if (o.status !== OrderStatus.CANCELLED) {
              // totalAmount already includes delivery fee and tip, so don't add deliveryFee again
              return sum + (o.totalAmount || 0);
            }
            return sum;
          }, 0),
          totalUsers: users.length,
          totalRestaurants: restaurants.length,
          totalRiders: riders.length,
          totalCustomers: customers.length,
        },
        orders: filteredOrders.map(o => ({
          id: o.id,
          customer: customers.find(c => c.id === o.customerId)?.userId,
          restaurant: restaurants.find(r => r.id === o.restaurantId)?.name,
          rider: riders.find(r => r.id === o.riderId)?.userId,
          status: o.status,
          totalAmount: o.totalAmount,
          deliveryFee: o.deliveryFee,
          paymentMethod: o.paymentMethod,
          createdAt: o.createdAt,
        })),
      };

      // Return as JSON for now (PDF and Excel export can be added with additional libraries)
      if (format === 'json') {
        res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(reportData);
      } else {
        // For other formats, we'll need to implement with appropriate libraries
        res.status(400).json({ message: `Export format ${format} not yet implemented` });
      }
    } catch (error) {
      console.error("Error exporting analytics:", error);
      res.status(500).json({ message: "Error exporting analytics" });
    }
  });

  // ==================== Object Storage Routes ====================

  // Get upload URL for rider documents
  app.post("/api/riders/upload-url", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Update rider document URLs after upload
  app.put("/api/riders/documents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const { licensePhotoUrl, riderPhotoUrl } = req.body;
      const userId = req.user.id;

      // Get the rider for this user
      const rider = await storage.getRiderByUserId(userId);
      if (!rider) {
        return res.status(404).json({ message: "Rider profile not found" });
      }

      // Set ACL policy and normalize URLs
      const objectStorageService = new ObjectStorageService();
      let normalizedLicenseUrl = licensePhotoUrl;
      let normalizedRiderUrl = riderPhotoUrl;

      if (licensePhotoUrl) {
        normalizedLicenseUrl = await objectStorageService.trySetObjectEntityAclPolicy(
          licensePhotoUrl,
          {
            owner: userId.toString(),
            visibility: "private", // Admin/verification purposes only
          }
        );
      }

      if (riderPhotoUrl) {
        normalizedRiderUrl = await objectStorageService.trySetObjectEntityAclPolicy(
          riderPhotoUrl,
          {
            owner: userId.toString(),
            visibility: "private", // Admin/verification purposes only
          }
        );
      }

      // Update rider with document URLs
      const updatedRider = await storage.updateRider(rider.id, {
        licensePhotoUrl: normalizedLicenseUrl,
        riderPhotoUrl: normalizedRiderUrl,
      });

      res.json({
        message: "Documents uploaded successfully",
        licensePhotoUrl: normalizedLicenseUrl,
        riderPhotoUrl: normalizedRiderUrl
      });
    } catch (error) {
      console.error("Error updating rider documents:", error);
      res.status(500).json({ error: "Failed to update documents" });
    }
  });

  // Serve private objects (admin access to rider documents)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);

      // Check if user can access this object
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: req.user.id.toString(),
      });

      if (!canAccess && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ message: "Access denied" });
      }

      await objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "File not found" });
      }
      return res.status(500).json({ message: "Server error" });
    }
  });

  return httpServer;
}
