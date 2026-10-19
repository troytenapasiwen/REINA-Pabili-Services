import { useState, useRef, useCallback } from "react";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useEffect } from "react";
import { pabiliDetailsSchema, SavedAddress, PaymentMethod } from "@shared/schema";
import { Trash2, PlusCircle, ShoppingBag, MapPin, DollarSign, Info, Navigation } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoadScript, GoogleMap, Marker, Autocomplete } from "@react-google-maps/api";

// Google Maps configuration
const mapContainerStyle = {
  width: '100%',
  height: '350px'
};

const defaultCenter = {
  lat: 14.5995, // Manila
  lng: 120.9842
};

const libraries: ("places")[] = ["places"];

// Location interface
interface Location {
  lat: number;
  lng: number;
  address: string;
  locationName: string;
}

// Pabili order schema
const pabiliOrderSchema = z.object({
  items: z.array(z.object({
    name: z.string().min(1, "Item name is required"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    estimatedPrice: z.number().min(0, "Price must be positive"),
    notes: z.string().optional()
  })).min(1, "At least one item is required"),

  pickupLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().min(1, "Pickup location is required"),
    locationName: z.string().min(1, "Location name is required")
  }),

  deliveryLocation: z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string().min(1, "Delivery location is required"),
    locationName: z.string().min(1, "Location name is required")
  }),

  totalBudget: z.number().min(1, "Budget must be at least ₱1"),
  specialInstructions: z.string().optional(),
  paymentMethod: z.enum(["cash_on_delivery", "gcash"])
});

type PabiliOrderForm = z.infer<typeof pabiliOrderSchema>;

// Google Maps Location Picker Component
interface LocationPickerProps {
  location: Location;
  onLocationSelect: (location: Location) => void;
  placeholder: string;
  label: string;
}

