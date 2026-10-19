import React, { useState, useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapLocationPicker } from "@/components/ui/map-location-picker";
import { CheckCircle, Store } from "lucide-react";
import { InsertRestaurant } from "@shared/schema";
import { BusinessPermitUploader } from "./business-permit-uploader";

// Form steps
const STEPS = {
  BASIC_INFO: 0,
  CONTACT_INFO: 1,
  LOCATION: 2,
  BUSINESS_HOURS: 3,
  DOCUMENTS: 4,
  COMPLETE: 5,
};

// Form schema
const restaurantSchema = z.object({
  name: z.string().min(3, "Restaurant name must be at least 3 characters"),
  description: z.string().optional(),
  address: z.string().min(10, "Please enter a valid address"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email"),
  categories: z.array(z.string()).default([]),
  openingTime: z.string().min(1, "Please enter opening time"),
  closingTime: z.string().min(1, "Please enter closing time"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  deliveryFee: z.number().min(0, "Delivery fee cannot be negative").default(0),
});

export type RestaurantFormValues = z.infer<typeof restaurantSchema>;

interface RestaurantOnboardingProps {
  userId: number;
  onComplete?: () => void;
}

export function RestaurantOnboarding({ userId, onComplete }: RestaurantOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(STEPS.BASIC_INFO);
  const [businessPermitUrl, setBusinessPermitUrl] = useState<string>("");
  const { toast } = useToast();

  // Create form
  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      phone: "",
      email: "",
      categories: ["General"],
      openingTime: "09:00",
      closingTime: "21:00",
      deliveryFee: 50,
    },
  });

  // Create restaurant mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertRestaurant) => {
      const res = await apiRequest("POST", "/api/restaurants", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants/by-user"] });
      toast({
        title: "Restaurant created",
        description: "Your restaurant has been created successfully and is pending approval.",
      });
      setCurrentStep(STEPS.COMPLETE);
      if (onComplete) onComplete();
    },
    onError: (error) => {
      toast({
        title: "Error creating restaurant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (values: RestaurantFormValues) => {
    createMutation.mutate({
      ...values,
      userId,
      isActive: true,
      businessPermitUrl: businessPermitUrl || undefined,
    });
  };

  // Go to next step with validation
  const goToNextStep = async () => {
    if (currentStep === STEPS.BASIC_INFO) {
      const isValid = await form.trigger(['name', 'description']);
      if (!isValid) return;
    } else if (currentStep === STEPS.CONTACT_INFO) {
      const isValid = await form.trigger(['email', 'phone']);
      if (!isValid) return;
    } else if (currentStep === STEPS.LOCATION) {
      const isValid = await form.trigger(['address', 'latitude', 'longitude']);
      if (!isValid) return;
    } else if (currentStep === STEPS.BUSINESS_HOURS) {
      const isValid = await form.trigger(['openingTime', 'closingTime', 'deliveryFee']);
      if (!isValid) return;
    } else if (currentStep === STEPS.DOCUMENTS) {
      // Final step, submit the form
      form.handleSubmit(onSubmit)();
      return;
    }

    setCurrentStep((prev) => prev + 1);
  };

  // Go to previous step
  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  // Handle location selection
  const handleLocationSelect = (location: { lat: number, lng: number }) => {
    form.setValue('latitude', location.lat);
    form.setValue('longitude', location.lng);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>Restaurant Onboarding</CardTitle>
          <CardDescription>
            {currentStep === STEPS.BASIC_INFO && "Provide basic information about your restaurant"}
            {currentStep === STEPS.CONTACT_INFO && "How can customers reach you?"}
            {currentStep === STEPS.LOCATION && "Pin your restaurant location on the map"}
            {currentStep === STEPS.BUSINESS_HOURS && "When are you open for business?"}
            {currentStep === STEPS.DOCUMENTS && "Upload required documents for verification"}
            {currentStep === STEPS.COMPLETE && "Your restaurant has been created!"}
          </CardDescription>

          {/* Progress bar */}
          {currentStep !== STEPS.COMPLETE && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
              <div
                className="bg-primary h-2.5 rounded-full"
                style={{ width: `${((currentStep + 1) / 5) * 100}%` }}
              ></div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form className="space-y-6">
              {/* Step 1: Basic Information */}
              {currentStep === STEPS.BASIC_INFO && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Restaurant Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your restaurant name" {...field} />
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
                            placeholder="Describe your restaurant, cuisine, specialties, etc."
                            {...field}
                            className="min-h-[100px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 2: Contact Information */}
              {currentStep === STEPS.CONTACT_INFO && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter restaurant email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter restaurant phone number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 3: Location */}
              {currentStep === STEPS.LOCATION && (
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter restaurant address"
                            {...field}
                            className="min-h-[60px]"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="latitude"
                    render={() => (
                      <FormItem>
                        <FormLabel>Location on Map</FormLabel>
                        <FormControl>
                          <MapLocationPicker
                            onLocationSelect={handleLocationSelect}
                            initialLocation={
                              form.getValues('latitude') && form.getValues('longitude')
                                ? {
                                    lat: form.getValues('latitude'),
                                    lng: form.getValues('longitude'),
                                  }
                                : undefined
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 4: Business Hours */}
              {currentStep === STEPS.BUSINESS_HOURS && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="openingTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opening Time</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 09:00" {...field} />
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
                            <Input placeholder="e.g. 21:00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                            step="0.01"
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Step 5: Documents */}
              {currentStep === STEPS.DOCUMENTS && (
                <div className="space-y-6">
                  <BusinessPermitUploader
                    onUploadComplete={setBusinessPermitUrl}
                    currentPermitUrl={businessPermitUrl}
                  />
                </div>
              )}

              {/* Completion step */}
              {currentStep === STEPS.COMPLETE && (
                <div className="text-center py-8">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Restaurant Created Successfully!</h3>
                  <p className="text-muted-foreground mb-6">
                    Your restaurant has been created and is now pending approval from the administrator.
                    You'll be notified once it's approved and visible to customers.
                  </p>

                  {onComplete && (
                    <Button
                      onClick={onComplete}
                      className="mx-auto"
                    >
                      <Store className="mr-2 h-4 w-4" />
                      Go to Restaurant Dashboard
                    </Button>
                  )}
                </div>
              )}

              {/* Navigation buttons */}
              {currentStep !== STEPS.COMPLETE && (
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={goToPreviousStep}
                    disabled={currentStep === STEPS.BASIC_INFO}
                  >
                    Back
                  </Button>

                  <Button
                    type="button"
                    onClick={goToNextStep}
                    disabled={createMutation.isPending}
                  >
                    {currentStep === STEPS.DOCUMENTS ? (
                      createMutation.isPending ? (
                        <>
                          <span className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></span>
                          Creating...
                        </>
                      ) : (
                        "Create Restaurant"
                      )
                    ) : (
                      "Next"
                    )}
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
