import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import CustomerLayout from "@/layouts/CustomerLayout";
import { useQuery } from "@tanstack/react-query";
import { Restaurant, MenuItem } from "@shared/schema";
import { useCart } from "@/contexts/cart-context";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Bike,
  Minus,
  Plus,
  SearchX,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

/*
  Reina Pabili brand tokens (same as auth-page.tsx):
    yellow #FFD527, orange #F76043, charcoal #282828.
  Square corners, 2px charcoal outlines, hard offset shadows. Text on orange is charcoal for contrast.
*/
const inputClass =
  "h-12 rounded-none border-2 border-[#282828] bg-white pl-11 pr-4 text-base placeholder:text-gray-500 focus-visible:border-[#282828] focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2";
const buttonBase =
  "h-12 rounded-none border-2 border-[#282828] text-base font-bold text-[#282828] transition-all motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 disabled:opacity-60";
const hardShadow =
  "shadow-[4px_4px_0_0_#282828] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#282828] active:translate-x-1 active:translate-y-1 active:shadow-none";
const primaryButtonClass = `${buttonBase} ${hardShadow} bg-[#F76043] hover:bg-[#FF7154]`;
const secondaryButtonClass = `${buttonBase} ${hardShadow} bg-[#FFD527] hover:bg-[#FFE066]`;
const plainButtonClass = `${buttonBase} bg-white px-5 hover:bg-gray-100`;
const chipBase =
  "shrink-0 border-2 border-[#282828] px-3.5 py-1.5 text-sm font-bold text-[#282828] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2";
const chipClass = (active: boolean) =>
  `${chipBase} ${active ? "bg-[#F76043]" : "bg-white hover:bg-[#FFD527]"}`;

const FALLBACK_BANNER = "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3";
const FALLBACK_FOOD = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3";

