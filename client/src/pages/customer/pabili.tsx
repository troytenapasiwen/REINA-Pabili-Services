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
  // Using simpler delivery form without maps
  const [estimatedDeliveryFee, setEstimatedDeliveryFee] = useState<number | null>(null);

  // Initialize form with default values
  const form = useForm<PabiliOrderForm>({
    resolver: zodResolver(pabiliOrderFormSchema),
    defaultValues: {
      pabiliDetails: {
        pickupLocation: {
          address: "",
          lat: 0,
          lng: 0,
          locationName: "",
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

  // Calculate total estimated price
  const calculateTotal = () => {
    const items = form.watch("pabiliDetails.items");
    return items.reduce((total, item) => total + (item.estimatedPrice * item.quantity), 0);
  };

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: async (data: PabiliOrderForm) => {
      // Calculate delivery fee based on distance
      const pickupLat = data.pabiliDetails.pickupLocation.lat;
      const pickupLng = data.pabiliDetails.pickupLocation.lng;
      const deliveryLat = data.deliveryAddress.lat;
      const deliveryLng = data.deliveryAddress.lng;

      // Haversine formula to calculate distance
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371; // Radius of the earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
      };

      const distance = calculateDistance(pickupLat, pickupLng, deliveryLat, deliveryLng);

      // Calculate delivery fee: base fare of ₱30 plus ₱15 per kilometer
      const baseFare = 30;
      const ratePerKm = 15;
      const deliveryFee = baseFare + (ratePerKm * distance);

      // Calculate total amount
      const itemsTotal = calculateTotal();
      const totalAmount = itemsTotal + deliveryFee;

      // Create order payload
      const orderPayload = {
        isPabili: true,
        pabiliDetails: data.pabiliDetails,
        deliveryAddress: data.deliveryAddress.address,
        deliveryLocationName: data.deliveryAddress.locationName,
        specialInstructions: data.specialInstructions,
        paymentMethod: data.paymentMethod,
        totalAmount: totalAmount,
        deliveryFee: deliveryFee,
        restaurantId: 0, // No restaurant for pabili orders, but API requires this field
        items: data.pabiliDetails.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.estimatedPrice,
          totalPrice: item.estimatedPrice * item.quantity,
        })),
        metadata: {
          pickupLocation: {
            lat: data.pabiliDetails.pickupLocation.lat,
            lng: data.pabiliDetails.pickupLocation.lng,
          },
          customerLocation: {
            lat: data.deliveryAddress.lat,
            lng: data.deliveryAddress.lng,
          },
          deliveryDistance: distance,
        },
      };

      const res = await apiRequest("POST", "/api/orders/pabili", orderPayload);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully",
        description: `Your Pabili order has been placed. Order #${data.id}`,
      });

      // Update queries
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });

      // Navigate to orders page
      setLocation("/orders");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to place order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate estimated delivery fee when pickup/delivery locations change
  useEffect(() => {
    const calculateEstimatedFee = () => {
      const pickupLocation = form.watch("pabiliDetails.pickupLocation");
      const deliveryAddress = form.watch("deliveryAddress");

      if (
        pickupLocation.lat !== 0 &&
        pickupLocation.lng !== 0 &&
        deliveryAddress.lat !== 0 &&
        deliveryAddress.lng !== 0
      ) {
        // Haversine formula to calculate distance
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
          const R = 6371; // Radius of the earth in km
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLon = (lon2 - lon1) * Math.PI / 180;
          const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          return R * c; // Distance in km
        };

        const distance = calculateDistance(
          pickupLocation.lat,
          pickupLocation.lng,
          deliveryAddress.lat,
          deliveryAddress.lng
        );

        // Calculate delivery fee: base fare of ₱50 plus ₱15 per kilometer plus ₱2 platform fee
        const baseFare = 50;
        const ratePerKm = 15;
        const platformFee = 2;
        const deliveryFee = baseFare + (ratePerKm * distance) + platformFee;

        setEstimatedDeliveryFee(deliveryFee);
      }
    };

    calculateEstimatedFee();
  }, [form.watch("pabiliDetails.pickupLocation"), form.watch("deliveryAddress"), form]);

  // Handle form submission
  const onSubmit = (data: PabiliOrderForm) => {
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

  // Handle pickup address input
  const handlePickupAddressUpdate = (input: {
    address: string;
    locationName: string;
  }) => {
    form.setValue("pabiliDetails.pickupLocation", {
      address: input.address,
      lat: 0, // We're no longer getting accurate coordinates
      lng: 0,
      locationName: input.locationName || "Pickup Location",
    });
  };

  // For direct setting of delivery address values (used by SimpleAddressSelector)
  const handleDeliveryAddressUpdate = (address: {
    address: string;
    lat: number;
    lng: number;
    locationName: string;
  }) => {
    form.setValue("deliveryAddress", address);
  };

  return (
    <CustomerLayout title="Pabili Service" description="Request a rider to purchase items for you">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Info Banner */}
          <Alert className="mb-6 bg-primary/10 border-blue-200">
            <Info className="h-4 w-4" />
            <AlertTitle>How Pabili Works</AlertTitle>
            <AlertDescription>
              Use our interactive maps to pin exact pickup and delivery locations. Our riders will purchase items
              for you and deliver them to your specified location. All locations are set using Google Maps for accuracy.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Pabili Order Form
              </CardTitle>
              <CardDescription>Use the interactive maps below to set precise pickup and delivery locations</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Pickup Location Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Pickup Location
                    </h3>

                    <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h4 className="font-medium text-blue-900">Pin Pickup Location on Map</h4>
                      </div>
                      <p className="text-sm text-blue-700">
                        Use the interactive map below to precisely set where the rider should pick up your items.
                        You can search for a location, use your current location, or click anywhere on the map.
                      </p>

                      <LocationPicker
                        location={{
                          ...form.watch("pabiliDetails.pickupLocation"),
                          locationName: form.watch("pabiliDetails.pickupLocation").locationName || "",
                        }}
                        onLocationSelect={(location: Location) => {
                          form.setValue("pabiliDetails.pickupLocation", {
                            address: location.address,
                            lat: location.lat,
                            lng: location.lng,
                            locationName: location.locationName,
                          });
                        }}
                        placeholder="Search for stores, malls, or establishments"
                        label="Pickup Location"
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="pabiliDetails.pickupLocation.locationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Pickup Location Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., SM Mall, 7-Eleven, Mercury Drug, etc."
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Give this location a memorable name (e.g., "Mall entrance", "Grocery store")
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

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
                          <FormLabel>Pickup Instructions (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions for the pickup location?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Items Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <ShoppingBag className="h-4 w-4 mr-2" />
                      Items to Purchase
                    </h3>

                    {fields.map((field, index) => (
                      <div key={field.id} className="p-4 border rounded-md">
                        <div className="flex justify-between mb-2">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
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
                                  <Input placeholder="e.g., 2L Coke" {...field} />
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
                                    min={1}
                                    placeholder="1"
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
                                    min={1}
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
                            name={`pabiliDetails.items.${index}.notes`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Notes (optional)</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g., Regular, not diet" {...field} />
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
                      name="pabiliDetails.budget"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Total Budget (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              step={0.01}
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormDescription>
                            This is the maximum amount you're willing to spend on these items.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Delivery Location Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      Delivery Location
                    </h3>

                    {savedAddresses.length > 0 && (
                      <div className="mb-4">
                        <FormLabel>Saved Addresses</FormLabel>
                        <Select value={selectedSavedAddress || ""} onValueChange={handleSelectSavedAddress}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select a saved address" />
                          </SelectTrigger>
                          <SelectContent>
                            {savedAddresses.map((address, index) => (
                              <SelectItem key={index} value={address.name}>
                                {address.name} - {address.address}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground mt-2">Or set a custom location on the map below</p>
                      </div>
                    )}

                    <FormField
                      control={form.control}
                      name="deliveryAddress.locationName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Location Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Home, Work, School" {...field} />
                          </FormControl>
                          <FormDescription>
                            A short name to identify where you want items delivered
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-4 p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-5 w-5 text-green-600" />
                        <h4 className="font-medium text-green-900">Pin Delivery Location on Map</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        Set your exact delivery location using the interactive map. You can search for your address,
                        use your current location, or click anywhere on the map to drop a pin.
                      </p>

                      <LocationPicker
                        location={{
                          ...form.watch("deliveryAddress"),
                          locationName: form.watch("deliveryAddress").locationName || "",
                        }}
                        onLocationSelect={(location: Location) => {
                          form.setValue("deliveryAddress", {
                            address: location.address,
                            lat: location.lat,
                            lng: location.lng,
                            locationName: location.locationName || "Delivery Location",
                          });
                        }}
                        placeholder="Search for your home, office, or any address"
                        label="Delivery Location"
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
                      name="specialInstructions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Instructions (optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Any special instructions for the delivery?"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Payment Method Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Payment Method
                    </h3>

                    <FormField
                      control={form.control}
                      name="paymentMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>How would you like to pay?</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select payment method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={PaymentMethod.COD}>Cash on Delivery</SelectItem>
                              <SelectItem value={PaymentMethod.GCASH}>GCash</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            For GCash payments, you'll need to upload proof of payment when the order is confirmed.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* GCash Payment Instructions */}
                    {form.watch("paymentMethod") === PaymentMethod.GCASH && (
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
                              <p>Please send your payment to:</p>
                              <div className="bg-white p-3 rounded border border-blue-200">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-lg font-bold text-blue-900">09467102826</span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText('09467102826');
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
                              <div className="text-xs text-blue-700 mt-3">
                                <p><strong>Estimated Amount:</strong> ₱{(calculateTotal() + (estimatedDeliveryFee || 0)).toFixed(2)}</p>
                                <p><strong>Note:</strong> Final amount may vary based on actual item prices. You'll upload proof of payment after order confirmation.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertTitle>Important Note</AlertTitle>
                    <AlertDescription>
                      The rider will purchase the items for you and deliver them to your specified location. You'll only pay for the actual cost of the items plus the delivery fee.
                    </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={submitOrderMutation.isPending}
                  >
                    {submitOrderMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Processing Order...
                      </>
                    ) : (
                      <>Place Pabili Order</>
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
                      <span>₱ 30.00</span>
                    </div>
                    {form.watch("pabiliDetails.pickupLocation").lat !== 0 &&
                     form.watch("deliveryAddress").lat !== 0 && (
                      <div className="flex justify-between text-xs text-muted-foreground ml-4">
                        <span>Distance Charge:</span>
                        <span>₱ {(estimatedDeliveryFee - 30).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between font-bold">
                    <span>Estimated Total:</span>
                    <span>₱ {(calculateTotal() + (estimatedDeliveryFee || 0)).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
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
