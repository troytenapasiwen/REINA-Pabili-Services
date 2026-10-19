import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// Define the types for our component props
interface SimpleMapProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

// Add type definitions for the global Google object
// This is a module-scoped declaration to avoid conflicts with other files
interface Window {
  google: any; // Using any here to avoid TypeScript errors with the Google Maps API
  initMap?: () => void; // Optional so it can be set/unset
}

// Default center coordinates (Manila, Philippines)
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

const SimpleMap: React.FC<SimpleMapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
}) => {
  // Use a generated mapId to make each map instance unique
  const mapId = useRef<string>(`map-${Math.random().toString(36).substring(2, 9)}`);

  // Refs for DOM elements and Google Maps objects
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State variables
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');
  const [mapKey, setMapKey] = useState<string | null>(null);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/api/maps/key');
        const data = await response.json();
        if (data && data.key) {
          setMapKey(data.key);
        } else {
          setError('Failed to fetch Google Maps API key');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching Maps API key:', error);
        setError('Failed to fetch Google Maps API key');
        setIsLoading(false);
      }
    };

    fetchApiKey();

    // Clean up on unmount
    return () => {
      // If we had a map instance, clean it up
      if (mapRef.current) {
        // Remove any listeners
        if (window.google && window.google.maps && window.google.maps.event) {
          window.google.maps.event.clearInstanceListeners(mapRef.current);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Set up the map when the API key is available
  useEffect(() => {
    if (!mapKey) return;

    // Function to initialize the map
    const initializeMap = () => {
      const mapContainer = mapContainerRef.current;

      if (!mapContainer || !window.google || !window.google.maps) {
        console.error('Missing dependencies for map initialization');
        setError('Map initialization failed');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Creating map instance...');

        // Create map instance
        const mapOptions = {
          center: initialLocation || DEFAULT_CENTER,
          zoom: 14,
          mapTypeId: window.google.maps.MapTypeId.ROADMAP,
          fullscreenControl: true,
          streetViewControl: false,
        };

        mapRef.current = new window.google.maps.Map(mapContainer, mapOptions);

        // Create geocoder for address lookup
        const geocoder = new window.google.maps.Geocoder();

        // Add marker if initial location is provided
        if (initialLocation) {
          markerRef.current = new window.google.maps.Marker({
            position: initialLocation,
            map: mapRef.current,
            animation: window.google.maps.Animation.DROP,
            draggable: true,
          });

          // Get address for initial location
          geocoder.geocode(
            { location: initialLocation },
            (results: any, status: any) => {
              if (status === 'OK' && results && results[0]) {
                const address = results[0].formatted_address;
                setSelectedAddress(address);
                onLocationSelect({
                  address,
                  lat: initialLocation.lat,
                  lng: initialLocation.lng,
                });
              }
            }
          );
        }

        // Add click listener to the map
        mapRef.current.addListener('click', (e: any) => {
          const latLng = e.latLng;
          const lat = latLng.lat();
          const lng = latLng.lng();

          // Update or create marker
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapRef.current,
              animation: window.google.maps.Animation.DROP,
              draggable: true,
            });
          }

          // Add drag end event to marker
          if (markerRef.current) {
            markerRef.current.addListener('dragend', () => {
              const position = markerRef.current.getPosition();
              reverseGeocode(position.lat(), position.lng(), geocoder);
            });
          }

          // Get address for clicked location
          reverseGeocode(lat, lng, geocoder);
        });

        // Set up search box if input ref exists
        if (searchInputRef.current) {
          const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);

          // Bias results to current viewport
          mapRef.current.addListener('bounds_changed', () => {
            searchBox.setBounds(mapRef.current.getBounds());
          });

          // Listen for location selection from search
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places || !places.length) return;

            const place = places[0];
            if (!place.geometry || !place.geometry.location) return;

            // Center map on found place
            mapRef.current.setCenter(place.geometry.location);
            mapRef.current.setZoom(17);

            // Update marker
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            if (markerRef.current) {
              markerRef.current.setPosition({ lat, lng });
            } else {
              markerRef.current = new window.google.maps.Marker({
                position: { lat, lng },
                map: mapRef.current,
                animation: window.google.maps.Animation.DROP,
                draggable: true,
              });

              // Add drag listener to new marker
              markerRef.current.addListener('dragend', () => {
                const position = markerRef.current.getPosition();
                reverseGeocode(position.lat(), position.lng(), geocoder);
              });
            }

            // Use formatted address from place
            if (place.formatted_address) {
              setSelectedAddress(place.formatted_address);
              onLocationSelect({
                address: place.formatted_address,
                lat,
                lng,
              });
            }
          });
        }

        setIsLoading(false);
        console.log('Map initialized successfully!');
      } catch (error) {
        console.error('Error initializing map:', error);
        setError('Failed to initialize map');
        setIsLoading(false);
      }
    };

    // Helper function to reverse geocode a location
    const reverseGeocode = (lat: number, lng: number, geocoder: any) => {
      geocoder.geocode(
        { location: { lat, lng } },
        (results: any, status: any) => {
          let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          if (status === 'OK' && results && results[0]) {
            address = results[0].formatted_address;
          }

          setSelectedAddress(address);
          onLocationSelect({ address, lat, lng });
        }
      );
    };

    // Load Google Maps script if not already loaded
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded, initializing map directly');
      // Small timeout to ensure DOM is ready
      setTimeout(initializeMap, 100);
    } else {
      console.log('Loading Google Maps script...');

      // Set up global callback for script loading
      window.initMap = () => {
        console.log('Google Maps script loaded via callback');
        // Small timeout to ensure DOM is ready
        setTimeout(initializeMap, 100);
      };

      // Load script
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapKey}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;

      // Handle errors
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setError('Failed to load Google Maps');
        setIsLoading(false);
      };

      document.head.appendChild(script);
    }

    // Clean up on effect cleanup
    return () => {
      if (window.initMap) {
        // @ts-ignore - remove the global callback
        window.initMap = undefined;
      }
    };
  }, [mapKey, initialLocation, onLocationSelect]);

  // Get user's current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (mapRef.current) {
          mapRef.current.setCenter({ lat, lng });
          mapRef.current.setZoom(17);

          // Update marker
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapRef.current,
              animation: window.google.maps.Animation.DROP,
              draggable: true,
            });
          }

          // Get address
          if (window.google && window.google.maps) {
            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode(
              { location: { lat, lng } },
              (results: any, status: any) => {
                if (status === 'OK' && results && results[0]) {
                  const address = results[0].formatted_address;
                  setSelectedAddress(address);
                  onLocationSelect({ address, lat, lng });
                } else {
                  const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                  setSelectedAddress(fallbackAddress);
                  onLocationSelect({ address: fallbackAddress, lat, lng });
                }
              }
            );
          }
        }
      },
      (error) => {
        console.error('Error getting current location:', error);
      }
    );
  };

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full" style={{ height }}>
        <div className="bg-destructive/10 p-4 rounded-md max-w-md text-center text-destructive">
          <h3 className="font-bold mb-2">Error</h3>
          <p>{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center" style={{ height, width }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render the map
  return (
    <div className="space-y-2 w-full">
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search for a location"
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-2"
        />

        <div
          id={mapId.current}
          ref={mapContainerRef}
          className="rounded-md border overflow-hidden"
          style={{ height, width }}
        ></div>

        <div className="absolute bottom-4 right-4 z-10 space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={getCurrentLocation}
            title="Use my current location"
          >
            <MapPin className="h-4 w-4 mr-1" />
            My Location
          </Button>
        </div>
      </div>

      {selectedAddress && (
        <div className="text-sm text-muted-foreground">
          <strong>Selected:</strong> {selectedAddress}
        </div>
      )}
    </div>
  );
};

export default SimpleMap;
