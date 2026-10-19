import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// Add a global declaration for Google
declare global {
  interface Window {
    google: any;
    [key: string]: any; // For dynamic callback names
  }
}

// Define props interface
interface MapSimpleProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

// Default location (Manila)
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

const MapSimple: React.FC<MapSimpleProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
}) => {
  // DOM refs
  const mapContainer = useRef<HTMLDivElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapApiKey, setMapApiKey] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');

  // Map objects refs (not tied to React rendering)
  const mapInstance = useRef<any>(null);
  const marker = useRef<any>(null);
  const geocoder = useRef<any>(null);

  // Unique ID for this map instance
  const mapId = useRef(`map-${Math.random().toString(36).substring(2, 9)}`);

  // Step 1: Fetch the API key
  useEffect(() => {
    const getApiKey = async () => {
      try {
        const response = await fetch('/api/maps/key');
        const data = await response.json();
        setMapApiKey(data.key);
      } catch (error) {
        console.error('Error fetching Maps API key:', error);
        setError('Failed to load Maps API key');
        setLoading(false);
      }
    };

    getApiKey();

    // Cleanup function
    return () => {
      // Clean up map instance if it exists
      if (mapInstance.current && window.google && window.google.maps) {
        google.maps.event.clearInstanceListeners(mapInstance.current);
        mapInstance.current = null;
      }
    };
  }, []);

  // Step 2: Initialize the map when we have the API key
  useEffect(() => {
    if (!mapApiKey) return;

    // Function to initialize map with a delay to ensure DOM is ready
    const initializeMap = () => {
      // Add a longer delay to make sure the DOM is fully rendered
      setTimeout(() => {
        if (!mapContainer.current) {
          console.error('Map container element not found');
          setError('Map container not found');
          setLoading(false);
          return;
        }

        if (!window.google || !window.google.maps) {
          console.error('Google Maps API not loaded');
          setError('Google Maps failed to load');
          setLoading(false);
          return;
        }

        try {
          // Create map
          const options = {
            center: initialLocation || DEFAULT_CENTER,
            zoom: 14,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
          };

          console.log('Creating Google Map instance...');
          mapInstance.current = new google.maps.Map(
            mapContainer.current,
            options
          );

        // Create geocoder
        geocoder.current = new google.maps.Geocoder();

        // Create marker if initial location is set
        if (initialLocation) {
          marker.current = new google.maps.Marker({
            position: initialLocation,
            map: mapInstance.current,
            animation: google.maps.Animation.DROP,
            draggable: true,
          });

          // Get address for initial location
          getAddressFromCoordinates(initialLocation.lat, initialLocation.lng);
        }

        // Add click listener to map
        mapInstance.current.addListener('click', (event: any) => {
          const clickedLat = event.latLng.lat();
          const clickedLng = event.latLng.lng();

          // Add or update marker
          if (marker.current) {
            marker.current.setPosition({ lat: clickedLat, lng: clickedLng });
          } else {
            marker.current = new google.maps.Marker({
              position: { lat: clickedLat, lng: clickedLng },
              map: mapInstance.current,
              animation: google.maps.Animation.DROP,
              draggable: true,
            });

            // Add drag end listener
            marker.current.addListener('dragend', () => {
              const position = marker.current.getPosition();
              getAddressFromCoordinates(position.lat(), position.lng());
            });
          }

          // Get address for clicked location
          getAddressFromCoordinates(clickedLat, clickedLng);
        });

        // Setup search box if input exists
        if (searchInput.current && window.google.maps.places) {
          const searchBox = new google.maps.places.SearchBox(searchInput.current);

          // Bias results toward current map viewport
          mapInstance.current.addListener('bounds_changed', () => {
            searchBox.setBounds(mapInstance.current.getBounds());
          });

          // Listen for search results
          searchBox.addListener('places_changed', () => {
            const places = searchBox.getPlaces();
            if (!places || places.length === 0) return;

            const place = places[0];
            if (!place.geometry || !place.geometry.location) return;

            // Zoom to the place
            mapInstance.current.setCenter(place.geometry.location);
            mapInstance.current.setZoom(17);

            // Update marker
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            if (marker.current) {
              marker.current.setPosition({ lat, lng });
            } else {
              marker.current = new google.maps.Marker({
                position: { lat, lng },
                map: mapInstance.current,
                animation: google.maps.Animation.DROP,
                draggable: true,
              });

              // Add drag end listener
              marker.current.addListener('dragend', () => {
                const position = marker.current.getPosition();
                getAddressFromCoordinates(position.lat(), position.lng());
              });
            }

            // Update address
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

        // Map is loaded
        setLoading(false);
        console.log('Map initialized successfully');
      } catch (err) {
        console.error('Error creating map:', err);
        setError('Error initializing map');
        setLoading(false);
      }
      }, 1000);
    };

    // Load the Google Maps script if not already loaded
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded, initializing map directly');
      initializeMap();
    } else {
      console.log('Loading Google Maps script...');

      // Create a globally available callback function
      const callbackName = `initMap${mapId.current.replace(/-/g, '')}`;

      // @ts-ignore - Add callback to window
      window[callbackName] = () => {
        console.log('Google Maps script loaded via callback');
        initializeMap();
      };

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapApiKey}&libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;

      // Handle script errors
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setError('Failed to load Google Maps script');
        setLoading(false);
      };

      // Add script to document
      document.head.appendChild(script);

      // Cleanup function
      return () => {
        // Remove callback from window
        // @ts-ignore
        if (window[callbackName]) window[callbackName] = undefined;

        // Remove script if it still exists
        if (document.head.contains(script)) {
          document.head.removeChild(script);
        }
      };
    }
  }, [mapApiKey, initialLocation, onLocationSelect]);

  // Get address from coordinates using geocoder
  const getAddressFromCoordinates = (lat: number, lng: number) => {
    if (!geocoder.current) return;

    geocoder.current.geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          // Success - use formatted address
          const address = results[0].formatted_address;
          setSelectedAddress(address);
          onLocationSelect({ address, lat, lng });
        } else {
          // Failure - use coordinates as fallback
          const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSelectedAddress(fallbackAddress);
          onLocationSelect({ address: fallbackAddress, lat, lng });
        }
      }
    );
  };

  // Get user's current location
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (mapInstance.current) {
          // Move map to user's location
          mapInstance.current.setCenter({ lat: latitude, lng: longitude });
          mapInstance.current.setZoom(17);

          // Add or update marker
          if (marker.current) {
            marker.current.setPosition({ lat: latitude, lng: longitude });
          } else {
            marker.current = new google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstance.current,
              animation: google.maps.Animation.DROP,
              draggable: true,
            });

            // Add drag end listener
            marker.current.addListener('dragend', () => {
              const position = marker.current.getPosition();
              getAddressFromCoordinates(position.lat(), position.lng());
            });
          }

          // Get address
          getAddressFromCoordinates(latitude, longitude);
        }
      },
      (error) => {
        console.error('Error getting user location:', error);
      }
    );
  };

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 bg-muted/20 rounded-md" style={{ height }}>
        <div className="bg-destructive/10 p-4 rounded-md max-w-md text-center text-destructive">
          <h3 className="font-bold mb-2">Map Error</h3>
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
  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height, width }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render map
  return (
    <div className="space-y-2 w-full">
      <div className="relative">
        <input
          ref={searchInput}
          type="text"
          placeholder="Search for a location"
          className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-2"
        />

        <div
          id={mapId.current}
          ref={mapContainer}
          className="rounded-md border overflow-hidden"
          style={{ height, width }}
        ></div>

        <div className="absolute bottom-4 right-4 z-10 space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleGetCurrentLocation}
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

export default MapSimple;
