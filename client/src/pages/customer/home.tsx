
import React, { useState, useEffect } from "react";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Button } from "@/components/ui/button";
import { RestaurantCard } from "@/components/ui/restaurant-card";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Restaurant, Customer } from "@shared/schema";

type CustomerRestaurant = Restaurant & {
  rating?: number | null;
  reviewCount?: number | null;
  preparationTime?: number | null;
};

type CustomerProfileWithLocation = Omit<Customer, "location"> & {
  location: { lat?: unknown; lng?: unknown } | null;
};
import { Filter, X, AlertCircle, SearchX, Store } from "lucide-react";
import { LoyaltyBadge } from "@/components/customer/loyalty-badge";
import { calculateDistance } from "@/lib/map-utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Slider } from "@/components/ui/slider";

/*
  Reina Pabili brand tokens:
    yellow #FFD527, orange #F76043, charcoal #282828.
  Square corners, charcoal outlines, and hard offset shadows.
*/
const buttonBase =
  "h-12 rounded-none border-2 border-[#282828] text-base font-bold text-[#282828] transition-all motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 disabled:opacity-60";

const hardShadow =
  "shadow-[4px_4px_0_0_#282828] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#282828] active:translate-x-1 active:translate-y-1 active:shadow-none";

const primaryButtonClass =
  `${buttonBase} ${hardShadow} bg-[#F76043] hover:bg-[#FF7154]`;

const secondaryButtonClass =
  `${buttonBase} ${hardShadow} bg-[#FFD527] hover:bg-[#FFE066]`;

const plainButtonClass =
  `${buttonBase} bg-white px-5 hover:bg-gray-100`;

const sectionTitleClass =
  "text-2xl font-extrabold uppercase tracking-tight text-[#282828]";

const chipBase =
  "shrink-0 border-2 border-[#282828] px-3.5 py-1.5 text-sm font-bold text-[#282828] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2";

const chipClass = (active: boolean) =>
  `${chipBase} ${active ? "bg-[#F76043]" : "bg-white hover:bg-[#FFD527]"}`;

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3";

