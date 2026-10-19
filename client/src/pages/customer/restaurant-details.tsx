import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { useQuery } from "@tanstack/react-query";
import { Restaurant, MenuItem } from "@shared/schema";
import { useCart } from "@/contexts/cart-context";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MenuItemCard } from "@/components/ui/menu-item-card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MapPin,
  Clock,
  Star,
  Phone,
  Mail,
  AlertTriangle,
  ShoppingCart,
  ChevronLeft,
  Filter,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";

export default function CustomerRestaurantDetails() {
  const [match, params] = useRoute("/restaurants/:id");
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [dietaryFilters, setDietaryFilters] = useState({
    isVegetarian: false,
    isVegan: false,
    isHalal: false,
  });
  // Use cart context instead of local state
  const {
    items: cartItems,
    addItem,
    updateQuantity,
    getTotalItems,
    getTotalPrice,
  } = useCart();

  const restaurantId = params?.id ? parseInt(params.id) : 0;

  // Fetch restaurant data
  const { data: restaurant, isLoading: isLoadingRestaurant } =
    useQuery<Restaurant>({
      queryKey: ["/api/restaurants", restaurantId],
      queryFn: async () => {
        const res = await fetch(`/api/restaurants/${restaurantId}`);
        return res.json();
      },
      enabled: restaurantId > 0,
    });

  // Fetch menu items
  const { data: menuItems, isLoading: isLoadingMenu } = useQuery<MenuItem[]>({
    queryKey: ["/api/restaurants", restaurantId, "menu-items"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurants/${restaurantId}/menu-items`);
      return res.json();
    },
    enabled: restaurantId > 0,
  });

  // Get all categories from menu items
  const allCategories = React.useMemo(() => {
    const categories = new Set<string>();
    menuItems?.forEach((item) => {
      if (item.categories && item.categories.length > 0) {
        item.categories.forEach((cat) => categories.add(cat));
      }
    });
    return Array.from(categories);
  }, [menuItems]);

  // Filter menu items
  const filteredMenuItems = React.useMemo(() => {
    if (!menuItems) return [];

    return menuItems.filter((item) => {
      // Only show available items
      if (item.isAvailable === false) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !item.name.toLowerCase().includes(query) &&
          !(item.description && item.description.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      // Filter by category (tab)
      if (activeTab !== "all") {
        if (!item.categories || !item.categories.includes(activeTab)) {
          return false;
        }
      }

      // Filter by selected filters
      if (selectedFilters.length > 0) {
        const itemCategories = item.categories || [];

        if (
          !selectedFilters.some((filter) => itemCategories.includes(filter))
        ) {
          return false;
        }
      }

      // Filter by dietary preferences
      const dietaryInfo = (item.dietaryInfo as any) || {};
      if (dietaryFilters.isVegetarian && !dietaryInfo.isVegetarian)
        return false;
      if (dietaryFilters.isVegan && !dietaryInfo.isVegan) return false;
      if (dietaryFilters.isHalal && !dietaryInfo.isHalal) return false;

      return true;
    });
  }, [menuItems, searchQuery, activeTab, selectedFilters, dietaryFilters]);

  // Toggle filter selection
  const toggleFilter = (category: string) => {
    setSelectedFilters((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  };

  // Toggle dietary filter
  const toggleDietaryFilter = (key: keyof typeof dietaryFilters) => {
    setDietaryFilters((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Handle adding item to cart
  const handleAddToCart = (itemId: number) => {
    const menuItem = menuItems?.find((item) => item.id === itemId);
    if (menuItem) {
      addItem(menuItem);
    }
  };

  // Handle increasing item quantity
  const handleIncreaseQuantity = (itemId: number) => {
    const cartItem = cartItems.find((item) => item.menuItem.id === itemId);
    if (cartItem) {
      updateQuantity(itemId, cartItem.quantity + 1);
    } else {
      const menuItem = menuItems?.find((item) => item.id === itemId);
      if (menuItem) {
        addItem(menuItem);
      }
    }
  };

  // Handle decreasing item quantity
  const handleDecreaseQuantity = (itemId: number) => {
    const cartItem = cartItems.find((item) => item.menuItem.id === itemId);
    if (cartItem) {
      updateQuantity(itemId, cartItem.quantity - 1);
    }
  };

  // Calculate cart totals - use methods from cart context
  const cartTotal = getTotalPrice();
  const cartItemCount = getTotalItems();

  // Handle go to cart
  const handleGoToCart = () => {
    // TODO: Implement cart page navigation
    console.log("Go to cart with items:", cartItems);
    setLocation("/cart");
  };

  // Handle back button
  const handleBack = () => {
    setLocation("/");
  };

  // Loading state
  if (isLoadingRestaurant) {
    return (
      <CustomerLayout transparentHeader>
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </CustomerLayout>
    );
  }

  // Handle not found
  if (!restaurant) {
    return (
      <CustomerLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
          <h1 className="text-2xl font-bold mb-2">Restaurant Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The restaurant you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={handleBack}>Back to Restaurants</Button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout transparentHeader>
      {/* Restaurant Banner */}
      <div
        className="w-full h-64 bg-cover bg-center relative"
        style={{
          backgroundImage: `url(${restaurant.bannerUrl || "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3"})`,
        }}
      >
        <div className="absolute inset-0 bg-primary/60" />
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 left-4 text-white bg-black/20 hover:bg-black/40"
            onClick={handleBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <h1 className="text-3xl font-bold text-white mb-2">
            {restaurant.name}
          </h1>

          <div className="flex flex-wrap gap-2 mb-2">
            {restaurant.categories?.map((category, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30"
              >
                {category}
              </Badge>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 text-white/90 text-sm">


            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>
                {restaurant.openingTime || "9:00"} -{" "}
                {restaurant.closingTime || "21:00"}
              </span>
            </div>

            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span className="truncate max-w-xs">{restaurant.address}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Restaurant Info */}
      <div className="bg-white shadow-md rounded-b-lg mb-6">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center">
                <Phone className="h-4 w-4 text-muted-foreground mr-2" />
                <span>{restaurant.phone}</span>
              </div>

              <div className="flex items-center">
                <Mail className="h-4 w-4 text-muted-foreground mr-2" />
                <span>{restaurant.email}</span>
              </div>
            </div>


          </div>
        </div>
      </div>

      {/* Menu Filters and Search */}
      <div className="container mx-auto px-4 mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search menu items..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter
                {(selectedFilters.length > 0 ||
                  Object.values(dietaryFilters).some(Boolean)) && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-primary text-white"
                  >
                    {selectedFilters.length +
                      Object.values(dietaryFilters).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Menu</SheetTitle>
                <SheetDescription>Customize your menu view</SheetDescription>
              </SheetHeader>

              <div className="py-4 space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((category) => (
                      <Badge
                        key={category}
                        variant={
                          selectedFilters.includes(category)
                            ? "default"
                            : "outline"
                        }
                        className="cursor-pointer"
                        onClick={() => toggleFilter(category)}
                      >
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Dietary Preferences</h3>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isVegetarian"
                        checked={dietaryFilters.isVegetarian}
                        onCheckedChange={() =>
                          toggleDietaryFilter("isVegetarian")
                        }
                      />
                      <label
                        htmlFor="isVegetarian"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Vegetarian
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isVegan"
                        checked={dietaryFilters.isVegan}
                        onCheckedChange={() => toggleDietaryFilter("isVegan")}
                      />
                      <label
                        htmlFor="isVegan"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Vegan
                      </label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isHalal"
                        checked={dietaryFilters.isHalal}
                        onCheckedChange={() => toggleDietaryFilter("isHalal")}
                      />
                      <label
                        htmlFor="isHalal"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Halal
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <SheetFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedFilters([]);
                    setDietaryFilters({
                      isVegetarian: false,
                      isVegan: false,
                      isHalal: false,
                    });
                  }}
                >
                  Clear All
                </Button>
                <SheetClose asChild>
                  <Button>Apply Filters</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Menu Tabs and Items */}
      <div className="container mx-auto px-4 mb-24">
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto">
            <TabsList className="mb-6 h-auto p-1 w-full justify-start">
              <TabsTrigger value="all" className="px-4 py-2">
                All Items
              </TabsTrigger>
              {allCategories.map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="px-4 py-2"
                >
                  {category}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {isLoadingMenu ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="h-64 animate-pulse bg-gray-100 rounded-lg"
                ></div>
              ))}
            </div>
          ) : filteredMenuItems.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenuItems.map((item) => {
                const cartItem = cartItems.find(
                  (ci) => ci.menuItem.id === item.id,
                );
                const inCart = !!cartItem;
                const cartQuantity = cartItem?.quantity || 0;

                return (
                  <MenuItemCard
                    key={item.id}
                    id={item.id}
                    name={item.name}
                    description={item.description}
                    price={item.price}
                    discountedPrice={item.discountedPrice}
                    imageUrl={
                      item.imageUrl ||
                      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3"
                    }
                    isAvailable={
                      item.isAvailable === null ? true : !!item.isAvailable
                    }
                    categories={item.categories || []}
                    dietaryInfo={
                      (item.dietaryInfo as any) || {
                        isVegan: false,
                        isVegetarian: false,
                        isHalal: false,
                      }
                    }
                    isRestaurantView={false}
                    onAddToCart={() => handleAddToCart(item.id)}
                    inCart={inCart}
                    cartQuantity={cartQuantity}
                    onIncreaseQuantity={() => handleIncreaseQuantity(item.id)}
                    onDecreaseQuantity={() => handleDecreaseQuantity(item.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-xl font-semibold mb-2">No items found</p>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search criteria
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFilters([]);
                  setDietaryFilters({
                    isVegetarian: false,
                    isVegan: false,
                    isHalal: false,
                  });
                  setActiveTab("all");
                }}
              >
                Clear All Filters
              </Button>
            </div>
          )}
        </Tabs>
      </div>

      {/* Cart Button (fixed at bottom) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 bg-white shadow-md border-t p-4 pb-10">
          <div className="container mx-auto">
            <Button className="w-full" size="lg" onClick={handleGoToCart}>
              <ShoppingCart className="mr-2 h-5 w-5" />
              View Cart ({cartItemCount}{" "}
              {cartItemCount === 1 ? "item" : "items"}) •{" "}
              {formatCurrency(cartTotal)}
            </Button>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}
