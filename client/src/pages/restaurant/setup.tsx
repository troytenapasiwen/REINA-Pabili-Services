import React, { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import RestaurantLayout from "@/layouts/RestaurantLayout";
import { RestaurantOnboarding } from "@/components/restaurant/restaurant-onboarding";
import { Restaurant } from "@shared/schema";
import { Loader2 } from "lucide-react";

export default function RestaurantSetupPage() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();

  // Fetch restaurant data
  const { data: restaurant, isLoading } = useQuery<Restaurant | null>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  // If user already has a restaurant, redirect to dashboard
  useEffect(() => {
    if (!isLoading && restaurant && restaurant.id) {
      setLocation("/");
    }
  }, [restaurant, isLoading, setLocation]);

  if (isLoading) {
    return (
      <RestaurantLayout
        title="Setting Up Your Restaurant"
        description="Complete your restaurant profile"
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RestaurantLayout>
    );
  }

  if (restaurant) {
    return null; // Will redirect via useEffect
  }

  return (
    <RestaurantLayout
      title="Setting Up Your Restaurant"
      description="Complete your restaurant profile"
    >
      <div className="max-w-4xl mx-auto">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <h3 className="text-amber-800 font-semibold text-lg mb-2">Welcome to Reina Pabili Services!</h3>
          <p className="text-amber-700 mb-0">
            Before you can start using the restaurant features, you need to set up your restaurant profile.
            Please complete the onboarding process below.
          </p>
        </div>

        {user && <RestaurantOnboarding userId={user.id} onComplete={() => setLocation("/")} />}
      </div>
    </RestaurantLayout>
  );
}