export default function CustomerHome() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("popularity");

  const [filterOptions, setFilterOptions] = useState({
    categories: [] as string[],
    maxDeliveryTime: 60,
    minRating: 0,
    maxDistance: 100,
  });

  // Fetch restaurants
  const {
    data: restaurants,
    isLoading: isLoadingRestaurants,
    isError: isRestaurantsError,
    refetch: refetchRestaurants,
  } = useQuery<CustomerRestaurant[]>({
    queryKey: ["/api/restaurants/active"],
  });

  // Fetch customer profile to get location
  const {
    data: customerProfile,
    isLoading: isLoadingCustomer,
  } = useQuery<CustomerProfileWithLocation>({
    queryKey: ["/api/customers/profile"],
  });

  // Calculate distances between user and each restaurant
  const [restaurantDistances, setRestaurantDistances] =
    useState<Record<number, string>>({});

  const [rawDistances, setRawDistances] =
    useState<Record<number, number>>({});

  const [previousLocation, setPreviousLocation] = useState<string>("");

  useEffect(() => {
    const location = customerProfile?.location;
    if (
      restaurants && restaurants.length > 0 &&
      typeof location?.lat === "number" &&
      typeof location?.lng === "number"
    ) {
      const userLat = location.lat;
      const userLng = location.lng;
      const locationString = `${userLat},${userLng}`;

      const distances: Record<number, string> = {};
      const rawDistancesKm: Record<number, number> = {};

      restaurants.forEach((restaurant) => {
        if (restaurant.latitude && restaurant.longitude) {
          const distanceInKm = calculateDistance(
            userLat,
            userLng,
            restaurant.latitude,
            restaurant.longitude
          );

          rawDistancesKm[restaurant.id] = distanceInKm;

          distances[restaurant.id] =
            distanceInKm < 1
              ? `${Math.round(distanceInKm * 1000)} m`
              : `${distanceInKm.toFixed(1)} km`;
        }
      });

      setRestaurantDistances(distances);
      setRawDistances(rawDistancesKm);

      if (previousLocation && previousLocation !== locationString) {
        setFilterOptions((prev) => ({
          ...prev,
          maxDistance: 100,
        }));
      }

      setPreviousLocation(locationString);
    }
  }, [restaurants, customerProfile]);

  // Combined loading state
  const isLoading = isLoadingRestaurants || isLoadingCustomer;

  // Get all categories from restaurants
  const allCategories = React.useMemo(() => {
    const categories = new Set<string>();

    restaurants?.forEach((restaurant) => {
      if (restaurant.categories) {
        restaurant.categories.forEach((category) => categories.add(category));
      }
    });

    return Array.from(categories);
  }, [restaurants]);

  // Get nearest restaurant recommendation
  const aiRecommendation = React.useMemo(() => {
    if (
      !restaurants ||
      !rawDistances ||
      Object.keys(rawDistances).length === 0
    ) {
      return null;
    }

    return restaurants.reduce<CustomerRestaurant | null>(
      (nearest, restaurant) => {
        const distance = rawDistances[restaurant.id];

        if (distance === undefined) return nearest;

        if (
          nearest === null ||
          distance < rawDistances[nearest.id]
        ) {
          return restaurant;
        }

        return nearest;
      },
      null
    );
  }, [restaurants, rawDistances]);

  // Filter and sort restaurants
  const filteredRestaurants = React.useMemo(() => {
    if (!restaurants) return [];

    return restaurants
      .filter((restaurant) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const nameMatch = restaurant.name.toLowerCase().includes(query);
          const categoryMatch = restaurant.categories?.some((category) =>
            category.toLowerCase().includes(query)
          );

          if (!nameMatch && !categoryMatch) return false;
        }

        if (filterOptions.categories.length > 0) {
          const hasCategory = restaurant.categories?.some((category) =>
            filterOptions.categories.includes(category)
          );

          if (!hasCategory) return false;
        }

        const rating = restaurant.rating || 4.0;

        if (rating < filterOptions.minRating) {
          return false;
        }

        if (filterOptions.maxDistance < 100) {
          const distance = rawDistances[restaurant.id];

          if (
            distance === undefined ||
            distance > filterOptions.maxDistance
          ) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortOption) {
          case "popularity":
            return (b.rating || 4) - (a.rating || 4);

          case "delivery_fee":
            return (a.deliveryFee || 0) - (b.deliveryFee || 0);

          case "delivery_time": {
            const aTime = a.preparationTime || 30;
            const bTime = b.preparationTime || 30;
            return aTime - bTime;
          }

          case "rating":
            return (b.rating || 0) - (a.rating || 0);

          default:
            return 0;
        }
      });
  }, [restaurants, searchQuery, sortOption, filterOptions, rawDistances]);

  // Toggle category filter
  const toggleCategory = (category: string) => {
    setFilterOptions((prev) => {
      const newCategories = prev.categories.includes(category)
        ? prev.categories.filter((item) => item !== category)
        : [...prev.categories, category];

      return {
        ...prev,
        categories: newCategories,
      };
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterOptions({
      categories: [],
      maxDeliveryTime: 60,
      minRating: 0,
      maxDistance: 100,
    });
  };

  // Handle view restaurant
  const handleViewRestaurant = (id: number) => {
    setLocation(`/restaurants/${id}`);
  };

  const hasActiveFilters =
    filterOptions.categories.length > 0 ||
    filterOptions.minRating > 0 ||
    filterOptions.maxDistance < 100;

  const activeFilterCount =
    filterOptions.categories.length +
    (filterOptions.minRating > 0 ? 1 : 0) +
    (filterOptions.maxDistance < 100 ? 1 : 0);

  const appliedChipClass =
    "inline-flex items-center gap-1.5 border-2 border-[#282828] bg-[#FFD527] px-2.5 py-1 text-sm font-bold text-[#282828]";

  const removeChipClass =
    "flex h-5 w-5 items-center justify-center hover:bg-[#282828] hover:text-[#FFD527] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828]";

  return (
    <CustomerLayout>
      <div className="space-y-8 pb-10">
        {/* Compact discovery banner: search and location are in the shared header */}
        <section className="flex flex-col gap-3 border-[3px] border-[#282828] bg-[#FFD527] px-4 py-4 shadow-[4px_4px_0_0_#282828] sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold uppercase leading-tight tracking-tight text-[#282828] sm:text-3xl">
              Hungry? Pabili po!
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#282828] sm:text-base">
              Order from local restaurants and get it delivered to your door.
            </p>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                type="button"
                className={`${primaryButtonClass} w-full shrink-0 px-5 sm:w-auto`}
              >
                <Filter className="mr-2 h-5 w-5" aria-hidden="true" />
                Filters
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
                  Filter options
                </SheetTitle>
                <SheetDescription>
                  Refine your restaurant search
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-8 py-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#282828]">
                    Categories
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        aria-pressed={filterOptions.categories.includes(category)}
                        className={chipClass(
                          filterOptions.categories.includes(category)
                        )}
                        onClick={() => toggleCategory(category)}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-[#282828]">
                    Minimum rating
                  </h3>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        aria-pressed={filterOptions.minRating >= rating}
                        className={chipClass(
                          filterOptions.minRating >= rating
                        )}
                        onClick={() =>
                          setFilterOptions((prev) => ({
                            ...prev,
                            minRating: rating,
                          }))
                        }
                      >
                        {rating}+
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#282828]">
                      Distance radius
                    </h3>
                    <span className="text-sm font-bold text-[#282828]">
                      {filterOptions.maxDistance === 100
                        ? "All"
                        : `${filterOptions.maxDistance} km`}
                    </span>
                  </div>

                  <Slider
                    value={[filterOptions.maxDistance]}
                    max={100}
                    min={1}
                    step={1}
                    onValueChange={(value) =>
                      setFilterOptions((prev) => ({
                        ...prev,
                        maxDistance: value[0],
                      }))
                    }
                    className="w-full"
                  />

                  <div className="flex justify-between text-xs font-semibold text-gray-700">
                    <span>1 km</span>
                    <span>All</span>
                  </div>
                </div>
              </div>

              <SheetFooter className="gap-2 sm:flex-col sm:space-x-0">
                <Button
                  type="button"
                  className={plainButtonClass}
                  variant="outline"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>

                <SheetClose asChild>
                  <Button
                    type="button"
                    className={`${primaryButtonClass} w-full`}
                  >
                    Apply filters
                  </Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </section>

        {/* Loyalty Program Badge */}
        <div>
          <LoyaltyBadge />
        </div>

        {/* Category quick filters */}
        {allCategories.length > 0 && (
          <section aria-labelledby="categories-heading">
            <h2
              id="categories-heading"
              className={`${sectionTitleClass} mb-4`}
            >
              Categories
            </h2>

            <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-2">
              {allCategories.slice(0, 10).map((category) => (
                <button
                  key={category}
                  type="button"
                  aria-pressed={filterOptions.categories.includes(category)}
                  className={chipClass(
                    filterOptions.categories.includes(category)
                  )}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Nearest restaurant */}
        {aiRecommendation && (
          <section aria-labelledby="recommendation-heading">
            <h2
              id="recommendation-heading"
              className={`${sectionTitleClass} mb-4`}
            >
              Recommended for you
            </h2>

            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              <RestaurantCard
                key={aiRecommendation.id}
                variant="customer"
                id={aiRecommendation.id}
                name={aiRecommendation.name}
                imageUrl={aiRecommendation.bannerUrl || FALLBACK_IMAGE}
                categories={aiRecommendation.categories || ["Restaurant"]}
                rating={aiRecommendation.rating || 4.5}
                reviewCount={aiRecommendation.reviewCount || 0}
                isActive={aiRecommendation.isActive ?? false}
                deliveryFee={aiRecommendation.deliveryFee || 0}
                deliveryTime={`${aiRecommendation.preparationTime || 30}-${(aiRecommendation.preparationTime || 30) + 15} min`}
                distance={restaurantDistances[aiRecommendation.id]}
                isAdmin={false}
                onView={(id) => handleViewRestaurant(id)}
                isRecommended={true}
              />

              <p className="self-center text-base font-semibold text-gray-800 md:col-span-1 lg:col-span-2">
                This restaurant is closest to your location (
                {restaurantDistances[aiRecommendation.id]}) and offers great
                food with fast delivery.
              </p>
            </div>
          </section>
        )}

        {/* Restaurant listing */}
        <section aria-labelledby="all-restaurants-heading">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2
              id="all-restaurants-heading"
              className={sectionTitleClass}
            >
              All restaurants
            </h2>

            <Select value={sortOption} onValueChange={setSortOption}>
              <SelectTrigger
                aria-label="Sort restaurants"
                className="h-11 w-[180px] rounded-none border-2 border-[#282828] bg-white font-bold text-[#282828] focus:ring-2 focus:ring-[#282828]"
              >
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>

              <SelectContent className="rounded-none border-2 border-[#282828]">
                <SelectItem value="popularity">Popularity</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
                <SelectItem value="delivery_fee">Delivery Fee</SelectItem>
                <SelectItem value="delivery_time">Delivery Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Applied filters display */}
          {hasActiveFilters && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-[#282828]">
                Filters:
              </span>

              {filterOptions.categories.map((category) => (
                <span key={category} className={appliedChipClass}>
                  {category}
                  <button
                    type="button"
                    className={removeChipClass}
                    aria-label={`Remove ${category} filter`}
                    onClick={() => toggleCategory(category)}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}

              {filterOptions.minRating > 0 && (
                <span className={appliedChipClass}>
                  {filterOptions.minRating}+ Rating
                  <button
                    type="button"
                    className={removeChipClass}
                    aria-label="Remove rating filter"
                    onClick={() =>
                      setFilterOptions((prev) => ({
                        ...prev,
                        minRating: 0,
                      }))
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              )}

              {filterOptions.maxDistance < 100 && (
                <span className={appliedChipClass}>
                  Max {filterOptions.maxDistance} km
                  <button
                    type="button"
                    className={removeChipClass}
                    aria-label="Remove distance filter"
                    onClick={() =>
                      setFilterOptions((prev) => ({
                        ...prev,
                        maxDistance: 100,
                      }))
                    }
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              )}

              <Button
                type="button"
                variant="ghost"
                className="h-auto rounded-none p-0 text-sm font-bold text-[#282828] underline decoration-[#F76043] decoration-2 underline-offset-4 hover:bg-transparent hover:decoration-4"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            </div>
          )}

          {isRestaurantsError ? (
            <div
              role="alert"
              className="flex flex-col items-center border-2 border-[#282828] bg-white px-6 py-12 text-center shadow-[4px_4px_0_0_#282828]"
            >
              <AlertCircle
                className="mb-3 h-10 w-10 text-red-700"
                aria-hidden="true"
              />

              <p className="text-xl font-extrabold text-[#282828]">
                We couldn't load restaurants
              </p>

              <p className="mb-6 mt-1 max-w-sm text-base text-gray-700">
                Check your connection and try again.
              </p>

              <Button
                className={`${primaryButtonClass} px-6`}
                onClick={() => refetchRestaurants()}
              >
                Try again
              </Button>
            </div>
          ) : isLoading ? (
            <div
              className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
              aria-busy="true"
              aria-label="Loading restaurants"
            >
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="border-2 border-[#282828]/30 bg-white motion-safe:animate-pulse"
                >
                  <div className="h-40 bg-gray-200" />

                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 bg-gray-200" />
                    <div className="h-4 w-1/2 bg-gray-200" />
                    <div className="h-4 w-2/3 bg-gray-200" />
                    <div className="h-11 w-full bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRestaurants.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredRestaurants.map((restaurant) => (
                <RestaurantCard
                  key={restaurant.id}
                  variant="customer"
                  id={restaurant.id}
                  name={restaurant.name}
                  imageUrl={restaurant.bannerUrl || FALLBACK_IMAGE}
                  categories={restaurant.categories || ["Restaurant"]}
                  rating={restaurant.rating || 4.5}
                  reviewCount={restaurant.reviewCount || 0}
                  isActive={restaurant.isActive ?? false}
                  deliveryFee={restaurant.deliveryFee || 0}
                  deliveryTime={`${restaurant.preparationTime || 30}-${(restaurant.preparationTime || 30) + 15} min`}
                  distance={restaurantDistances[restaurant.id]}
                  isAdmin={false}
                  onView={(id) => handleViewRestaurant(id)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center border-2 border-[#282828] bg-white px-6 py-12 text-center shadow-[4px_4px_0_0_#282828]">
              {restaurants && restaurants.length === 0 ? (
                <>
                  <Store
                    className="mb-3 h-10 w-10 text-[#282828]"
                    aria-hidden="true"
                  />

                  <p className="text-xl font-extrabold text-[#282828]">
                    No restaurants are open yet
                  </p>

                  <p className="mt-1 max-w-sm text-base text-gray-700">
                    New restaurants are added regularly. Check back soon.
                  </p>
                </>
              ) : (
                <>
                  <SearchX
                    className="mb-3 h-10 w-10 text-[#282828]"
                    aria-hidden="true"
                  />

                  <p className="text-xl font-extrabold text-[#282828]">
                    No restaurants found
                  </p>

                  <p className="mb-6 mt-1 max-w-sm text-base text-gray-700">
                    Try a different search or loosen your filters.
                  </p>

                  <Button
                    className={`${secondaryButtonClass} px-6`}
                    onClick={() => {
                      clearFilters();
                      setSearchQuery("");
                    }}
                  >
                    Clear search and filters
                  </Button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </CustomerLayout>
  );
}
