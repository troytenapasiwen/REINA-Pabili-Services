import React, { useState } from "react";
import { useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Customer } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, MapPin, Phone, Mail, Package, Clock, Edit, Trash2, Save, LogOut } from "lucide-react";
import { CustomerLocationPicker } from "@/components/customer/customer-location-picker";
import { EnhancedLocationPicker } from "@/components/customer/enhanced-location-picker";
import { LocationDisplay } from "@/components/customer/location-display";
import { SavedAddresses } from "@/components/customer/saved-addresses";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// Form validation schema
const profileFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  phone: z.string().min(8, "Please enter a valid phone number"),
  address: z.string().min(10, "Please enter a complete address"),
  city: z.string().min(2, "City is required"),
  avatarUrl: z.string().url().optional().or(z.literal("")),
});

// Password change schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(6, "Password must be at least 6 characters"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmNewPassword: z.string().min(6, "Password must be at least 6 characters"),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: "Passwords don't match",
  path: ["confirmNewPassword"],
});

export default function CustomerProfile() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [_, navigate] = useLocation();

  // Get customer data
  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
    enabled: !!user?.id,
  });

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async (formData: z.infer<typeof profileFormSchema>) => {
      if (!customer) throw new Error("Customer not found");

      // First update the user profile
      const userUpdates = {
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
      };

      // Update the customer profile
      const customerUpdates = {
        defaultAddress: formData.address,
      };

      // Update user data first
      await apiRequest("PATCH", `/api/users/me`, userUpdates);

      // Then update customer data
      const res = await apiRequest("PATCH", `/api/customers`, customerUpdates);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      toast({
        title: "Profile updated",
        description: "Your profile has been updated successfully",
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to update profile",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: z.infer<typeof passwordChangeSchema>) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Password changed",
        description: "Your password has been changed successfully",
      });
      passwordForm.reset();
    },
    onError: (error) => {
      toast({
        title: "Failed to change password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/users/me");
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Account deleted",
        description: "Your account has been deleted successfully",
      });
      logoutMutation.mutate();
    },
    onError: (error) => {
      toast({
        title: "Failed to delete account",
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
      email: "",
      phone: "",
      address: "",
      city: "",
      avatarUrl: "",
    },
  });

  // Password form
  const passwordForm = useForm<z.infer<typeof passwordChangeSchema>>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
  });

  // Initialize form with customer data
  React.useEffect(() => {
    if (customer && user) {
      profileForm.reset({
        name: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        address: customer.defaultAddress || "",
        city: customer.defaultAddress ? customer.defaultAddress.split(",").pop()?.trim() || "" : "",
        avatarUrl: "", // No avatarUrl in the current schema
      });
    }
  }, [customer, user, isEditing]);

  // Handle profile form submission
  const onProfileSubmit = (values: z.infer<typeof profileFormSchema>) => {
    updateCustomerMutation.mutate(values);
  };

  // Handle password form submission
  const onPasswordSubmit = (values: z.infer<typeof passwordChangeSchema>) => {
    changePasswordMutation.mutate(values);
  };

  // Handle logout
  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logoutMutation.mutate();
    setLogoutDialogOpen(false);
  };

  // Start editing profile
  const startEditing = () => {
    setIsEditing(true);
  };

  // Cancel editing profile
  const cancelEditing = () => {
    setIsEditing(false);
    // Reset form to original values
    if (customer && user) {
      profileForm.reset({
        name: user.fullName || "",
        email: user.email || "",
        phone: user.phone || "",
        address: customer.defaultAddress || "",
        city: customer.defaultAddress ? customer.defaultAddress.split(",").pop()?.trim() || "" : "",
        avatarUrl: "",
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <CustomerLayout>
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        <Tabs defaultValue="profile" className="mb-4 sm:mb-8">
          <TabsList className="mb-4 sm:mb-8 grid w-full grid-cols-2 sm:grid-cols-4 h-auto">
            <TabsTrigger value="profile" className="flex items-center text-xs sm:text-sm p-2 sm:p-3">
              <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center text-xs sm:text-sm p-2 sm:p-3">
              <Package className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="addresses" className="flex items-center text-xs sm:text-sm p-2 sm:p-3">
              <MapPin className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Addresses
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center text-xs sm:text-sm p-2 sm:p-3">
              <User className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-2">
                <CardTitle className="text-lg sm:text-xl">My Profile</CardTitle>
                {!isEditing && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate("/profile/edit")}
                    className="w-full sm:w-auto"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </Button>
                )}
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col md:flex-row gap-4 sm:gap-8">
                  <div className="flex flex-col items-center space-y-4 w-full md:w-auto">
                    <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                      <AvatarFallback className="text-2xl sm:text-4xl">
                        {user?.fullName?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>

                  </div>

                  <div className="flex-grow w-full">
                      <div className="space-y-4 sm:space-y-6">
                        <div className="mb-4">
                          <div>
                            <h3 className="text-lg sm:text-xl font-bold">{user?.fullName || user?.username}</h3>
                            <p className="text-sm text-muted-foreground">{user?.role === "customer" ? "Customer" : "User"}</p>
                          </div>
                        </div>

                        <Separator />

                        <div className="grid grid-cols-1 gap-4 sm:gap-6">
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Contact Information</h4>
                              <div className="bg-muted/30 rounded-lg p-3 sm:p-4 space-y-3">
                                <div className="flex items-center">
                                  <Mail className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm break-all">{user?.email}</span>
                                </div>

                                <div className="flex items-center">
                                  <Phone className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm">{user?.phone || "No phone added yet"}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-medium text-muted-foreground mb-2">Default Delivery Address</h4>
                              <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                                {customer && <LocationDisplay
                                  customer={customer}
                                  iconSize={16}
                                  className="mt-0"
                                  showDefaultText={true}
                                />}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                            <span>Member since {new Date(customer?.createdAt || Date.now()).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
              </CardHeader>

              <CardContent>
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Order history available in Orders section</h3>
                  <p className="text-muted-foreground mb-4">
                    You can view all your past and current orders in the Orders page
                  </p>
                  <Button onClick={() => window.location.href = "/orders"}>
                    Go to Orders
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Addresses Tab */}
          <TabsContent value="addresses">
            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <div className="w-full">
                <Card className="mb-4 sm:mb-6">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl">My Current Location</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      This is the default address that will be used for your deliveries
                    </p>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-6">
                    {customer && (
                      <div className="bg-muted/40 rounded-lg p-3 sm:p-4 mb-4">
                        <LocationDisplay
                          customer={customer}
                          iconSize={18}
                          className="text-sm sm:text-base"
                          showDefaultText={true}
                        />
                      </div>
                    )}

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
                  </CardContent>
                </Card>
              </div>

              <div className="w-full">
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Tips</CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4 text-sm">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
                      <p className="font-medium mb-2">📍 Set your current location</p>
                      <p>Your current location is used as the default delivery address. Update it using the map or by selecting a saved address.</p>
                    </div>

                    <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-blue-800">
                      <p className="font-medium mb-2">🏠 Multiple saved addresses</p>
                      <p>Save multiple locations with descriptive names like "Home", "Work", "School" or "Friend's Place" for quicker checkout.</p>
                    </div>

                    <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-green-800">
                      <p className="font-medium mb-2">⭐ Set a default address</p>
                      <p>Mark any saved address as your default to have it automatically selected during checkout.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Saved Addresses</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your saved locations for faster checkout
                </p>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                <SavedAddresses
                  allowSetAsCurrent={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security">
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Change Password</CardTitle>
              </CardHeader>

              <CardContent className="p-4 sm:p-6">
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Your current password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Your new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={passwordForm.control}
                      name="confirmNewPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirm New Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Confirm your new password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      className="mt-2"
                      disabled={changePasswordMutation.isPending}
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                          Changing Password...
                        </>
                      ) : "Change Password"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 sm:gap-6">
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Logout</CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    You'll need to login again to access your account
                  </p>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleLogout}
                    disabled={logoutMutation.isPending}
                  >
                    {logoutMutation.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent"></div>
                        Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl text-red-600">Delete Account</CardTitle>
                </CardHeader>

                <CardContent className="p-4 sm:p-6">
                  <p className="text-sm text-muted-foreground mb-4">
                    This action cannot be undone. This will permanently delete your account and all data.
                  </p>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="destructive"
                        className="w-full"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Account
                      </Button>
                    </DialogTrigger>

                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Are you absolutely sure?</DialogTitle>
                        <DialogDescription>
                          This action cannot be undone. This will permanently delete your account
                          and all associated data from our servers.
                        </DialogDescription>
                      </DialogHeader>

                      <DialogFooter className="mt-4">
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>

                        <Button
                          variant="destructive"
                          onClick={() => deleteAccountMutation.mutate()}
                          disabled={deleteAccountMutation.isPending}
                        >
                          {deleteAccountMutation.isPending ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                              Deleting...
                            </>
                          ) : "Delete Account"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You'll need to sign in again to access your account.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                <User size={20} />
              </div>
              <div>
                <p className="font-medium">{user?.fullName || user?.username || 'Customer'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogoutDialogOpen(false)}
              disabled={logoutMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLogout}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CustomerLayout>
  );
}
