import React from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/contexts/cart-context";
import { useQuery } from "@tanstack/react-query";
import { Restaurant, Customer } from "@shared/schema";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Store,
  AlertTriangle
} from "lucide-react";
import { formatCurrency, calculateDeliveryFeeSimple } from "@/lib/utils";

export default function CartPage() {
  const [, setLocation] = useLocation();
  const {
    items,
    restaurantId,
    removeItem,
    updateQuantity,
    clearCart,
    getTotalItems,
    getTotalPrice
  } = useCart();

  // Fetch restaurant data if we have a restaurantId
  const { data: restaurant, isLoading: isLoadingRestaurant } = useQuery<Restaurant>({
    queryKey: [`/api/restaurants/${restaurantId}`],
    enabled: !!restaurantId,
  });

  // Fetch customer data for location
  const { data: customer } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
  });

  // Calculate distance for delivery fee (in km)
  const calculateDistance = () => {
    // If no restaurant or customer data, return null
    if (!restaurant) {
      console.log('Missing restaurant data');
      return null;
    }

    if (!customer) {
      console.log('Missing customer data');
      return null;
    }

    // Get restaurant coordinates
    const restaurantLat = restaurant.latitude;
    const restaurantLng = restaurant.longitude;

    // Get customer coordinates
    const customerLocation = customer.location ? (customer.location as { lat: number; lng: number }) : null;
    const customerLat = customerLocation?.lat;
    const customerLng = customerLocation?.lng;

    console.log('Coordinates:', {
      restaurant: { lat: restaurantLat, lng: restaurantLng },
      customer: { lat: customerLat, lng: customerLng }
    });

    if (!restaurantLat || !restaurantLng) {
      console.log('Missing restaurant coordinates');
      return null;
    }

    if (!customerLat || !customerLng) {
      console.log('Missing customer coordinates');
      return null;
    }

    // Simple distance calculation using Haversine formula
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const R = 6371; // Earth's radius in km

    const dLat = toRadians(customerLat - restaurantLat);
    const dLon = toRadians(customerLng - restaurantLng);

    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRadians(restaurantLat)) * Math.cos(toRadians(customerLat)) *
      Math.sin(dLon/2) * Math.sin(dLon/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in km

    // Apply a multiplier to account for non-straight-line routes
    const routeMultiplier = 1.3; // Roads are typically 20-30% longer than straight lines
    const finalDistance = distance * routeMultiplier;

    console.log('Calculated distance:', finalDistance);
    return finalDistance;
  };

  // Check if we have valid data for calculation
  console.log('Restaurant data:', restaurant);
  console.log('Restaurant ID:', restaurantId);
  console.log('Cart items:', items.length);

  // Calculate delivery fee based on distance between customer and restaurant
  const distance = calculateDistance();
  console.log('Calculated distance result:', distance);

  const distanceBasedFee = distance ? calculateDeliveryFeeSimple(distance) : null;
  console.log('Distance-based fee:', distanceBasedFee);

  // Use the calculated fee if available, otherwise use a default base fare of 52 (50 + 2 platform fee)
  const deliveryFee = distanceBasedFee !== null ? distanceBasedFee : 52;
  console.log('Final delivery fee:', deliveryFee);

  const subtotal = getTotalPrice();
  const total = subtotal + deliveryFee;

  const handleGoBack = () => {
    if (restaurantId) {
      setLocation(`/restaurants/${restaurantId}`);
    } else {
      setLocation("/");
    }
  };

  const handleCheckout = () => {
    setLocation('/checkout');
  };

  if (items.length === 0) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              className="mr-2"
              onClick={handleGoBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Your Cart</h1>
          </div>

          <Card className="w-full text-center py-12">
            <CardContent>
              <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">Add items from a restaurant to get started</p>
              <Button onClick={() => setLocation("/")}>Browse Restaurants</Button>
            </CardContent>
          </Card>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Button
              variant="ghost"
              className="mr-2"
              onClick={handleGoBack}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold">Your Cart</h1>
          </div>

          <Button
            variant="outline"
            className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
            onClick={clearCart}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Cart
          </Button>
        </div>

        {restaurant && (
          <div className="flex items-center mb-6 p-4 bg-muted/30 rounded-lg">
            <Store className="h-5 w-5 mr-3 text-primary" />
            <div>
              <h2 className="font-medium">{restaurant.name}</h2>
              <p className="text-sm text-muted-foreground">{restaurant.address}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Cart Items */}
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.menuItem.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex border-b">
                      {item.menuItem.imageUrl && (
                        <div
                          className="w-24 h-24 bg-cover bg-center"
                          style={{ backgroundImage: `url(${item.menuItem.imageUrl})` }}
                        />
                      )}
                      <div className="flex-grow p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{item.menuItem.name}</h3>
                            {item.menuItem.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {item.menuItem.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-500"
                            onClick={() => removeItem(item.menuItem.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="mx-3 font-medium">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => updateQuantity(item.menuItem.id, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(
                                (item.menuItem.discountedPrice || item.menuItem.price) * item.quantity
                              )}
                            </p>
                            {item.quantity > 1 && (
                              <p className="text-xs text-muted-foreground">
                                {formatCurrency(item.menuItem.discountedPrice || item.menuItem.price)} each
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {/* Order Summary */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      {distance !== null && (
                        <span className="text-xs text-muted-foreground mt-1">
                          {distance.toFixed(1)} km distance
                        </span>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                      <span>{formatCurrency(deliveryFee)}</span>
                      {distance !== null && distanceBasedFee !== null && (
                        <span className="text-xs text-muted-foreground mt-1">
                          ₱50 base + ₱{(distanceBasedFee - 52).toFixed(2)} distance + ₱2 platform
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="specialInstructions">
                      Special Instructions
                    </label>
                    <Input
                      id="specialInstructions"
                      placeholder="E.g., No onions, allergies, etc."
                    />
                  </div>

                  <Button className="w-full" size="lg" onClick={handleCheckout}>
                    Proceed to Checkout
                  </Button>

                  <div className="text-center text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                    This is a demo. No real orders will be processed.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
