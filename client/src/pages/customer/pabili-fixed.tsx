import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { pabiliDetailsSchema, SavedAddress, PaymentMethod } from "@shared/schema";
import { Trash2, PlusCircle, ShoppingBag, MapPin, DollarSign, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import GoogleMapsReliable from "@/components/customer/google-maps-reliable";
import { calculateDistance, calculateDeliveryFee } from "@/lib/map-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Create a schema for the entire pabili order form
const pabiliOrderFormSchema = z.object({
  pabiliDetails: pabiliDetailsSchema,
  deliveryAddress: z.object({
    address: z.string().min(1, "Delivery address is required"),
    lat: z.number(),
    lng: z.number(),
    locationName: z.string().optional(),
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  specialInstructions: z.string().optional(),
});

type PabiliOrderForm = z.infer<typeof pabiliOrderFormSchema>;

export default function PabiliPage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddress, setSelectedSavedAddress] = useState<string | null>(null);
  const [estimatedDeliveryFee, setEstimatedDeliveryFee] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("pickup");
  const [mapKey, setMapKey] = useState(Date.now()); // To force re-render maps when needed

  // Initialize form with default values
  const form = useForm<PabiliOrderForm>({
    resolver: zodResolver(pabiliOrderFormSchema),
    defaultValues: {
      pabiliDetails: {
        pickupLocation: {
          address: "",
          lat: 0,
          lng: 0,
          locationName: "Shop/Store",
        },
        items: [
          {
            name: "",
            quantity: 1,
            estimatedPrice: 0,
            notes: "",
          },
        ],
        budget: 0,
        pickupInstructions: "",
      },
      deliveryAddress: {
        address: "",
        lat: 0,
        lng: 0,
        locationName: "Home",
      },
      paymentMethod: PaymentMethod.COD,
      specialInstructions: "",
    },
  });

  // Get items field array for dynamic addition/removal
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pabiliDetails.items",
  });

  // Load customer's saved addresses
  useEffect(() => {
    if (user) {
      const fetchCustomer = async () => {
        try {
          const response = await fetch(`/api/customers/by-user/${user.id}`);
          const data = await response.json();

          if (data.savedAddresses && data.savedAddresses.length > 0) {
            setSavedAddresses(data.savedAddresses);

            // Pre-fill the delivery address with the default address if available
            const defaultAddress = data.savedAddresses.find((addr: SavedAddress) => addr.isDefault);
            if (defaultAddress) {
              form.setValue("deliveryAddress", {
                address: defaultAddress.address,
                lat: defaultAddress.lat,
                lng: defaultAddress.lng,
                locationName: defaultAddress.name || "Home",
              });
              setSelectedSavedAddress(defaultAddress.name);
            }
          }
        } catch (error) {
          console.error("Error fetching customer data:", error);
        }
      };

      fetchCustomer();
    }
  }, [user, form]);

  // Mutation for submitting the order
  const submitOrderMutation = useMutation({
    mutationFn: async (data: PabiliOrderForm) => {
      // Calculate the final order amount
      const totalBudget = data.pabiliDetails.budget;
      const deliveryFee = estimatedDeliveryFee || 0;

      // Create an order object
      const orderData = {
        ...data,
        isPabili: true,
        orderType: "pabili",
        totalAmount: totalBudget + deliveryFee,
        deliveryFee,
        status: "pending",
        paymentStatus: "pending",
        metadata: {
          deliveryDistance: calculateDistance(
            data.pabiliDetails.pickupLocation.lat,
            data.pabiliDetails.pickupLocation.lng,
            data.deliveryAddress.lat,
            data.deliveryAddress.lng
          ),
          customerLocation: {
            lat: data.deliveryAddress.lat,
            lng: data.deliveryAddress.lng
          },
          pickupLocation: {
            lat: data.pabiliDetails.pickupLocation.lat,
            lng: data.pabiliDetails.pickupLocation.lng
          }
        }
      };

      // Submit the order
      const response = await apiRequest("POST", "/api/pabili-orders", orderData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to create order");
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Submitted!",
        description: "Your Pabili order has been placed successfully.",
      });

      // Reset form and navigate to orders page
      form.reset();
      setLocation("/customer/orders");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Calculate the total budget based on item costs
  const calculateTotal = () => {
    return form.watch("pabiliDetails.items").reduce(
      (total, item) => total + (item.estimatedPrice * item.quantity),
      0
    );
  };

  // Update budget when items change
  useEffect(() => {
    const totalItemsCost = calculateTotal();
    form.setValue("pabiliDetails.budget", totalItemsCost);
  }, [form.watch("pabiliDetails.items")]);

  // Calculate delivery fee when locations change
  useEffect(() => {
    const calculateEstimatedFee = () => {
      const pickupLocation = form.watch("pabiliDetails.pickupLocation");
      const deliveryAddress = form.watch("deliveryAddress");

      if (pickupLocation.lat !== 0 && pickupLocation.lng !== 0 &&
          deliveryAddress.lat !== 0 && deliveryAddress.lng !== 0) {

        const distance = calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          deliveryAddress.lat,
          deliveryAddress.lng
        );

        if (distance > 0) {
          // Calculate delivery fee: base fare of ₱50 plus ₱15 per kilometer plus ₱2 platform fee
          const deliveryFee = calculateDeliveryFee(distance, 50, 15, 2);
          setEstimatedDeliveryFee(deliveryFee);
        }
      }
    };

    calculateEstimatedFee();
  }, [form.watch("pabiliDetails.pickupLocation"), form.watch("deliveryAddress")]);

  // Handle form submission
  const onSubmit = (data: PabiliOrderForm) => {
    if (data.pabiliDetails.pickupLocation.lat === 0 || data.pabiliDetails.pickupLocation.lng === 0) {
      toast({
        title: "Missing Pickup Location",
        description: "Please select a pickup location on the map",
        variant: "destructive",
      });
      return;
    }

    if (data.deliveryAddress.lat === 0 || data.deliveryAddress.lng === 0) {
      toast({
        title: "Missing Delivery Location",
        description: "Please select a delivery location on the map",
        variant: "destructive",
      });
      return;
    }

    if (data.pabiliDetails.items.length === 0) {
      toast({
        title: "No Items Added",
        description: "Please add at least one item to order",
        variant: "destructive",
      });
      return;
    }

    submitOrderMutation.mutate(data);
  };

  // Handle selecting saved address
  const handleSelectSavedAddress = (name: string) => {
    const address = savedAddresses.find(addr => addr.name === name);
    if (address) {
      form.setValue("deliveryAddress", {
        address: address.address,
        lat: address.lat,
        lng: address.lng,
        locationName: address.name,
      });
      setSelectedSavedAddress(name);
    }
  };

  // Handle pickup location selection from map
  const handlePickupLocationSelected = (address: string, lat: number, lng: number) => {
    form.setValue("pabiliDetails.pickupLocation", {
      address,
      lat,
      lng,
      locationName: form.watch("pabiliDetails.pickupLocation.locationName") || "Pickup Location",
    });
  };

  // Handle delivery location selection from map
  const handleDeliveryLocationSelected = (address: string, lat: number, lng: number) => {
    form.setValue("deliveryAddress", {
      address,
      lat,
      lng,
      locationName: form.watch("deliveryAddress.locationName") || "Delivery Location",
    });
  };

  return (
    <CustomerLayout title="Pabili Service" description="Request a rider to purchase items for you">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Pabili Order
              </CardTitle>
              <CardDescription>
                Request a rider to purchase and deliver items for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Tabbed interface for pickup and delivery locations */}
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="pickup">
                        <MapPin className="h-4 w-4 mr-2" />
                        Pickup Location
                      </TabsTrigger>
                      <TabsTrigger value="delivery">
                        <MapPin className="h-4 w-4 mr-2" />
                        Delivery Location
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pickup" className="space-y-4 mt-4">
                      <div className="space-y-2">
                        <FormField
                          control={form.control}
                          name="pabiliDetails.pickupLocation.locationName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pickup Location Name</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="e.g., Convenience Store, Mall, etc."
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                A short name to identify where items will be picked up
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="rounded-md overflow-hidden border h-[350px]">
                          <GoogleMapsReliable
                            key={`pickup-${mapKey}`}
                            onLocationSelect={handlePickupLocationSelected}
                            initialLocation={
                              form.watch("pabiliDetails.pickupLocation").lat !== 0
                                ? {
                                    lat: form.watch("pabiliDetails.pickupLocation").lat,
                                    lng: form.watch("pabiliDetails.pickupLocation").lng,
                                  }
                                : undefined
                            }
                            height="350px"
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="pabiliDetails.pickupLocation.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pickup Address</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Address will update when you select a location on the map"
                                  {...field}
                                  readOnly
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="pabiliDetails.pickupInstructions"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Pickup Instructions</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Any special instructions for the rider when picking up the items"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="delivery" className="space-y-4 mt-4">
                      {savedAddresses.length > 0 && (
                        <div className="space-y-2">
                          <FormLabel>Select from Saved Addresses</FormLabel>
                          <Select
                            value={selectedSavedAddress || undefined}
                            onValueChange={handleSelectSavedAddress}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose a saved address" />
                            </SelectTrigger>
                            <SelectContent>
                              {savedAddresses.map(addr => (
                                <SelectItem key={addr.name} value={addr.name}>
                                  <div className="flex items-center">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    <span>{addr.name} {addr.isDefault && <Badge variant="outline" className="ml-2">Default</Badge>}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="rounded-md overflow-hidden border h-[350px]">
                        <GoogleMapsReliable
                          key={`delivery-${mapKey}`}
                          onLocationSelect={handleDeliveryLocationSelected}
                          initialLocation={
                            form.watch("deliveryAddress").lat !== 0
                              ? {
                                  lat: form.watch("deliveryAddress").lat,
                                  lng: form.watch("deliveryAddress").lng,
                                }
                              : undefined
                          }
                          height="350px"
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="deliveryAddress.address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Address</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Address will update when you select a location on the map"
                                {...field}
                                readOnly
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="deliveryAddress.locationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Location Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="e.g., Home, Office, etc."
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </TabsContent>
                  </Tabs>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Items to Purchase</h3>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => append({ name: "", quantity: 1, estimatedPrice: 0, notes: "" })}
                      >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Add Item
                      </Button>
                    </div>

                    {fields.length === 0 ? (
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertTitle>No items added</AlertTitle>
                        <AlertDescription>
                          Add at least one item for the rider to purchase.
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <div key={field.id} className="p-4 border rounded-md relative">
                            <div className="absolute top-2 right-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => remove(index)}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name={`pabiliDetails.items.${index}.name`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Item Name</FormLabel>
                                    <FormControl>
                                      <Input placeholder="e.g., Milk, Bread, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              <FormField
                                control={form.control}
                                name={`pabiliDetails.items.${index}.quantity`}
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
                                name={`pabiliDetails.items.${index}.estimatedPrice`}
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
                                name={`pabiliDetails.items.${index}.notes`}
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                      <Input placeholder="e.g., Brand, Size, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name="specialInstructions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Instructions</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any additional instructions for the rider"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="paymentMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Method</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment method" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PaymentMethod.COD}>
                                <div className="flex items-center">
                                  <DollarSign className="h-4 w-4 mr-2" />
                                  Cash on Delivery
                                </div>
                              </SelectItem>
                              {/* Can add other payment methods here */}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-between pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLocation("/customer/home")}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={submitOrderMutation.isPending || fields.length === 0}
                    >
                      {submitOrderMutation.isPending && (
                        <span className="mr-2">
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        </span>
                      )}
                      Place Order
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Items Total:</span>
                  <span>₱ {calculateTotal().toFixed(2)}</span>
                </div>

                {estimatedDeliveryFee !== null && (
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Delivery Fee:</span>
                      <span>₱ {estimatedDeliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground ml-4">
                      <span>Base Fare:</span>
                      <span>₱ 50.00</span>
                    </div>
                    {form.watch("pabiliDetails.pickupLocation").lat !== 0 &&
                     form.watch("deliveryAddress").lat !== 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground ml-4">
                        <span>Distance Charge:</span>
                        <span>₱ {(estimatedDeliveryFee - 52).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-muted-foreground ml-4">
                      <span>Platform Fee:</span>
                      <span>₱ 2.00</span>
                    </div>
                  </div>
                )}

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span>Estimated Total:</span>
                    <span>₱ {(calculateTotal() + (estimatedDeliveryFee || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground mt-6">
                <p className="font-medium mb-1">How Pabili works:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Submit your order with items you need purchased</li>
                  <li>A rider will be assigned to your order</li>
                  <li>The rider will go to the pickup location and purchase the items</li>
                  <li>You'll pay for the actual cost of items plus delivery fee</li>
                  <li>The rider will deliver items to your delivery location</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}
