import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadScript, GoogleMap, Marker } from "@react-google-maps/api";
import { MapPin, Navigation, Loader2, Home as HomeIcon, Briefcase, MapPinOff, Search, GraduationCap, Dumbbell, Users } from "lucide-react";
import { Autocomplete } from "@react-google-maps/api";

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

interface EnhancedLocationPickerProps {
  onLocationSaved?: (address: string, locationName?: string, location?: {lat: number, lng: number}) => void;
  saveToAddresses?: boolean;
  initialLocation?: Location;
}

export function EnhancedLocationPicker({
  onLocationSaved,
  saveToAddresses = false,
  initialLocation
}: EnhancedLocationPickerProps) {
  const { toast } = useToast();
  const [location, setLocation] = useState<Location | null>(initialLocation || null);
  const [locationName, setLocationName] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [namePreset, setNamePreset] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // References for Google Maps objects
  const mapRef = useRef<google.maps.Map | null>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
    // If initialLocation is provided, use that
    if (initialLocation) {
      setLocation(initialLocation);
      return;
    }

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
  }, [customer, initialLocation]);

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

          // Also center the map on this location if map is loaded
          if (mapRef.current) {
            mapRef.current.panTo(newLocation);
            mapRef.current.setZoom(16);
          }

          // Get address from coordinates
          if (mapLoaded) {
            getAddressFromCoordinates(newLocation.lat, newLocation.lng).then(address => {
              console.log("Got address:", address);
            });
          }

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
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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

  // Get human-readable address from coordinates using Geocoder
  const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
    if (!window.google || !window.google.maps) {
      return `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    }

    try {
      const geocoder = new window.google.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat, lng }
      });

      if (response.results && response.results.length > 0) {
        return response.results[0].formatted_address;
      } else {
        return `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      }
    } catch (error) {
      console.error('Error getting address:', error);
      return `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
    }
  };

  // Handle when map is loaded
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapLoaded(true);

    // If location is set, center map on it
    if (location) {
      map.panTo(location);
      map.setZoom(16);
    }
  }, [location]);

  // Handle when Autocomplete is loaded
  const onAutocompleteLoad = useCallback((autocomplete: google.maps.places.Autocomplete) => {
    autocompleteRef.current = autocomplete;

    // Add listener for place changed
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();

      if (!place.geometry || !place.geometry.location) {
        console.error("No geometry found for selected place");
        return;
      }

      // Get coordinates
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      // Update location
      setLocation({ lat, lng });

      // Center map
      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(17);
      }

      // If the place has a name, suggest it as location name
      if (place.name && place.types &&
         (place.types.includes('establishment') ||
          place.types.includes('point_of_interest'))) {
        setLocationName(place.name);
        setNamePreset(null); // Clear preset when an establishment is selected
      }
    });
  }, []);

  // Handle map click to set marker
  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const newLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      setLocation(newLocation);

      // Get address from coordinates
      if (mapLoaded) {
        getAddressFromCoordinates(newLocation.lat, newLocation.lng).then(address => {
          console.log("Got address from map click:", address);
        });
      }
    }
  }, [mapLoaded]);

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

  if (isLoadingCustomer || isLoadingMapsKey) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!mapsData?.key) {
    return (
      <Card className="p-8 text-center">
        <MapPin className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Google Maps API key is missing. Please contact the administrator.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground mb-2">
          Pin your delivery location on the map. You can search for an address, use your current location, or click directly on the map.
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

      <LoadScript
        googleMapsApiKey={mapsData.key}
        libraries={["places"]}
        onLoad={() => console.log("Google Maps loaded successfully")}
        onError={(error) => console.error("Google Maps loading error:", error)}
        loadingElement={
          <div className="h-96 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        }
      >
        <div className="relative mb-4">
          <Autocomplete
            onLoad={onAutocompleteLoad}
            restrictions={{ country: "ph" }}
            options={{
              componentRestrictions: { country: "ph" },
              fields: ["formatted_address", "geometry", "name", "place_id", "types"],
              types: ["geocode", "establishment"]
            }}
          >
            <div className="relative">
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Search for a location"
                className="w-full pr-10"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Autocomplete>
        </div>

        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={location || defaultCenter}
          zoom={15}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            fullscreenControl: true,
            streetViewControl: false,
            mapTypeControl: true,
            zoomControl: true,
            mapTypeId: window.google?.maps?.MapTypeId.ROADMAP
          }}
        >
          {location && (
            <Marker
              position={location}
              animation={window.google?.maps?.Animation.DROP}
            />
          )}
        </GoogleMap>
      </LoadScript>

      {/* Location name input */}
      {location && (
        <div className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label htmlFor="locationName">Name this location</Label>
            <Input
              id="locationName"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Home, Work, Friend's House, Favorite Restaurant"
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Give your address a descriptive name to easily find it later. You can save multiple addresses with different names.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Quick select common locations:</p>
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

              <Button
                type="button"
                size="sm"
                variant={namePreset === 'School' ? 'default' : 'outline'}
                onClick={() => {
                  setNamePreset('School');
                  setLocationName('School');
                }}
              >
                <GraduationCap className="mr-2 h-4 w-4" />
                School
              </Button>

              <Button
                type="button"
                size="sm"
                variant={namePreset === 'Gym' ? 'default' : 'outline'}
                onClick={() => {
                  setNamePreset('Gym');
                  setLocationName('Gym');
                }}
              >
                <Dumbbell className="mr-2 h-4 w-4" />
                Gym
              </Button>

              <Button
                type="button"
                size="sm"
                variant={namePreset === 'Friend' ? 'default' : 'outline'}
                onClick={() => {
                  setNamePreset('Friend');
                  setLocationName('Friend\'s Place');
                }}
              >
                <Users className="mr-2 h-4 w-4" />
                Friend
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
