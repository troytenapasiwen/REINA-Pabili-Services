import { pgTable, text, serial, integer, boolean, timestamp, doublePrecision, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Define types for saved addresses
export const SavedAddressSchema = z.object({
  name: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  isDefault: z.boolean().optional(),
});

export type SavedAddress = z.infer<typeof SavedAddressSchema>;

// User Types
export const UserRole = {
  ADMIN: "admin",
  RESTAURANT: "restaurant",
  RIDER: "rider",
  CUSTOMER: "customer",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Order Status
export const OrderStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY_FOR_PICKUP: "ready_for_pickup",
  PICKED_UP: "picked_up",
  ON_THE_WAY: "on_the_way",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export type OrderStatusType = typeof OrderStatus[keyof typeof OrderStatus];

// Rider Status
export const RiderStatus = {
  ACTIVE: "active",
  WAITING: "waiting",
  OFFLINE: "offline",
  BUSY: "busy",
} as const;

export type RiderStatusType = typeof RiderStatus[keyof typeof RiderStatus];

// Payment Method
export const PaymentMethod = {
  COD: "cash_on_delivery",
  GCASH: "gcash",
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

// User Schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  fullName: text("full_name"),
  role: text("role").notNull(),
  isActive: boolean("is_active").default(true),
  emailVerified: boolean("email_verified").default(false),
  emailVerificationToken: text("email_verification_token"),
  emailVerificationExpires: timestamp("email_verification_expires"),
  termsAccepted: boolean("terms_accepted").default(false),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  lastLogin: timestamp("last_login"),
  otpEnabled: boolean("otp_enabled").default(false),
  otpSecret: text("otp_secret"),
});

// Restaurant Schema
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  address: text("address").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  businessPermitUrl: text("business_permit_url"),
  isActive: boolean("is_active").default(true),
  isApproved: boolean("is_approved").default(false),
  isArchived: boolean("is_archived").default(false),
  categories: text("categories").array(),
  openingTime: text("opening_time"),
  closingTime: text("closing_time"),
  deliveryFee: doublePrecision("delivery_fee").default(0),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  acceptsCash: boolean("accepts_cash").default(true),
  acceptsGcash: boolean("accepts_gcash").default(false),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  gcashNumber: text("gcash_number"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Menu Items Schema
export const menuItems = pgTable("menu_items", {
  id: serial("id").primaryKey(),
  restaurantId: integer("restaurant_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  discountedPrice: doublePrecision("discounted_price"),
  imageUrl: text("image_url"),
  categories: text("categories").array(),
  isAvailable: boolean("is_available").default(true),
  dietaryInfo: json("dietary_info").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rider Schema
export const riders = pgTable("riders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  licenseNumber: text("license_number").notNull(),
  licensePhotoUrl: text("license_photo_url"),
  riderPhotoUrl: text("rider_photo_url"),
  vehicleType: text("vehicle_type").notNull(),
  vehiclePlateNumber: text("vehicle_plate_number"),
  status: text("status").default("offline"),
  currentLocation: json("current_location").default({}),
  isVerified: boolean("is_verified").default(false),
  queuePosition: integer("queue_position"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Customer Schema
export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  defaultAddress: text("default_address"),
  locationName: text("location_name"),
  savedAddresses: json("saved_addresses").default([]),
  location: json("location").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Schema
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull(),
  restaurantId: integer("restaurant_id"),
  riderId: integer("rider_id"),
  items: json("items").notNull().default([]),
  status: text("status").notNull().default("pending"),
  totalAmount: doublePrecision("total_amount").notNull(),
  deliveryFee: doublePrecision("delivery_fee").default(0),
  paymentMethod: text("payment_method").notNull(),
  paymentStatus: text("payment_status").default("pending"),
  paymentReference: text("payment_reference"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLocationName: text("delivery_location_name"),
  specialInstructions: text("special_instructions"),
  estimatedDeliveryTime: timestamp("estimated_delivery_time"),
  actualDeliveryTime: timestamp("actual_delivery_time"),
  orderType: text("order_type").default("food"),
  isPabili: boolean("is_pabili").default(false),
  pabiliDetails: json("pabili_details").default({}),
  tipAmount: doublePrecision("tip_amount").default(0),
  metadata: json("metadata").default({}), // For storing delivery distance, locations, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// Settings Schema
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod Schemas for data validation
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRestaurantSchema = createInsertSchema(restaurants).omit({ id: true, createdAt: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true, createdAt: true });
export const insertRiderSchema = createInsertSchema(riders).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders)
  .omit({ id: true, createdAt: true })
  .extend({
    deliveryLocationName: z.string().optional(),
    metadata: z.any().optional(),
  });
export const insertSettingSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });

// Types for entity insertion
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type InsertRider = z.infer<typeof insertRiderSchema>;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertSetting = z.infer<typeof insertSettingSchema>;

// Types for entity selection
export type User = typeof users.$inferSelect;
export type Restaurant = typeof restaurants.$inferSelect;
export type MenuItem = typeof menuItems.$inferSelect;
export type Rider = typeof riders.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Setting = typeof settings.$inferSelect;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginData = z.infer<typeof loginSchema>;

// OTP schema
export const otpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export type OtpData = z.infer<typeof otpSchema>;

// Pabili schema
export const pabiliDetailsSchema = z.object({
  pickupLocation: z.object({
    address: z.string().min(1, "Pickup address is required"),
    lat: z.number(),
    lng: z.number(),
    locationName: z.string().optional(),
  }),
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    estimatedPrice: z.number().min(1, "Estimated price is required"),
    notes: z.string().optional(),
  })).min(1, "At least one item is required"),
  budget: z.number().min(1, "Budget is required"),
  pickupInstructions: z.string().optional(),
});

export type PabiliDetails = z.infer<typeof pabiliDetailsSchema>;

// Messages table
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  senderId: integer('sender_id').notNull().references(() => users.id),
  senderType: text('sender_type').notNull(), // 'customer' or 'rider'
  message: text('message').notNull(),
  messageType: text('message_type').notNull().default('text'), // 'text', 'location', 'image'
  metadata: json('metadata').default({}),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert and Select schemas for Messages
export const insertMessageSchema = createInsertSchema(messages);

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Feedback table
export const feedback = pgTable('feedback', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  restaurantId: integer('restaurant_id').references(() => restaurants.id), // null for pabili orders
  rating: integer('rating').notNull(), // 1-5 stars
  comment: text('comment'),
  feedbackType: text('feedback_type').notNull().default('order'), // 'order', 'delivery', 'food_quality'
  isAnonymous: boolean('is_anonymous').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert and Select schemas for Feedback
export const insertFeedbackSchema = createInsertSchema(feedback).omit({ id: true, createdAt: true, customerId: true });

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// Rider feedback table (riders rating customers)
export const riderFeedback = pgTable('rider_feedback', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => orders.id),
  riderId: integer('rider_id').notNull().references(() => riders.id),
  customerId: integer('customer_id').notNull().references(() => customers.id),
  rating: integer('rating').notNull(), // 1-5 stars
  comment: text('comment'),
  punctuality: integer('punctuality'), // 1-5 rating for being on time
  communication: integer('communication'), // 1-5 rating for communication
  paymentEase: integer('payment_ease'), // 1-5 rating for ease of payment
  createdAt: timestamp('created_at').defaultNow(),
});

// Insert and Select schemas for Rider Feedback
export const insertRiderFeedbackSchema = createInsertSchema(riderFeedback).omit({ id: true, createdAt: true, riderId: true });

export type InsertRiderFeedback = z.infer<typeof insertRiderFeedbackSchema>;
export type RiderFeedback = typeof riderFeedback.$inferSelect;

// Loyalty Program Types
export const LoyaltyTier = {
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
} as const;

export type LoyaltyTierType = typeof LoyaltyTier[keyof typeof LoyaltyTier];

export const LoyaltyTransactionType = {
  EARN: "earn",
  REDEEM: "redeem",
  ADJUST: "adjust",
  REVERSAL: "reversal",
} as const;

export type LoyaltyTransactionTypeType = typeof LoyaltyTransactionType[keyof typeof LoyaltyTransactionType];

// Loyalty tier thresholds (lifetime points needed)
export const LOYALTY_TIER_THRESHOLDS = {
  BRONZE: 0,
  SILVER: 1000,
  GOLD: 5000,
} as const;

// Points per peso spent (1 point per 20 pesos)
export const POINTS_PER_PESO = 20;

// Delivery fee discount per loyalty tier (fraction of the delivery fee waived)
export const LOYALTY_DELIVERY_DISCOUNTS = {
  bronze: 0.2,
  silver: 0.5,
  gold: 1.0,
} as const;

// Loyalty Accounts Schema
export const loyaltyAccounts = pgTable("loyalty_accounts", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  pointsBalance: integer("points_balance").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  tier: text("tier").notNull().default("bronze"),
  lastTierChangeAt: timestamp("last_tier_change_at"),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Loyalty Transactions Schema
export const loyaltyTransactions = pgTable("loyalty_transactions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => loyaltyAccounts.id),
  orderId: integer("order_id").references(() => orders.id),
  type: text("type").notNull(),
  pointsDelta: integer("points_delta").notNull(),
  description: text("description"),
  metadata: json("metadata").default({}),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert and Select schemas for Loyalty
export const insertLoyaltyAccountSchema = createInsertSchema(loyaltyAccounts).omit({ id: true, createdAt: true });
export const insertLoyaltyTransactionSchema = createInsertSchema(loyaltyTransactions).omit({ id: true, createdAt: true });

export type InsertLoyaltyAccount = z.infer<typeof insertLoyaltyAccountSchema>;
export type InsertLoyaltyTransaction = z.infer<typeof insertLoyaltyTransactionSchema>;
export type LoyaltyAccount = typeof loyaltyAccounts.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactions.$inferSelect;

// Helper function to calculate tier from lifetime points
export function calculateTierFromPoints(lifetimePoints: number): LoyaltyTierType {
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.GOLD) {
    return LoyaltyTier.GOLD;
  } else if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.SILVER) {
    return LoyaltyTier.SILVER;
  }
  return LoyaltyTier.BRONZE;
}

// Helper function to calculate points to next tier
export function getPointsToNextTier(lifetimePoints: number): { nextTier: LoyaltyTierType | null; pointsNeeded: number } {
  if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.GOLD) {
    return { nextTier: null, pointsNeeded: 0 };
  } else if (lifetimePoints >= LOYALTY_TIER_THRESHOLDS.SILVER) {
    return { nextTier: LoyaltyTier.GOLD, pointsNeeded: LOYALTY_TIER_THRESHOLDS.GOLD - lifetimePoints };
  }
  return { nextTier: LoyaltyTier.SILVER, pointsNeeded: LOYALTY_TIER_THRESHOLDS.SILVER - lifetimePoints };
}

// Helper function to calculate points earned from order
// Gold tier members receive a 2% bonus on points earned
export function calculatePointsFromOrder(subtotal: number, tipAmount: number = 0, tier: LoyaltyTierType = "bronze"): number {
  const qualifyingAmount = subtotal + tipAmount;
  let basePoints = Math.floor(qualifyingAmount / POINTS_PER_PESO);

  // Apply 2% bonus for Gold tier members
  if (tier === LoyaltyTier.GOLD) {
    basePoints = Math.floor(basePoints * 1.02);
  }

  return basePoints;
}

// Helper to get the delivery fee discount rate (0-1) for a given tier
export function getDeliveryDiscountRate(tier: LoyaltyTierType = "bronze"): number {
  return LOYALTY_DELIVERY_DISCOUNTS[tier] ?? 0;
}

// Helper to apply the loyalty delivery fee discount based on tier
// Returns the discounted delivery fee (rounded to 2 decimals)
export function applyDeliveryFeeDiscount(deliveryFee: number, tier: LoyaltyTierType = "bronze"): number {
  const rate = getDeliveryDiscountRate(tier);
  const discounted = deliveryFee * (1 - rate);
  return Math.round(discounted * 100) / 100;
}
