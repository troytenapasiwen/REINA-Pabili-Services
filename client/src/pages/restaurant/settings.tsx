import React, { useState } from "react";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Restaurant } from "@shared/schema";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  TimeInput
} from "@/components/ui/time-input";
import { AlertTriangle, Check, Store, Image, Clock, CreditCard, MapPin, Shield, Save, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ImageUpload } from "@/components/ui/image-upload";
import { LoadScript, GoogleMap, Marker } from "@react-google-maps/api";

// Form validation schemas
const profileFormSchema = z.object({
  name: z.string().min(3, "Restaurant name must be at least 3 characters"),
  description: z.string().min(10, "Please provide a detailed description"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email"),
  address: z.string().min(10, "Please enter a complete address"),
  bannerUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  isActive: z.boolean(),
});

const operationsFormSchema = z.object({
  openingTime: z.string(),
  closingTime: z.string(),
  categories: z.string(),
  cuisine: z.string().optional(),
  minimumOrderAmount: z.coerce.number().min(0, "Minimum order amount cannot be negative"),
  serviceRadius: z.coerce.number().min(0, "Service radius cannot be negative"),
  preparationTime: z.coerce.number().min(5, "Preparation time must be at least 5 minutes"),
});

const paymentsFormSchema = z.object({
  acceptsCash: z.boolean(),
  acceptsGcash: z.boolean(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountName: z.string().optional(),
  gcashNumber: z.string().optional(),
});

const locationFormSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().min(10, "Please enter a complete address"),
});

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
};

