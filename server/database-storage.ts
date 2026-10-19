import {
  users,
  restaurants,
  menuItems,
  riders,
  customers,
  orders,
  settings,
  messages,
  loyaltyAccounts,
  loyaltyTransactions,
  type User,
  type InsertUser,
  type Restaurant,
  type InsertRestaurant,
  type MenuItem,
  type InsertMenuItem,
  type Rider,
  type InsertRider,
  type Customer,
  type InsertCustomer,
  type Order,
  type InsertOrder,
  type Setting,
  type InsertSetting,
  type Message,
  type InsertMessage,
  type LoyaltyAccount,
  type InsertLoyaltyAccount,
  type LoyaltyTransaction,
  type InsertLoyaltyTransaction,
  LoyaltyTier
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, ne } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import session from "express-session";
import { pool } from "./db";
import { IStorage } from "./storage";

const PostgresSessionStore = connectPg(session);

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  // Restaurant operations
  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id));
    return restaurant;
  }

  async getRestaurantByUserId(userId: number): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.userId, userId));
    return restaurant;
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants);
  }

  async getActiveRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).where(
      and(
        eq(restaurants.isActive, true),
        eq(restaurants.isArchived, false)
      )
    );
  }

  async getApprovedRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).where(
      and(
        eq(restaurants.isActive, true),
        eq(restaurants.isApproved, true),
        eq(restaurants.isArchived, false)
      )
    );
  }

  async createRestaurant(insertRestaurant: InsertRestaurant): Promise<Restaurant> {
    const [restaurant] = await db.insert(restaurants).values(insertRestaurant).returning();
    return restaurant;
  }

  async updateRestaurant(id: number, restaurantData: Partial<Restaurant>): Promise<Restaurant | undefined> {
    const [updatedRestaurant] = await db.update(restaurants)
      .set(restaurantData)
      .where(eq(restaurants.id, id))
      .returning();
    return updatedRestaurant;
  }

  // MenuItem operations
  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    const [menuItem] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return menuItem;
  }

  async getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]> {
    return await db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async createMenuItem(insertMenuItem: InsertMenuItem): Promise<MenuItem> {
    const [menuItem] = await db.insert(menuItems).values(insertMenuItem).returning();
    return menuItem;
  }

  async updateMenuItem(id: number, menuItemData: Partial<MenuItem>): Promise<MenuItem | undefined> {
    const [updatedMenuItem] = await db.update(menuItems)
      .set(menuItemData)
      .where(eq(menuItems.id, id))
      .returning();
    return updatedMenuItem;
  }

  // Rider operations
  async getRider(id: number): Promise<Rider | undefined> {
    const [rider] = await db.select().from(riders).where(eq(riders.id, id));
    return rider;
  }

  async getRiderByUserId(userId: number): Promise<Rider | undefined> {
    const [rider] = await db.select().from(riders).where(eq(riders.userId, userId));
    return rider;
  }

  async getAllRiders(): Promise<Rider[]> {
    return await db.select().from(riders);
  }

  async getActiveRiders(): Promise<Rider[]> {
    return await db.select().from(riders).where(eq(riders.status, 'active'));
  }

  async getWaitingRiders(): Promise<Rider[]> {
    return await db.select().from(riders).where(eq(riders.status, 'waiting'));
  }

  async createRider(insertRider: InsertRider): Promise<Rider> {
    const [rider] = await db.insert(riders).values(insertRider).returning();
    return rider;
  }

  async updateRider(id: number, riderData: Partial<Rider>): Promise<Rider | undefined> {
    const [updatedRider] = await db.update(riders)
      .set(riderData)
      .where(eq(riders.id, id))
      .returning();
    return updatedRider;
  }

  // Customer operations
  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByUserId(userId: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.userId, userId));
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return await db.select().from(customers);
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(insertCustomer).returning();
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined> {
    const [updatedCustomer] = await db.update(customers)
      .set(customerData)
      .where(eq(customers.id, id))
      .returning();
    return updatedCustomer;
  }

  // Order operations
  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.customerId, customerId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByRestaurantId(restaurantId: number): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.restaurantId, restaurantId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByRiderId(riderId: number): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.riderId, riderId))
      .orderBy(desc(orders.createdAt));
  }

  async getAllOrders(): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .orderBy(desc(orders.createdAt));
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return await db.select()
      .from(orders)
      .where(eq(orders.status, status))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db.insert(orders).values(insertOrder).returning();
    return order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const [updatedOrder] = await db.update(orders)
      .set(orderData)
      .where(eq(orders.id, id))
      .returning();
    return updatedOrder;
  }

  // Settings operations
  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async getAllSettings(): Promise<Setting[]> {
    return await db.select().from(settings);
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const [setting] = await db.insert(settings).values(insertSetting).returning();
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const [updatedSetting] = await db.update(settings)
      .set({ value, updatedAt: new Date() })
      .where(eq(settings.key, key))
      .returning();
    return updatedSetting;
  }

  // Message methods
  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const [message] = await db
      .insert(messages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getMessagesByOrderId(orderId: number): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.orderId, orderId))
      .orderBy(asc(messages.createdAt));
  }

  async markMessageAsRead(messageId: number): Promise<Message | undefined> {
    const [updated] = await db
      .update(messages)
      .set({ isRead: true })
      .where(eq(messages.id, messageId))
      .returning();
    return updated;
  }

  async markAllMessagesAsRead(orderId: number, userId: number): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(and(
        eq(messages.orderId, orderId),
        ne(messages.senderId, userId)
      ));
  }

  // Loyalty operations
  async getLoyaltyAccount(id: number): Promise<LoyaltyAccount | undefined> {
    const [account] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.id, id));
    return account;
  }

  async getLoyaltyAccountByCustomerId(customerId: number): Promise<LoyaltyAccount | undefined> {
    const [account] = await db.select().from(loyaltyAccounts).where(eq(loyaltyAccounts.customerId, customerId));
    return account;
  }

  async getAllLoyaltyAccounts(): Promise<LoyaltyAccount[]> {
    return await db.select().from(loyaltyAccounts).orderBy(desc(loyaltyAccounts.lifetimePoints));
  }

  async createLoyaltyAccount(insertAccount: InsertLoyaltyAccount): Promise<LoyaltyAccount> {
    const [account] = await db.insert(loyaltyAccounts).values(insertAccount).returning();
    return account;
  }

  async updateLoyaltyAccount(id: number, accountData: Partial<LoyaltyAccount>): Promise<LoyaltyAccount | undefined> {
    const [updatedAccount] = await db.update(loyaltyAccounts)
      .set(accountData)
      .where(eq(loyaltyAccounts.id, id))
      .returning();
    return updatedAccount;
  }

  async getLoyaltyTransactions(accountId: number): Promise<LoyaltyTransaction[]> {
    return await db.select().from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.accountId, accountId))
      .orderBy(desc(loyaltyTransactions.createdAt));
  }

  async getLoyaltyTransactionByOrderId(orderId: number): Promise<LoyaltyTransaction | undefined> {
    const [transaction] = await db.select().from(loyaltyTransactions)
      .where(eq(loyaltyTransactions.orderId, orderId));
    return transaction;
  }

  async createLoyaltyTransaction(insertTransaction: InsertLoyaltyTransaction): Promise<LoyaltyTransaction> {
    const [transaction] = await db.insert(loyaltyTransactions).values(insertTransaction).returning();
    return transaction;
  }

  async getLoyaltyStats(): Promise<{ bronze: number; silver: number; gold: number; totalPoints: number }> {
    const accounts = await db.select().from(loyaltyAccounts);

    let bronze = 0, silver = 0, gold = 0, totalPoints = 0;

    for (const account of accounts) {
      totalPoints += account.pointsBalance;
      if (account.tier === LoyaltyTier.GOLD) {
        gold++;
      } else if (account.tier === LoyaltyTier.SILVER) {
        silver++;
      } else {
        bronze++;
      }
    }

    return { bronze, silver, gold, totalPoints };
  }
}
