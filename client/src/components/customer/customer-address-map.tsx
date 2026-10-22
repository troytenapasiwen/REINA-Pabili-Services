import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";

// Add type definitions for window.google and the callback function
declare global {
  interface Window {
    google: any;
    initGoogleMap: () => void;
  }
}

interface CustomerAddressMapProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
}

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila, Philippines

// Simplified version that uses vanilla JS to load Google Maps API
const CustomerAddressMap: React.FC<CustomerAddressMapProps> = ({
  onLocationSelect,
  initialLocation,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapCenter = initialLocation || DEFAULT_CENTER;

  useEffect(() => {
    let isMounted = true;
    let safetyTimeout: NodeJS.Timeout;

    const loadMap = async () => {
      try {
        console.log("Attempting to load map...");

        // Set a timeout to ensure loading is updated even if the script loading hangs
        safetyTimeout = setTimeout(() => {
          if (isMounted && loading) {
            console.error("Map loading timed out");
            setError("Map loading timed out. Please try again.");
            setLoading(false);
          }
        }, 8000); // 8 seconds timeout

        // Fetch the API key
        const response = await fetch("/api/maps/key");
        if (!response.ok) {
          throw new Error(`Failed to fetch Maps API key: ${response.status}`);
        }

        const data = await response.json();
        const apiKey = data.key;

        if (!apiKey) {
          throw new Error("No Maps API key received");
        }

        console.log("Maps API key received successfully");

        // Make sure we still need to proceed
        if (!isMounted) {
          return;
        }

        // If Google Maps API is already loaded, initialize the map
        if (window.google && window.google.maps) {
          console.log("Google Maps API already loaded");
          initializeMap();
          return;
        }

        console.log("Loading Google Maps API...");

        // Create a new script element
        const script = document.createElement("script");
        // Include places library for better geocoding
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMap`;
        script.async = true;
        script.defer = true;

        // Define a global callback function that will be called when the script loads
        window.initGoogleMap = () => {
          console.log("Google Maps callback executed");
          if (isMounted) {
            initializeMap();
          }
        };

        // Handle errors
        script.onerror = () => {
          console.error("Failed to load Google Maps script");
          if (isMounted) {
            setError("Failed to load Google Maps API. Please try again.");
            setLoading(false);
          }
        };

        // Append the script to the document
        document.head.appendChild(script);
      } catch (error) {
        console.error("Error loading map:", error);
        if (isMounted) {
          setError(`Failed to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setLoading(false);
        }
      }
    };

    const initializeMap = () => {
      console.log("Initializing map...");
      if (!mapRef.current || !window.google) {
        console.error("Can't initialize map: mapRef or window.google missing");
        setLoading(false);
        setError("Map initialization failed");
        return;
      }

      try {
        console.log("Creating map instance");
        // Create the map
        const mapOptions: google.maps.MapOptions = {
          center: mapCenter,
          zoom: 15,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        };

        googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);
        console.log("Map instance created successfully");

        // Add a marker if we have an initial location
        if (initialLocation) {
          console.log("Adding marker at initial location");
          markerRef.current = new google.maps.Marker({
            position: initialLocation,
            map: googleMapRef.current,
          });
        }

        // Add click listener
        googleMapRef.current.addListener("click", handleMapClick);

        // Try to get user's location if no initial location provided
        if (!initialLocation && navigator.geolocation) {
          console.log("Getting user's current location");
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };

              console.log("Got user location:", currentLocation);

              if (googleMapRef.current) {
                googleMapRef.current.setCenter(currentLocation);

                if (markerRef.current) {
                  markerRef.current.setPosition(currentLocation);
                } else {
                  markerRef.current = new google.maps.Marker({
                    position: currentLocation,
                    map: googleMapRef.current,
                  });
                }
              }
            },
            (err) => {
              console.error("Error getting user location:", err);
            }
          );
        }

        console.log("Map initialization complete");
        setLoading(false);
      } catch (err) {
        console.error("Error during map initialization:", err);
        setError("Error initializing map");
        setLoading(false);
      }
    };

    const handleMapClick = (e: google.maps.MapMouseEvent) => {
      if (!e.latLng || !googleMapRef.current) return;

      const clickedLat = e.latLng.lat();
      const clickedLng = e.latLng.lng();

      // Update or create the marker
      if (markerRef.current) {
        markerRef.current.setPosition({ lat: clickedLat, lng: clickedLng });
      } else {
        markerRef.current = new google.maps.Marker({
          position: { lat: clickedLat, lng: clickedLng },
          map: googleMapRef.current,
        });
      }

      // Reverse geocode the coordinates
      if (window.google && window.google.maps) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode(
          { location: { lat: clickedLat, lng: clickedLng } },
        ).then(response => {
          if (response.results && response.results[0]) {
            onLocationSelect(response.results[0].formatted_address, clickedLat, clickedLng);
          } else {
            onLocationSelect(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`, clickedLat, clickedLng);
          }
        }).catch(err => {
          console.error("Geocoding error:", err);
          onLocationSelect(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`, clickedLat, clickedLng);
        });
      } else {
        // If geocoder is not available, just use coordinates
        onLocationSelect(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`, clickedLat, clickedLng);
      }
    };

    loadMap();

    // Cleanup
    return () => {
      isMounted = false;

      // Remove event listeners if map exists
      if (googleMapRef.current) {
        google.maps.event.clearInstanceListeners(googleMapRef.current);
      }
    };
  }, [initialLocation, onLocationSelect]);

  // Update map center if initialLocation changes
  useEffect(() => {
    if (initialLocation && googleMapRef.current) {
      googleMapRef.current.setCenter(initialLocation);

      if (markerRef.current) {
        markerRef.current.setPosition(initialLocation);
      } else {
        markerRef.current = new google.maps.Marker({
          position: initialLocation,
          map: googleMapRef.current,
        });
      }
    }
  }, [initialLocation]);

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md max-w-md text-center">
          <p className="font-semibold mb-2">{error}</p>
          <p className="text-sm mb-4">We couldn't load the map. You can try again or continue without the map.</p>
          <div className="flex space-x-4 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => onLocationSelect("Manual address entry", 0, 0)}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4 mx-auto"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapRef} style={{ width: "100%", height: "100%" }}></div>
  );
};

export default CustomerAddressMap;
