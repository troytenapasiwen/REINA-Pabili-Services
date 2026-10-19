import { useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RestaurantCard } from "@/components/ui/restaurant-card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Restaurant, InsertRestaurant } from "@shared/schema";
import { Plus, Store, Utensils, MapPin, Clock, Mail, Phone, Info, Tag, Check, X, Download, Image, Filter, Search } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { useLocation } from "wouter";
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
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleMap, Marker, LoadScript } from "@react-google-maps/api";
import { ExportButton } from "@/components/admin/export-button";

// Form validation schema
const restaurantFormSchema = z.object({
  name: z.string().min(3, "Restaurant name must be at least 3 characters"),
  description: z.string().optional(),
  address: z.string().min(10, "Please enter a valid address"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email"),
  logoUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  bannerUrl: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  userId: z.number().optional(),
  isActive: z.boolean().default(true),
  categories: z.array(z.string()).default([]),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
});

type RestaurantFormValues = z.infer<typeof restaurantFormSchema>;

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '0.5rem',
};

// Default center (Manila, Philippines)
const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

export default function AdminRestaurants() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editRestaurant, setEditRestaurant] = useState<Restaurant | null>(null);
  const [viewRestaurant, setViewRestaurant] = useState<Restaurant | null>(null);
  const [deleteRestaurant, setDeleteRestaurant] = useState<Restaurant | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [approvalFilter, setApprovalFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [, setLocation] = useLocation();

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Fetch restaurants
  const { data: restaurants, isLoading } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Create restaurant mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertRestaurant) => {
      const res = await apiRequest("POST", "/api/restaurants", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      toast({
        title: "Restaurant created",
        description: "The restaurant has been created successfully",
      });
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create restaurant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update restaurant mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Restaurant> }) => {
      const res = await apiRequest("PATCH", `/api/restaurants/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      toast({
        title: "Restaurant updated",
        description: "The restaurant has been updated successfully",
      });
      setEditRestaurant(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update restaurant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Approve restaurant mutation
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/restaurants/${id}/approval`, { isApproved: true });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      toast({
        title: "Restaurant approved",
        description: "The restaurant has been approved and is now visible to customers",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to approve restaurant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete restaurant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/restaurants/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      toast({
        title: "Restaurant removed",
        description: "The restaurant has been successfully removed from the platform",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to remove restaurant",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form for creating/editing restaurant
  const form = useForm<RestaurantFormValues>({
    resolver: zodResolver(restaurantFormSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      phone: "",
      email: "",
      isActive: true,
      categories: [],
    },
  });

  // Prepare form for editing
  const handleEdit = (restaurant: Restaurant) => {
    form.reset({
      name: restaurant.name,
      description: restaurant.description || "",
      address: restaurant.address,
      phone: restaurant.phone,
      email: restaurant.email,
      isActive: !!restaurant.isActive,
      categories: restaurant.categories || [],
      openingTime: restaurant.openingTime || "",
      closingTime: restaurant.closingTime || "",
      userId: restaurant.userId,
    });
    setEditRestaurant(restaurant);
  };

  // Handle form submission
  const onSubmit = (values: RestaurantFormValues) => {
    if (editRestaurant) {
      updateMutation.mutate({ id: editRestaurant.id, data: values });
    } else {
      createMutation.mutate(values as InsertRestaurant);
    }
  };

  // Restaurant Excel export configuration
  const exportConfig = {
    headers: [
      "ID",
      "Name",
      "Address",
      "Phone",
      "Email",
      "Status",
      "Categories",
      "Opening Time",
      "Closing Time",
      "Delivery Fee",
      "Created At"
    ],
    rowMapping: (restaurant: Restaurant) => [
      restaurant.id.toString(),
      restaurant.name,
      restaurant.address,
      restaurant.phone,
      restaurant.email,
      restaurant.isActive ? "Active" : "Inactive",
      restaurant.categories ? restaurant.categories.join(", ") : "",
      restaurant.openingTime || "N/A",
      restaurant.closingTime || "N/A",
      restaurant.deliveryFee ? `₱${restaurant.deliveryFee.toFixed(2)}` : "N/A",
      restaurant.createdAt ? new Date(restaurant.createdAt).toLocaleString() : "N/A"
    ],
    columnWidths: [5, 30, 40, 15, 25, 10, 25, 15, 15, 15, 20]
  };

  // Filter restaurants based on status, approval, and search query
  const filteredRestaurants = restaurants?.filter(restaurant => {
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && restaurant.isActive) ||
      (statusFilter === "inactive" && !restaurant.isActive);

    const matchesApproval = approvalFilter === "all" ||
      (approvalFilter === "approved" && restaurant.isApproved) ||
      (approvalFilter === "pending" && !restaurant.isApproved);

    const matchesSearch = searchQuery === "" ||
      restaurant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      restaurant.categories?.some(cat => cat.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesApproval && matchesSearch;
  });

  return (
    <AdminLayout title="Restaurant Management" description="Manage restaurants on the platform">
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">All Restaurants</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search restaurants by name, address, email, phone, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter dropdowns */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Approval</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          {restaurants && restaurants.length > 0 && (
            <ExportButton
              data={filteredRestaurants || restaurants}
              filename="restaurants-report"
              headers={exportConfig.headers}
              rowMapping={exportConfig.rowMapping}
              columnWidths={exportConfig.columnWidths}
            />
          )}
          {/* Removed Dialog for adding restaurant */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Restaurant</DialogTitle>
                <DialogDescription>
                  Enter the restaurant details to add it to the platform.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Restaurant description" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Email address" {...field} />
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
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input placeholder="Phone number" {...field} />
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
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Restaurant address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="openingTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Opening Time</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 9:00 AM" {...field} />
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
                            <Input placeholder="e.g. 9:00 PM" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Active Status</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            Whether the restaurant is active on the platform
                          </p>
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
                  <DialogFooter>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Restaurant"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : filteredRestaurants && filteredRestaurants.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              id={restaurant.id}
              name={restaurant.name}
              imageUrl={restaurant.bannerUrl || "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3"}
              categories={restaurant.categories || ["Restaurant"]}
              rating={4.5}
              reviewCount={0}
              isActive={restaurant.isActive || false}
              isApproved={restaurant.isApproved || false}
              deliveryFee={restaurant.deliveryFee || 0}
              deliveryTime={`${30}-${45} min`}
              onView={() => setViewRestaurant(restaurant)}
              onEdit={() => handleEdit(restaurant)}
              onDelete={() => deleteMutation.mutate(restaurant.id)}
              onApprove={() => approveMutation.mutate(restaurant.id)}
              isAdmin={true}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Store className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mb-2">No restaurants found</CardTitle>
            <p className="text-center text-muted-foreground mb-4">
              {restaurants && restaurants.length > 0
                ? "No restaurants match the selected filters. Try adjusting your filter criteria."
                : "There are no restaurants registered on the platform yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Edit Restaurant Dialog */}
      <Dialog open={editRestaurant !== null} onOpenChange={(open) => !open && setEditRestaurant(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Restaurant</DialogTitle>
            <DialogDescription>
              Update the restaurant details. Modified information will be saved when you click update.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
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
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Restaurant description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email address" {...field} />
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
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
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
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Restaurant address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="openingTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Opening Time</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. 9:00 AM" {...field} value={field.value || ""} />
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
                        <Input placeholder="e.g. 9:00 PM" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Whether the restaurant is active on the platform
                      </p>
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
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Restaurant"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Restaurant Details Dialog */}
      <Dialog open={viewRestaurant !== null} onOpenChange={(open) => !open && setViewRestaurant(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Restaurant Details</DialogTitle>
            <DialogDescription>
              View detailed information about the restaurant.
            </DialogDescription>
          </DialogHeader>

          {viewRestaurant && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold flex items-center">
                  <Store className="h-5 w-5 mr-2" />
                  {viewRestaurant.name}
                </h3>
                {viewRestaurant.description && (
                  <p className="text-sm text-muted-foreground mt-1">{viewRestaurant.description}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">{viewRestaurant.address}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Mail className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{viewRestaurant.email}</p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Phone className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{viewRestaurant.phone}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-start">
                    <Clock className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Opening Hours</p>
                      <p className="text-sm text-muted-foreground">
                        {viewRestaurant.openingTime && viewRestaurant.closingTime
                          ? `${viewRestaurant.openingTime} - ${viewRestaurant.closingTime}`
                          : "Not specified"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start">
                    <Tag className="h-4 w-4 mr-2 mt-1 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Categories</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {viewRestaurant.categories && viewRestaurant.categories.length > 0
                          ? viewRestaurant.categories.map((category, index) => (
                              <Badge key={index} variant="secondary">{category}</Badge>
                            ))
                          : <p className="text-sm text-muted-foreground">No categories</p>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <Info className="h-4 w-4 mr-2 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <Badge variant={viewRestaurant.isActive ? "default" : "outline"}>
                        {viewRestaurant.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2">Location</h4>
                {viewRestaurant.latitude && viewRestaurant.longitude && !isLoadingMapsKey && mapsData?.key ? (
                  <LoadScript googleMapsApiKey={mapsData.key}>
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={{ lat: viewRestaurant.latitude, lng: viewRestaurant.longitude }}
                      zoom={15}
                    >
                      <Marker
                        position={{ lat: viewRestaurant.latitude, lng: viewRestaurant.longitude }}
                        title={viewRestaurant.name}
                      />
                    </GoogleMap>
                  </LoadScript>
                ) : (
                  <div className="h-[300px] w-full rounded-md bg-muted flex items-center justify-center">
                    <p className="text-sm text-muted-foreground">No location data available</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleEdit(viewRestaurant)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => {
                  setDeleteRestaurant(viewRestaurant);
                  setViewRestaurant(null);
                }}>
                  Delete
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteRestaurant !== null} onOpenChange={(open) => !open && setDeleteRestaurant(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Restaurant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this restaurant? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteRestaurant && (
            <div className="py-4">
              <div className="rounded-lg border p-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  <Store className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{deleteRestaurant.name}</p>
                    <p className="text-sm text-muted-foreground">{deleteRestaurant.address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> Deleting this restaurant will:
                </p>
                <ul className="text-sm text-destructive mt-2 space-y-1 ml-4">
                  <li>• Remove all menu items</li>
                  <li>• Cancel active orders</li>
                  <li>• Delete all restaurant data permanently</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteRestaurant(null)}
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteRestaurant) {
                  deleteMutation.mutate(deleteRestaurant.id);
                  setDeleteRestaurant(null);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Restaurant"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
