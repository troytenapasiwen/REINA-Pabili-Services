import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { MenuItem } from '@shared/schema';

// Define cart item type
export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

// Define cart context type
interface CartContextType {
  items: CartItem[];
  restaurantId: number | null;
  addItem: (menuItem: MenuItem) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, quantity: number) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
}

// Create context with default values
const CartContext = createContext<CartContextType>({
  items: [],
  restaurantId: null,
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getTotalItems: () => 0,
  getTotalPrice: () => 0,
});

// Custom hook to use cart context
export const useCart = () => useContext(CartContext);

// Cart Provider component
export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<number | null>(null);

  // Initialize cart from localStorage
  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    const savedRestaurantId = localStorage.getItem('cartRestaurantId');

    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Failed to parse cart from localStorage:', error);
        setItems([]);
      }
    }

    if (savedRestaurantId) {
      try {
        setRestaurantId(JSON.parse(savedRestaurantId));
      } catch (error) {
        console.error('Failed to parse restaurantId from localStorage:', error);
        setRestaurantId(null);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(items));
    if (restaurantId !== null) {
      localStorage.setItem('cartRestaurantId', JSON.stringify(restaurantId));
    }
  }, [items, restaurantId]);

  // Add item to cart
  const addItem = (menuItem: MenuItem) => {
    // Check if trying to add item from different restaurant
    if (restaurantId !== null && restaurantId !== menuItem.restaurantId) {
      if (!window.confirm('Adding items from a different restaurant will clear your current cart. Continue?')) {
        return;
      }
      // Clear cart if user confirms
      setItems([]);
    }

    // Set restaurant ID
    setRestaurantId(menuItem.restaurantId);

    // Check if item already exists in cart
    const existingItemIndex = items.findIndex(item => item.menuItem.id === menuItem.id);

    if (existingItemIndex >= 0) {
      // Update quantity of existing item
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += 1;
      setItems(updatedItems);
    } else {
      // Add new item to cart
      setItems([...items, { menuItem, quantity: 1 }]);
    }
  };

  // Remove item from cart
  const removeItem = (menuItemId: number) => {
    setItems(items.filter(item => item.menuItem.id !== menuItemId));

    // Reset restaurant ID if cart becomes empty
    if (items.length <= 1) {
      setRestaurantId(null);
    }
  };

  // Update quantity of item in cart
  const updateQuantity = (menuItemId: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menuItemId);
      return;
    }

    const updatedItems = items.map(item =>
      item.menuItem.id === menuItemId
        ? { ...item, quantity }
        : item
    );

    setItems(updatedItems);
  };

  // Clear cart
  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
    localStorage.removeItem('cart');
    localStorage.removeItem('cartRestaurantId');
  };

  // Get total number of items in cart
  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0);
  };

  // Get total price of items in cart
  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      const itemPrice = item.menuItem.discountedPrice || item.menuItem.price;
      return total + (itemPrice * item.quantity);
    }, 0);
  };

  const contextValue: CartContextType = {
    items,
    restaurantId,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};
