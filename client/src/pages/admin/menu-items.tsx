import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { MenuItem, InsertMenuItem, Restaurant } from "@shared/schema";
import { formatCurrency } from "@/lib/utils";
import { Plus, ArrowLeft, Edit, Trash2, Tag, UtensilsCrossed, CircleOff, CircleCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Form validation schema
const menuItemFormSchema = z.object({
  name: z.string().min(3, "Menu item name must be at least 3 characters"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  discountedPrice: z.coerce.number().min(0, "Discounted price cannot be negative").optional().nullable(),
  categories: z.array(z.string()).default([]),
  restaurantId: z.coerce.number(),
  imageUrl: z.string().url("Please enter a valid URL").optional().nullable(),
  isAvailable: z.boolean().default(true),
  dietaryInfo: z.any().optional(),
});

type MenuItemFormValues = z.infer<typeof menuItemFormSchema>;

export default function AdminMenuItems() {
  const { toast } = useToast();
  const search = useSearch();
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(search);
  const restaurantId = params.get('restaurant') ? parseInt(params.get('restaurant')!) : null;

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editMenuItem, setEditMenuItem] = useState<MenuItem | null>(null);

  // Fetch restaurants (for the filter dropdown)
  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants"],
  });

  // Fetch menu items
  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: restaurantId ? ["/api/menu-items", restaurantId] : ["/api/menu-items"],
    queryFn: async () => {
      const url = restaurantId
        ? `/api/restaurants/${restaurantId}/menu-items`
        : "/api/menu-items";
      const res = await fetch(url);
      return res.json();
    },
  });

  // Get current restaurant name
  const currentRestaurant = restaurants?.find(r => r.id === restaurantId);

  // Create menu item mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertMenuItem) => {
      const res = await apiRequest("POST", `/api/restaurants/${data.restaurantId}/menu-items`, data);
      return await res.json();
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items", restaurantId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      }
      toast({
        title: "Menu item created",
        description: "The menu item has been created successfully",
      });
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to create menu item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update menu item mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItem> }) => {
      const res = await apiRequest("PATCH", `/api/menu-items/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items", restaurantId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      }
      toast({
        title: "Menu item updated",
        description: "The menu item has been updated successfully",
      });
      setEditMenuItem(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update menu item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete menu item mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/menu-items/${id}`);
      return res.ok;
    },
    onSuccess: () => {
      if (restaurantId) {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items", restaurantId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      }
      toast({
        title: "Menu item deleted",
        description: "The menu item has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete menu item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form for creating/editing menu item
  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      discountedPrice: null,
      categories: [],
      restaurantId: restaurantId || 0,
      imageUrl: null,
      isAvailable: true,
      dietaryInfo: {},
    },
  });

  // Update form default values when restaurant ID changes
  useEffect(() => {
    if (restaurantId) {
      form.setValue('restaurantId', restaurantId);
    }
  }, [restaurantId, form]);

  // Prepare form for editing
  const handleEdit = (menuItem: MenuItem) => {
    form.reset({
      name: menuItem.name,
      description: menuItem.description || "",
      price: menuItem.price,
      discountedPrice: menuItem.discountedPrice,
      categories: menuItem.categories || [],
      restaurantId: menuItem.restaurantId,
      imageUrl: menuItem.imageUrl,
      isAvailable: menuItem.isAvailable,
      dietaryInfo: menuItem.dietaryInfo || {},
    });
    setEditMenuItem(menuItem);
  };

  // Handle form submission
  const onSubmit = (values: MenuItemFormValues) => {
    if (editMenuItem) {
      updateMutation.mutate({ id: editMenuItem.id, data: values });
    } else {
      createMutation.mutate(values as InsertMenuItem);
    }
  };

  return (
    <AdminLayout
      title={restaurantId && currentRestaurant ? `Menu Items - ${currentRestaurant.name}` : "Menu Items"}
      description={restaurantId && currentRestaurant ? `Manage menu items for ${currentRestaurant.name}` : "Manage menu items across all restaurants"}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          {restaurantId && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 mr-2"
              onClick={() => setLocation('/admin/restaurants')}
            >
              <ArrowLeft size={16} /> Back to Restaurants
            </Button>
          )}
          <div>
            <h2 className="text-xl font-bold">
              {restaurantId && currentRestaurant ? `${currentRestaurant.name} Menu` : "All Menu Items"}
            </h2>
          </div>
        </div>

        {/* Filter by restaurant */}
        {!restaurantId && restaurants && restaurants.length > 0 && (
          <div className="w-full sm:w-auto">
            <Select
              onValueChange={(value) => setLocation(`/admin/menu-items?restaurant=${value}`)}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue placeholder="Filter by restaurant" />
              </SelectTrigger>
              <SelectContent>
                {restaurants.map((restaurant) => (
                  <SelectItem key={restaurant.id} value={restaurant.id.toString()}>
                    {restaurant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Menu Item
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="animate-pulse">
              <div className="h-40 bg-gray-200"></div>
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="flex gap-2 mt-4">
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : menuItems && menuItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {menuItems.map((menuItem) => (
            <Card key={menuItem.id} className="overflow-hidden border">
              {menuItem.imageUrl ? (
                <div className="h-40 overflow-hidden">
                  <img
                    src={menuItem.imageUrl}
                    alt={menuItem.name}
                    className="w-full h-full object-cover transition-transform hover:scale-105"
                  />
                </div>
              ) : (
                <div className="h-40 bg-gray-100 flex items-center justify-center text-gray-400">
                  <UtensilsCrossed size={48} />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-lg truncate">{menuItem.name}</h3>
                  {!menuItem.isAvailable && (
                    <Badge variant="outline" className="text-red-500 border-red-200 ml-2 whitespace-nowrap">
                      <CircleOff size={14} className="mr-1" /> Not Available
                    </Badge>
                  )}
                </div>

                {menuItem.description && (
                  <p className="text-sm text-gray-500 mb-2 line-clamp-2">{menuItem.description}</p>
                )}

                <div className="flex flex-wrap gap-1 mb-3">
                  {menuItem.categories && menuItem.categories.map((category, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Tag size={10} className="mr-1" /> {category}
                    </Badge>
                  ))}
                </div>

                <div className="flex justify-between items-center">
                  <div>
                    {menuItem.discountedPrice ? (
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-primary">
                          {formatCurrency(menuItem.discountedPrice)}
                        </span>
                        <span className="text-sm text-gray-500 line-through">
                          {formatCurrency(menuItem.price)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold">
                        {formatCurrency(menuItem.price)}
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(menuItem)}
                    >
                      <Edit size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete "${menuItem.name}"?`)) {
                          deleteMutation.mutate(menuItem.id);
                        }
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mb-2">No menu items found</CardTitle>
            <p className="text-center text-muted-foreground mb-4">
              {restaurantId
                ? "This restaurant doesn't have any menu items yet."
                : "There are no menu items available. Select a restaurant or add a new menu item."}
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add Menu Item
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Menu Item Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Menu Item</DialogTitle>
            <DialogDescription>
              Enter the menu item details to add it to the restaurant.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!restaurantId && (
                <FormField
                  control={form.control}
                  name="restaurantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a restaurant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {restaurants?.map((restaurant) => (
                            <SelectItem key={restaurant.id} value={restaurant.id.toString()}>
                              {restaurant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Menu item name" {...field} />
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
                      <Textarea placeholder="Item description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₱)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountedPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discounted Price (₱) (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Available</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Whether the item is available for ordering
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
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <div className="flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                      Saving...
                    </div>
                  ) : (
                    `${editMenuItem ? "Update" : "Save"} Menu Item`
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Menu Item Dialog */}
      <Dialog open={editMenuItem !== null} onOpenChange={(open) => !open && setEditMenuItem(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the menu item details.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {!restaurantId && (
                <FormField
                  control={form.control}
                  name="restaurantId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value.toString()}
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a restaurant" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {restaurants?.map((restaurant) => (
                            <SelectItem key={restaurant.id} value={restaurant.id.toString()}>
                              {restaurant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Menu item name" {...field} />
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
                      <Textarea placeholder="Item description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (₱)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="discountedPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discounted Price (₱) (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0"
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : null)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isAvailable"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Available</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Whether the item is available for ordering
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
                <Button
                  variant="outline"
                  onClick={() => setEditMenuItem(null)}
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <div className="flex items-center">
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                      Updating...
                    </div>
                  ) : (
                    "Update Menu Item"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
