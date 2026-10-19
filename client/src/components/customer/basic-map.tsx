import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// Define component props
interface BasicMapProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

const BasicMap: React.FC<BasicMapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
}) => {
  // State variables
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapApiKey, setMapApiKey] = useState<string | null>(null);

  // DOM references
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map instance references (not tied to React render cycle)
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Unique ID for this map instance
  const uniqueId = useRef(`map-${Math.random().toString(36).slice(2, 11)}`);

  // Step 1: Fetch the Maps API key
  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/api/maps/key');
        const data = await response.json();
        if (data && data.key) {
          setMapApiKey(data.key);
        } else {
          setError('Failed to get Maps API key');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching Maps API key:', err);
        setError('Error fetching Maps API key');
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Step 2: Load Google Maps and initialize map when API key is available
  useEffect(() => {
    if (!mapApiKey) return;

    const initMap = () => {
      // Do not initialize if container is not available
      if (!mapContainerRef.current) {
        console.error('Map container not found');
        return;
      }

      // Do not initialize if Google Maps is not loaded
      if (!window.google || !window.google.maps) {
        console.error('Google Maps not loaded');
        return;
      }

      try {
        // Create map instance
        const mapOptions = {
          center: initialLocation || { lat: 14.5995, lng: 120.9842 }, // Manila
          zoom: 14,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
        };

        mapInstanceRef.current = new window.google.maps.Map(
          mapContainerRef.current,
          mapOptions
        );

        // Add marker if initial location provided
        if (initialLocation) {
          markerRef.current = new window.google.maps.Marker({
            position: initialLocation,
            map: mapInstanceRef.current,
            draggable: true,
          });

          // Get address for initial location
          getAddressFromCoords(initialLocation.lat, initialLocation.lng);
        }

        // Add click listener to map
        mapInstanceRef.current.addListener('click', (e: any) => {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          // Add or update marker
          if (markerRef.current) {
            markerRef.current.setPosition({ lat, lng });
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapInstanceRef.current,
              draggable: true,
            });
          }

          // Get address for clicked location
          getAddressFromCoords(lat, lng);
        });

        // Set up Places Autocomplete on search input
        if (searchInputRef.current && window.google.maps.places) {
          // Create the autocomplete object
          const autocomplete = new window.google.maps.places.Autocomplete(
            searchInputRef.current,
            { types: ['geocode'] }
          );

          // Bind the autocomplete to the map
          autocomplete.bindTo('bounds', mapInstanceRef.current);

          // Add listener for place selection
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();

            if (!place.geometry || !place.geometry.location) {
              console.error('No geometry found for selected place');
              return;
            }

            // If the place has a geometry, center the map on it
            const location = place.geometry.location;
            mapInstanceRef.current.setCenter(location);
            mapInstanceRef.current.setZoom(17);

            // Update or create marker
            const lat = location.lat();
            const lng = location.lng();

            if (markerRef.current) {
              markerRef.current.setPosition({ lat, lng });
            } else {
              markerRef.current = new window.google.maps.Marker({
                position: { lat, lng },
                map: mapInstanceRef.current,
                draggable: true,
              });

              // Add drag listener to marker
              markerRef.current.addListener('dragend', () => {
                const position = markerRef.current.getPosition();
                getAddressFromCoords(position.lat(), position.lng());
              });
            }

            // Get and set address
            let address = place.formatted_address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            onLocationSelect({ address, lat, lng });
          });
        }

        // Finish loading
        setLoading(false);
      } catch (err) {
        console.error('Error initializing map:', err);
        setError('Error initializing map');
        setLoading(false);
      }
    };

    // Helper function to get address from coordinates
    const getAddressFromCoords = (lat: number, lng: number) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng } },
        (results: any, status: any) => {
          let address = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

          if (status === 'OK' && results && results[0]) {
            address = results[0].formatted_address;
          }

          onLocationSelect({ address, lat, lng });
        }
      );
    };

    // Load Google Maps script with a unique callback name
    const loadGoogleMaps = () => {
      // Check if already loaded
      if (window.google && window.google.maps) {
        console.log('Google Maps already loaded');
        initMap();
        return;
      }

      // Create a unique callback name
      const callbackName = `initMap${uniqueId.current}`;

      // Create the global callback
      window[callbackName] = () => {
        console.log('Google Maps loaded');
        initMap();
      };

      // Create script element
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${mapApiKey}&libraries=places&callback=${callbackName}`;
      script.async = true;
      script.defer = true;

      // Add error handler
      script.onerror = () => {
        setError('Failed to load Google Maps script');
        setLoading(false);
      };

      // Add script to document
      document.head.appendChild(script);

      // Return cleanup function
      return () => {
        if (window[callbackName]) {
          delete window[callbackName];
        }
        document.head.removeChild(script);
      };
    };

    // Start the map loading process
    const cleanup = loadGoogleMaps();

    // Cleanup function
    return () => {
      if (cleanup) cleanup();

      // Clean up any listeners
      if (mapInstanceRef.current && window.google && window.google.maps) {
        window.google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
  }, [mapApiKey, initialLocation, onLocationSelect]);

  // Handle the "My Location" button click
  const handleMyLocationClick = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
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
          } else {
            markerRef.current = new window.google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstanceRef.current,
              draggable: true,
            });
          }

          // Get address for current location
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode(
            { location: { lat: latitude, lng: longitude } },
            (results: any, status: any) => {
              let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

              if (status === 'OK' && results && results[0]) {
                address = results[0].formatted_address;
              }

              onLocationSelect({ address, lat: latitude, lng: longitude });
            }
          );
        }
      },
      (err) => {
        console.error('Error getting location:', err);
      }
    );
  };

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

  // Render map
  return (
    <div className="space-y-2 w-full">
      <div className="relative">
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
            id={uniqueId.current}
            ref={mapContainerRef}
            className="rounded-md border overflow-hidden shadow-md"
            style={{ height, width }}
          ></div>

          <div className="absolute top-3 left-0 right-0 z-10 flex justify-center pointer-events-none">
            <div className="bg-white/90 px-3 py-1 rounded-full text-sm font-medium shadow-sm text-primary border border-primary/30 pointer-events-auto">
              Click anywhere on the map to set a pin
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BasicMap;