// Customer-facing menu item row. Presentation only: all cart actions are passed in from the page.
function MenuTile({
  item,
  cartQuantity,
  onAdd,
  onIncrease,
  onDecrease,
}: {
  item: MenuItem;
  cartQuantity: number;
  onAdd: () => void;
  onIncrease: () => void;
  onDecrease: () => void;
}) {
  const dietaryInfo = (item.dietaryInfo as any) || {};
  const hasDiscount =
    item.discountedPrice !== null &&
    item.discountedPrice !== undefined &&
    item.discountedPrice < item.price;
  const tags: string[] = [];
  if (dietaryInfo.isVegetarian) tags.push("Vegetarian");
  if (dietaryInfo.isVegan) tags.push("Vegan");
  if (dietaryInfo.isHalal) tags.push("Halal");
  const available = item.isAvailable === null ? true : !!item.isAvailable;

  return (
    <article
      className={`flex h-full flex-col border-2 border-[#282828] bg-white shadow-[4px_4px_0_0_#282828] ${
        cartQuantity > 0 ? "ring-2 ring-[#F76043] ring-offset-2" : ""
      }`}
    >
      <div className="relative h-40 border-b-2 border-[#282828] bg-[#FFD527]">
        <img
          src={item.imageUrl || FALLBACK_FOOD}
          alt={item.name}
          loading="lazy"
          className={`h-full w-full object-cover ${!available ? "grayscale" : ""}`}
        />
        {!available && (
          <span className="absolute left-2 top-2 border-2 border-[#282828] bg-white px-2 py-0.5 text-xs font-extrabold">
            Unavailable
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 text-[#282828]">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold leading-tight tracking-tight">{item.name}</h3>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold">
              {formatCurrency(hasDiscount ? (item.discountedPrice as number) : item.price)}
            </p>
            {hasDiscount && (
              <p className="text-sm font-semibold text-gray-600 line-through">{formatCurrency(item.price)}</p>
            )}
          </div>
        </div>

        {item.description && (
          <p className="line-clamp-2 text-sm text-gray-700">{item.description}</p>
        )}

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className="border border-green-800 bg-green-100 px-2 py-0.5 text-xs font-bold text-green-900"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3">
          {cartQuantity > 0 ? (
            <div className="flex h-11 items-center justify-between border-2 border-[#282828] bg-[#FFD527]">
              <button
                type="button"
                className="flex h-full w-12 items-center justify-center border-r-2 border-[#282828] hover:bg-[#FFE066] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#282828]"
                aria-label={`Decrease quantity of ${item.name}`}
                onClick={onDecrease}
              >
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-base font-extrabold" aria-live="polite">
                {cartQuantity}
                <span className="sr-only"> in cart</span>
              </span>
              <button
                type="button"
                className="flex h-full w-12 items-center justify-center border-l-2 border-[#282828] hover:bg-[#FFE066] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#282828]"
                aria-label={`Increase quantity of ${item.name}`}
                onClick={onIncrease}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              className={`${primaryButtonClass} h-11 w-full`}
              disabled={!available}
              onClick={onAdd}
              aria-label={`Add ${item.name} to cart`}
            >
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Add to cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

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

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedFilters([]);
    setDietaryFilters({
      isVegetarian: false,
      isVegan: false,
      isHalal: false,
    });
    setActiveTab("all");
  };

  const activeFilterCount =
    selectedFilters.length + Object.values(dietaryFilters).filter(Boolean).length;

  // Loading state
  if (isLoadingRestaurant) {
    return (
      <CustomerLayout transparentHeader>
        <div className="flex items-center justify-center py-20" role="status" aria-label="Loading restaurant">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#282828]"></div>
        </div>
      </CustomerLayout>
    );
  }

  // Handle not found
  if (!restaurant) {
    return (
      <CustomerLayout>
        <div className="mx-auto my-12 flex max-w-md flex-col items-center border-2 border-[#282828] bg-white px-6 py-12 text-center shadow-[4px_4px_0_0_#282828]">
          <AlertTriangle className="mb-4 h-12 w-12 text-[#F76043]" aria-hidden="true" />
          <h1 className="mb-2 text-2xl font-extrabold uppercase tracking-tight text-[#282828]">
            Restaurant not found
          </h1>
          <p className="mb-6 text-base text-gray-700">
            The restaurant you're looking for doesn't exist or has been removed.
          </p>
          <Button className={`${primaryButtonClass} px-6`} onClick={handleBack}>
            Back to restaurants
          </Button>
        </div>
      </CustomerLayout>
    );
  }

  const description: string | undefined = (restaurant as any).description || undefined;
  const prepTime = 30;
  const infoChip = "flex items-center gap-1.5 text-sm font-semibold text-[#282828]";

  return (
    <CustomerLayout transparentHeader>
      {/* Restaurant header */}
      <header className="border-b-[3px] border-[#282828] bg-[#FFD527]">
        <div className="relative h-48 w-full overflow-hidden border-b-[3px] border-[#282828] bg-[#282828] sm:h-60">
          <img
            src={restaurant.bannerUrl || FALLBACK_BANNER}
            alt=""
            className="h-full w-full object-cover"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-4 top-4 h-11 w-11 rounded-none border-2 border-[#282828] bg-white text-[#282828] shadow-[3px_3px_0_0_#282828] hover:bg-[#FFD527] focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2"
            onClick={handleBack}
            aria-label="Back to restaurants"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>

        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-extrabold uppercase leading-tight tracking-tight text-[#282828] sm:text-4xl">
            {restaurant.name}
          </h1>

          {description && (
            <p className="mt-2 max-w-2xl text-base font-semibold text-[#282828]">{description}</p>
          )}

          {restaurant.categories && restaurant.categories.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {restaurant.categories.map((category, index) => (
                <span
                  key={`${category}-${index}`}
                  className="border-2 border-[#282828] bg-white px-2.5 py-0.5 text-xs font-bold text-[#282828]"
                >
                  {category}
                </span>
              ))}
            </div>
          )}

          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <li className={infoChip}>
              <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
              {restaurant.openingTime || "9:00"} - {restaurant.closingTime || "21:00"}
            </li>
            <li className={infoChip}>
              <Bike className="h-4 w-4 shrink-0" aria-hidden="true" />
              {restaurant.deliveryFee ? formatCurrency(restaurant.deliveryFee) : "Free delivery"}
              <span className="text-gray-700">
                {" "}· {prepTime}-{prepTime + 15} min
              </span>
            </li>
            {restaurant.address && (
              <li className={infoChip}>
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="max-w-xs truncate sm:max-w-md">{restaurant.address}</span>
              </li>
            )}
            {restaurant.phone && (
              <li className={infoChip}>
                <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
                {restaurant.phone}
              </li>
            )}
            {restaurant.email && (
              <li className={infoChip}>
                <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                {restaurant.email}
              </li>
            )}
          </ul>
        </div>
      </header>

      {/* Menu search + filters */}
      <div className="container mx-auto mt-6 px-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#282828]"
              aria-hidden="true"
            />
            <Input
              type="search"
              aria-label="Search menu items"
              placeholder="Search menu items"
              className={inputClass}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className={`${secondaryButtonClass} px-5`}>
                <Filter className="mr-2 h-5 w-5" aria-hidden="true" />
                Filter
                {activeFilterCount > 0 && (
                  <span className="ml-2 flex h-6 min-w-6 items-center justify-center border-2 border-[#282828] bg-white px-1 text-xs font-extrabold">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto rounded-none border-l-[3px] border-[#282828]">
              <SheetHeader>
                <SheetTitle className="text-2xl font-extrabold uppercase tracking-tight text-[#282828]">
                  Filter menu
                </SheetTitle>
                <SheetDescription>Customize your menu view</SheetDescription>
              </SheetHeader>

              <div className="space-y-8 py-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#282828]">Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={selectedFilters.includes(category)}
                        className={chipClass(selectedFilters.includes(category))}
                        onClick={() => toggleFilter(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#282828]">Dietary preferences</h3>
                  <div className="space-y-3">
                    {(
                      [
                        ["isVegetarian", "Vegetarian"],
                        ["isVegan", "Vegan"],
                        ["isHalal", "Halal"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-3">
                        <Checkbox
                          id={key}
                          className="h-5 w-5 rounded-none border-2 border-[#282828] data-[state=checked]:bg-[#F76043] data-[state=checked]:text-[#282828]"
                          checked={dietaryFilters[key]}
                          onCheckedChange={() => toggleDietaryFilter(key)}
                        />
                        <label htmlFor={key} className="text-sm font-bold leading-none text-[#282828]">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <SheetFooter className="gap-2 sm:flex-col sm:space-x-0">
                <Button
                  variant="outline"
                  className={plainButtonClass}
                  onClick={() => {
                    setSelectedFilters([]);
                    setDietaryFilters({
                      isVegetarian: false,
                      isVegan: false,
                      isHalal: false,
                    });
                  }}
                >
                  Clear all
                </Button>
                <SheetClose asChild>
                  <Button className={`${primaryButtonClass} w-full`}>Apply filters</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Menu category navigation and items */}
      <div className={`container mx-auto mt-6 px-4 ${cartItemCount > 0 ? "mb-40" : "mb-12"}`}>
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <div className="no-scrollbar overflow-x-auto pb-2">
            <TabsList className="mb-4 h-auto w-max justify-start gap-2 rounded-none bg-transparent p-0">
              {["all", ...allCategories].map((category) => (
                <TabsTrigger
                  key={category}
                  value={category}
                  className="rounded-none border-2 border-[#282828] bg-white px-4 py-2 text-sm font-bold text-[#282828] shadow-none hover:bg-[#FFD527] focus-visible:ring-2 focus-visible:ring-[#282828] data-[state=active]:bg-[#F76043] data-[state=active]:text-[#282828] data-[state=active]:shadow-none"
                >
                  {category === "all" ? "All items" : category}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {isLoadingMenu ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading menu">
              {[...Array(6)].map((_, index) => (
                <div key={index} className="border-2 border-[#282828]/30 bg-white motion-safe:animate-pulse">
                  <div className="h-40 bg-gray-200" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 bg-gray-200" />
                    <div className="h-4 w-full bg-gray-200" />
                    <div className="h-11 w-full bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredMenuItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredMenuItems.map((item) => {
                const cartItem = cartItems.find(
                  (ci) => ci.menuItem.id === item.id,
                );
                return (
                  <MenuTile
                    key={item.id}
                    item={item}
                    cartQuantity={cartItem?.quantity || 0}
                    onAdd={() => handleAddToCart(item.id)}
                    onIncrease={() => handleIncreaseQuantity(item.id)}
                    onDecrease={() => handleDecreaseQuantity(item.id)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center border-2 border-[#282828] bg-white px-6 py-12 text-center shadow-[4px_4px_0_0_#282828]">
              <SearchX className="mb-3 h-10 w-10 text-[#282828]" aria-hidden="true" />
              <p className="text-xl font-extrabold text-[#282828]">No items found</p>
              <p className="mb-6 mt-1 max-w-sm text-base text-gray-700">
                Try a different search or clear your filters.
              </p>
              <Button className={`${secondaryButtonClass} px-6`} onClick={resetAllFilters}>
                Clear all filters
              </Button>
            </div>
          )}
        </Tabs>
      </div>

      {/* Cart Button (fixed at bottom) */}
      {cartItemCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-40 border-t-[3px] border-[#282828] bg-[#FFD527] p-4 pb-10">
          <div className="container mx-auto">
            <Button className={`${primaryButtonClass} w-full`} size="lg" onClick={handleGoToCart}>
              <ShoppingCart className="mr-2 h-5 w-5" aria-hidden="true" />
              View cart ({cartItemCount} {cartItemCount === 1 ? "item" : "items"}) • {formatCurrency(cartTotal)}
            </Button>
          </div>
        </div>
      )}
    </CustomerLayout>
  );
}