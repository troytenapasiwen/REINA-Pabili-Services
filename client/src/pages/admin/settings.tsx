import React, { useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Setting } from "@shared/schema";
import { Save, Globe, Bell, Shield, CreditCard, MapPinned, Phone, QrCode, Upload } from "lucide-react";
import { MapLocationPicker } from "@/components/ui/map-location-picker";
import { ObjectUploader } from "@/components/ObjectUploader";

// Form schema for general settings
const generalSettingsSchema = z.object({
  maintenanceMode: z.boolean().default(false),
});

// Form schema for notification settings
const notificationSettingsSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(true),
  pushNotifications: z.boolean().default(true),
  orderConfirmations: z.boolean().default(true),
  marketingEmails: z.boolean().default(false),
});

// Form schema for payment settings
const paymentSettingsSchema = z.object({
  cashOnDelivery: z.boolean().default(true),
  gcashEnabled: z.boolean().default(true),
  gcashDisplayMode: z.enum(["phone", "qr"]).default("phone"),
  gcashPhoneNumber: z.string().default("09467102826"),
  gcashQrCodeUrl: z.string().optional(),
  gcashApiKey: z.string().optional(),
  gcashSecretKey: z.string().optional(),
  gcashMerchantId: z.string().optional(),
  defaultCurrency: z.string().default("PHP"),
  taxRate: z.string().default("0"),
});

// Form schema for location settings
const locationSettingsSchema = z.object({
  restaurantApplicationRadiusEnabled: z.boolean().default(false),
  restaurantApplicationCenterLat: z.string().default("14.5995"),
  restaurantApplicationCenterLng: z.string().default("120.9842"),
  restaurantApplicationRadiusKm: z.string().default("10"),
});

