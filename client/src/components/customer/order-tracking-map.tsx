import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';

// A simplified map component for order tracking that doesn't rely on Google Maps API directly
// This uses static map images instead for better stability

interface OrderTrackingMapProps {
  // Order ID to track
  orderId: number;

  // Restaurant location
  restaurant?: {
    name: string;
    latitude: number;
    longitude: number;
  };

  // Customer location
  customer?: {
    address: string;
    latitude: number;
    longitude: number;
  };

  // Current rider location (if available)
  riderLocation?: {
    latitude: number;
    longitude: number;
  } | null;
}

export function OrderTrackingMap({
  orderId,
  restaurant,
  customer,
  riderLocation
}: OrderTrackingMapProps) {
  // Fetch Google Maps API key
  const { data: mapsData } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  const googleMapsApiKey = mapsData?.key || '';

  // Function to open in Google Maps app
  const openInGoogleMaps = () => {
    let url = "https://www.google.com/maps/dir/?api=1";

    if (restaurant && restaurant.latitude && restaurant.longitude) {
      url += `&origin=${restaurant.latitude},${restaurant.longitude}`;
      url += `&origin_name=${encodeURIComponent(restaurant.name || 'Restaurant')}`;
    }

    if (customer && customer.latitude && customer.longitude) {
      url += `&destination=${customer.latitude},${customer.longitude}`;
      url += `&destination_name=${encodeURIComponent(customer.address || 'Delivery location')}`;
    }

    if (riderLocation && riderLocation.latitude && riderLocation.longitude) {
      // If rider location is available, we can add it as waypoint
      url += `&waypoints=${riderLocation.latitude},${riderLocation.longitude}`;
      url += `&waypoint_names=${encodeURIComponent('Rider')}`;
    }

    url += `&travelmode=driving`;
    window.open(url, '_blank');
  };

  // This creates a static map image URL with all relevant locations
  const getStaticMapUrl = () => {
    if (!googleMapsApiKey) return '';

    let markers = '';
    let center = '14.5995,120.9842'; // Default to Manila
    let zoom = '12';

    // Add customer marker
    if (customer && customer.latitude && customer.longitude) {
      markers += `&markers=color:red|label:C|${customer.latitude},${customer.longitude}`;
      center = `${customer.latitude},${customer.longitude}`;
    }

    // Add restaurant marker
    if (restaurant && restaurant.latitude && restaurant.longitude) {
      markers += `&markers=color:green|label:R|${restaurant.latitude},${restaurant.longitude}`;
      if (!customer) center = `${restaurant.latitude},${restaurant.longitude}`;
    }

    // Add rider marker if available
    if (riderLocation && riderLocation.latitude && riderLocation.longitude) {
      markers += `&markers=color:blue|label:D|${riderLocation.latitude},${riderLocation.longitude}`;

      // If we have rider location, center on rider
      center = `${riderLocation.latitude},${riderLocation.longitude}`;
      zoom = '14'; // Zoom in more when we have rider location
    }

    return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=600x400&maptype=roadmap${markers}&key=${googleMapsApiKey}`;
  };

  const mapUrl = getStaticMapUrl();

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm mb-4">
      <div className="flex flex-col space-y-1.5 p-6 pb-2">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold leading-none tracking-tight">Order Tracking</h3>
          <Badge variant="outline">Map</Badge>
        </div>
      </div>

      <div className="p-3">
        {/* Location info panel */}
        <div className="flex flex-col space-y-2 mb-3">
          {restaurant && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                Restaurant: {restaurant.name}
              </span>
            </div>
          )}

          {customer && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">
                Delivery Address: {customer.address}
              </span>
            </div>
          )}

          {riderLocation ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Rider Location: {riderLocation.latitude.toFixed(5)}, {riderLocation.longitude.toFixed(5)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground italic">
                Waiting for rider to update location...
              </span>
            </div>
          )}
        </div>

        {/* Map section */}
        <div className="w-full mb-3 border rounded-md overflow-hidden" style={{ height: '350px' }}>
          {mapUrl ? (
            <img
              src={mapUrl}
              alt="Order Tracking Map"
              className="w-full h-full object-cover"
              onError={(e) => {
                // If image fails to load, show placeholder
                e.currentTarget.src = 'https://via.placeholder.com/600x400?text=Map+unavailable';
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p>Loading map...</p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={openInGoogleMaps}
            disabled={!restaurant && !customer}
          >
            <Navigation className="h-4 w-4 mr-2" />
            View in Google Maps
          </Button>
        </div>
      </div>
    </div>
  );
}
