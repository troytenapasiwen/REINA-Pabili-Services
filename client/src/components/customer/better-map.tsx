import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// Global types for Google Maps
declare global {
  interface Window {
    google: any;
    [key: string]: any; // For dynamic callback names
  }
}

// Component props
interface MapProps {
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

const BetterMap: React.FC<MapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
}) => {
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState('');

  // References
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  // Generate a unique id for this map instance
  const mapId = useRef(`map-${Math.random().toString(36).substring(2, 9)}`);

  // Fetch API key and initialize map
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    const setupMap = async () => {
      try {
        // Step 1: Fetch API key
        const response = await fetch('/api/maps/key');
        const data = await response.json();
        const apiKey = data.key;

        if (!apiKey) {
          throw new Error('Failed to get Google Maps API key');
        }

        // Step 2: Load Google Maps script
        if (window.google && window.google.maps) {
          console.log('Google Maps already loaded');
          initializeMap();
          return;
        }

        // Create a unique callback name based on map ID
        const callbackName = `initMap_${mapId.current}`;
        window[callbackName] = initializeMap;

        // Create and add script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
        script.async = true;
        script.defer = true;

        script.onerror = () => {
          setError('Failed to load Google Maps');
          setLoading(false);
        };

        // Add script to page
        document.head.appendChild(script);

      } catch (error) {
        console.error('Error setting up map:', error);
        setError('Failed to set up map');
        setLoading(false);
      }
    };

    // Function to initialize the map
    function initializeMap() {
      console.log('Initializing map...');

      // Add significant delay to ensure DOM is ready
      timeoutId = setTimeout(() => {
        try {
          // Check for container
          if (!mapContainerRef.current) {
            console.error('Map container not found');
            setError('Map container not found');
            setLoading(false);
            return;
          }

          // Create map
          const mapOptions = {
            center: initialLocation || DEFAULT_CENTER,
            zoom: 14,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
          };

          console.log('Creating map with container:', mapContainerRef.current);
          mapRef.current = new window.google.maps.Map(
            mapContainerRef.current,
            mapOptions
          );

          // Create geocoder
          geocoderRef.current = new window.google.maps.Geocoder();

          // Add marker if initial location exists
          if (initialLocation) {
            markerRef.current = new window.google.maps.Marker({
              position: initialLocation,
              map: mapRef.current,
              draggable: true,
            });

            // Get address for initial location
            getAddressFromCoordinates(initialLocation.lat, initialLocation.lng);
          }

          // Add map click listener
          mapRef.current.addListener('click', (e: any) => {
            const clickedLat = e.latLng.lat();
            const clickedLng = e.latLng.lng();

            // Update or create marker
            if (markerRef.current) {
              markerRef.current.setPosition({ lat: clickedLat, lng: clickedLng });
            } else {
              markerRef.current = new window.google.maps.Marker({
                position: { lat: clickedLat, lng: clickedLng },
                map: mapRef.current,
                draggable: true,
              });

              // Add drag listener
              markerRef.current.addListener('dragend', () => {
                const position = markerRef.current.getPosition();
                getAddressFromCoordinates(position.lat(), position.lng());
              });
            }

            // Get address for clicked location
            getAddressFromCoordinates(clickedLat, clickedLng);
          });

          // Setup search box
          if (searchInputRef.current && window.google.maps.places) {
            const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);

            // Bias to current map view
            mapRef.current.addListener('bounds_changed', () => {
              searchBox.setBounds(mapRef.current.getBounds());
            });

            // Handle place selection
            searchBox.addListener('places_changed', () => {
              const places = searchBox.getPlaces();
              if (!places || places.length === 0) return;

              const place = places[0];
              if (!place.geometry || !place.geometry.location) return;

              // Center map on place
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
                  draggable: true,
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

          setLoading(false);
          console.log('Map initialization complete');
        } catch (err) {
          console.error('Error initializing map:', err);
          setError('Failed to initialize map');
          setLoading(false);
        }
      }, 1000); // Use a 1-second delay to ensure DOM is ready
    }

    // Start setup process
    setupMap();

    // Cleanup
    return () => {
      if (timeoutId) clearTimeout(timeoutId);

      // Clean up map listeners
      if (mapRef.current && window.google && window.google.maps) {
        window.google.maps.event.clearInstanceListeners(mapRef.current);
      }

      // Remove callback
      const callbackName = `initMap_${mapId.current}`;
      if (window[callbackName]) {
        window[callbackName] = undefined;
      }
    };
  }, [initialLocation, onLocationSelect]);

  // Function to get address from coordinates
  const getAddressFromCoordinates = (lat: number, lng: number) => {
    if (!geocoderRef.current) return;

    geocoderRef.current.geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const address = results[0].formatted_address;
          setSelectedAddress(address);
          onLocationSelect({ address, lat, lng });
        } else {
          // Fallback to coordinates
          const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSelectedAddress(fallbackAddress);
          onLocationSelect({ address: fallbackAddress, lat, lng });
        }
      }
    );
  };

  // Get user's current location
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (mapRef.current) {
          // Update map center
          mapRef.current.setCenter({ lat: latitude, lng: longitude });
          mapRef.current.setZoom(17);

          // Update marker
          if (markerRef.current) {
            markerRef.current.setPosition({ lat: latitude, lng: longitude });
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapRef.current,
              draggable: true,
            });

            // Add drag listener
            markerRef.current.addListener('dragend', () => {
              const position = markerRef.current.getPosition();
              getAddressFromCoordinates(position.lat(), position.lng());
            });
          }

          // Update address
          getAddressFromCoordinates(latitude, longitude);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      }
    );
  };

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 h-full bg-gray-50 rounded-md" style={{ height }}>
        <div className="bg-red-50 p-4 rounded-md max-w-md text-center text-red-600">
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
      <div className="flex items-center justify-center h-full bg-gray-50 rounded-md" style={{ height, width }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  // Render map
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
            onClick={handleCurrentLocation}
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

export default BetterMap;
