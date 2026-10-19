import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Trash2, PlusCircle, ShoppingBag, MapPin, ArrowRight, ArrowLeft, Check, DollarSign, AlertTriangle, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadScript, GoogleMap, Marker, Autocomplete } from "@react-google-maps/api";
import { useLanguage } from "@/contexts/language-context";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { TipSelector } from "@/components/customer/tip-selector";
import { applyDeliveryFeeDiscount, getDeliveryDiscountRate, LoyaltyTierType } from "@shared/schema";

// COD payment limits
const COD_LIMIT = 1000;
const COD_WARNING_THRESHOLD = 800;

interface Location {
  lat: number;
  lng: number;
  address: string;
  locationName: string;
}

const pabiliItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  estimatedPrice: z.number().min(0, "Price must be non-negative"),
  notes: z.string().optional(),
});

const pabiliOrderSchema = z.object({
  items: z.array(pabiliItemSchema).min(1, "At least one item is required"),
  pickupLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().min(1, "Pickup address is required"),
    locationName: z.string().min(1, "Location name is required"),
  }),
  deliveryLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().min(1, "Delivery address is required"),
    locationName: z.string().min(1, "Location name is required"),
  }),
  totalBudget: z.number().min(1, "Budget must be specified"),
  specialInstructions: z.string().optional(),
  paymentMethod: z.enum(["cash_on_delivery", "gcash"]),
});

type PabiliOrderForm = z.infer<typeof pabiliOrderSchema>;

// Location Picker Component
function LocationPicker({
  location,
  onLocationSelect,
  placeholder,
  label
}: {
  location: Location;
  onLocationSelect: (location: Location) => void;
  placeholder: string;
  label: string;
}) {
  const { data: mapsKey } = useQuery<{ key: string }>({
    queryKey: ["/api/maps/key"],
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const onLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;
  }, []);

  const onPlaceChanged = useCallback(() => {
    if (autocompleteRef.current) {
      const place = autocompleteRef.current.getPlace();
      if (place.geometry?.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        onLocationSelect({
          lat,
          lng,
          address: place.formatted_address || "",
          locationName: place.name || "Selected Location"
        });
      }
    }
  }, [onLocationSelect]);

  const handleMapClick = useCallback((event: google.maps.MapMouseEvent) => {
    if (event.latLng) {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          onLocationSelect({
            lat,
            lng,
            address: results[0].formatted_address,
            locationName: "Pin Location"
          });
        }
      });
    }
  }, [onLocationSelect]);

  if (!mapsKey?.key) {
    return <div>Loading maps...</div>;
  }

  return (
    <LoadScript googleMapsApiKey={mapsKey.key} libraries={["places"]}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">{label}</label>
          <Autocomplete onLoad={onLoad} onPlaceChanged={onPlaceChanged}>
            <Input placeholder={placeholder} />
          </Autocomplete>
        </div>

        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "300px" }}
          center={{ lat: location.lat || 14.5995, lng: location.lng || 120.9842 }}
          zoom={15}
          onClick={handleMapClick}
        >
          {location.lat !== 0 && (
            <Marker position={{ lat: location.lat, lng: location.lng }} />
          )}
        </GoogleMap>

        {location.address && (
          <div className="text-sm p-3 bg-white border rounded-lg shadow-sm">
            <div className="flex items-start space-x-2">
              <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900">Selected Location</p>
                <p className="text-gray-600">{location.address}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </LoadScript>
  );
}

