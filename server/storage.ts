import {
  users, restaurants, menuItems, riders, customers, orders, settings, feedback,
  type User, type Restaurant, type MenuItem, type Rider, type Customer, type Order, type Setting, type Feedback,
  type InsertUser, type InsertRestaurant, type InsertMenuItem, type InsertRider, type InsertCustomer, type InsertOrder, type InsertSetting, type InsertFeedback,
  type LoyaltyAccount, type InsertLoyaltyAccount, type LoyaltyTransaction, type InsertLoyaltyTransaction,
  UserRole, OrderStatus, RiderStatus, PaymentMethod
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Storage interface for CRUD operations
export interface IStorage {
  // Session store
  sessionStore: session.SessionStore;

  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;

  // Restaurant operations
  getRestaurant(id: number): Promise<Restaurant | undefined>;
  getRestaurantByUserId(userId: number): Promise<Restaurant | undefined>;
  getAllRestaurants(): Promise<Restaurant[]>;
  getActiveRestaurants(): Promise<Restaurant[]>;
  getApprovedRestaurants(): Promise<Restaurant[]>;
  createRestaurant(restaurant: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(id: number, restaurant: Partial<Restaurant>): Promise<Restaurant | undefined>;

  // MenuItem operations
  getMenuItem(id: number): Promise<MenuItem | undefined>;
  getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]>;
  createMenuItem(menuItem: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: number, menuItem: Partial<MenuItem>): Promise<MenuItem | undefined>;

  // Rider operations
  getRider(id: number): Promise<Rider | undefined>;
  getRiderByUserId(userId: number): Promise<Rider | undefined>;
  getAllRiders(): Promise<Rider[]>;
  getActiveRiders(): Promise<Rider[]>;
  getWaitingRiders(): Promise<Rider[]>;
  createRider(rider: InsertRider): Promise<Rider>;
  updateRider(id: number, rider: Partial<Rider>): Promise<Rider | undefined>;

  // Customer operations
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByUserId(userId: number): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, customer: Partial<Customer>): Promise<Customer | undefined>;

  // Order operations
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByCustomerId(customerId: number): Promise<Order[]>;
  getOrdersByRestaurantId(restaurantId: number): Promise<Order[]>;
  getOrdersByRiderId(riderId: number): Promise<Order[]>;
  getAllOrders(): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: number, order: Partial<Order>): Promise<Order | undefined>;

  // Settings operations
  getSetting(key: string): Promise<Setting | undefined>;
  getAllSettings(): Promise<Setting[]>;
  createSetting(setting: InsertSetting): Promise<Setting>;
  updateSetting(key: string, value: string): Promise<Setting | undefined>;

  // Feedback operations
  getFeedback(id: number): Promise<Feedback | undefined>;
  getFeedbackByOrderId(orderId: number): Promise<Feedback[]>;
  getFeedbackByRestaurantId(restaurantId: number): Promise<Feedback[]>;
  getAllFeedback(): Promise<Feedback[]>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;

  // Loyalty operations
  getLoyaltyAccount(id: number): Promise<LoyaltyAccount | undefined>;
  getLoyaltyAccountByCustomerId(customerId: number): Promise<LoyaltyAccount | undefined>;
  getAllLoyaltyAccounts(): Promise<LoyaltyAccount[]>;
  createLoyaltyAccount(account: InsertLoyaltyAccount): Promise<LoyaltyAccount>;
  updateLoyaltyAccount(id: number, account: Partial<LoyaltyAccount>): Promise<LoyaltyAccount | undefined>;
  getLoyaltyTransactions(accountId: number): Promise<LoyaltyTransaction[]>;
  getLoyaltyTransactionByOrderId(orderId: number): Promise<LoyaltyTransaction | undefined>;
  createLoyaltyTransaction(transaction: InsertLoyaltyTransaction): Promise<LoyaltyTransaction>;
  getLoyaltyStats(): Promise<{ bronze: number; silver: number; gold: number; totalPoints: number }>;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private restaurants: Map<number, Restaurant>;
  private menuItems: Map<number, MenuItem>;
  private riders: Map<number, Rider>;
  private customers: Map<number, Customer>;
  private orders: Map<number, Order>;
  private settings: Map<number, Setting>;

  private userCurrentId: number;
  private restaurantCurrentId: number;
  private menuItemCurrentId: number;
  private riderCurrentId: number;
  private customerCurrentId: number;
  private orderCurrentId: number;
  private settingCurrentId: number;

  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.restaurants = new Map();
    this.menuItems = new Map();
    this.riders = new Map();
    this.customers = new Map();
    this.orders = new Map();
    this.settings = new Map();

    this.userCurrentId = 1;
    this.restaurantCurrentId = 1;
    this.menuItemCurrentId = 1;
    this.riderCurrentId = 1;
    this.customerCurrentId = 1;
    this.orderCurrentId = 1;
    this.settingCurrentId = 1;

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // 24 hours
    });
}

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase()
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userCurrentId++;
    const now = new Date();
    const user: User = {
      ...insertUser,
      id,
      createdAt: now,
      lastLogin: null
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;

    const updatedUser = { ...user, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Restaurant methods
  async getRestaurant(id: number): Promise<Restaurant | undefined> {
    return this.restaurants.get(id);
  }

  async getRestaurantByUserId(userId: number): Promise<Restaurant | undefined> {
    return Array.from(this.restaurants.values()).find(
      (restaurant) => restaurant.userId === userId
    );
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values());
  }

  async getActiveRestaurants(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values()).filter(
      (restaurant) => restaurant.isActive
    );
  }

  async getApprovedRestaurants(): Promise<Restaurant[]> {
    return Array.from(this.restaurants.values()).filter(
      (restaurant) => restaurant.isActive && restaurant.isApproved
    );
  }

  async createRestaurant(insertRestaurant: InsertRestaurant): Promise<Restaurant> {
    const id = this.restaurantCurrentId++;
    const now = new Date();
    const restaurant: Restaurant = {
      ...insertRestaurant,
      id,
      createdAt: now
    };
    this.restaurants.set(id, restaurant);
    return restaurant;
  }

  async updateRestaurant(id: number, restaurantData: Partial<Restaurant>): Promise<Restaurant | undefined> {
    const restaurant = await this.getRestaurant(id);
    if (!restaurant) return undefined;

    const updatedRestaurant = { ...restaurant, ...restaurantData };
    this.restaurants.set(id, updatedRestaurant);
    return updatedRestaurant;
  }

  // MenuItem methods
  async getMenuItem(id: number): Promise<MenuItem | undefined> {
    return this.menuItems.get(id);
  }

  async getMenuItemsByRestaurantId(restaurantId: number): Promise<MenuItem[]> {
    return Array.from(this.menuItems.values()).filter(
      (menuItem) => menuItem.restaurantId === restaurantId
    );
  }

  async createMenuItem(insertMenuItem: InsertMenuItem): Promise<MenuItem> {
    const id = this.menuItemCurrentId++;
    const now = new Date();
    const menuItem: MenuItem = {
      ...insertMenuItem,
      id,
      createdAt: now
    };
    this.menuItems.set(id, menuItem);
    return menuItem;
  }

  async updateMenuItem(id: number, menuItemData: Partial<MenuItem>): Promise<MenuItem | undefined> {
    const menuItem = await this.getMenuItem(id);
    if (!menuItem) return undefined;

    const updatedMenuItem = { ...menuItem, ...menuItemData };
    this.menuItems.set(id, updatedMenuItem);
    return updatedMenuItem;
  }

  // Rider methods
  async getRider(id: number): Promise<Rider | undefined> {
    return this.riders.get(id);
  }

  async getRiderByUserId(userId: number): Promise<Rider | undefined> {
    return Array.from(this.riders.values()).find(
      (rider) => rider.userId === userId
    );
  }

  async getAllRiders(): Promise<Rider[]> {
    return Array.from(this.riders.values());
  }

  async getActiveRiders(): Promise<Rider[]> {
    return Array.from(this.riders.values()).filter(
      (rider) => rider.status === RiderStatus.ACTIVE
    );
  }

  async getWaitingRiders(): Promise<Rider[]> {
    return Array.from(this.riders.values())
      .filter(rider => rider.status === RiderStatus.WAITING)
      .sort((a, b) => (a.queuePosition || 0) - (b.queuePosition || 0));
  }

  async createRider(insertRider: InsertRider): Promise<Rider> {
    const id = this.riderCurrentId++;
    const now = new Date();
    const rider: Rider = {
      ...insertRider,
      id,
      createdAt: now
    };
    this.riders.set(id, rider);
    return rider;
  }

  async updateRider(id: number, riderData: Partial<Rider>): Promise<Rider | undefined> {
    const rider = await this.getRider(id);
    if (!rider) return undefined;

    const updatedRider = { ...rider, ...riderData };
    this.riders.set(id, updatedRider);
    return updatedRider;
  }

  // Customer methods
  async getCustomer(id: number): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomerByUserId(userId: number): Promise<Customer | undefined> {
    return Array.from(this.customers.values()).find(
      (customer) => customer.userId === userId
    );
  }

  async getAllCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = this.customerCurrentId++;
    const now = new Date();
    const customer: Customer = {
      ...insertCustomer,
      id,
      createdAt: now
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer | undefined> {
    const customer = await this.getCustomer(id);
    if (!customer) return undefined;

    const updatedCustomer = { ...customer, ...customerData };
    this.customers.set(id, updatedCustomer);
    return updatedCustomer;
  }

  // Order methods
  async getOrder(id: number): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByCustomerId(customerId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerId === customerId
    );
  }

  async getOrdersByRestaurantId(restaurantId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.restaurantId === restaurantId
    );
  }

  async getOrdersByRiderId(riderId: number): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.riderId === riderId
    );
  }

  async getAllOrders(): Promise<Order[]> {
    return Array.from(this.orders.values());
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === status
    );
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const id = this.orderCurrentId++;
    const now = new Date();
    const order: Order = {
      ...insertOrder,
      id,
      createdAt: now
    };
    this.orders.set(id, order);
    return order;
  }

  async updateOrder(id: number, orderData: Partial<Order>): Promise<Order | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;

    const updatedOrder = { ...order, ...orderData };
    this.orders.set(id, updatedOrder);
    return updatedOrder;
  }

  // Settings methods
  async getSetting(key: string): Promise<Setting | undefined> {
    return Array.from(this.settings.values()).find(
      (setting) => setting.key === key
    );
  }

  async getAllSettings(): Promise<Setting[]> {
    return Array.from(this.settings.values());
  }

  async createSetting(insertSetting: InsertSetting): Promise<Setting> {
    const id = this.settingCurrentId++;
    const now = new Date();
    const setting: Setting = {
      ...insertSetting,
      id,
      updatedAt: now
    };
    this.settings.set(id, setting);
    return setting;
  }

  async updateSetting(key: string, value: string): Promise<Setting | undefined> {
    const setting = await this.getSetting(key);
    if (!setting) return undefined;

    const now = new Date();
    const updatedSetting = { ...setting, value, updatedAt: now };
    this.settings.set(setting.id, updatedSetting);
    return updatedSetting;
  }
}

import { DatabaseStorage } from "./database-storage";

// Use database storage for production
export const storage = new DatabaseStorage();