function LocationPicker({ location, onLocationSelect, placeholder, label }: LocationPickerProps) {
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading } = useQuery<{key: string}>({
    queryKey: ["/api/maps/key"],
    staleTime: Infinity,
  });

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;

    autocomplete.setOptions({
      componentRestrictions: { country: "ph" },
      fields: ["place_id", "formatted_address", "geometry", "name", "types"],
      types: ["establishment", "geocode"]
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        return;
      }

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const address = place.formatted_address || place.name || `${lat}, ${lng}`;

      onLocationSelect({
        lat,
        lng,
        address,
        locationName: location.locationName
      });

      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(17);
      }
    });
  }, [onLocationSelect, location.locationName]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();

      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } })
        .then(response => {
          if (response.results && response.results[0]) {
            const address = response.results[0].formatted_address;
            onLocationSelect({
              lat,
              lng,
              address,
              locationName: location.locationName
            });
          } else {
            onLocationSelect({
              lat,
              lng,
              address: `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
              locationName: location.locationName
            });
          }
        })
        .catch(() => {
          onLocationSelect({
            lat,
            lng,
            address: `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`,
            locationName: location.locationName
          });
        });
    }
  }, [onLocationSelect, location.locationName]);

  const getCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const geocoder = new google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } })
            .then(response => {
              if (response.results && response.results[0]) {
                const address = response.results[0].formatted_address;
                onLocationSelect({
                  lat,
                  lng,
                  address,
                  locationName: location.locationName
                });
              } else {
                onLocationSelect({
                  lat,
                  lng,
                  address: "Current Location",
                  locationName: location.locationName
                });
              }

              if (mapRef.current) {
                mapRef.current.panTo({ lat, lng });
                mapRef.current.setZoom(16);
              }
            });
        },
        (error) => {
          console.error("Error getting current location:", error);
        }
      );
    }
  }, [onLocationSelect, location.locationName]);

  if (isLoading || !mapsData?.key) {
    return (
      <div className="h-80 flex items-center justify-center bg-gray-50 rounded-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-gray-500">Loading Google Maps...</p>
        </div>
      </div>
    );
  }

  const centerLocation = location.lat !== 0 ? location : defaultCenter;

  return (
    <LoadScript googleMapsApiKey={mapsData.key} libraries={libraries}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            restrictions={{ country: "ph" }}
            className="flex-1"
          >
            <Input
              type="text"
              placeholder={placeholder}
              className="w-full"
            />
          </Autocomplete>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={getCurrentLocation}
            className="whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 mr-1" />
            Current
          </Button>
        </div>

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={centerLocation}
          zoom={15}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            fullscreenControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            zoomControl: true,
          }}
        >
          {location.lat !== 0 && (
            <Marker
              position={{ lat: location.lat, lng: location.lng }}
              animation={window.google?.maps?.Animation.DROP}
            />
          )}
        </GoogleMap>

        {location.address && (
          <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
            <MapPin className="w-4 h-4 inline mr-1" />
            {location.address}
          </div>
        )}
      </div>
    </LoadScript>
  );
}

export default function PabiliPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  // Initialize form
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

  // Items field array
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

  // Calculate totals
  const itemsTotal = form.watch("items").reduce((sum, item) => sum + (item.estimatedPrice * item.quantity), 0);
  const deliveryFee = calculateDeliveryFee(form.watch("pickupLocation"), form.watch("deliveryLocation"));
  const grandTotal = itemsTotal + deliveryFee;

  // Submit mutation
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
        specialInstructions: data.specialInstructions || "",
        status: "pending"
      };

      const res = await apiRequest("POST", "/api/orders", orderData);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Pabili order submitted!",
        description: "Your order has been submitted successfully. A rider will be assigned soon.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      setLocation("/orders");
    },
    onError: (error) => {
      toast({
        title: "Failed to submit order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PabiliOrderForm) => {
    if (data.pickupLocation.lat === 0 || data.deliveryLocation.lat === 0) {
      toast({
        title: "Missing locations",
        description: "Please set both pickup and delivery locations on the map.",
        variant: "destructive",
      });
      return;
    }

    submitOrderMutation.mutate(data);
  };

  return (
    <CustomerLayout title="Pabili Service" description="Request a rider to purchase items for you">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* Info Banner */}
          <Alert className="mb-6 bg-primary/10 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertTitle>Pabili Service</AlertTitle>
            <AlertDescription>
              Our riders will purchase items for you and deliver them to your location.
              Use the interactive maps below to set precise pickup and delivery locations.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Pabili Order Form
              </CardTitle>
              <CardDescription>Fill out your shopping list and set locations using Google Maps</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                  {/* Items Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Shopping List
                    </h3>

                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 border rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
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
                                  <Input placeholder="e.g., Rice, Medicine, etc." {...field} />
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
                                    min={1}
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
                                    min={0}
                                    step={0.01}
                                    placeholder="0.00"
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
                                  <Input placeholder="Brand preference, size, etc." {...field} />
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
                      className="w-full"
                      onClick={() => append({ name: "", quantity: 1, estimatedPrice: 0, notes: "" })}
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
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
                              min={1}
                              step={0.01}
                              placeholder="Enter your total budget"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum amount you're willing to spend on these items
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Pickup Location Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Pickup Location
                    </h3>

                    <FormField
                      control={form.control}
                      name="pickupLocation.locationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., SM Mall, 7-Eleven, Mercury Drug"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Name the place where items should be purchased
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium text-blue-900">Set Pickup Location</h4>
                      </div>
                      <p className="text-sm text-blue-700 mb-3">
                        Search for the store or establishment, or click on the map to pin the exact location.
                      </p>

                      <LocationPicker
                        location={form.watch("pickupLocation")}
                        onLocationSelect={(location) => {
                          form.setValue("pickupLocation", location);
                        }}
                        placeholder="Search for stores, malls, pharmacies..."
                        label="Pickup Location"
                      />
                    </div>
                  </div>

                  {/* Delivery Location Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Delivery Location
                    </h3>

                    <FormField
                      control={form.control}
                      name="deliveryLocation.locationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Location Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Home, Office, School"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Name this delivery location for easy reference
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium text-green-900">Set Delivery Location</h4>
                      </div>
                      <p className="text-sm text-green-700 mb-3">
                        Search for your address or click on the map to pin your exact delivery location.
                      </p>

                      <LocationPicker
                        location={form.watch("deliveryLocation")}
                        onLocationSelect={(location) => {
                          form.setValue("deliveryLocation", location);
                        }}
                        placeholder="Search for your address..."
                        label="Delivery Location"
                      />
                    </div>
                  </div>

                  {/* Additional Details */}
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="specialInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Instructions (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions for the rider?"
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
                          <Select value={field.value} onValueChange={field.onChange}>
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
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitOrderMutation.isPending}
                  >
                    {submitOrderMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Submitting Order...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        Place Pabili Order
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Items Total:</span>
                  <span>₱ {itemsTotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Delivery Fee:</span>
                  <span>₱ {deliveryFee.toFixed(2)}</span>
                </div>

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span>₱ {grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-2">How Pabili Works:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Submit your shopping list</li>
                  <li>Rider goes to pickup location</li>
                  <li>Rider purchases your items</li>
                  <li>Items delivered to your location</li>
                  <li>Pay for items + delivery fee</li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}
