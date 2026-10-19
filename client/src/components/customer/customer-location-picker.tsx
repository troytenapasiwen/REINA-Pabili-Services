import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadScript, GoogleMap, Marker } from "@react-google-maps/api";
import { MapPin, Navigation, Loader2, Home as HomeIcon, Briefcase, MapPinOff } from "lucide-react";

interface Location {
  lat: number;
  lng: number;
}

const mapContainerStyle = {
  width: "100%",
  height: "400px",
  borderRadius: "8px",
};

// Default center (Manila, Philippines)
const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

interface CustomerLocationPickerProps {
  onLocationSaved?: (address: string, locationName?: string, location?: {lat: number, lng: number}) => void;
  saveToAddresses?: boolean;
}

export function CustomerLocationPicker({ onLocationSaved, saveToAddresses = false }: CustomerLocationPickerProps) {
  const { toast } = useToast();
  const [location, setLocation] = useState<Location | null>(null);
  const [locationName, setLocationName] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [namePreset, setNamePreset] = useState<string | null>(null);

  // Fetch customer data
  const { data: customer, isLoading: isLoadingCustomer } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
  });

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery<{key: string}>({
    queryKey: ["/api/maps/key"],
    staleTime: Infinity,
  });

  // Update location mutation with address and name
  const updateLocationMutation = useMutation({
    mutationFn: async ({ location, address, locationName }: { location: Location, address: string, locationName?: string }) => {
      const res = await apiRequest("PATCH", "/api/customers/location", {
        ...location,
        defaultAddress: address,
        locationName: locationName || ''
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
      toast({
        title: "Location updated",
        description: "Your current location has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Use customer location as initial if available or get current location if none saved
  useEffect(() => {
    const hasLocation = customer?.location &&
        typeof customer.location === 'object' &&
        (customer.location as any).lat &&
        (customer.location as any).lng;

    if (hasLocation) {
      // Handle the case where location might be a string or empty object
      try {
        const locationData = customer.location as any;
        setLocation({
          lat: parseFloat(locationData.lat),
          lng: parseFloat(locationData.lng)
        });

        // If there's a location name, set it in the input field
        if (customer.locationName) {
          setLocationName(customer.locationName);
          if (customer.locationName === 'Home' || customer.locationName === 'Work') {
            setNamePreset(customer.locationName);
          }
        }
      } catch (err) {
        console.error('Error parsing location data:', err);
      }
    } else if (customer && !hasLocation) {
      // If customer exists but has no location, auto-detect current location
      getCurrentLocation();
    }
  }, [customer]);

  // Get current location from browser
  const getCurrentLocation = () => {
    setIsLocating(true);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setLocation(newLocation);
          setIsLocating(false);
        },
        (error) => {
          toast({
            title: "Error getting location",
            description: error.message,
            variant: "destructive",
          });
          setIsLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      toast({
        title: "Geolocation not supported",
        description: "Your browser does not support geolocation",
        variant: "destructive",
      });
      setIsLocating(false);
    }
  };

  // Get human-readable address from coordinates
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsData?.key}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        return data.results[0].formatted_address;
      } else {
        return `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      }
    } catch (error) {
      console.error('Error getting address:', error);
      return `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    }
  };

  // Save location to database
  const saveLocation = async () => {
    if (location) {
      // Get human-readable address
      const address = await getAddressFromCoordinates(location.lat, location.lng);

      // Get location name from input or preset
      const finalLocationName = locationName || namePreset || '';

      // Update location and address in database
      updateLocationMutation.mutate({ location, address, locationName: finalLocationName });

      // Call callback with address if provided
      if (onLocationSaved) {
        onLocationSaved(address, finalLocationName, location);
      }

      // If this should also be saved to the customer's saved addresses
      if (saveToAddresses && finalLocationName) {
        try {
          const savedAddresses = (customer?.savedAddresses as any[]) || [];

          // Check if an address with this name already exists
          const existingIndex = savedAddresses.findIndex(addr => addr.name === finalLocationName);

          if (existingIndex !== -1) {
            // Update existing address
            savedAddresses[existingIndex] = {
              ...savedAddresses[existingIndex],
              address,
              lat: location.lat,
              lng: location.lng
            };
          } else {
            // Add new address
            savedAddresses.push({
              name: finalLocationName,
              address,
              lat: location.lat,
              lng: location.lng,
              isDefault: savedAddresses.length === 0
            });
          }

          // Update saved addresses in the database
          const res = await apiRequest("PATCH", "/api/customers/saved-addresses", {
            savedAddresses
          });

          toast({
            title: "Address saved",
            description: `'${finalLocationName}' has been added to your saved addresses`,
          });
        } catch (error) {
          console.error('Error saving address:', error);
          toast({
            title: "Failed to save address",
            description: "There was an error saving this address to your list",
            variant: "destructive",
          });
        }
      }
    }
  };

  // Handle map click to set marker
  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      setLocation(newLocation);
    }
  };

  if (isLoadingCustomer || isLoadingMapsKey) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          Your current location will be used for delivery and pathfinding. You can set it by clicking on the map or using the button below.
        </p>

        <Button
          onClick={getCurrentLocation}
          variant="outline"
          className="w-full mb-4"
          disabled={isLocating}
        >
          {isLocating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Getting your location...
            </>
          ) : (
            <>
              <Navigation className="mr-2 h-4 w-4" />
              Use my current location
            </>
          )}
        </Button>
      </div>

      {mapsData?.key ? (
        <LoadScript
          googleMapsApiKey={mapsData.key}
          onLoad={() => console.log("Google Maps loaded successfully")}
          onError={(error) => console.error("Google Maps loading error:", error)}
          loadingElement={<div className="h-96 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        >
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={location || defaultCenter}
            zoom={15}
            onClick={handleMapClick}
            options={{
              fullscreenControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              zoomControl: true,
            }}
          >
            {location && (
              <Marker
                position={location}
                icon={{
                  url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png",
                  scaledSize: window.google?.maps ? new window.google.maps.Size(32, 32) : null,
                }}
              />
            )}
          </GoogleMap>
        </LoadScript>
      ) : (
        <Card className="p-8 text-center">
          <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Google Maps API key is missing. Please contact the administrator.
          </p>
        </Card>
      )}

      {/* Location name input */}
      {location && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="locationName">Name this location (optional)</Label>
            <Input
              id="locationName"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Home, Work, Friend's House"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Quick select:</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={namePreset === 'Home' ? 'default' : 'outline'}
                onClick={() => {
                  setNamePreset('Home');
                  setLocationName('Home');
                }}
              >
                <HomeIcon className="mr-2 h-4 w-4" />
                Home
              </Button>

              <Button
                type="button"
                size="sm"
                variant={namePreset === 'Work' ? 'default' : 'outline'}
                onClick={() => {
                  setNamePreset('Work');
                  setLocationName('Work');
                }}
              >
                <Briefcase className="mr-2 h-4 w-4" />
                Work
              </Button>

              {namePreset && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNamePreset(null);
                    setLocationName('');
                  }}
                >
                  <MapPinOff className="mr-2 h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={saveLocation}
          disabled={!location || updateLocationMutation.isPending}
        >
          {updateLocationMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving location...
            </>
          ) : (
            "Save Location"
          )}
        </Button>
      </div>

      {customer && (
        <div className="text-sm text-muted-foreground mt-2">
          <span className="font-semibold">Saved location:</span>{" "}
          {customer.defaultAddress ? (
            <>
              {customer.locationName && (
                <span className="font-semibold mr-1">{customer.locationName}:</span>
              )}
              {customer.defaultAddress}
            </>
          ) : customer.location && typeof customer.location === 'object' &&
             'lat' in customer.location && 'lng' in customer.location &&
             customer.location.lat && customer.location.lng ? (
            `Latitude: ${Number(customer.location.lat).toFixed(6)}, Longitude: ${Number(customer.location.lng).toFixed(6)}`
          ) : (
            "No location saved yet"
          )}
        </div>
      )}
    </div>
  );
}
