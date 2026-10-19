import React, { useState } from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/cart-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Customer, InsertOrder, PaymentMethod, Restaurant, applyDeliveryFeeDiscount, getDeliveryDiscountRate, LoyaltyTierType } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency, calculateDeliveryFeeSimple } from "@/lib/utils";
import { ArrowLeft, CreditCard, Upload, AlertTriangle, AlertCircle, Loader2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerLocationPicker } from "@/components/customer/customer-location-picker";
import { EnhancedLocationPicker } from "@/components/customer/enhanced-location-picker";
import { SavedAddresses } from "@/components/customer/saved-addresses";

import { TipSelector } from "@/components/customer/tip-selector";

// COD payment limits
const COD_LIMIT = 1000;
const COD_WARNING_THRESHOLD = 800;

export default function CheckoutPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { items, restaurantId, getTotalPrice, clearCart } = useCart();
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PaymentMethod.COD);
  const [gcashReceiptOpen, setGcashReceiptOpen] = useState(false);
  const [gcashReceipt, setGcashReceipt] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);

  // Fetch restaurant data
  const { data: restaurant, isLoading: isLoadingRestaurant } = useQuery<Restaurant>({
    queryKey: [`/api/restaurants/${restaurantId}`],
    enabled: !!restaurantId,
  });

  // Fetch customer data
  const { data: customer, isLoading: isLoadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
  });

  // Fetch loyalty account to apply tier-based delivery fee discount
  const { data: loyaltyAccount } = useQuery<{ tier: LoyaltyTierType }>({
    queryKey: ["/api/loyalty/account"],
  });

  // Fetch GCash configuration
  const { data: gcashConfig } = useQuery<{
    enabled: boolean;
    displayMode: "phone" | "qr";
    phoneNumber?: string;
    qrCodeUrl?: string;
  }>({
    queryKey: ["/api/public/gcash-config"],
  });

  // Location update mutation
  const updateLocationMutation = useMutation({
    mutationFn: async ({ location, address, locationName }: { location: {lat: number, lng: number}, address: string, locationName?: string }) => {
      const res = await apiRequest("PATCH", "/api/customers/location", {
        lat: location.lat,
        lng: location.lng,
        defaultAddress: address,
        locationName
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
      toast({
        title: "Location updated",
        description: "Your delivery location has been updated"
      });
      setShowLocationDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating location",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Calculate distance for delivery fee (in km)
  const calculateDistance = () => {
    // Get restaurant coordinates
    const restaurantLat = restaurant?.latitude || 0;
    const restaurantLng = restaurant?.longitude || 0;

    // Get customer coordinates - use type casting for proper type checking
    const customerLocation = customer?.location ? (customer.location as { lat: number; lng: number }) : { lat: 0, lng: 0 };
    const customerLat = customerLocation.lat;
    const customerLng = customerLocation.lng;

    if (!restaurantLat || !restaurantLng || !customerLat || !customerLng) {
      // If coordinates are missing, fall back to restaurant's default delivery fee
      return null;
    }

    // Simple distance calculation (this is a straight-line distance, actual routes would be longer)
    // Using Haversine formula to calculate distance between two coordinates
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
    return distance * routeMultiplier;
  };

  // Calculate delivery fee based on distance between customer and restaurant
  const distance = calculateDistance();
  const distanceBasedFee = distance ? calculateDeliveryFeeSimple(distance) : null;

  // Use the calculated fee if available, otherwise use a default base fare of 30
  const baseDeliveryFee = distanceBasedFee !== null ? distanceBasedFee : 30;

  // Apply tier-based loyalty discount on the delivery fee
  const loyaltyTier: LoyaltyTierType = loyaltyAccount?.tier || "bronze";
  const deliveryDiscountRate = getDeliveryDiscountRate(loyaltyTier);
  const deliveryFee = applyDeliveryFeeDiscount(baseDeliveryFee, loyaltyTier);
  const deliveryDiscountAmount = baseDeliveryFee - deliveryFee;

  const subtotal = getTotalPrice();
  const total = subtotal + deliveryFee + tipAmount;

  // COD limit checks
  const isCodLimitExceeded = paymentMethod === PaymentMethod.COD && total > COD_LIMIT;
  const isCodWarning = paymentMethod === PaymentMethod.COD && total > COD_WARNING_THRESHOLD && total <= COD_LIMIT;

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: InsertOrder) => {
      const res = await apiRequest("POST", "/api/orders", orderData);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Order Placed!",
        description: `Your order #${data.id} has been placed successfully.`,
      });
      clearCart();
      setLocation(`/orders/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to place order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadReceiptMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await apiRequest("POST", "/api/uploads/receipt", formData, false);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Receipt Uploaded",
        description: "Your GCash receipt has been uploaded.",
      });
      setGcashReceiptOpen(false);
      proceedWithOrder(data.receiptUrl);
    },
    onError: (error: Error) => {
      setIsUploading(false);
      toast({
        title: "Failed to upload receipt",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGoBack = () => {
    setLocation("/cart");
  };

  const handleGcashReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setGcashReceipt(e.target.files[0]);
    }
  };

  const uploadGcashReceipt = async () => {
    if (!gcashReceipt) {
      toast({
        title: "No receipt selected",
        description: "Please upload a screenshot of your payment",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("receipt", gcashReceipt);
    formData.append("restaurantId", String(restaurantId));
    formData.append("amount", String(total));

    uploadReceiptMutation.mutate(formData);
  };

  const proceedWithOrder = (receiptUrl?: string) => {
    if (isLoadingCustomer || isLoadingRestaurant) {
      toast({
        title: "Loading",
        description: "Please wait while we load your information",
        variant: "default",
      });
      return;
    }

    if (!customer) {
      toast({
        title: "Error",
        description: "Unable to get customer data. Please try refreshing the page.",
        variant: "destructive",
      });
      return;
    }

    if (!restaurant) {
      toast({
        title: "Error",
        description: "Unable to get restaurant data. Restaurant ID: " + restaurantId,
        variant: "destructive",
      });
      return;
    }

    if (!customer.defaultAddress) {
      toast({
        title: "No delivery address",
        description: "Please set a delivery address in your profile",
        variant: "destructive",
      });
      return;
    }

    // Get customer coordinates for metadata
    const customerCoordinates = customer?.location ? (customer.location as { lat: number; lng: number }) : { lat: 0, lng: 0 };

    // Get restaurant coordinates for metadata
    const restaurantCoordinates = {
      lat: restaurant?.latitude || 0,
      lng: restaurant?.longitude || 0
    };

    // Construct metadata with distance information and receipt image
    const metadata = {
      deliveryDistance: distance || null,
      customerLocation: customerCoordinates,
      restaurantLocation: restaurantCoordinates,
      ...(receiptUrl && { receiptImage: receiptUrl })
    };

    const orderData: InsertOrder = {
      customerId: customer.id,
      restaurantId: restaurant.id,
      items: items.map(item => ({
        menuItemId: item.menuItem.id,
        name: item.menuItem.name,
        price: item.menuItem.price,
        quantity: item.quantity,
        totalPrice: (item.menuItem.discountedPrice || item.menuItem.price) * item.quantity,
      })),
      status: "pending",
      totalAmount: total,
      deliveryFee: deliveryFee,
      paymentMethod: paymentMethod,
      paymentStatus: paymentMethod === PaymentMethod.COD ? "pending" : "paid",
      paymentReference: receiptUrl || null,
      deliveryAddress: customer.defaultAddress,
      tipAmount: tipAmount,
      deliveryLocationName: customer.locationName || 'Delivery Location',
      specialInstructions: specialInstructions,
      metadata: metadata,
    };

    createOrderMutation.mutate(orderData);
  };

  const handleCheckout = () => {
    // Check COD limit
    if (paymentMethod === PaymentMethod.COD && total > COD_LIMIT) {
      toast({
        title: "COD limit exceeded",
        description: `Cash on Delivery is only available for orders up to ₱${COD_LIMIT.toLocaleString()}. Please use GCash for this order.`,
        variant: "destructive",
      });
      return;
    }

    if (paymentMethod === PaymentMethod.GCASH) {
      setGcashReceiptOpen(true);
    } else {
      proceedWithOrder();
    }
  };

  // Redirect to cart if no items
  if (items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const isLoading = isLoadingCustomer || isLoadingRestaurant || createOrderMutation.isPending;

  return (
    <CustomerLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center mb-6">
          <Button
            variant="ghost"
            className="mr-2"
            onClick={handleGoBack}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Button>
          <h1 className="text-2xl font-bold">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {/* Delivery Address */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">Delivery Address</h2>
                {customer ? (
                  <div>
                    <div className="flex items-center mb-1">
                      <p className="font-medium">{customer.locationName || "Your Address"}</p>
                      {customer.locationName && (customer.locationName === 'Home' || customer.locationName === 'Work') && (
                        <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          {customer.locationName}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{customer.defaultAddress || "No address set"}</p>
                    <div className="flex mt-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setLocation("/profile")}
                      >
                        Change Address
                      </Button>
                      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
                        <DialogTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setShowLocationDialog(true)}
                          >
                            <MapPin className="mr-2 h-4 w-4" />
                            Update Location
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
                          <DialogHeader>
                            <DialogTitle>Update Delivery Location</DialogTitle>
                            <DialogDescription>
                              Set your delivery location for this order. You can save it as Home or Work.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-6">
                            <div className="rounded-lg border p-4 bg-muted/20">
                              <h3 className="text-sm font-medium mb-2">Select a saved address</h3>
                              <SavedAddresses
                                compact={true}
                                selectedAddressName={customer?.locationName || ""}
                                onSelectAddress={(savedAddress) => {
                                  // Update the customer's location with the saved address
                                  if (savedAddress) {
                                    updateLocationMutation.mutate({
                                      location: {
                                        lat: savedAddress.lat,
                                        lng: savedAddress.lng
                                      },
                                      address: savedAddress.address,
                                      locationName: savedAddress.name
                                    });
                                  }
                                }}
                              />
                            </div>

                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                  Or set a new location
                                </span>
                              </div>
                            </div>

                            <EnhancedLocationPicker
                              saveToAddresses={true}
                              onLocationSaved={() => {
                                toast({
                                  title: "Location updated",
                                  description: "Your delivery location has been updated"
                                });
                                // Refresh customer data
                                queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
                              }}
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ) : (
                  <div className="animate-pulse h-24">
                    <div className="bg-muted h-4 w-48 rounded mb-2"></div>
                    <div className="bg-muted h-4 w-96 rounded mb-4"></div>
                    <div className="bg-muted h-9 w-36 rounded"></div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Method */}
            <Card className="mb-6">
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">Payment Method</h2>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={PaymentMethod.COD} id="cod" />
                    <Label htmlFor="cod" className="flex items-center cursor-pointer">
                      <CreditCard className="mr-2 h-4 w-4" /> Cash on Delivery
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={PaymentMethod.GCASH} id="gcash" />
                    <Label htmlFor="gcash" className="flex items-center cursor-pointer">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="mr-2"
                      >
                        <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#0057AB"/>
                        <path d="M16.95 7H7.05c-.58 0-1.05.47-1.05 1.05v7.9c0 .58.47 1.05 1.05 1.05h9.9c.58 0 1.05-.47 1.05-1.05v-7.9c0-.58-.47-1.05-1.05-1.05z" fill="#fff"/>
                        <path d="M13.667 15.766h-3.334a.766.766 0 110-1.532h3.334a.766.766 0 110 1.532zM7.116 13.7h9.768v-1.532H7.116V13.7zM10.45 9.767h3.1a.766.766 0 010 1.532h-3.1a.766.766 0 010-1.532z" fill="#0057AB"/>
                      </svg> GCash
                    </Label>
                  </div>
                </RadioGroup>

                {/* GCash Payment Instructions */}
                {/* COD Limit Warning */}
                {paymentMethod === PaymentMethod.COD && total > COD_LIMIT && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 text-red-600 mt-0.5">
                        ⚠️
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-red-900 mb-1">COD Limit Exceeded</h3>
                        <p className="text-sm text-red-700">
                          Cash on Delivery is only available for orders up to ₱{COD_LIMIT.toLocaleString()}.
                          Your current order total is {formatCurrency(total)}. Please use GCash instead.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* COD Limit Warning - Approaching */}
                {paymentMethod === PaymentMethod.COD && total > COD_WARNING_THRESHOLD && total <= COD_LIMIT && (
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 text-yellow-600 mt-0.5">
                        ⚠️
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800">
                          Note: COD has a maximum limit of ₱{COD_LIMIT.toLocaleString()}.
                          Your current order total is {formatCurrency(total)}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* GCash Payment Instructions */}
                {paymentMethod === PaymentMethod.GCASH && gcashConfig?.enabled && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-blue-600"
                        >
                          <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" fill="#0057AB"/>
                          <path d="M16.95 7H7.05c-.58 0-1.05.47-1.05 1.05v7.9c0 .58.47 1.05 1.05 1.05h9.9c.58 0 1.05-.47 1.05-1.05v-7.9c0-.58-.47-1.05-1.05-1.05z" fill="#fff"/>
                          <path d="M13.667 15.766h-3.334a.766.766 0 110-1.532h3.334a.766.766 0 110 1.532zM7.116 13.7h9.768v-1.532H7.116V13.7zM10.45 9.767h3.1a.766.766 0 010 1.532h-3.1a.766.766 0 010-1.532z" fill="#0057AB"/>
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">GCash Payment Instructions</h3>
                        <div className="text-sm text-blue-800 space-y-2">
                          {gcashConfig.displayMode === "phone" && gcashConfig.phoneNumber ? (
                            <>
                              <p>Please send your payment to:</p>
                              <div className="bg-white p-3 rounded border border-blue-200">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-lg font-bold text-blue-900">{gcashConfig.phoneNumber}</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(gcashConfig.phoneNumber || '');
                                      toast({
                                        title: "Copied!",
                                        description: "GCash number copied to clipboard",
                                      });
                                    }}
                                    className="text-xs"
                                  >
                                    Copy
                                  </Button>
                                </div>
                              </div>
                            </>
                          ) : gcashConfig.displayMode === "qr" && gcashConfig.qrCodeUrl ? (
                            <>
                              <p>Please scan this QR code to send payment:</p>
                              <div className="bg-white p-4 rounded border border-blue-200">
                                <img
                                  src={gcashConfig.qrCodeUrl}
                                  alt="GCash QR Code"
                                  className="max-w-full mx-auto"
                                  style={{ maxWidth: '250px' }}
                                />
                              </div>
                            </>
                          ) : (
                            <p className="text-red-600">GCash payment configuration is missing. Please contact support.</p>
                          )}
                          <div className="text-xs text-blue-700 mt-3">
                            <p><strong>Amount:</strong> {formatCurrency(total)}</p>
                            <p><strong>Note:</strong> After placing your order, you'll be asked to upload proof of payment.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tip for Rider */}
            <div className="mb-6">
              <TipSelector
                totalAmount={subtotal + deliveryFee}
                onTipChange={setTipAmount}
                selectedTip={tipAmount}
              />
            </div>

            {/* Special Instructions */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-bold mb-4">Special Instructions</h2>
                <Textarea
                  placeholder="E.g., No onions, deliver to back door, etc."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  className="resize-none"
                  rows={4}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            {/* Order Summary */}
            <Card className="sticky top-24">
              <CardContent className="p-6">
                <h2 className="text-xl font-bold mb-4">Order Summary</h2>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items ({items.length})</span>
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
                      {deliveryDiscountAmount > 0 ? (
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground line-through">
                            {formatCurrency(baseDeliveryFee)}
                          </span>
                          <span>{formatCurrency(deliveryFee)}</span>
                        </span>
                      ) : (
                        <span>{formatCurrency(deliveryFee)}</span>
                      )}
                      {distance !== null && distanceBasedFee !== null && (
                        <span className="text-xs text-muted-foreground mt-1">
                          ₱50 base + ₱{(distanceBasedFee - 52).toFixed(2)} distance + ₱2 platform
                        </span>
                      )}
                    </div>
                  </div>

                  {deliveryDiscountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span className="capitalize">
                        {loyaltyTier} loyalty discount ({Math.round(deliveryDiscountRate * 100)}% off delivery)
                      </span>
                      <span>-{formatCurrency(deliveryDiscountAmount)}</span>
                    </div>
                  )}

                  {tipAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tip for Rider</span>
                      <span>{formatCurrency(tipAmount)}</span>
                    </div>
                  )}

                  <div className="border-t pt-3 flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="px-6 pb-6 pt-0 flex-col">
                {/* COD Limit Error */}
                {isCodLimitExceeded && (
                  <div className="w-full mb-4 p-3 bg-red-50 border border-red-200 rounded-lg" data-testid="cod-limit-error">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-800">COD Limit Exceeded</p>
                        <p className="text-xs text-red-600 mt-1">
                          Cash on Delivery is only available for orders up to ₱{COD_LIMIT.toLocaleString()}.
                          Your total is ₱{total.toLocaleString()}. Please use GCash for this order.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* COD Limit Warning */}
                {isCodWarning && (
                  <div className="w-full mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg" data-testid="cod-limit-warning">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-800">Approaching COD Limit</p>
                        <p className="text-xs text-yellow-600 mt-1">
                          Your order total (₱{total.toLocaleString()}) is close to the COD limit of ₱{COD_LIMIT.toLocaleString()}.
                          Consider using GCash if your final total might exceed the limit.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isLoading || isCodLimitExceeded}
                  data-testid="place-order-button"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Place Order"
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  <AlertTriangle className="h-3 w-3 inline-block mr-1" />
                  By placing your order, you agree to our terms and conditions.
                </p>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>

      {/* GCash Receipt Upload Dialog */}
      <Dialog open={gcashReceiptOpen} onOpenChange={setGcashReceiptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload GCash Payment Receipt</DialogTitle>
            <DialogDescription>
              Please upload a screenshot of your GCash payment receipt
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              {gcashReceipt ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{gcashReceipt.name}</p>
                  <p className="text-xs text-muted-foreground">{(gcashReceipt.size / 1024).toFixed(2)} KB</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setGcashReceipt(null)}
                  >
                    Change File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Drag and drop your receipt here</p>
                    <p className="text-xs text-muted-foreground mt-1">Or click to browse files</p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleGcashReceiptUpload}
                    className="hidden"
                    id="receipt-upload"
                  />
                  <label htmlFor="receipt-upload">
                    <Button variant="outline" size="sm" className="mt-2" asChild>
                      <span>Select File</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 rounded p-3 text-sm text-yellow-800">
              <p className="font-medium">Important:</p>
              <p>Make sure your screenshot clearly shows:</p>
              <ul className="list-disc list-inside ml-2 text-xs space-y-1 mt-1">
                <li>Transaction reference number</li>
                <li>Date and time of payment</li>
                <li>Payment amount (₱{total.toFixed(2)})</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setGcashReceiptOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                onClick={uploadGcashReceipt}
                disabled={!gcashReceipt || isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  "Upload Receipt"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}
