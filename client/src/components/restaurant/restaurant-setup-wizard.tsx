import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MapLocationPicker } from "@/components/ui/map-location-picker";
import { Restaurant } from "@shared/schema";
import {
  Check,
  Store,
  MapPin,
  Phone,
  Clock,
  Tag,
  Utensils,
  ArrowRight,
  Truck
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { InsertRestaurant } from "@shared/schema";

// Define the schema for restaurant setup
const restaurantSetupSchema = z.object({
  name: z.string().min(3, "Restaurant name must be at least 3 characters"),
  address: z.string().min(5, "Please provide a valid address"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  email: z.string().email("Please provide a valid email"),
  description: z.string().optional(),
  openingTime: z.string().min(1, "Please provide opening hours"),
  closingTime: z.string().min(1, "Please provide closing hours"),
  cuisine: z.string().min(1, "Please specify your cuisine type"),
  deliveryFee: z.coerce.number().min(0, "Delivery fee can't be negative"),
  serviceRadius: z.coerce.number().min(1, "Service radius must be at least 1 km"),
  categories: z.string().min(1, "Please provide at least one category"),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

type RestaurantSetupData = z.infer<typeof restaurantSetupSchema>;

interface RestaurantSetupWizardProps {
  open: boolean;
  onComplete: () => void;
}

export function RestaurantSetupWizard({ open, onComplete }: RestaurantSetupWizardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isExistingRestaurant, setIsExistingRestaurant] = useState(false);

  // Fetch existing restaurant data
  const { data: existingRestaurant } = useQuery<Restaurant>({
    queryKey: ['/api/restaurants/by-user'],
    enabled: !!user?.id && user?.role === 'restaurant',
  });

  // Setup form with validation
  const form = useForm<RestaurantSetupData>({
    resolver: zodResolver(restaurantSetupSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: user?.phone || "",
      email: user?.email || "",
      description: "",
      openingTime: "09:00",
      closingTime: "21:00",
      cuisine: "",
      deliveryFee: 50,
      serviceRadius: 5,
      categories: "",
    },
  });

  // Initialize form with existing restaurant data if available
  useEffect(() => {
    if (existingRestaurant) {
      setIsExistingRestaurant(true);
      // Populate form values from existing restaurant
      form.reset({
        name: existingRestaurant.name || "",
        address: existingRestaurant.address || "",
        phone: existingRestaurant.phone || "",
        email: existingRestaurant.email || "",
        description: existingRestaurant.description || "",
        openingTime: existingRestaurant.openingTime || "09:00",
        closingTime: existingRestaurant.closingTime || "21:00",
        cuisine: existingRestaurant.categories?.join(", ") || "",
        deliveryFee: existingRestaurant.deliveryFee || 50,
        serviceRadius: existingRestaurant.serviceRadius || 5,
        categories: existingRestaurant.categories?.join(", ") || "",
        latitude: existingRestaurant.latitude || null,
        longitude: existingRestaurant.longitude || null,
      });

      // Set selected location if coordinates exist
      if (existingRestaurant.latitude && existingRestaurant.longitude) {
        setSelectedLocation({
          lat: existingRestaurant.latitude,
          lng: existingRestaurant.longitude,
        });
      }
    }
  }, [existingRestaurant, form]);

  // Restaurant mutation - handles both create and update
  const restaurantMutation = useMutation({
    mutationFn: async (data: RestaurantSetupData) => {
      // Ensure location data is included
      if (selectedLocation) {
        data.latitude = selectedLocation.lat;
        data.longitude = selectedLocation.lng;

        // Make sure address isn't blank if we have coordinates
        if (!data.address || data.address.trim() === '') {
          // Try to get the address from coordinates if missing
          await fetchAddressFromCoordinates(selectedLocation.lat, selectedLocation.lng);
          data.address = form.getValues('address');
        }
      }

      // Validate that we have a non-empty address
      if (!data.address || data.address.trim() === '') {
        throw new Error("Please provide a restaurant address or select a location on the map");
      }

      // Transform data for API
      const apiData: Partial<InsertRestaurant> = {
        ...data,
        userId: user?.id as number,
        categories: data.categories.split(',').map(cat => cat.trim()),
        isActive: true,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
      };

      let res;
      if (isExistingRestaurant && existingRestaurant?.id) {
        // Update existing restaurant
        res = await apiRequest("PATCH", `/api/restaurants/${existingRestaurant.id}`, apiData);
      } else {
        // Create new restaurant
        res = await apiRequest("POST", "/api/restaurants", apiData);
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: isExistingRestaurant ? "Restaurant Updated" : "Restaurant Created",
        description: isExistingRestaurant
          ? "Your restaurant profile has been updated successfully!"
          : "Your restaurant has been set up successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/by-user"] });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: isExistingRestaurant ? "Update Failed" : "Setup Failed",
        description: error.message,
        variant: "destructive",
      });
      // Stay on the current step
    },
  });

  // Function to fetch address from coordinates
  const fetchAddressFromCoordinates = async (lat: number, lng: number) => {
    try {
      const response = await fetch(`/api/maps/geocode?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        if (data.address) {
          form.setValue('address', data.address);
          return data.address;
        }
      }
      // If geocoding fails, create a simple address from coordinates
      const simpleAddress = `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      form.setValue('address', simpleAddress);
      return simpleAddress;
    } catch (error) {
      console.error("Error fetching address:", error);
      // Fallback to coordinates
      const simpleAddress = `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      form.setValue('address', simpleAddress);
      return simpleAddress;
    }
  };

  // Handle next step
  const handleNext = async () => {
    // Get fields for the current step
    let fieldsToValidate: (keyof RestaurantSetupData)[] = [];

    if (step === 1) {
      fieldsToValidate = ['name', 'phone', 'email', 'address'];
    } else if (step === 2) {
      fieldsToValidate = ['openingTime', 'closingTime', 'cuisine', 'categories'];
    } else if (step === 3) {
      // Location step - validate the selected location
      if (!selectedLocation) {
        toast({
          title: "Location required",
          description: "Please select your restaurant location on the map",
          variant: "destructive"
        });
        return;
      }

      // Set latitude and longitude in form
      form.setValue('latitude', selectedLocation.lat);
      form.setValue('longitude', selectedLocation.lng);

      // Update address field if it's empty or just coordinates
      const currentAddress = form.getValues('address');
      if (!currentAddress || currentAddress.trim() === '' || currentAddress.startsWith('Location (')) {
        await fetchAddressFromCoordinates(selectedLocation.lat, selectedLocation.lng);
      }

      setStep(step + 1);
      return;
    }

    // Manually validate only the fields for the current step
    let isValid = true;

    // Trigger validation for each field and wait for all to complete
    for (const field of fieldsToValidate) {
      const result = await form.trigger(field);
      if (!result) isValid = false;
    }

    if (isValid) {
      setStep(step + 1);
    }
  };

  // Form submission handler (only used on final step)
  const onSubmit = (data: RestaurantSetupData) => {
    if (step < totalSteps) {
      // This shouldn't be called directly on steps 1-2, but just in case
      setStep(step + 1);
    } else {
      // Final submission
      restaurantMutation.mutate(data);
    }
  };

  // Move to previous step
  const handlePrevious = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Prevent closing by clicking outside
  const handleClose = () => {
    // Don't allow closing the modal
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Store className="h-5 w-5" />
            Restaurant Setup ({step}/{totalSteps})
          </DialogTitle>
          <DialogDescription>
            Let's set up your restaurant profile. This information will be visible to customers.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Step 1: Basic Information */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Store className="h-4 w-4" />
                  <span>Basic Information</span>
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Tasty Bites" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 09123456789" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. restaurant@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant Address</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Full address including street, barangay, city" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of your restaurant"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Share what makes your restaurant special
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 2: Business Details */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Clock className="h-4 w-4" />
                  <span>Business Hours & Cuisine</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="openingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Opening Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="closingTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Closing Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cuisine"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cuisine Type</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Filipino, Italian, Chinese" {...field} />
                      </FormControl>
                      <FormDescription>
                        Main cuisine type your restaurant specializes in
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="categories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Food Categories</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Fast Food, Seafood, Desserts" {...field} />
                      </FormControl>
                      <FormDescription>
                        Separate categories with commas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Step 3: Location */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <MapPin className="h-4 w-4" />
                  <span>Restaurant Location</span>
                </div>

                <div className="rounded-md border overflow-hidden" style={{ height: '400px' }}>
                  <MapLocationPicker
                    onLocationSelect={async (location) => {
                      setSelectedLocation(location);
                      // If address is blank or just coordinates, update it from the map location
                      const currentAddress = form.getValues('address');
                      if (!currentAddress || currentAddress.trim() === '' || currentAddress.startsWith('Location (')) {
                        await fetchAddressFromCoordinates(location.lat, location.lng);
                        toast({
                          title: "Address Updated",
                          description: "Your restaurant address has been updated based on the map location"
                        });
                      }
                    }}
                    initialLocation={selectedLocation || undefined}
                  />
                </div>

                {selectedLocation ? (
                  <div className="text-sm text-muted-foreground">
                    Location selected at coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600">
                    Please pin your restaurant location on the map.
                  </div>
                )}

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-6 pb-4 px-6">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-blue-800 mb-1">Why this matters</h3>
                        <p className="text-sm text-blue-700">
                          Setting your restaurant location helps customers find you and allows us to
                          calculate accurate delivery times and distances for orders.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 4: Delivery Information */}
            {step === 4 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Truck className="h-4 w-4" />
                  <span>Delivery Settings</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="deliveryFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Delivery Fee (₱)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="5"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Standard delivery fee amount
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceRadius"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Radius (km)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Maximum delivery distance
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-6 pb-4 px-6">
                    <div className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <h3 className="font-medium text-amber-800 mb-1">Almost done!</h3>
                        <p className="text-sm text-amber-700">
                          After completing this setup, you'll be able to add menu items,
                          manage orders, and customize your restaurant's appearance.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Separator />

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrevious}
                disabled={step === 1 || restaurantMutation.isPending}
              >
                Previous
              </Button>

              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={restaurantMutation.isPending}
                  className="gap-2"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={restaurantMutation.isPending}
                  className="gap-2"
                >
                  {restaurantMutation.isPending ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-2 border-b-transparent rounded-full" />
                      {isExistingRestaurant ? "Updating..." : "Setting up..."}
                    </>
                  ) : (
                    isExistingRestaurant ? "Update Profile" : "Complete Setup"
                  )}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
