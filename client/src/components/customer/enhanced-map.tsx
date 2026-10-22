import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Define the props interface
interface EnhancedMapProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
  label?: string;
}

const EnhancedMap: React.FC<EnhancedMapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
  label = 'Click anywhere on the map to set a pin'
}) => {
  // State variables
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // DOM references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch Google Maps API key from backend
  const { data: mapsData, isLoading: isLoadingKey, isError: isKeyError } = useQuery<{key: string}>({
    queryKey: ['/api/maps/key'],
    staleTime: Infinity,
  });

  // Initialize the map once we have the API key
  useEffect(() => {
    if (!mapsData?.key || !mapContainerRef.current) return;

    const apiKey = mapsData.key;
    console.log("Got Maps API key, initializing map...");

    // Don't re-initialize if already loaded
    if (mapLoaded && mapInstanceRef.current) return;

    // Function to initialize the map
    const initializeMap = () => {
      if (!window.google || !window.google.maps) {
        console.error("Google Maps library not loaded");
        setError("Failed to load Google Maps. Please try refreshing the page.");
        return;
      }

      try {
        // Default center if no initial location
        const defaultCenter = initialLocation || { lat: 14.5995, lng: 120.9842 }; // Manila, Philippines

        // Create map
        const mapOptions = {
          center: defaultCenter,
          zoom: 15,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
        };

        // Initialize the map
        if (mapContainerRef.current) {
          const map = new window.google.maps.Map(mapContainerRef.current, mapOptions);
          mapInstanceRef.current = map;

          // Add marker if initial location provided
          if (initialLocation) {
            const marker = new window.google.maps.Marker({
              position: initialLocation,
              map: map,
              draggable: true,
              animation: google.maps.Animation.DROP
            });

            markerRef.current = marker;

            // Get address for initial location
            getAddressFromCoords(initialLocation.lat, initialLocation.lng);

            // Add listener for when marker is dragged
            marker.addListener('dragend', function() {
              const position = marker.getPosition();
              if (position) {
                getAddressFromCoords(position.lat(), position.lng());
              }
            });
          }

          // Add click listener to map
          map.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;

            const lat = e.latLng.lat();
            const lng = e.latLng.lng();

            // Update or create marker
            if (markerRef.current) {
              markerRef.current.setPosition({ lat, lng });
            } else {
              const marker = new window.google.maps.Marker({
                position: { lat, lng },
                map: map,
                draggable: true,
                animation: google.maps.Animation.DROP
              });

              markerRef.current = marker;

              // Add listener for when marker is dragged
              marker.addListener('dragend', function() {
                const position = marker.getPosition();
                if (position) {
                  getAddressFromCoords(position.lat(), position.lng());
                }
              });
            }

            // Get address from coordinates
            getAddressFromCoords(lat, lng);
          });

          // Initialize search box if Places library is available
          if (searchInputRef.current && window.google.maps.places) {
            const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);
            searchBoxRef.current = searchBox;

            // Bias the search box to within the map's viewport
            map.addListener('bounds_changed', () => {
              if (searchBoxRef.current && mapInstanceRef.current) {
                searchBoxRef.current.setBounds(mapInstanceRef.current.getBounds() as google.maps.LatLngBounds);
              }
            });

            // Listen for the event fired when the user selects a prediction
            searchBox.addListener('places_changed', () => {
              const places = searchBox.getPlaces();
              if (!places || places.length === 0) return;

              const place = places[0];
              if (!place.geometry || !place.geometry.location) return;

              // Update map and marker
              map.setCenter(place.geometry.location);
              map.setZoom(17);

              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();

              // Update or create marker
              if (markerRef.current) {
                markerRef.current.setPosition({ lat, lng });
              } else {
                const marker = new window.google.maps.Marker({
                  position: { lat, lng },
                  map: map,
                  draggable: true,
                  animation: google.maps.Animation.DROP
                });

                markerRef.current = marker;

                // Add listener for when marker is dragged
                marker.addListener('dragend', function() {
                  const position = marker.getPosition();
                  if (position) {
                    getAddressFromCoords(position.lat(), position.lng());
                  }
                });
              }

              // Get address from the place or coordinates
              const address = place.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
              onLocationSelect({ address, lat, lng });
            });
          }

          setMapLoaded(true);
        }
      } catch (err) {
        console.error("Error initializing map:", err);
        setError("Error initializing map. Please try again.");
      }
    };

    // Helper function to get address from coordinates
    const getAddressFromCoords = (lat: number, lng: number) => {
      if (!window.google || !window.google.maps) return;

      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } })
        .then((response: google.maps.GeocoderResponse) => {
          if (response.results && response.results[0]) {
            const address = response.results[0].formatted_address;
            onLocationSelect({ address, lat, lng });
          } else {
            onLocationSelect({ address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
          }
        })
        .catch((error: unknown) => {
          console.error("Geocoder failed:", error);
          onLocationSelect({ address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
        });
    };

    // Load Google Maps script if not already loaded
    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeMap;
      script.onerror = () => {
        console.error("Failed to load Google Maps script");
        setError("Failed to load Google Maps. Please check your internet connection and try again.");
      };
      document.head.appendChild(script);

      return () => {
        // Clean up script if component unmounts before script loads
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    } else {
      // Google Maps already loaded
      initializeMap();
    }

  }, [mapsData, initialLocation, onLocationSelect, mapLoaded]);

  // Handle "My Location" button click
  const handleMyLocationClick = () => {
    if (!navigator.geolocation) {
      console.error("Geolocation is not supported by this browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.setCenter({ lat: latitude, lng: longitude });
          mapInstanceRef.current.setZoom(17);

          if (markerRef.current) {
            markerRef.current.setPosition({ lat: latitude, lng: longitude });
          } else if (window.google && window.google.maps) {
            const marker = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstanceRef.current,
              draggable: true,
              animation: google.maps.Animation.DROP
            });

            markerRef.current = marker;

            // Add listener for when marker is dragged
            marker.addListener('dragend', function() {
              const position = marker.getPosition();
              if (position) {
                const lat = position.lat();
                const lng = position.lng();

                if (window.google && window.google.maps) {
                  const geocoder = new window.google.maps.Geocoder();
                  geocoder.geocode({ location: { lat, lng } })
                    .then((response: google.maps.GeocoderResponse) => {
                      if (response.results && response.results[0]) {
                        const address = response.results[0].formatted_address;
                        onLocationSelect({ address, lat, lng });
                      } else {
                        onLocationSelect({ address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
                      }
                    })
                    .catch((error: unknown) => {
                      console.error("Geocoder failed:", error);
                      onLocationSelect({ address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng });
                    });
                }
              }
            });
          }

          // Get address for current location
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: { lat: latitude, lng: longitude } })
              .then((response: google.maps.GeocoderResponse) => {
                if (response.results && response.results[0]) {
                  const address = response.results[0].formatted_address;
                  onLocationSelect({ address, lat: latitude, lng: longitude });
                } else {
                  onLocationSelect({
                    address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                    lat: latitude,
                    lng: longitude
                  });
                }
              })
              .catch((error: unknown) => {
                console.error("Geocoder failed:", error);
                onLocationSelect({
                  address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
                  lat: latitude,
                  lng: longitude
                });
              });
          }
        }
      },
      (error) => {
        console.error("Error getting current location:", error);
        alert("Unable to retrieve your location. Please check your device settings and permissions.");
      }
    );
  };

  // Show loading state
  if (isLoadingKey) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full bg-gray-50 rounded-md" style={{ height, width }}>
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  // Show error state
  if (isKeyError || error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full bg-gray-50 rounded-md" style={{ height, width }}>
        <div className="bg-destructive/10 text-destructive p-4 rounded-md max-w-md text-center">
          <p className="font-semibold mb-2">Failed to load map</p>
          <p className="text-sm mb-4">{error || "Could not retrieve Google Maps API key. Please try again later."}</p>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex mb-2 gap-2">
        <div className="relative flex-1">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location"
            className="w-full pl-9 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="absolute left-3 top-2.5 text-gray-400">
            <MapPin className="h-4 w-4" />
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleMyLocationClick}
          title="Use my current location"
          className="whitespace-nowrap"
        >
          <MapPin className="h-4 w-4 mr-1" />
          My Location
        </Button>
      </div>

      <div className="relative">
        <div
          ref={mapContainerRef}
          className="rounded-md border overflow-hidden shadow-md"
          style={{ height, width }}
        ></div>

        <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
          <div className="bg-white/90 px-3 py-1 rounded-full text-sm font-medium shadow-sm text-primary border border-primary/30 pointer-events-auto">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedMap;