export default function RestaurantSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery<{key: string}>({
    queryKey: ["/api/maps/key"],
    staleTime: Infinity,
  });

  // Get restaurant data for the logged-in user
  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // Update restaurant mutation
  const updateRestaurantMutation = useMutation({
    mutationFn: async (data: Partial<Restaurant>) => {
      if (!restaurant) throw new Error("Restaurant not found");

      const res = await apiRequest("PATCH", `/api/restaurants/${restaurant.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/by-user"] });
      toast({
        title: "Settings updated",
        description: "Your restaurant settings have been saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Profile form
  const profileForm = useForm<z.infer<typeof profileFormSchema>>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: "",
      description: "",
      phone: "",
      email: "",
      address: "",
      bannerUrl: "",
      logoUrl: "",
      isActive: true,
    },
  });

  // Operations form
  const operationsForm = useForm<z.infer<typeof operationsFormSchema>>({
    resolver: zodResolver(operationsFormSchema),
    defaultValues: {
      openingTime: "09:00",
      closingTime: "21:00",
      categories: "",
      cuisine: "",
      minimumOrderAmount: 0,
      serviceRadius: 5,
      preparationTime: 30,
    },
  });

  // Payments form
  const paymentsForm = useForm<z.infer<typeof paymentsFormSchema>>({
    resolver: zodResolver(paymentsFormSchema),
    defaultValues: {
      acceptsCash: true,
      acceptsGcash: false,
      bankName: "",
      accountNumber: "",
      accountName: "",
      gcashNumber: "",
    },
  });

  // Location form
  const locationForm = useForm<z.infer<typeof locationFormSchema>>({
    resolver: zodResolver(locationFormSchema),
    defaultValues: {
      latitude: 14.5995,
      longitude: 120.9842,
      address: "",
    },
  });

  // Initialize forms with restaurant data
  React.useEffect(() => {
    if (restaurant) {
      profileForm.reset({
        name: restaurant.name,
        description: restaurant.description || "",
        phone: restaurant.phone,
        email: restaurant.email,
        address: restaurant.address,
        bannerUrl: restaurant.bannerUrl || "",
        logoUrl: restaurant.logoUrl || "",
        isActive: restaurant.isActive,
      });

      operationsForm.reset({
        openingTime: restaurant.openingTime || "09:00",
        closingTime: restaurant.closingTime || "21:00",
        categories: (restaurant.categories || []).join(", "),
        cuisine: restaurant.cuisine || "",
        minimumOrderAmount: restaurant.minimumOrderAmount || 0,
        serviceRadius: restaurant.serviceRadius || 5,
        preparationTime: restaurant.preparationTime || 30,
      });

      paymentsForm.reset({
        acceptsCash: restaurant.acceptsCash !== false,
        acceptsGcash: restaurant.acceptsGcash || false,
        bankName: restaurant.bankName || "",
        accountNumber: restaurant.accountNumber || "",
        accountName: restaurant.accountName || "",
        gcashNumber: restaurant.gcashNumber || "",
      });

      locationForm.reset({
        latitude: restaurant.latitude || 14.5995,
        longitude: restaurant.longitude || 120.9842,
        address: restaurant.address,
      });
    }
  }, [restaurant]);

  // Handle profile form submission
  const onProfileSubmit = (values: z.infer<typeof profileFormSchema>) => {
    updateRestaurantMutation.mutate(values);
  };

  // Handle operations form submission
  const onOperationsSubmit = (values: z.infer<typeof operationsFormSchema>) => {
    const categories = values.categories.split(",").map(cat => cat.trim()).filter(Boolean);

    updateRestaurantMutation.mutate({
      ...values,
      categories,
    });
  };

  // Handle payments form submission
  const onPaymentsSubmit = (values: z.infer<typeof paymentsFormSchema>) => {
    updateRestaurantMutation.mutate(values);
  };

  // Handle location form submission
  const onLocationSubmit = (values: z.infer<typeof locationFormSchema>) => {
    updateRestaurantMutation.mutate(values);
  };

  if (isLoading) {
    return (
      <RestaurantLayout title="Restaurant Settings" description="Configure your restaurant profile and settings">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </RestaurantLayout>
    );
  }

  if (!restaurant) {
    return (
      <RestaurantLayout title="Restaurant Settings" description="Configure your restaurant profile and settings">
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6 flex items-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mr-4" />
            <div>
              <h3 className="text-lg font-semibold text-amber-800">Restaurant Not Found</h3>
              <p className="text-amber-700">
                Your user account is not associated with any restaurant. Please contact support.
              </p>
            </div>
          </CardContent>
        </Card>
      </RestaurantLayout>
    );
  }

  return (
    <RestaurantLayout title="Restaurant Settings" description="Configure your restaurant profile and settings">
      <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center">
            <Store className="mr-2 h-4 w-4" />
            Restaurant Profile
          </TabsTrigger>
          <TabsTrigger value="operations" className="flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Operations
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center">
            <MapPin className="mr-2 h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center">
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Restaurant Profile */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Information</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-6 border-b">
                    <div className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="logoUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Image className="h-4 w-4" />
                              Restaurant Logo
                            </FormLabel>
                            <FormControl>
                              <ImageUpload
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                placeholder="https://example.com/logo.png"
                                accept="image/*"
                                maxSizeMessage="Logo: Maximum 5MB (JPG, PNG, WebP)"
                              />
                            </FormControl>
                            <FormDescription>
                              Upload or provide a URL for your restaurant logo. Recommended size: 200x200px
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Logo Preview */}
                      <div className="flex items-center space-y-2">
                        <Avatar className="h-16 w-16 border">
                          {profileForm.watch("logoUrl") ? (
                            <AvatarImage src={profileForm.watch("logoUrl")} alt="Restaurant Logo" />
                          ) : null}
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {restaurant.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground ml-2">Current Logo</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <FormField
                        control={profileForm.control}
                        name="bannerUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <Image className="h-4 w-4" />
                              Banner Image
                            </FormLabel>
                            <FormControl>
                              <ImageUpload
                                value={field.value || ""}
                                onChange={field.onChange}
                                onBlur={field.onBlur}
                                placeholder="https://example.com/banner.jpg"
                                accept="image/*"
                                maxSizeMessage="Banner: Maximum 5MB (JPG, PNG, WebP)"
                              />
                            </FormControl>
                            <FormDescription>
                              Upload or provide a URL for your restaurant banner. Recommended size: 1200x400px
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Restaurant name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe your restaurant..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Tell customers about your restaurant, cuisine, and specialties
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="restaurant@example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="+63 123 456 7890" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Full restaurant address..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Active Status</FormLabel>
                          <FormDescription>
                            When active, your restaurant is visible to customers and can receive orders
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateRestaurantMutation.isPending}
                  >
                    {updateRestaurantMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Operations */}
        <TabsContent value="operations">
          <Card>
            <CardHeader>
              <CardTitle>Operational Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...operationsForm}>
                <form onSubmit={operationsForm.handleSubmit(onOperationsSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={operationsForm.control}
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
                      control={operationsForm.control}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={operationsForm.control}
                      name="categories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categories</FormLabel>
                          <FormControl>
                            <Input placeholder="Fast Food, Chinese, Filipino, etc." {...field} />
                          </FormControl>
                          <FormDescription>
                            Enter categories separated by commas
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={operationsForm.control}
                      name="cuisine"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cuisine Type</FormLabel>
                          <FormControl>
                            <Input placeholder="Filipino, Chinese, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={operationsForm.control}
                      name="preparationTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Average Preparation Time (minutes)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="5"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Used to calculate estimated delivery times
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={operationsForm.control}
                      name="serviceRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Service Radius (km)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum distance for delivery
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                    <FormField
                      control={operationsForm.control}
                      name="minimumOrderAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minimum Order Amount (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="1"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription>
                            Set to 0 for no minimum order
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateRestaurantMutation.isPending}
                  >
                    {updateRestaurantMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Operational Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Location</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...locationForm}>
                <form onSubmit={locationForm.handleSubmit(onLocationSubmit)} className="space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Click on the map to set your restaurant's precise location. This helps customers find you and enables accurate delivery estimates.
                    </p>

                    {/* Current Location Display */}
                    <div className="p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Current Location</h4>
                      <p className="text-sm text-muted-foreground mb-2">
                        Latitude: {locationForm.watch("latitude").toFixed(6)},
                        Longitude: {locationForm.watch("longitude").toFixed(6)}
                      </p>
                      <p className="text-sm">{locationForm.watch("address")}</p>
                    </div>

                    {/* Google Maps Component */}
                    <div className="border rounded-lg overflow-hidden">
                      {mapsData?.key ? (
                        <LoadScript
                          googleMapsApiKey={mapsData.key}
                          onLoad={() => console.log("Google Maps loaded successfully")}
                          onError={(error) => console.error("Google Maps loading error:", error)}
                          loadingElement={<div className="h-96 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
                        >
                          <GoogleMap
                            mapContainerStyle={mapContainerStyle}
                            center={{
                              lat: locationForm.watch("latitude"),
                              lng: locationForm.watch("longitude")
                            }}
                            zoom={16}
                            onClick={(e) => {
                              if (e.latLng) {
                                const lat = e.latLng.lat();
                                const lng = e.latLng.lng();
                                locationForm.setValue("latitude", lat);
                                locationForm.setValue("longitude", lng);
                              }
                            }}
                            options={{
                              fullscreenControl: true,
                              streetViewControl: false,
                              mapTypeControl: true,
                              zoomControl: true,
                            }}
                          >
                            <Marker
                              position={{
                                lat: locationForm.watch("latitude"),
                                lng: locationForm.watch("longitude")
                              }}
                              title={restaurant?.name || "Restaurant Location"}
                              icon={{
                                url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                                scaledSize: window.google?.maps ? new window.google.maps.Size(32, 32) : undefined,
                              }}
                            />
                          </GoogleMap>
                        </LoadScript>
                      ) : (
                        <div className="h-96 flex items-center justify-center bg-gray-50">
                          <div className="text-center">
                            <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                              {isLoadingMapsKey ? "Loading Google Maps..." : "Google Maps API key is missing"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Address Field */}
                    <FormField
                      control={locationForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Complete Address</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Enter your restaurant's complete address..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Update the address to match the pin location on the map
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Coordinates Display */}
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={locationForm.control}
                        name="latitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Latitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={locationForm.control}
                        name="longitude"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Longitude</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="any"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={updateRestaurantMutation.isPending}
                    className="w-full"
                  >
                    {updateRestaurantMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Location...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Location
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...paymentsForm}>
                <form onSubmit={paymentsForm.handleSubmit(onPaymentsSubmit)} className="space-y-6">
                  <FormField
                    control={paymentsForm.control}
                    name="acceptsCash"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Cash on Delivery</FormLabel>
                          <FormDescription>
                            Accept cash payments upon delivery
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={paymentsForm.control}
                    name="acceptsGcash"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">GCash</FormLabel>
                          <FormDescription>
                            Accept GCash payments
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {paymentsForm.watch("acceptsGcash") && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium">GCash Details</h3>

                      <FormField
                        control={paymentsForm.control}
                        name="gcashNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>GCash Number</FormLabel>
                            <FormControl>
                              <Input placeholder="09XX XXX XXXX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}

                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="text-sm font-medium">Bank Account Details (Optional)</h3>
                    <p className="text-sm text-muted-foreground">For payment settlement by the platform</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={paymentsForm.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bank Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Bank name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={paymentsForm.control}
                        name="accountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Account number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={paymentsForm.control}
                      name="accountName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Account Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Account name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateRestaurantMutation.isPending}
                  >
                    {updateRestaurantMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Payment Settings
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Password Protection</div>
                    <div className="text-sm text-muted-foreground">
                      Require password for sensitive operations
                    </div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Two-Factor Authentication</div>
                    <div className="text-sm text-muted-foreground">
                      Add an extra layer of security with 2FA
                    </div>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full mr-2 flex items-center">
                      <Check className="h-3 w-3 mr-1" /> Enabled
                    </span>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Staff Access</div>
                    <div className="text-sm text-muted-foreground">
                      Manage additional user accounts for your staff
                    </div>
                  </div>
                  <Button variant="outline">Manage Access</Button>
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Order Verification</div>
                    <div className="text-sm text-muted-foreground">
                      Require manual verification for orders above ₱1,000
                    </div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <Button className="w-full md:w-auto">
                  <Save className="mr-2 h-4 w-4" />
                  Save Security Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </RestaurantLayout>
  );
}
