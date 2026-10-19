import React, { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";

// Add type definitions for window.google and the callback function
declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsCallback: () => void;
  }
}

interface GoogleMapsReliableProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
}

const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 }; // Manila, Philippines

const GoogleMapsReliable: React.FC<GoogleMapsReliableProps> = ({
  onLocationSelect,
  initialLocation,
  height = "400px"
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

    const loadGoogleMaps = async () => {
      try {
        console.log("Starting to load Google Maps...");

        // Set a timeout to catch hanging requests
        safetyTimeout = setTimeout(() => {
          if (isMounted && loading) {
            console.error("Map loading timed out");
            setError("Map loading took too long. Please try again.");
            setLoading(false);
          }
        }, 10000); // 10 seconds timeout

        // Get API key from backend
        const response = await fetch("/api/maps/key");
        if (!response.ok) {
          throw new Error(`Failed to fetch Maps API key: ${response.status}`);
        }

        const data = await response.json();
        const apiKey = data.key;

        if (!apiKey) {
          throw new Error("No Maps API key received");
        }

        // If Google Maps API is already loaded, initialize the map
        if (window.google && window.google.maps) {
          console.log("Google Maps API already loaded");
          initializeMap();
          return;
        }

        // Define the callback function for when the Google Maps script loads
        window.initGoogleMapsCallback = () => {
          console.log("Google Maps loaded callback executed");
          if (isMounted) {
            initializeMap();
          }
        };

        // Create a new script element for Google Maps API
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;

        // Handle script loading errors
        script.onerror = () => {
          console.error("Failed to load Google Maps script");
          if (isMounted) {
            setError("Failed to load Google Maps. Please try again later.");
            setLoading(false);
          }
        };

        // Add the script to the document
        document.head.appendChild(script);
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        if (isMounted) {
          setError(`Failed to load map: ${error instanceof Error ? error.message : 'Unknown error'}`);
          setLoading(false);
        }
      }
    };

    const initializeMap = () => {
      console.log("Initializing Google Maps...");
      if (!mapRef.current || !window.google) {
        console.error("Cannot initialize map: mapRef or Google Maps not available");
        setLoading(false);
        setError("Map initialization failed");
        return;
      }

      try {
        // Create map options
        const mapOptions: google.maps.MapOptions = {
          center: mapCenter,
          zoom: 15,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU
          }
        };

        // Create the map
        googleMapRef.current = new google.maps.Map(mapRef.current, mapOptions);

        // Create search box for easier location finding
        if (window.google.maps.places) {
          const searchInput = document.createElement("input");
          searchInput.className = "controls";
          searchInput.type = "text";
          searchInput.placeholder = "Search for a location";
          searchInput.style.margin = "10px";
          searchInput.style.width = "300px";
          searchInput.style.padding = "8px";
          searchInput.style.borderRadius = "4px";
          searchInput.style.border = "1px solid #ccc";

          googleMapRef.current.controls[google.maps.ControlPosition.TOP_CENTER].push(searchInput);

          const searchBox = new google.maps.places.SearchBox(searchInput);

          // Add search event listener
          searchBox.addListener("places_changed", () => {
            const places = searchBox.getPlaces();
            if (!places || places.length === 0) return;

            const place = places[0];
            if (!place.geometry || !place.geometry.location) return;

            // Make sure we have a string value for formatted_address or name
            const address = typeof place.formatted_address === 'string' ? place.formatted_address :
                           (typeof place.name === 'string' ? place.name : "Selected location");

            // Move map to searched location
            if (googleMapRef.current) {
              googleMapRef.current.setCenter(place.geometry.location);
              googleMapRef.current.setZoom(17);

              // Update marker
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();

              if (markerRef.current) {
                markerRef.current.setPosition({ lat, lng });
              } else {
                markerRef.current = new google.maps.Marker({
                  position: { lat, lng },
                  map: googleMapRef.current,
                  animation: google.maps.Animation.DROP
                });
              }

              // Pass the location back
              onLocationSelect(address, lat, lng);
            }
          });
        }

        // Add a marker if we have an initial location
        if (initialLocation) {
          markerRef.current = new google.maps.Marker({
            position: initialLocation,
            map: googleMapRef.current,
            animation: google.maps.Animation.DROP
          });
        }

        // Add click listener
        googleMapRef.current.addListener("click", handleMapClick);

        // Try to get user's location if no initial location provided
        if (!initialLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
              };

              if (googleMapRef.current) {
                googleMapRef.current.setCenter(currentLocation);

                if (markerRef.current) {
                  markerRef.current.setPosition(currentLocation);
                } else {
                  markerRef.current = new google.maps.Marker({
                    position: currentLocation,
                    map: googleMapRef.current,
                    animation: google.maps.Animation.DROP
                  });
                }

                // Get address for the current location
                const geocoder = new google.maps.Geocoder();
                geocoder.geocode({ location: currentLocation })
                  .then(response => {
                    if (response.results && response.results[0]) {
                      onLocationSelect(
                        response.results[0].formatted_address,
                        currentLocation.lat,
                        currentLocation.lng
                      );
                    }
                  })
                  .catch(err => {
                    console.error("Error geocoding current location:", err);
                  });
              }
            },
            (err) => {
              console.error("Error getting user location:", err);
            }
          );
        }

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

      // Update marker position
      if (markerRef.current) {
        markerRef.current.setPosition({ lat: clickedLat, lng: clickedLng });
      } else {
        markerRef.current = new google.maps.Marker({
          position: { lat: clickedLat, lng: clickedLng },
          map: googleMapRef.current,
          animation: google.maps.Animation.DROP
        });
      }

      // Try to get address from coordinates using Geocoder
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: { lat: clickedLat, lng: clickedLng } })
        .then(response => {
          if (response.results && response.results[0]) {
            onLocationSelect(response.results[0].formatted_address, clickedLat, clickedLng);
          } else {
            onLocationSelect(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`, clickedLat, clickedLng);
          }
        })
        .catch(err => {
          console.error("Geocoding error:", err);
          onLocationSelect(`${clickedLat.toFixed(6)}, ${clickedLng.toFixed(6)}`, clickedLat, clickedLng);
        });
    };

    // Start loading the map
    loadGoogleMaps();

    // Cleanup function
    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);

      // Clean up the callback
      if (window.initGoogleMapsCallback) {
        // @ts-ignore - Safe to delete a property we added
        delete window.initGoogleMapsCallback;
      }

      // Remove event listeners
      if (googleMapRef.current) {
        google.maps.event.clearInstanceListeners(googleMapRef.current);
      }
    };
  }, [initialLocation, onLocationSelect, loading, mapCenter]);

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
          animation: google.maps.Animation.DROP
        });
      }
    }
  }, [initialLocation]);

  if (error) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="bg-destructive/10 text-destructive p-4 rounded-md max-w-md text-center">
          <p className="font-semibold mb-2">{error}</p>
          <p className="text-sm mb-4">We couldn't load the map. You can try again.</p>
          <div className="flex space-x-4 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ height }}>
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full mb-4 mx-auto"></div>
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={mapRef} style={{ width: "100%", height, borderRadius: "8px" }}></div>
  );
};

export default GoogleMapsReliable;
