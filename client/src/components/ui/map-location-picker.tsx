import React, { useState, useCallback, useEffect } from "react";
import { GoogleMap, Marker, LoadScript } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const containerStyle = {
  width: "100%",
  height: "400px",
};

// Default center (Manila, Philippines)
const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

interface Location {
  lat: number;
  lng: number;
}

interface MapLocationPickerProps {
  onLocationSelect: (location: Location) => void;
  initialLocation?: Location;
}

export function MapLocationPicker({
  onLocationSelect,
  initialLocation
}: MapLocationPickerProps) {
  const [center, setCenter] = useState<Location>(initialLocation || defaultCenter);
  const [markerPosition, setMarkerPosition] = useState<Location | null>(initialLocation || null);
  const [address, setAddress] = useState<string>("");
  const [map, setMap] = useState<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fetch Google Maps API key from backend
  const { data: mapsData, isLoading: isLoadingKey } = useQuery<{ key: string }>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Handle map click to set marker
  const handleMapClick = useCallback((e: any) => {
    if (e.latLng) {
      const newPosition = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
      };
      setMarkerPosition(newPosition);
      onLocationSelect(newPosition);

      // Reverse geocode to get address (optional)
      if (map && window.google) {
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: newPosition }, (results: any, status: any) => {
          if (status === "OK" && results && results[0]) {
            setAddress(results[0].formatted_address);
          }
        });
      }
    }
  }, [map, onLocationSelect]);

  // Handle address search
  const handleAddressSearch = useCallback(() => {
    if (address && map && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === "OK" && results && results[0] && results[0].geometry && results[0].geometry.location) {
          const newPosition = {
            lat: results[0].geometry.location.lat(),
            lng: results[0].geometry.location.lng(),
          };
          setMarkerPosition(newPosition);
          setCenter(newPosition);
          map.setCenter(newPosition);
          onLocationSelect(newPosition);
        }
      });
    }
  }, [address, map, onLocationSelect]);

  // Get current location
  const handleGetCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMarkerPosition(newPosition);
          setCenter(newPosition);
          if (map) map.setCenter(newPosition);
          onLocationSelect(newPosition);

          // Reverse geocode to get address
          if (map && window.google) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: newPosition }, (results: any, status: any) => {
              if (status === "OK" && results && results[0]) {
                setAddress(results[0].formatted_address);
              }
            });
          }
        },
        (error) => {
          console.error("Error getting location: ", error);
        }
      );
    }
  }, [map, onLocationSelect]);

  // Load initial marker address if marker position exists
  useEffect(() => {
    if (markerPosition && map && window.google) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: markerPosition }, (results: any, status: any) => {
        if (status === "OK" && results && results[0]) {
          setAddress(results[0].formatted_address);
        }
      });
    }
  }, [map, markerPosition]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-2 mb-4">
            <div className="flex-grow">
              <Label htmlFor="address" className="mb-1 block">Search for an address</Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter address or location name"
                  className="flex-grow"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                />
                <Button
                  variant="outline"
                  onClick={handleAddressSearch}
                  disabled={isLoadingKey || !mapsData?.key}
                >
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end mb-4">
            <Button
              variant="outline"
              onClick={handleGetCurrentLocation}
              size="sm"
              disabled={isLoadingKey || !mapsData?.key}
            >
              <MapPin className="h-4 w-4 mr-1" />
              Use My Location
            </Button>
          </div>

          {isLoadingKey ? (
            <div className="flex items-center justify-center h-[400px] border rounded-md bg-muted/20">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                <p className="text-sm text-muted-foreground">Loading map...</p>
              </div>
            </div>
          ) : !mapsData?.key ? (
            <div className="flex items-center justify-center h-[400px] border rounded-md bg-muted/20">
              <div className="text-center p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Map could not be loaded. Please check your Google Maps API key.
                </p>
              </div>
            </div>
          ) : (
            <LoadScript googleMapsApiKey={mapsData?.key || ""}>
              <GoogleMap
                mapContainerStyle={containerStyle}
                center={center}
                zoom={15}
                onClick={handleMapClick}
                onLoad={setMap}
              >
                {markerPosition && <Marker position={markerPosition} />}
              </GoogleMap>
            </LoadScript>
          )}

          {markerPosition && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Selected location: {address || "Unknown address"}</p>
              <p>
                Coordinates: {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
