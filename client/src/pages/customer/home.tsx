import React, { useState, useEffect } from "react";
import CustomerLayout from "@/layouts/CustomerLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RestaurantCard } from "@/components/ui/restaurant-card";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Restaurant, Customer } from "@shared/schema";
import { Search, MapPin, ChevronDown, Filter, Loader2 } from "lucide-react";
import { LoyaltyBadge } from "@/components/customer/loyalty-badge";
import { calculateDistance } from "@/lib/map-utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CustomerLocationPicker } from "@/components/customer/customer-location-picker";
import { EnhancedLocationPicker } from "@/components/customer/enhanced-location-picker";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";

export default function CustomerHome() {
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState("popularity");
  const [filterOptions, setFilterOptions] = useState({
    categories: [] as string[],
    maxDeliveryTime: 60,
    minRating: 0,
    maxDistance: 100, // Default to 100km to show all restaurants
  });

  // Fetch restaurants
  const { data: restaurants, isLoading: isLoadingRestaurants } = useQuery<Restaurant[]>({
    queryKey: ["/api/restaurants/active"],
  });

  // Fetch customer profile to get location
  const { data: customerProfile, isLoading: isLoadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
  });

  // Calculate distances between user and each restaurant
  const [restaurantDistances, setRestaurantDistances] = useState<Record<number, string>>({});
  // Store raw distances for filtering
  const [rawDistances, setRawDistances] = useState<Record<number, number>>({});
  // Store the previous location to detect changes
  const [previousLocation, setPreviousLocation] = useState<string>("");

  useEffect(() => {
    if (restaurants && restaurants.length > 0 && customerProfile?.location) {
      const userLat = customerProfile.location.lat;
      const userLng = customerProfile.location.lng;
      const locationString = `${userLat},${userLng}`; // Create a string representation to compare

      // Calculate distances using our utility function
      const distances: Record<number, string> = {};
      const rawDistancesKm: Record<number, number> = {};

      restaurants.forEach(restaurant => {
        if (restaurant.latitude && restaurant.longitude) {
          const distanceInKm = calculateDistance(
            userLat,
            userLng,
            restaurant.latitude,
            restaurant.longitude
          );

          // Store raw distance for filtering
          rawDistancesKm[restaurant.id] = distanceInKm;

          // Format distance for display
          distances[restaurant.id] = distanceInKm < 1
            ? `${Math.round(distanceInKm * 1000)} m`
            : `${distanceInKm.toFixed(1)} km`;
        }
      });

      setRestaurantDistances(distances);
      setRawDistances(rawDistancesKm);

      // If the location has changed, reset the distance filter to show all restaurants
      if (previousLocation && previousLocation !== locationString) {
        // Reset distance filter to show all restaurants in the new location
        setFilterOptions(prev => ({
          ...prev,
          maxDistance: 100
        }));
      }

      // Update the previous location
      setPreviousLocation(locationString);
    }
  }, [restaurants, customerProfile]);

  // Combined loading state
  const isLoading = isLoadingRestaurants || isLoadingCustomer;

  // Get all categories from restaurants
  const allCategories = React.useMemo(() => {
    const categories = new Set<string>();
    restaurants?.forEach(restaurant => {
      if (restaurant.categories) {
        restaurant.categories.forEach(cat => categories.add(cat));
      }
    });
    return Array.from(categories);
  }, [restaurants]);

  // Get AI recommendation (nearest restaurant)
  const aiRecommendation = React.useMemo(() => {
    if (!restaurants || !rawDistances || Object.keys(rawDistances).length === 0) return null;

    // Find the restaurant with minimum distance
    let nearestRestaurant = null;
    let minDistance = Infinity;

    restaurants.forEach(restaurant => {
      const distance = rawDistances[restaurant.id];
      if (distance && distance < minDistance) {
        minDistance = distance;
        nearestRestaurant = restaurant;
      }
    });

    return nearestRestaurant;
  }, [restaurants, rawDistances]);

  // Filter and sort restaurants
  const filteredRestaurants = React.useMemo(() => {
    if (!restaurants) return [];

    return restaurants
      .filter(restaurant => {
        // Filter by search query
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          const nameMatch = restaurant.name.toLowerCase().includes(query);
          const categoryMatch = restaurant.categories?.some(cat =>
            cat.toLowerCase().includes(query)
          );
          if (!nameMatch && !categoryMatch) return false;
        }

        // Filter by selected categories
        if (filterOptions.categories.length > 0) {
          const hasCategory = restaurant.categories?.some(category =>
            filterOptions.categories.includes(category)
          );
          if (!hasCategory) return false;
        }

        // Filter by rating
        const rating = restaurant.rating || 4.0;
        if (rating < filterOptions.minRating) {
          return false;
        }

        // Filter by distance radius
        if (filterOptions.maxDistance < 100) { // Only apply if not set to maximum (100km)
          const distance = rawDistances[restaurant.id];
          // If we don't have distance data or the restaurant is farther than the set radius
          if (!distance || distance > filterOptions.maxDistance) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Sort options
        switch (sortOption) {
          case "popularity":
            return (b.rating || 4) - (a.rating || 4);
          case "delivery_fee":
            return (a.deliveryFee || 0) - (b.deliveryFee || 0);
          case "delivery_time":
            // Mock delivery time for sorting
            const aTime = a.preparationTime || 30;
            const bTime = b.preparationTime || 30;
            return aTime - bTime;
          case "rating":
            return (b.rating || 0) - (a.rating || 0);
          default:
            return 0;
        }
      });
  }, [restaurants, searchQuery, sortOption, filterOptions]);

  // Toggle category filter
  const toggleCategory = (category: string) => {
    setFilterOptions(prev => {
      const newCategories = prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category];

      return {
        ...prev,
        categories: newCategories
      };
    });
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterOptions({
      categories: [],
      maxDeliveryTime: 60,
      minRating: 0,
      maxDistance: 100, // Reset to 100km (essentially all restaurants)
    });
  };

  // Handle view restaurant
  const handleViewRestaurant = (id: number) => {
    setLocation(`/restaurants/${id}`);
  };

  // LocationDisplay component
  function LocationDisplay() {
    const [addressDialogOpen, setAddressDialogOpen] = useState(false);

    // Fetch customer profile data
    const { data: customer, isLoading } = useQuery<Customer>({
      queryKey: ["/api/customers/profile"],
    });

    if (isLoading) {
      return (
        <Button
          variant="secondary"
          size="sm"
          className="bg-white/20 border-none text-white h-8"
          disabled
        >
          <Loader2 className="h-3 w-3 animate-spin mr-2" />
          Loading...
        </Button>
      );
    }

    // Display location name or address if available
    let displayAddress = "Set your location";

    if (customer?.locationName) {
      displayAddress = customer.locationName;
    } else if (customer?.defaultAddress) {
      displayAddress = customer.defaultAddress;
    }

    return (
      <>
        <Button
          variant="secondary"
          size="sm"
          className="bg-white/20 border-none text-white h-8 max-w-[180px] truncate"
          onClick={() => setAddressDialogOpen(true)}
        >
          {displayAddress}
        </Button>

        {/* Address Dialog */}
        <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Set Delivery Location</DialogTitle>
              <DialogDescription>
                Pin your location on the map to set your delivery address.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <EnhancedLocationPicker
                onLocationSaved={(newAddress, locationName) => {
                  setAddressDialogOpen(false);
                }}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <CustomerLayout>
      {/* Hero Section */}
      <div className="bg-primary text-white py-12 px-4 md:py-16 md:px-8 mb-8 rounded-lg">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">Delicious Food Delivered to Your Door</h1>
          <p className="text-lg mb-6 opacity-90">
            Order from your favorite restaurants with fast delivery
          </p>

          <div className="flex flex-col md:flex-row gap-3 mb-4 max-w-lg mx-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for restaurants or cuisines"
                className="pl-10 border-none text-black h-12"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary" className="md:px-4 h-12">
                  <Filter className="h-5 w-5 md:mr-2" />
                  <span className="hidden md:inline">Filters</span>
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filter Options</SheetTitle>
                  <SheetDescription>
                    Refine your restaurant search
                  </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Categories</h3>
                    <div className="flex flex-wrap gap-2">
                      {allCategories.map((category) => (
                        <Badge
                          key={category}
                          variant={filterOptions.categories.includes(category) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleCategory(category)}
                        >
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>



                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Minimum Rating</h3>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Button
                          key={rating}
                          variant={filterOptions.minRating >= rating ? "default" : "outline"}
                          size="sm"
                          onClick={() => setFilterOptions(prev => ({ ...prev, minRating: rating }))}
                        >
                          {rating}+
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Distance Radius</h3>
                      <span className="text-sm text-muted-foreground">
                        {filterOptions.maxDistance === 100 ? 'All' : `${filterOptions.maxDistance} km`}
                      </span>
                    </div>
                    <Slider
                      defaultValue={[filterOptions.maxDistance]}
                      max={100}
                      min={1}
                      step={1}
                      value={[filterOptions.maxDistance]}
                      onValueChange={(value) => setFilterOptions(prev => ({ ...prev, maxDistance: value[0] }))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>1 km</span>
                      <span>All</span>
                    </div>
                  </div>
                </div>

                <SheetFooter>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                  <SheetClose asChild>
                    <Button>Apply Filters</Button>
                  </SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <p className="text-sm mr-2 flex items-center">
              <MapPin className="h-4 w-4 mr-1" /> Delivering to:
            </p>
            <LocationDisplay />
          </div>
        </div>
      </div>

      {/* Loyalty Program Badge */}
      <div className="mb-8">
        <LoyaltyBadge />
      </div>

      {/* Featured Categories (quick filters) */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Categories</h2>
          <Button variant="ghost" size="sm">
            View All <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        </div>
        <div className="flex overflow-x-auto pb-2 gap-3 no-scrollbar">
          {allCategories.slice(0, 10).map((category) => (
            <Button
              key={category}
              variant={filterOptions.categories.includes(category) ? "default" : "outline"}
              className="flex-shrink-0"
              onClick={() => toggleCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* AI Recommendation */}
      {aiRecommendation && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">AI Recommendation</h2>
            <Badge variant="default" className="bg-primary">
              Nearest to You
            </Badge>
          </div>
          <div className="max-w-md">
            <RestaurantCard
              key={aiRecommendation.id}
              id={aiRecommendation.id}
              name={aiRecommendation.name}
              imageUrl={aiRecommendation.bannerUrl || "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3"}
              categories={aiRecommendation.categories || ["Restaurant"]}
              rating={aiRecommendation.rating || 4.5}
              reviewCount={aiRecommendation.reviewCount || 0}
              isActive={aiRecommendation.isActive}
              deliveryFee={aiRecommendation.deliveryFee || 0}
              deliveryTime={`${aiRecommendation.preparationTime || 30}-${(aiRecommendation.preparationTime || 30) + 15} min`}
              distance={restaurantDistances[aiRecommendation.id]}
              isAdmin={false}
              onView={(id) => handleViewRestaurant(id)}
              isRecommended={true}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            This restaurant is closest to your location ({restaurantDistances[aiRecommendation.id]}) and offers great food with fast delivery.
          </p>
        </div>
      )}

      {/* Restaurant Listing */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">All Restaurants</h2>
          <Select value={sortOption} onValueChange={setSortOption}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popularity">Popularity</SelectItem>
              <SelectItem value="rating">Rating</SelectItem>
              <SelectItem value="delivery_fee">Delivery Fee</SelectItem>
              <SelectItem value="delivery_time">Delivery Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applied filters display */}
        {(filterOptions.categories.length > 0 || filterOptions.minRating > 0 || filterOptions.maxDistance < 100) && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-sm text-muted-foreground">Filters:</span>
            {filterOptions.categories.map(category => (
              <Badge key={category} variant="secondary" className="flex items-center gap-1">
                {category}
                <button
                  className="ml-1 h-3 w-3 rounded-full hover:bg-muted"
                  onClick={() => toggleCategory(category)}
                >
                  ×
                </button>
              </Badge>
            ))}
            {filterOptions.minRating > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                {filterOptions.minRating}+ Rating
                <button
                  className="ml-1 h-3 w-3 rounded-full hover:bg-muted"
                  onClick={() => setFilterOptions(prev => ({ ...prev, minRating: 0 }))}
                >
                  ×
                </button>
              </Badge>
            )}
            {filterOptions.maxDistance < 100 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                Max {filterOptions.maxDistance} km Distance
                <button
                  className="ml-1 h-3 w-3 rounded-full hover:bg-muted"
                  onClick={() => setFilterOptions(prev => ({ ...prev, maxDistance: 100 }))}
                >
                  ×
                </button>
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, index) => (
              <Card key={index} className="h-64 animate-pulse">
                <div className="h-32 bg-gray-200"></div>
                <CardContent className="p-4">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRestaurants.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRestaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                id={restaurant.id}
                name={restaurant.name}
                imageUrl={restaurant.bannerUrl || "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3"}
                categories={restaurant.categories || ["Restaurant"]}
                rating={restaurant.rating || 4.5}
                reviewCount={restaurant.reviewCount || 0}
                isActive={restaurant.isActive}
                deliveryFee={restaurant.deliveryFee || 0}
                deliveryTime={`${restaurant.preparationTime || 30}-${(restaurant.preparationTime || 30) + 15} min`}
                distance={restaurantDistances[restaurant.id]}
                isAdmin={false}
                onView={(id) => handleViewRestaurant(id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-2xl font-bold mb-2">No restaurants found</p>
            <p className="text-muted-foreground mb-6">
              Try adjusting your filters or search criteria
            </p>
            <Button onClick={clearFilters}>Clear Filters</Button>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
