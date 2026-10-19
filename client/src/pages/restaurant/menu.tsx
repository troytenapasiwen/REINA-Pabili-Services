import React, { useState } from "react";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MenuItem, InsertMenuItem } from "@shared/schema";
import { Plus, Tag, Image } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form validation schema
const menuItemFormSchema = z.object({
  name: z.string().min(3, "Item name must be at least 3 characters"),
  description: z.string().min(10, "Please provide a detailed description"),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  discountedPrice: z.coerce.number().min(0, "Discounted price cannot be negative").optional(),
  restaurantId: z.number(),
  imageUrl: z.string().optional(),
  isAvailable: z.boolean().default(true),
  categories: z.array(z.string()).default([]),
  dietaryInfo: z.object({
    isVegan: z.boolean().default(false),
    isVegetarian: z.boolean().default(false),
    isHalal: z.boolean().default(false),
  }).default({}),
});

export default function RestaurantMenu() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  // We don't need the restaurantId query anymore since we're using the restaurant data directly

  // Get restaurant data for the logged-in user
  const { data: restaurant } = useQuery<any>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // Fetch menu items for this restaurant using the direct restaurant ID endpoint
  const { data: menuItems, isLoading } = useQuery<MenuItem[]>({
    queryKey: [restaurant?.id ? `/api/restaurants/${restaurant.id}/menu-items` : ''],
    enabled: !!user?.id && !!restaurant?.id,
  });

  // Fetch categories
  const categories = React.useMemo(() => {
    const allCategories = new Set<string>();
    menuItems?.forEach(item => {
      item.categories?.forEach(cat => allCategories.add(cat));
    });
    return Array.from(allCategories);
  }, [menuItems]);

  // Filter menu items
  const filteredItems = React.useMemo(() => {
    return menuItems?.filter(item => {
      const matchesCategory = categoryFilter === "all" ||
        (item.categories && item.categories.includes(categoryFilter));

      const matchesAvailability = availabilityFilter === "all" ||
        (availabilityFilter === "available" && item.isAvailable) ||
        (availabilityFilter === "unavailable" && !item.isAvailable);

      return matchesCategory && matchesAvailability;
    }) || [];
  }, [menuItems, categoryFilter, availabilityFilter]);

  // Create menu item mutation
  const createMenuItemMutation = useMutation({
    mutationFn: async (data: InsertMenuItem) => {
      const res = await apiRequest("POST", "/api/menu-items", data);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate the restaurant's menu items
      if (restaurant?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurant.id}/menu-items`] });
      }
      toast({
        title: "Menu item created",
        description: "The menu item has been added successfully",
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
  const updateMenuItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<MenuItem> }) => {
      const res = await apiRequest("PATCH", `/api/menu-items/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate the restaurant's menu items
      if (restaurant?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurant.id}/menu-items`] });
      }
      toast({
        title: "Menu item updated",
        description: "The menu item has been updated successfully",
      });
      setEditItem(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update menu item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Toggle availability mutation
  const toggleAvailabilityMutation = useMutation({
    mutationFn: async (id: number) => {
      const item = menuItems?.find(i => i.id === id);
      if (!item) throw new Error("Item not found");

      const res = await apiRequest("PATCH", `/api/menu-items/${id}`, {
        isAvailable: !item.isAvailable
      });
      return await res.json();
    },
    onSuccess: () => {
      // Invalidate the restaurant's menu items
      if (restaurant?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/restaurants/${restaurant.id}/menu-items`] });
      }
      toast({
        title: "Availability updated",
        description: "The menu item availability has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update availability",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form for creating/editing menu item
  const form = useForm<z.infer<typeof menuItemFormSchema>>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      discountedPrice: undefined,
      restaurantId: restaurant?.id || 0,
      imageUrl: "",
      isAvailable: true,
      categories: [],
      dietaryInfo: {
        isVegan: false,
        isVegetarian: false,
        isHalal: false,
      }
    },
  });

  // Update form values when restaurant ID is fetched
  React.useEffect(() => {
    if (restaurant?.id) {
      form.setValue("restaurantId", restaurant.id);
    }
  }, [restaurant, form]);

  // Prepare form for editing
  const handleEdit = (item: MenuItem) => {
    // Parse dietaryInfo safely
    const dietaryInfo = (typeof item.dietaryInfo === 'object' && item.dietaryInfo !== null)
      ? item.dietaryInfo as { isVegan?: boolean; isVegetarian?: boolean; isHalal?: boolean; }
      : {};

    form.reset({
      name: item.name,
      description: item.description || "",
      price: item.price,
      discountedPrice: item.discountedPrice || undefined,
      restaurantId: item.restaurantId,
      imageUrl: item.imageUrl || "",
      isAvailable: item.isAvailable ?? true,
      categories: item.categories || [],
      dietaryInfo: {
        isVegan: dietaryInfo.isVegan || false,
        isVegetarian: dietaryInfo.isVegetarian || false,
        isHalal: dietaryInfo.isHalal || false,
      }
    });
    setEditItem(item);
  };

  // Handle availability toggle
  const handleToggleAvailability = (id: number) => {
    toggleAvailabilityMutation.mutate(id);
  };

  // Reset form when opening create dialog
  const handleOpenCreateDialog = () => {
    form.reset({
      name: "",
      description: "",
      price: 0,
      discountedPrice: undefined,
      restaurantId: restaurant?.id || 0,
      imageUrl: "",
      isAvailable: true,
      categories: [],
      dietaryInfo: {
        isVegan: false,
        isVegetarian: false,
        isHalal: false,
      }
    });
    setCreateDialogOpen(true);
  };

  // Handle form submission
  const onSubmit = (values: z.infer<typeof menuItemFormSchema>) => {
    // The form already has dietaryInfo with the right structure
    if (editItem) {
      updateMenuItemMutation.mutate({
        id: editItem.id,
        data: values
      });
    } else {
      createMenuItemMutation.mutate(values as InsertMenuItem);
    }
  };

  return (
    <RestaurantLayout title="Menu Management" description="Manage your restaurant's menu items">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Menu Items</h2>
          <p className="text-muted-foreground text-sm">
            Manage and organize your restaurant's offerings
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={availabilityFilter} onValueChange={setAvailabilityFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Availability" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="unavailable">Unavailable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Dialog>
            <DialogTrigger asChild>
              <Button onClick={handleOpenCreateDialog}>
                <Plus className="mr-2 h-4 w-4" /> Add Menu Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] w-[95vw] sm:w-full overflow-y-auto p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle>{editItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
                <DialogDescription>
                  {editItem
                    ? "Update the details of this menu item."
                    : "Enter the details of the new menu item to add it to your menu."}
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Item Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Chicken Adobo" {...field} />
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
                            placeholder="Describe the menu item..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                          <FormLabel>Discounted Price (₱)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Optional"
                              {...field}
                              value={field.value || ""}
                              onChange={(e) => {
                                const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormDescription>
                            Leave empty if no discount
                          </FormDescription>
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
                        <FormLabel className="flex items-center gap-2">
                          <Image className="h-4 w-4" />
                          Menu Item Image
                        </FormLabel>
                        <FormControl>
                          <ImageUpload
                            value={field.value || ""}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            placeholder="https://example.com/menu-item.jpg"
                            accept="image/*"
                            maxSizeMessage="Menu Item: Maximum 5MB (JPG, PNG, WebP)"
                          />
                        </FormControl>
                        <FormDescription>
                          Upload or provide a URL for the menu item image. Recommended size: 800x600px
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <FormField
                      control={form.control}
                      name="categories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Categories</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Appetizer, Main Dish, Dessert, etc."
                              value={field.value?.join(', ') || ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                const categories = value.split(',').map(cat => cat.trim()).filter(Boolean);
                                field.onChange(categories);
                              }}
                            />
                          </FormControl>
                          <FormDescription>Separate categories with commas</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isAvailable"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Available</FormLabel>
                            <FormDescription>
                              Whether this item is available for order
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
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <h3 className="font-medium text-sm">Dietary Information</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                      <FormField
                        control={form.control}
                        name="dietaryInfo.isVegan"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between space-x-2">
                            <FormLabel>Vegan</FormLabel>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dietaryInfo.isVegetarian"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between space-x-2">
                            <FormLabel>Vegetarian</FormLabel>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="dietaryInfo.isHalal"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between space-x-2">
                            <FormLabel>Halal</FormLabel>
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      disabled={createMenuItemMutation.isPending || updateMenuItemMutation.isPending}
                    >
                      {createMenuItemMutation.isPending || updateMenuItemMutation.isPending ? (
                        <div className="flex items-center">
                          <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                          {editItem ? "Updating..." : "Saving..."}
                        </div>
                      ) : (
                        editItem ? "Update Item" : "Save Item"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Edit Menu Item Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] w-[95vw] sm:w-full overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Edit Menu Item</DialogTitle>
            <DialogDescription>
              Update the details of this menu item.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Item Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Chicken Adobo" {...field} />
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
                        placeholder="Describe the menu item..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
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
                      <FormLabel>Discounted Price (₱)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Optional"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value === "" ? undefined : parseFloat(e.target.value);
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Leave empty if no discount
                      </FormDescription>
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
                    <FormLabel className="flex items-center gap-2">
                      <Image className="h-4 w-4" />
                      Menu Item Image
                    </FormLabel>
                    <FormControl>
                      <ImageUpload
                        value={field.value || ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        placeholder="https://example.com/menu-item.jpg"
                        accept="image/*"
                        maxSizeMessage="Menu Item: Maximum 5MB (JPG, PNG, WebP)"
                      />
                    </FormControl>
                    <FormDescription>
                      Upload or provide a URL for the menu item image. Recommended size: 800x600px
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <FormField
                  control={form.control}
                  name="categories"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categories</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Appetizer, Main Dish, Dessert, etc."
                          value={field.value?.join(', ') || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const categories = value.split(',').map(cat => cat.trim()).filter(Boolean);
                            field.onChange(categories);
                          }}
                        />
                      </FormControl>
                      <FormDescription>Separate categories with commas</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isAvailable"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Available</FormLabel>
                        <FormDescription>
                          Whether this item is available for order
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
              </div>

              <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-medium text-sm">Dietary Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  <FormField
                    control={form.control}
                    name="dietaryInfo.isVegan"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-2">
                        <FormLabel>Vegan</FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dietaryInfo.isVegetarian"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-2">
                        <FormLabel>Vegetarian</FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dietaryInfo.isHalal"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-2">
                        <FormLabel>Halal</FormLabel>
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMenuItemMutation.isPending}
                >
                  {updateMenuItemMutation.isPending ? "Updating..." : "Update Item"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={categoryFilter === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setCategoryFilter("all")}
          >
            All
          </Badge>
          {categories.map((category) => (
            <Badge
              key={category}
              variant={categoryFilter === category ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategoryFilter(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, index) => (
            <Card key={index} className="h-72 animate-pulse">
              <div className="h-32 bg-gray-200"></div>
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
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <MenuItemCard
              key={item.id}
              id={item.id}
              name={item.name}
              description={item.description}
              price={item.price}
              discountedPrice={item.discountedPrice}
              imageUrl={item.imageUrl || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3"}
              categories={item.categories || []}
              isAvailable={item.isAvailable ?? true}
              dietaryInfo={item.dietaryInfo ? item.dietaryInfo : {
                isVegan: false,
                isVegetarian: false,
                isHalal: false,
              }}
              isRestaurantView={true}
              onEdit={() => handleEdit(item)}
              onDelete={() => handleToggleAvailability(item.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <Tag className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="mb-2">No menu items found</CardTitle>
            {categoryFilter !== "all" ? (
              <p className="text-center text-muted-foreground mb-4">
                There are no menu items in the selected category.
              </p>
            ) : (
              <p className="text-center text-muted-foreground mb-4">
                Start adding items to build your restaurant's menu.
              </p>
            )}
            <Button onClick={handleOpenCreateDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add First Menu Item
            </Button>
          </CardContent>
        </Card>
      )}
    </RestaurantLayout>
  );
}
