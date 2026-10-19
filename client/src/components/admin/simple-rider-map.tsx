import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow
} from "@react-google-maps/api";
import { useQuery } from "@tanstack/react-query";
import { Rider, User } from "@shared/schema";
import { Loader2, MapPin } from "lucide-react";

const mapContainerStyle = {
  width: "100%",
  height: "600px",
  borderRadius: "8px",
};

const defaultCenter = {
  lat: 14.5995,
  lng: 120.9842,
};

const statusColors = {
  active: "green",
  inactive: "gray",
  waiting: "orange",
  offline: "red",
};

interface SimpleRiderMapProps {
  riders: Rider[];
  users: User[];
}

export function SimpleRiderMap({ riders, users }: SimpleRiderMapProps) {
  const [selectedRider, setSelectedRider] = useState<any>(null);
  const [processedRiders, setProcessedRiders] = useState<any[]>([]);

  // Fetch Google Maps API key
  const { data: mapsData, isLoading: isLoadingMapsKey } = useQuery({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Process riders data once when props change
  useEffect(() => {
    const processed = riders.map(rider => {
      const user = users.find(u => u.id === rider.userId);
      const displayName = user?.fullName || user?.username || `Rider #${rider.id}`;

      let location = null;
      if (rider.currentLocation) {
        try {
          if (typeof rider.currentLocation === 'string') {
            const locationData = JSON.parse(rider.currentLocation);
            if (locationData.latitude && locationData.longitude) {
              location = {
                lat: parseFloat(locationData.latitude),
                lng: parseFloat(locationData.longitude),
              };
            }
          } else if (rider.currentLocation && typeof rider.currentLocation === 'object') {
            const loc = rider.currentLocation as any;
            if (loc.latitude && loc.longitude) {
              location = {
                lat: parseFloat(loc.latitude),
                lng: parseFloat(loc.longitude),
              };
            } else if (loc.lat && loc.lng) {
              location = {
                lat: parseFloat(loc.lat),
                lng: parseFloat(loc.lng),
              };
            }
          }
        } catch (error) {
          console.error("Error parsing rider location:", error);
        }
      }

      return {
        ...rider,
        displayName,
        location
      };
    });

    setProcessedRiders(processed);
  }, [riders, users]);

  const activeLocations = processedRiders.filter(rider => rider.location).length;

  if (isLoadingMapsKey) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!mapsData || !mapsData.key) {
    return (
      <Card className="mb-6">
        <CardContent className="flex items-center justify-center h-[600px]">
          <div className="text-center max-w-md p-4">
            <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">Map API Key Missing</p>
            <p className="text-muted-foreground">
              Google Maps API key is required to display the rider location map.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-medium">Rider Locations</CardTitle>
          <Badge variant="outline" className="ml-2">
            {activeLocations} active locations
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time location of all enrolled riders on the platform. Click a rider to view details.
        </p>
      </CardHeader>
      <CardContent className="p-4">
        <LoadScript googleMapsApiKey={mapsData.key}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={
              processedRiders.find(r => r.location)?.location || defaultCenter
            }
            zoom={12}
            options={{
              fullscreenControl: true,
              streetViewControl: false,
              mapTypeControl: true,
              zoomControl: true,
            }}
          >
            {/* Render rider markers */}
            {processedRiders
              .filter(rider => rider.location)
              .map(rider => (
                <Marker
                  key={rider.id}
                  position={rider.location}
                  onClick={() => setSelectedRider(rider)}
                  icon={{
                    url: `http://maps.google.com/mapfiles/ms/icons/${
                      statusColors[rider.status as keyof typeof statusColors] || 'red'
                    }-dot.png`,
                    scaledSize: window.google ? new window.google.maps.Size(40, 40) : undefined,
                  }}
                />
              ))}

            {/* Show info window for selected rider */}
            {selectedRider && selectedRider.location && (
              <InfoWindow
                position={selectedRider.location}
                onCloseClick={() => setSelectedRider(null)}
              >
                <div className="p-2 max-w-[220px]">
                  <h3 className="font-medium text-sm">{selectedRider.displayName}</h3>
                  <p className="text-xs text-gray-600">ID: RDR-{selectedRider.id}</p>
                  <div className="mt-1 text-xs">
                    <span className="font-medium">Status: </span>
                    <span className="capitalize">
                      {selectedRider.status}
                    </span>
                  </div>
                  <div className="text-xs mt-1">
                    <span className="font-medium">Vehicle: </span>
                    {selectedRider.vehicleType}
                    {selectedRider.vehiclePlateNumber && ` (${selectedRider.vehiclePlateNumber})`}
                  </div>
                  <div className="text-xs mt-1">
                    <span className="font-medium">License: </span>
                    {selectedRider.licenseNumber}
                  </div>
                  <div className="text-xs mt-1">
                    <span className="font-medium">Queue Position: </span>
                    #{selectedRider.queuePosition}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </CardContent>
    </Card>
  );
}