export default function PabiliStepsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [tipAmount, setTipAmount] = useState(0);
  const totalSteps = 3;

  // Fetch GCash configuration
  const { data: gcashConfig } = useQuery<{
    enabled: boolean;
    displayMode: "phone" | "qr";
    phoneNumber?: string;
    qrCodeUrl?: string;
  }>({
    queryKey: ["/api/public/gcash-config"],
  });

  // Fetch loyalty account to apply tier-based delivery fee discount
  const { data: loyaltyAccount } = useQuery<{ tier: LoyaltyTierType }>({
    queryKey: ["/api/loyalty/account"],
  });

  const form = useForm<PabiliOrderForm>({
    resolver: zodResolver(pabiliOrderSchema),
    defaultValues: {
      items: [{ name: "", quantity: 1, estimatedPrice: 0, notes: "" }],
      pickupLocation: { lat: 0, lng: 0, address: "", locationName: "" },
      deliveryLocation: { lat: 0, lng: 0, address: "", locationName: "" },
      totalBudget: 0,
      specialInstructions: "",
      paymentMethod: "cash_on_delivery"
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items"
  });

  // Calculate delivery fee based on distance
  const calculateDeliveryFee = (pickup: Location, delivery: Location): number => {
    if (pickup.lat === 0 || delivery.lat === 0) return 0;

    const R = 6371; // Earth's radius in km
    const dLat = (delivery.lat - pickup.lat) * Math.PI / 180;
    const dLng = (delivery.lng - pickup.lng) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(pickup.lat * Math.PI / 180) * Math.cos(delivery.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    // Use the same formula as regular orders: base 50 + 15/km + 2 platform fee
    const DEFAULT_BASE_FARE = 50; // PHP
    const DEFAULT_RATE_PER_KM = 15; // PHP per km
    const DEFAULT_PLATFORM_FEE = 2; // PHP

    const deliveryFee = DEFAULT_BASE_FARE + (DEFAULT_RATE_PER_KM * distance) + DEFAULT_PLATFORM_FEE;
    return Math.round(deliveryFee);
  };

  const itemsTotal = form.watch("items").reduce((sum, item) => sum + (item.estimatedPrice * item.quantity), 0);
  const baseDeliveryFee = calculateDeliveryFee(form.watch("pickupLocation"), form.watch("deliveryLocation"));

  // Apply tier-based loyalty discount on the delivery fee
  const loyaltyTier: LoyaltyTierType = loyaltyAccount?.tier || "bronze";
  const deliveryDiscountRate = getDeliveryDiscountRate(loyaltyTier);
  const deliveryFee = applyDeliveryFeeDiscount(baseDeliveryFee, loyaltyTier);
  const deliveryDiscountAmount = baseDeliveryFee - deliveryFee;

  const grandTotal = itemsTotal + deliveryFee + tipAmount;

  const submitOrderMutation = useMutation({
    mutationFn: async (data: PabiliOrderForm) => {
      const orderData = {
        orderType: "pabili",
        isPabili: true,
        pabiliDetails: {
          items: data.items,
          pickupLocation: data.pickupLocation,
          budget: data.totalBudget
        },
        deliveryAddress: data.deliveryLocation.address,
        deliveryLocationName: data.deliveryLocation.locationName,
        deliveryLatitude: data.deliveryLocation.lat,
        deliveryLongitude: data.deliveryLocation.lng,
        totalAmount: grandTotal,
        deliveryFee: deliveryFee,
        paymentMethod: data.paymentMethod,
        specialInstructions: data.specialInstructions,
        status: "pending"
      };

      const response = await apiRequest("POST", "/api/pabili-orders", orderData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t.success.orderPlaced,
        description: t.success.orderPlacedDescription,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setLocation("/orders");
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to submit your order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PabiliOrderForm) => {
    // Check COD limit before submitting
    if (data.paymentMethod === "cash_on_delivery" && grandTotal > COD_LIMIT) {
      toast({
        title: "COD Limit Exceeded",
        description: `Cash on Delivery is only available for orders up to ₱${COD_LIMIT.toLocaleString()}. Please use GCash for this order or reduce your items.`,
        variant: "destructive",
      });
      return;
    }
    submitOrderMutation.mutate(data);
  };

  // Check if COD limit is exceeded
  const isCodLimitExceeded = form.watch("paymentMethod") === "cash_on_delivery" && grandTotal > COD_LIMIT;
  const isCodWarning = form.watch("paymentMethod") === "cash_on_delivery" && grandTotal > COD_WARNING_THRESHOLD && grandTotal <= COD_LIMIT;

  // Step validation functions
  const validateStep1 = () => {
    const items = form.getValues("items");
    return items.length > 0 && items.every(item => item.name.trim() !== "" && item.quantity > 0);
  };

  const validateStep2 = () => {
    const pickup = form.getValues("pickupLocation");
    const delivery = form.getValues("deliveryLocation");
    return pickup.address !== "" && delivery.address !== "";
  };

  const nextStep = (e?: React.MouseEvent) => {
    // Only prevent default for navigation buttons, not form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (currentStep === 1 && !validateStep1()) {
      toast({
        title: t.validation.completeShoppingList,
        description: t.validation.completeShoppingListDesc,
        variant: "destructive"
      });
      return;
    }
    if (currentStep === 2 && !validateStep2()) {
      toast({
        title: t.validation.setLocationsRequired,
        description: t.validation.setLocationsRequiredDesc,
        variant: "destructive"
      });
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Step indicator component
  const StepIndicator = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2 font-semibold
              ${currentStep >= step
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-400'
              }
            `}>
              {currentStep > step ? <Check className="w-5 h-5" /> : step}
            </div>
            {step < 3 && (
              <div className={`
                w-16 h-1 mx-2
                ${currentStep > step ? 'bg-blue-600' : 'bg-gray-300'}
              `} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between max-w-md mx-auto mt-2 text-sm">
        <span className={currentStep >= 1 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
          {t.pabiliSteps.shoppingList}
        </span>
        <span className={currentStep >= 2 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
          {t.pabiliSteps.locations}
        </span>
        <span className={currentStep >= 3 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
          {t.pabiliSteps.reviewSubmit}
        </span>
      </div>
    </div>
  );

  if (!user) {
    return <div>Please login to access pabili service.</div>;
  }

  return (
    <CustomerLayout title={t.pabiliService} description={t.pabiliDescription}>
      <div className="max-w-4xl mx-auto">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        <StepIndicator />

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>

              {/* Step 1: Shopping List */}
              {currentStep === 1 && (
                <div className="p-6">
                  <div className="mb-6 p-6 bg-primary rounded-xl text-white">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold mb-2">Create Your Shopping List</h2>
                        <p className="text-blue-100 leading-relaxed">
                          Add all the items you want our rider to purchase for you.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold flex items-center mb-4">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Shopping List
                    </h3>

                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 bg-gray-50 border rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-800">Item {index + 1}</h4>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <FormField
                            control={form.control}
                            name={`items.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Item Name</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Milk, Bread, Medicine" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="1"
                                    {...field}
                                    onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.estimatedPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Estimated Price (₱)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name={`items.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes (Optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="Brand, size, specific requirements" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full border-dashed border-2 hover:border-primary hover:bg-primary/5"
                      onClick={() => append({ name: "", quantity: 1, estimatedPrice: 0, notes: "" })}
                    >
                      <PlusCircle className="h-4 w-4 mr-2 text-primary" />
                      Add Another Item
                    </Button>

                    <FormField
                      control={form.control}
                      name="totalBudget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Budget (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Maximum amount you're willing to spend"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Locations */}
              {currentStep === 2 && (
                <div className="p-6">
                  <div className="mb-6 p-6 bg-primary rounded-xl text-white">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <MapPin className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold mb-2">Set Pickup & Delivery Locations</h2>
                        <p className="text-blue-100 leading-relaxed">
                          Pin the exact locations for pickup and delivery using Google Maps.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 bg-primary/10 rounded-xl border border-primary/20 shadow-sm">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <MapPin className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="font-semibold text-blue-900">Set Pickup Location</h4>
                      </div>
                      <p className="text-sm text-blue-700 mb-4">
                        Search for the store or establishment, or click anywhere on the map to pin the exact location.
                      </p>

                      <LocationPicker
                        location={form.watch("pickupLocation")}
                        onLocationSelect={(location) => {
                          form.setValue("pickupLocation", location);
                        }}
                        placeholder="Search for pickup location..."
                        label="Pickup Location"
                      />
                    </div>

                    <div className="p-6 bg-primary/10 rounded-xl border border-primary/20 shadow-sm">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="p-2 bg-green-600 rounded-lg">
                          <MapPin className="h-5 w-5 text-white" />
                        </div>
                        <h4 className="font-semibold text-green-900">Set Delivery Location</h4>
                      </div>
                      <p className="text-sm text-green-700 mb-4">
                        Search for your address or click anywhere on the map to pin your exact delivery location.
                      </p>

                      <LocationPicker
                        location={form.watch("deliveryLocation")}
                        onLocationSelect={(location) => {
                          form.setValue("deliveryLocation", location);
                        }}
                        placeholder="Search for delivery location..."
                        label="Delivery Location"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Submit */}
              {currentStep === 3 && (
                <div className="p-6">
                  <div className="mb-6 p-6 bg-primary rounded-xl text-white">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-white/20 rounded-lg">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold mb-2">Review Your Order</h2>
                        <p className="text-purple-100 leading-relaxed">
                          Review your order details and complete your pabili request.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Order Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Order Summary</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <h4 className="font-medium">Items:</h4>
                          {form.watch("items").map((item, index) => (
                            <div key={index} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                              <span>{item.name} x{item.quantity}</span>
                              <span>₱{(item.estimatedPrice * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2 border-t pt-2">
                          <div className="flex justify-between">
                            <span>Items Total:</span>
                            <span>₱{itemsTotal.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Fee:</span>
                            {deliveryDiscountAmount > 0 ? (
                              <span className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 line-through">
                                  ₱{baseDeliveryFee.toFixed(2)}
                                </span>
                                <span>₱{deliveryFee.toFixed(2)}</span>
                              </span>
                            ) : (
                              <span>₱{deliveryFee.toFixed(2)}</span>
                            )}
                          </div>
                          {deliveryDiscountAmount > 0 && (
                            <div className="flex justify-between text-green-600">
                              <span className="capitalize">
                                {loyaltyTier} loyalty discount ({Math.round(deliveryDiscountRate * 100)}% off delivery):
                              </span>
                              <span>-₱{deliveryDiscountAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {tipAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Tip for Rider:</span>
                              <span>₱{tipAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between font-bold text-lg border-t pt-2">
                            <span>Total:</span>
                            <span className="text-green-600">₱{grandTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Payment Method */}
                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Method</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash_on_delivery">Cash on Delivery</SelectItem>
                              <SelectItem value="gcash">GCash</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* COD Limit Error */}
                    {isCodLimitExceeded && (
                      <div className="p-4 bg-red-50 border border-red-200 rounded-lg" data-testid="cod-limit-error">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-red-800">COD Limit Exceeded</h4>
                            <p className="text-sm text-red-700 mt-1">
                              Cash on Delivery is only available for orders up to ₱{COD_LIMIT.toLocaleString()}.
                              Your current total is ₱{grandTotal.toLocaleString()}.
                              Please use GCash for this order or reduce your items.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* COD Limit Warning */}
                    {isCodWarning && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg" data-testid="cod-limit-warning">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-yellow-800">Approaching COD Limit</h4>
                            <p className="text-sm text-yellow-700 mt-1">
                              Cash on Delivery is limited to ₱{COD_LIMIT.toLocaleString()}.
                              Your current total is ₱{grandTotal.toLocaleString()}.
                              Consider using GCash if your order might exceed the limit.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tip for Rider */}
                    <TipSelector
                      totalAmount={itemsTotal + deliveryFee}
                      onTipChange={setTipAmount}
                      selectedTip={tipAmount}
                    />

                    {/* GCash Payment Instructions */}
                    {form.watch("paymentMethod") === "gcash" && gcashConfig?.enabled && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
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
                                        type="button"
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
                                <p><strong>Estimated Amount:</strong> ₱{grandTotal.toFixed(2)}</p>
                                <p><strong>Note:</strong> Final amount may vary based on actual item prices. You'll upload proof of payment after order confirmation.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Special Instructions */}
                    <FormField
                      control={form.control}
                      name="specialInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Instructions (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions for the rider..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between items-center p-6 bg-gray-50 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    type="button"
                    onClick={nextStep}
                    className="flex items-center"
                  >
                    Next
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={submitOrderMutation.isPending || isCodLimitExceeded}
                    className="flex items-center bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    data-testid="submit-pabili-order"
                  >
                    {submitOrderMutation.isPending ? "Submitting..." : "Submit Order"}
                    <Check className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </div>
      </div>
    </CustomerLayout>
  );
}