export default function AdminSettings() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("general");

  // Fetch settings
  const { data: settings, isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // Get settings by key
  const getSetting = (key: string) => {
    const setting = settings?.find(s => s.key === key);
    return setting?.value || "";
  };

  // Convert boolean string to actual boolean
  const getBooleanSetting = (key: string) => {
    return getSetting(key) === "true";
  };

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const promises = Object.entries(data).map(([key, value]) =>
        apiRequest("PATCH", `/api/settings/${key}`, { value })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings updated",
        description: "Your settings have been saved successfully",
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

  // General settings form
  const generalForm = useForm<z.infer<typeof generalSettingsSchema>>({
    resolver: zodResolver(generalSettingsSchema),
    defaultValues: {
      maintenanceMode: false,
    },
  });

  // Notification settings form
  const notificationForm = useForm<z.infer<typeof notificationSettingsSchema>>({
    resolver: zodResolver(notificationSettingsSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: true,
      pushNotifications: true,
      orderConfirmations: true,
      marketingEmails: false,
    },
  });

  // Payment settings form
  const paymentForm = useForm<z.infer<typeof paymentSettingsSchema>>({
    resolver: zodResolver(paymentSettingsSchema),
    defaultValues: {
      cashOnDelivery: true,
      gcashEnabled: true,
      gcashDisplayMode: "phone",
      gcashPhoneNumber: "09467102826",
      gcashQrCodeUrl: "",
      gcashApiKey: "",
      gcashSecretKey: "",
      gcashMerchantId: "",
      defaultCurrency: "PHP",
      taxRate: "0",
    },
  });

  // Location settings form
  const locationForm = useForm<z.infer<typeof locationSettingsSchema>>({
    resolver: zodResolver(locationSettingsSchema),
    defaultValues: {
      restaurantApplicationRadiusEnabled: false,
      restaurantApplicationCenterLat: "14.5995",
      restaurantApplicationCenterLng: "120.9842",
      restaurantApplicationRadiusKm: "10",
    },
  });

  // Initialize forms with data from API
  React.useEffect(() => {
    if (settings) {
      generalForm.reset({
        maintenanceMode: getBooleanSetting("maintenanceMode"),
      });

      notificationForm.reset({
        emailNotifications: getBooleanSetting("emailNotifications"),
        smsNotifications: getBooleanSetting("smsNotifications"),
        pushNotifications: getBooleanSetting("pushNotifications"),
        orderConfirmations: getBooleanSetting("orderConfirmations"),
        marketingEmails: getBooleanSetting("marketingEmails"),
      });

      paymentForm.reset({
        cashOnDelivery: getBooleanSetting("cashOnDelivery"),
        gcashEnabled: getBooleanSetting("gcashEnabled"),
        gcashDisplayMode: (getSetting("gcashDisplayMode") || "phone") as "phone" | "qr",
        gcashPhoneNumber: getSetting("gcashPhoneNumber") || "09467102826",
        gcashQrCodeUrl: getSetting("gcashQrCodeUrl"),
        gcashApiKey: getSetting("gcashApiKey"),
        gcashSecretKey: getSetting("gcashSecretKey"),
        gcashMerchantId: getSetting("gcashMerchantId"),
        defaultCurrency: getSetting("defaultCurrency"),
        taxRate: getSetting("taxRate"),
      });

      locationForm.reset({
        restaurantApplicationRadiusEnabled: getBooleanSetting("restaurantApplicationRadiusEnabled"),
        restaurantApplicationCenterLat: getSetting("restaurantApplicationCenterLat") || "14.5995",
        restaurantApplicationCenterLng: getSetting("restaurantApplicationCenterLng") || "120.9842",
        restaurantApplicationRadiusKm: getSetting("restaurantApplicationRadiusKm") || "10",
      });
    }
  }, [settings]);

  // Handle form submissions
  const onGeneralSubmit = (values: z.infer<typeof generalSettingsSchema>) => {
    const data = Object.entries(values).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);

    updateSettingsMutation.mutate(data);
  };

  const onNotificationSubmit = (values: z.infer<typeof notificationSettingsSchema>) => {
    const data = Object.entries(values).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);

    updateSettingsMutation.mutate(data);
  };

  const onPaymentSubmit = (values: z.infer<typeof paymentSettingsSchema>) => {
    const data = Object.entries(values).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);

    updateSettingsMutation.mutate(data);
  };

  const onLocationSubmit = (values: z.infer<typeof locationSettingsSchema>) => {
    const data = Object.entries(values).reduce((acc, [key, value]) => {
      acc[key] = value.toString();
      return acc;
    }, {} as Record<string, string>);

    updateSettingsMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Settings" description="Configure application settings">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings" description="Configure application settings">
      <Tabs defaultValue="general" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="general" className="flex items-center">
            <Globe className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center">
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="location" className="flex items-center">
            <MapPinned className="mr-2 h-4 w-4" />
            Location
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...generalForm}>
                <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-6">
                  <FormField
                    control={generalForm.control}
                    name="maintenanceMode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Maintenance Mode</FormLabel>
                          <FormDescription>
                            When enabled, the site will be inaccessible to users
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
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-6">
                  <FormField
                    control={notificationForm.control}
                    name="emailNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Email Notifications</FormLabel>
                          <FormDescription>
                            Send notifications via email
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
                    control={notificationForm.control}
                    name="smsNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">SMS Notifications</FormLabel>
                          <FormDescription>
                            Send notifications via SMS
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
                    control={notificationForm.control}
                    name="pushNotifications"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Push Notifications</FormLabel>
                          <FormDescription>
                            Send in-app push notifications
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
                    control={notificationForm.control}
                    name="orderConfirmations"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Order Confirmations</FormLabel>
                          <FormDescription>
                            Send notifications for order status changes
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
                    control={notificationForm.control}
                    name="marketingEmails"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Marketing Emails</FormLabel>
                          <FormDescription>
                            Send promotional emails to customers
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
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Settings */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...paymentForm}>
                <form onSubmit={paymentForm.handleSubmit(onPaymentSubmit)} className="space-y-6">
                  <FormField
                    control={paymentForm.control}
                    name="cashOnDelivery"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Cash on Delivery</FormLabel>
                          <FormDescription>
                            Enable cash payment on delivery
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
                    control={paymentForm.control}
                    name="gcashEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">GCash</FormLabel>
                          <FormDescription>
                            Enable GCash payments
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

                  {paymentForm.watch("gcashEnabled") && (
                    <>
                      {/* GCash Display Configuration */}
                      <div className="space-y-4 rounded-lg border p-4">
                        <h3 className="text-sm font-medium">GCash Display Settings</h3>
                        <p className="text-sm text-muted-foreground">
                          Configure how customers see GCash payment information during checkout
                        </p>

                        <FormField
                          control={paymentForm.control}
                          name="gcashDisplayMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Display Mode</FormLabel>
                              <FormControl>
                                <RadioGroup
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  className="flex flex-col space-y-3"
                                >
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="phone" id="phone-mode" />
                                    <Label htmlFor="phone-mode" className="font-normal cursor-pointer flex items-center">
                                      <Phone className="mr-2 h-4 w-4" />
                                      Phone Number
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="qr" id="qr-mode" />
                                    <Label htmlFor="qr-mode" className="font-normal cursor-pointer flex items-center">
                                      <QrCode className="mr-2 h-4 w-4" />
                                      QR Code
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormDescription>
                                Choose how customers will see GCash payment options
                              </FormDescription>
                            </FormItem>
                          )}
                        />

                        {paymentForm.watch("gcashDisplayMode") === "phone" && (
                          <FormField
                            control={paymentForm.control}
                            name="gcashPhoneNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GCash Phone Number</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder="09XXXXXXXXX"
                                    maxLength={11}
                                  />
                                </FormControl>
                                <FormDescription>
                                  The phone number customers will send payments to
                                </FormDescription>
                              </FormItem>
                            )}
                          />
                        )}

                        {paymentForm.watch("gcashDisplayMode") === "qr" && (
                          <FormField
                            control={paymentForm.control}
                            name="gcashQrCodeUrl"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>GCash QR Code</FormLabel>
                                {field.value ? (
                                  <div className="space-y-3">
                                    <div className="border rounded-lg p-4 bg-gray-50">
                                      <img
                                        src={field.value}
                                        alt="GCash QR Code"
                                        className="max-w-[200px] mx-auto"
                                      />
                                    </div>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => field.onChange("")}
                                    >
                                      Remove QR Code
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <ObjectUploader
                                      maxNumberOfFiles={1}
                                      maxFileSize={5242880} // 5MB
                                      allowedFileTypes={["image/*"]}
                                      onGetUploadParameters={async () => {
                                        const response = await apiRequest("POST", "/api/objects/upload");
                                        const data = await response.json();
                                        return {
                                          method: "PUT" as const,
                                          url: data.uploadURL,
                                        };
                                      }}
                                      onComplete={async (result) => {
                                        if (result.successful && result.successful.length > 0) {
                                          const uploadedFile = result.successful[0];
                                          const uploadUrl = uploadedFile.uploadURL;
                                          field.onChange(uploadUrl);
                                        }
                                      }}
                                      buttonClassName="w-full"
                                    >
                                      <Upload className="mr-2 h-4 w-4" />
                                      Upload QR Code
                                    </ObjectUploader>
                                    <FormDescription>
                                      Upload the GCash QR code image that customers will scan to make payments
                                    </FormDescription>
                                  </div>
                                )}
                              </FormItem>
                            )}
                          />
                        )}
                      </div>

                      {/* GCash API Settings */}
                      <div className="space-y-4 rounded-lg border p-4">
                        <h3 className="text-sm font-medium">GCash API Integration (Optional)</h3>

                        <FormField
                          control={paymentForm.control}
                          name="gcashMerchantId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Merchant ID</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={paymentForm.control}
                          name="gcashApiKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>API Key</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={paymentForm.control}
                          name="gcashSecretKey"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Secret Key</FormLabel>
                              <FormControl>
                                <Input type="password" {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={paymentForm.control}
                      name="defaultCurrency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Default Currency</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Default is PHP (Philippine Peso)
                          </FormDescription>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={paymentForm.control}
                      name="taxRate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tax Rate (%)</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormDescription>
                            Applied to all orders
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Settings */}
        <TabsContent value="location">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Application Radius</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...locationForm}>
                <form onSubmit={locationForm.handleSubmit(onLocationSubmit)} className="space-y-6">
                  <FormField
                    control={locationForm.control}
                    name="restaurantApplicationRadiusEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Enable Application Radius Limit</FormLabel>
                          <FormDescription>
                            Restrict new restaurant applications to within a specific radius
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-radius-enabled"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {locationForm.watch("restaurantApplicationRadiusEnabled") && (
                    <div className="space-y-4 rounded-lg border p-4">
                      <h3 className="text-sm font-medium">Service Area Settings</h3>

                      <FormField
                        control={locationForm.control}
                        name="restaurantApplicationRadiusKm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Radius Limit (kilometers)</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-radius-km"
                                type="number"
                                min="0.1"
                                max="1000"
                                step="0.1"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              Restaurants can only apply within this radius from the center point
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <div className="space-y-2">
                        <Label>Center Location</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={locationForm.control}
                            name="restaurantApplicationCenterLat"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Latitude</FormLabel>
                                <FormControl>
                                  <Input
                                    data-testid="input-center-lat"
                                    type="number"
                                    step="any"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={locationForm.control}
                            name="restaurantApplicationCenterLng"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-xs">Longitude</FormLabel>
                                <FormControl>
                                  <Input
                                    data-testid="input-center-lng"
                                    type="number"
                                    step="any"
                                    {...field}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormDescription>
                          Click on the map below to set the center point of your service area
                        </FormDescription>
                      </div>

                      <div className="space-y-2">
                        <Label>Select Center on Map</Label>
                        <MapLocationPicker
                          initialLocation={{
                            lat: parseFloat(locationForm.watch("restaurantApplicationCenterLat") || "14.5995"),
                            lng: parseFloat(locationForm.watch("restaurantApplicationCenterLng") || "120.9842")
                          }}
                          onLocationSelect={(location) => {
                            locationForm.setValue("restaurantApplicationCenterLat", location.lat.toString());
                            locationForm.setValue("restaurantApplicationCenterLng", location.lng.toString());
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full md:w-auto"
                    disabled={updateSettingsMutation.isPending}
                  >
                    {updateSettingsMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">2FA Authentication</div>
                    <div className="text-sm text-muted-foreground">
                      Require two-factor authentication for all admin accounts
                    </div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Secure Passwords</div>
                    <div className="text-sm text-muted-foreground">
                      Require strong passwords (min. 8 chars, special chars, numbers)
                    </div>
                  </div>
                  <Switch defaultChecked={true} />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">Session Timeout</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically log out inactive users after 30 minutes
                    </div>
                  </div>
                  <Switch defaultChecked={false} />
                </div>

                <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-base font-medium">IP Restriction</div>
                    <div className="text-sm text-muted-foreground">
                      Limit admin access to specific IP addresses
                    </div>
                  </div>
                  <Switch defaultChecked={false} />
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
    </AdminLayout>
  );
}
