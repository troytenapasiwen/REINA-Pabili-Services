import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { RestaurantSetupWizard } from './restaurant-setup-wizard';
import { Loader2 } from 'lucide-react';
import { Restaurant, UserRole } from '@shared/schema';
import { getQueryFn } from '@/lib/queryClient';

interface RestaurantCheckProps {
  children: React.ReactNode;
}

export function RestaurantCheck({ children }: RestaurantCheckProps) {
  const { user } = useAuth();
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Only for restaurant users
  const isRestaurantUser = user?.role === UserRole.RESTAURANT;

  // Query for restaurant data
  const {
    data: restaurant,
    isLoading,
    error,
    refetch
  } = useQuery<Restaurant | null>({
    queryKey: ['/api/restaurants/by-user'],
    enabled: isRestaurantUser,
    retry: false,
    retryOnMount: false,
    // Use the updated queryFn with proper error handling for 404
    queryFn: getQueryFn({ on401: "returnNull", on404: "returnNull" })
  });

  useEffect(() => {
    // Show setup wizard for restaurant users who haven't fully set up their profile
    // (check if required fields are empty or if the restaurant record doesn't exist)
    if (isRestaurantUser && !isLoading &&
        (!restaurant ||
         !restaurant.address ||
         !restaurant.phone ||
         !restaurant.latitude ||
         !restaurant.longitude)) {
      setShowSetupWizard(true);
    }
  }, [isRestaurantUser, restaurant, isLoading]);

  // Handle setup completion
  const handleSetupComplete = () => {
    setShowSetupWizard(false);
    refetch();
  };

  // If not a restaurant user, just render children
  if (!isRestaurantUser) {
    return <>{children}</>;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center z-50">
        <div className="flex flex-col items-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading restaurant information...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}

      {/* Setup wizard modal */}
      {showSetupWizard && (
        <RestaurantSetupWizard
          open={showSetupWizard}
          onComplete={handleSetupComplete}
        />
      )}
    </>
  );
}
