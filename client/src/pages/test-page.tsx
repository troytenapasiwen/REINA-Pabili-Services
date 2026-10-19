import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// Add global type definition for the initMap callback
interface Window {
  google: any;
  initMap?: () => void;
}

export default function TestPage() {
  const [mapApiKey, setMapApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Fetch Google Maps API key
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
      } catch (error) {
        console.error('Error fetching Maps API key:', error);
        setError('Failed to get Maps API key');
        setLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  // Load Google Maps script
  useEffect(() => {
    if (!mapApiKey) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${mapApiKey}&callback=initMap`;
    script.async = true;
    script.defer = true;

    // Create a global callback function for the script to call when ready
    window.initMap = () => {
      console.log('Google Maps script loaded successfully');

      if (!mapContainerRef.current) {
        console.error('Map container not found');
        setError('Map container not found');
        setLoading(false);
        return;
      }

      try {
        // Create the map
        const mapOptions = {
          center: { lat: 14.5995, lng: 120.9842 }, // Manila
          zoom: 10,
        };

        // Initialize map - delayed to ensure DOM is ready
        setTimeout(() => {
          try {
            console.log('Creating map instance...');
            mapRef.current = new window.google.maps.Map(mapContainerRef.current, mapOptions);

            // Add a marker for demo
            markerRef.current = new window.google.maps.Marker({
              position: { lat: 14.5995, lng: 120.9842 },
              map: mapRef.current,
              title: 'Manila'
            });

            // Add click listener
            mapRef.current.addListener('click', (e: any) => {
              const position = {
                lat: e.latLng.lat(),
                lng: e.latLng.lng()
              };

              // Update marker position
              if (markerRef.current) {
                markerRef.current.setPosition(position);
              }

              console.log('Selected location:', position);
            });

            setLoading(false);
          } catch (error) {
            console.error('Error initializing map:', error);
            setError('Error initializing map');
            setLoading(false);
          }
        }, 500);
      } catch (error) {
        console.error('Error creating map:', error);
        setError('Error creating map');
        setLoading(false);
      }
    };

    // Handle loading errors
    script.onerror = () => {
      console.error('Failed to load Google Maps script');
      setError('Failed to load Google Maps script');
      setLoading(false);
    };

    // Add the script to the document
    document.head.appendChild(script);

    // Cleanup
    return () => {
      if (window.initMap) {
        // @ts-ignore - Cleanup global callback
        window.initMap = undefined;
      }

      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [mapApiKey]);

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Google Maps Test</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading map...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-80 bg-red-50 text-red-500 rounded-md">
              <p className="text-center">{error}</p>
            </div>
          )}

          <div
            ref={mapContainerRef}
            style={{
              height: '400px',
              width: '100%',
              display: loading || error ? 'none' : 'block'
            }}
          ></div>

          <div className="mt-4 p-4 bg-muted rounded-md">
            <p className="text-sm text-muted-foreground">Click on the map to place a marker. This is a simplified version of the map component.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
