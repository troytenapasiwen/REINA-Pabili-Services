import React from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { Restaurant } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Star,
  Settings,
  Edit,
  ChevronLeft
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";

export default function RestaurantProfile() {
  const [match, params] = useRoute("/restaurant/:id");
  const { user } = useAuth();
  const restaurantId = params?.id;

  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurants", restaurantId],
    enabled: !!restaurantId,
  });

  // Check if this is the restaurant owner viewing their own profile
  const isOwner = user?.role === "restaurant" && restaurant?.userId === user?.id;

  if (isLoading) {
    return (
      <RestaurantLayout
        title="Restaurant Profile"
        description="View restaurant information"
      >
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </RestaurantLayout>
    );
  }

  if (!restaurant) {
    return (
      <RestaurantLayout
        title="Restaurant Not Found"
        description="The requested restaurant could not be found"
      >
        <div className="text-center py-12">
          <p className="text-xl font-semibold mb-2">Restaurant not found</p>
          <p className="text-muted-foreground">
            The restaurant you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </RestaurantLayout>
    );
  }

  return (
    <RestaurantLayout
      title={restaurant.name}
      description="Restaurant profile and information"
    >
      {/* Restaurant Banner */}
      <div
        className="w-full h-64 bg-cover bg-center relative rounded-lg overflow-hidden mb-6"
        style={{
          backgroundImage: `url(${restaurant.bannerUrl || "https://images.unsplash.com/photo-1590846406792-0adc7f938f1d?ixlib=rb-4.0.3"})`,
        }}
      >
        <div className="absolute inset-0 bg-primary/60" />
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          {isOwner && (
            <Link href="/restaurant/settings">
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 text-white bg-black/20 hover:bg-black/40"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
          )}

          <div className="flex items-center gap-4 mb-4">
            {restaurant.logoUrl && (
              <img
                src={restaurant.logoUrl}
                alt={`${restaurant.name} logo`}
                className="w-16 h-16 rounded-full border-2 border-white object-cover"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {restaurant.name}
              </h1>
              <div className="flex items-center text-white/90">
                <Star className="h-4 w-4 mr-1 fill-amber-400 text-amber-400" />
                <span className="font-medium">4.5</span>
                <span className="ml-1">(24 reviews)</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {restaurant.categories?.map((category, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 text-white"
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Restaurant Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{restaurant.description || "No description available"}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Address</p>
              <p className="font-medium">{restaurant.address}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{restaurant.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{restaurant.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operating Hours */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Operating Hours
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Opening Hours</p>
              <p className="font-medium">
                {restaurant.openingTime || "9:00 AM"} - {restaurant.closingTime || "9:00 PM"}
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Delivery Fee</p>
              <p className="font-medium">
                {restaurant.deliveryFee
                  ? `₱${restaurant.deliveryFee.toFixed(2)}`
                  : "Free Delivery"
                }
              </p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={restaurant.isActive ? "default" : "secondary"}>
                {restaurant.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Methods */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {restaurant.acceptsCash && (
              <Badge variant="outline">Cash on Delivery</Badge>
            )}
            {restaurant.acceptsGcash && (
              <Badge variant="outline">GCash</Badge>
            )}
            {!restaurant.acceptsCash && !restaurant.acceptsGcash && (
              <p className="text-muted-foreground">No payment methods configured</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions for Restaurant Owner */}
      {isOwner && (
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/restaurant/settings">
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </Link>
              <Link href="/restaurant/menu">
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Manage Menu
                </Button>
              </Link>
              <Link href="/restaurant/orders">
                <Button variant="outline">
                  View Orders
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </RestaurantLayout>
  );
}
