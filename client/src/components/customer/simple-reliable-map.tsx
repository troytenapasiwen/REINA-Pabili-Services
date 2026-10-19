import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface SimpleReliableMapProps {
  onLocationSelect: (address: string, lat: number, lng: number) => void;
  initialLocation?: { lat: number; lng: number };
  height?: string;
  width?: string;
  label?: string;
}

const SimpleReliableMap: React.FC<SimpleReliableMapProps> = ({
  onLocationSelect,
  initialLocation,
  height = '400px',
  width = '100%',
  label = 'Click anywhere on the map to set a pin'
}) => {
  // References
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const marker = useRef<google.maps.Marker | null>(null);
  const searchBoxRef = useRef<HTMLInputElement>(null);

  // State
  const [mapError, setMapError] = useState<string | null>(null);

  // Get API key
  const { data: apiKeyData, isLoading: isLoadingKey, isError: isKeyError } = useQuery({
    queryKey: ['/api/maps/key'],
    queryFn: async () => {
      const response = await fetch('/api/maps/key');
      if (!response.ok) {
        throw new Error('Failed to fetch Maps API key');
      }
      return response.json();
    },
    staleTime: Infinity,
  });

  // Load Google Maps script
  useEffect(() => {
    if (isLoadingKey || !apiKeyData || isKeyError) return;

    const apiKey = apiKeyData.key;
    if (!apiKey) {
      setMapError('No API key provided');
      return;
    }

    // Skip if Google Maps is already loaded
    if (window.google && window.google.maps) {
      initMap();
      return;
    }

    // Create callback function for Google Maps
    const callbackName = `initMap${Math.random().toString(36).substring(2, 11)}`;
    window[callbackName] = initMap;

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;

    script.onerror = () => {
      setMapError('Failed to load Google Maps script');
    };

    document.head.appendChild(script);

    return () => {
      // Clean up
      if (window[callbackName]) {
        delete window[callbackName];
      }
      document.head.contains(script) && document.head.removeChild(script);
    };
  }, [apiKeyData, isLoadingKey, isKeyError]);

  // Initialize map
  function initMap() {
    if (!mapRef.current || !window.google || !window.google.maps) return;

    try {
      // Default center (Manila) if no initial location provided
      const center = initialLocation || { lat: 14.5995, lng: 120.9842 };

      // Create map
      const mapOptions = {
        center,
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: false,
      };

      const map = new google.maps.Map(mapRef.current, mapOptions);
      mapInstance.current = map;

      // Add initial marker if location provided
      if (initialLocation) {
        const newMarker = new google.maps.Marker({
          position: initialLocation,
          map,
          draggable: true,
        });
        marker.current = newMarker;

        // Get address for initial marker
        getAddressFromCoords(initialLocation.lat, initialLocation.lng);

        // Add listener for marker drag end
        newMarker.addListener('dragend', () => {
          const position = newMarker.getPosition();
          if (position) {
            getAddressFromCoords(position.lat(), position.lng());
          }
        });
      }

      // Add click listener to map
      map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;

        const clickedLat = e.latLng.lat();
        const clickedLng = e.latLng.lng();

        // Update or create marker
        if (marker.current) {
          marker.current.setPosition({ lat: clickedLat, lng: clickedLng });
        } else {
          const newMarker = new google.maps.Marker({
            position: { lat: clickedLat, lng: clickedLng },
            map,
            draggable: true,
          });
          marker.current = newMarker;

          // Add listener for marker drag end
          newMarker.addListener('dragend', () => {
            const position = newMarker.getPosition();
            if (position) {
              getAddressFromCoords(position.lat(), position.lng());
            }
          });
        }

        // Get address for clicked location
        getAddressFromCoords(clickedLat, clickedLng);
      });

      // Add search box if input exists and Places library is available
      if (searchBoxRef.current && window.google.maps.places) {
        const searchBox = new google.maps.places.SearchBox(searchBoxRef.current);

        map.addListener('bounds_changed', () => {
          searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
        });

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
          if (marker.current) {
            marker.current.setPosition({ lat, lng });
          } else {
            const newMarker = new google.maps.Marker({
              position: { lat, lng },
              map,
              draggable: true,
            });
            marker.current = newMarker;

            // Add listener for marker drag end
            newMarker.addListener('dragend', () => {
              const position = newMarker.getPosition();
              if (position) {
                getAddressFromCoords(position.lat(), position.lng());
              }
            });
          }

          // Get address from place
          const address = place.formatted_address || `${lat}, ${lng}`;
          onLocationSelect(address, lat, lng);
        });
      }
    } catch (err) {
      console.error('Error initializing map:', err);
      setMapError('Error initializing map');
    }
  }

  // Helper function to get address from coordinates
  function getAddressFromCoords(lat: number, lng: number) {
    if (!window.google || !window.google.maps) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } })
      .then(response => {
        if (response.results && response.results[0]) {
          const address = response.results[0].formatted_address;
          onLocationSelect(address, lat, lng);
        } else {
          onLocationSelect(`${lat}, ${lng}`, lat, lng);
        }
      })
      .catch(error => {
        console.error('Geocoding failed:', error);
        onLocationSelect(`${lat}, ${lng}`, lat, lng);
      });
  }

  // Handle the "My Location" button click
  const handleMyLocationClick = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (mapInstance.current) {
          mapInstance.current.setCenter({ lat: latitude, lng: longitude });
          mapInstance.current.setZoom(17);

          if (marker.current) {
            marker.current.setPosition({ lat: latitude, lng: longitude });
          } else {
            const newMarker = new google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: mapInstance.current,
              draggable: true,
            });
            marker.current = newMarker;

            // Add listener for marker drag end
            newMarker.addListener('dragend', () => {
              const position = newMarker.getPosition();
              if (position) {
                getAddressFromCoords(position.lat(), position.lng());
              }
            });
          }

          // Get address for current location
          getAddressFromCoords(latitude, longitude);
        }
      },
      (error) => {
        console.error('Error getting location:', error);
        alert('Unable to retrieve your location. Please check your device settings and permissions.');
      }
    );
  };

  // Show loading state
  if (isLoadingKey) {
    return (
      <div className="flex items-center justify-center bg-gray-50 rounded-md" style={{ height, width }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (isKeyError || mapError) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-md" style={{ height, width }}>
        <div className="bg-red-50 p-4 rounded-md max-w-md text-center text-red-600">
          <h3 className="font-bold mb-2">Map Error</h3>
          <p>{mapError || 'Failed to get Google Maps API key'}</p>
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
              ref={searchBoxRef}
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
            ref={mapRef}
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
    </div>
  );
};

export default SimpleReliableMap;
