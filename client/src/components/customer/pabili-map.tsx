import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';

// Add global type definition for the map callback
declare global {
  interface Window {
    initPabiliMap?: () => void;
    google: any;
  }
}

interface PabiliMapProps {
  onLocationSelect: (location: {
    address: string;
    lat: number;
    lng: number;
  }) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
}

// Default center (Manila, Philippines)
const DEFAULT_CENTER = { lat: 14.5995, lng: 120.9842 };

const PabiliMap: React.FC<PabiliMapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
}) => {
  // Create a unique ID for this map instance
  const mapId = useRef<string>(`map-${Math.random().toString(36).substr(2, 9)}`);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const geocoderRef = useRef<any>(null);
  const searchBoxRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<string>('');

  // Step 1: Fetch the API key
  useEffect(() => {
    let isMounted = true;

    const fetchKey = async () => {
      try {
        const response = await fetch('/api/maps/key');
        const data = await response.json();

        if (!isMounted) return;

        if (data && data.key) {
          // Once we have the key, load the script
          loadGoogleMapsScript(data.key);
        } else {
          setError('Could not retrieve Maps API key');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error fetching Maps API key:', error);
        if (isMounted) {
          setError('Failed to load Maps API key');
          setIsLoading(false);
        }
      }
    };

    fetchKey();

    // Cleanup function
    return () => {
      isMounted = false;

      // Clean up map instance and listeners
      if (mapInstanceRef.current && window.google && window.google.maps) {
        google.maps.event.clearInstanceListeners(mapInstanceRef.current);
      }
    };
  }, []);

  // Step 2: Load the Google Maps script
  const loadGoogleMapsScript = (apiKey: string) => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      console.log('Google Maps already loaded, initializing map directly');
      initializeMap();
      return;
    }

    console.log('Loading Google Maps script...');

    // Set up the callback function
    window.initPabiliMap = () => {
      console.log('Google Maps script loaded via callback');
      initializeMap();
    };

    // Create script tag
    const script = document.createElement('script');

    // Set script attributes
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initPabiliMap`;
    script.async = true;
    script.defer = true;

    // Handle errors
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setError('Failed to load Google Maps');
      setIsLoading(false);
    };

    // Add script to document
    document.head.appendChild(script);
  };

  // Step 3: Initialize the map
  const initializeMap = () => {
    if (!mapContainerRef.current) {
      console.error('Map container not found');
      setError('Map container not found');
      setIsLoading(false);
      return;
    }

    // Ensure Google Maps API is loaded
    if (!window.google || !window.google.maps) {
      console.error('Google Maps API not loaded');
      setError('Google Maps failed to load');
      setIsLoading(false);
      return;
    }

    try {
      console.log('Creating map instance...');

      // Add a small delay to ensure the DOM is fully ready
      setTimeout(() => {
        try {
          // Create map - we know mapContainerRef.current exists because we checked above
          const mapOptions = {
            center: initialLocation || DEFAULT_CENTER,
            zoom: 14,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
            zoomControl: true,
          };

          // This assertion is safe because we've already checked that the ref exists
          mapInstanceRef.current = new google.maps.Map(
            mapContainerRef.current as HTMLElement,
            mapOptions
          );

          // Create geocoder for reverse geocoding
          geocoderRef.current = new google.maps.Geocoder();

          // Add a marker if initial location is provided
          if (initialLocation) {
            markerRef.current = new google.maps.Marker({
              position: initialLocation,
              map: mapInstanceRef.current,
              animation: google.maps.Animation.DROP,
              draggable: true,
            });

            // Get address for initial location
            reverseGeocode(initialLocation.lat, initialLocation.lng);
          }

          // Add click listener to map
          mapInstanceRef.current.addListener('click', (e: any) => {
            const position = {
              lat: e.latLng.lat(),
              lng: e.latLng.lng()
            };

            // Update or create marker
            if (markerRef.current) {
              markerRef.current.setPosition(position);
            } else {
              markerRef.current = new google.maps.Marker({
                position,
                map: mapInstanceRef.current,
                animation: google.maps.Animation.DROP,
                draggable: true,
              });

              // Add drag listener to marker
              markerRef.current.addListener('dragend', () => {
                const newPosition = markerRef.current.getPosition();
                reverseGeocode(newPosition.lat(), newPosition.lng());
              });
            }

            // Get address for clicked location
            reverseGeocode(position.lat, position.lng);
          });

          // Set up search box if input ref exists
          if (searchInputRef.current) {
            searchBoxRef.current = new google.maps.places.SearchBox(searchInputRef.current);

            // Bias search results to current map view
            mapInstanceRef.current.addListener('bounds_changed', () => {
              searchBoxRef.current.setBounds(mapInstanceRef.current.getBounds());
            });

            // Listen for location selection from search
            searchBoxRef.current.addListener('places_changed', () => {
              const places = searchBoxRef.current.getPlaces();

              if (!places || places.length === 0) return;

              const place = places[0];
              if (!place.geometry || !place.geometry.location) return;

              // Zoom to the location
              const location = place.geometry.location;
              mapInstanceRef.current.setCenter(location);
              mapInstanceRef.current.setZoom(17);

              // Update marker
              const position = {
                lat: location.lat(),
                lng: location.lng()
              };

              if (markerRef.current) {
                markerRef.current.setPosition(position);
              } else {
                markerRef.current = new google.maps.Marker({
                  position,
                  map: mapInstanceRef.current,
                  animation: google.maps.Animation.DROP,
                  draggable: true,
                });

                // Add drag listener to marker
                markerRef.current.addListener('dragend', () => {
                  const newPosition = markerRef.current.getPosition();
                  reverseGeocode(newPosition.lat(), newPosition.lng());
                });
              }

              // Update address
              if (place.formatted_address) {
                setSelectedAddress(place.formatted_address);
                onLocationSelect({
                  address: place.formatted_address,
                  lat: position.lat,
                  lng: position.lng
                });
              }
            });
          }

          // Map is ready
          setIsLoading(false);
          console.log('Map initialized successfully');
        } catch (err) {
          console.error('Error initializing map:', err);
          setError('Failed to initialize map');
          setIsLoading(false);
        }
      }, 100);
    } catch (err) {
      console.error('Error creating map:', err);
      setError('Failed to create map');
      setIsLoading(false);
    }
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = (lat: number, lng: number) => {
    if (!geocoderRef.current) return;

    geocoderRef.current.geocode(
      { location: { lat, lng } },
      (results: any, status: any) => {
        if (status === 'OK' && results && results[0]) {
          const address = results[0].formatted_address;
          setSelectedAddress(address);
          onLocationSelect({ address, lat, lng });
        } else {
          // Use coordinates as fallback
          const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSelectedAddress(fallbackAddress);
          onLocationSelect({ address: fallbackAddress, lat, lng });
        }
      }
    );
  };

  // Find user's current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation not supported by browser');
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
            markerRef.current = new google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstanceRef.current,
              animation: google.maps.Animation.DROP,
              draggable: true,
            });

            // Add drag listener to marker
            markerRef.current.addListener('dragend', () => {
              const newPosition = markerRef.current.getPosition();
              reverseGeocode(newPosition.lat(), newPosition.lng());
            });
          }

          // Get address for current location
          reverseGeocode(latitude, longitude);
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

export default PabiliMap;
