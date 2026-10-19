import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, AlertTriangle } from "lucide-react";
import { wsService } from "@/lib/websocket-service";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RiderLocationTrackerProps {
  riderId: number;
  userLocation?: { latitude: number; longitude: number } | null;
  hasActiveOrders?: boolean;
}

export function RiderLocationTracker({ riderId, userLocation, hasActiveOrders = false }: RiderLocationTrackerProps) {
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const watchId = useRef<number | null>(null);
  const websocketConnected = useRef(false);
  const lastSentLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastSendTime = useRef<number>(0);
  const queryClient = useQueryClient();

  // Auto-start tracking when there are active orders
  useEffect(() => {
    if (hasActiveOrders && autoTrackingEnabled && !isTracking) {
      console.log("Auto-starting location tracking due to active orders");
      startTracking();
    }
  }, [hasActiveOrders, autoTrackingEnabled, isTracking]);

  // Calculate distance between two coordinates in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Start tracking rider's location
  const startTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    setIsTracking(true);
    setError(null);

    // Use watchPosition for continuous tracking
    if (navigator.geolocation) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };

          const newAccuracy = position.coords.accuracy;
          setAccuracy(newAccuracy);

          const now = Date.now();
          const timeSinceLastSend = now - lastSendTime.current;

          // Check if we should send this update
          let shouldSend = false;

          // Send if it's the first location
          if (!lastSentLocation.current) {
            shouldSend = true;
          }
          // Send if enough time has passed (5 seconds for high accuracy)
          else if (timeSinceLastSend >= 5000 && newAccuracy < 50) {
            shouldSend = true;
          }
          // Send if location changed significantly (>10 meters)
          else if (lastSentLocation.current) {
            const distance = calculateDistance(
              lastSentLocation.current.latitude,
              lastSentLocation.current.longitude,
              newLocation.latitude,
              newLocation.longitude
            );
            if (distance > 10) {
              shouldSend = true;
            }
          }

          // Always update local state for UI
          setCurrentLocation(newLocation);
          setLastUpdate(new Date());
          setError(null);

          // Send update if criteria met
          if (shouldSend) {
            sendLocationUpdate(newLocation);
            lastSentLocation.current = newLocation;
            lastSendTime.current = now;
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          let errorMessage = 'Unable to get location';

          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage = 'Location permission denied. Please enable location services.';
              break;
            case err.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check your GPS settings.';
              break;
            case err.TIMEOUT:
              errorMessage = 'Location request timed out. Trying again...';
              break;
          }

          setError(errorMessage);
          setIsTracking(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );

      console.log('Started continuous location tracking with watchPosition');
    } else {
      setError('Geolocation is not supported by this browser');
      setIsTracking(false);
    }
  };

  // Stop tracking rider's location
  const stopTracking = () => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setIsTracking(false);
    lastSentLocation.current = null;
    lastSendTime.current = 0;
  };

  // Send location update via WebSocket and API
  const sendLocationUpdate = async (location: { latitude: number; longitude: number }) => {
    // Send via WebSocket if connected
    if (websocketConnected.current) {
      try {
        wsService.send({
          type: 'location_update',
          riderId,
          location
        });
        console.log("Sent location update via WebSocket", location);
      } catch (err) {
        console.error('Error sending WebSocket update:', err);
      }
    }

    // Also send via HTTP API as a backup
    try {
      await apiRequest('POST', '/api/riders/location', {
        riderId,
        location
      });

      // Update rider data in the query cache to reflect the new location
      queryClient.invalidateQueries({ queryKey: ['/api/riders/current'] });

      console.log("Sent location update via API");
    } catch (err) {
      console.error('Error sending location update via API:', err);
    }
  };

  // Connect to WebSocket when component mounts
  useEffect(() => {
    const connectWebSocket = async () => {
      try {
        await wsService.connect();
        await wsService.authenticate('rider', undefined, riderId);
        websocketConnected.current = true;
        console.log('WebSocket connected and authenticated as rider');
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup WebSocket connection and location tracking when component unmounts
    return () => {
      stopTracking();

      if (websocketConnected.current) {
        websocketConnected.current = false;
      }
    };
  }, [riderId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Location Tracking</CardTitle>
          <Badge variant={isTracking ? "default" : "outline"}>
            {isTracking ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm space-y-2 pb-0">
        {currentLocation ? (
          <>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-muted-foreground mb-1">Current coordinates</p>
                <p className="font-mono text-xs">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {lastUpdate && (
              <div className="text-xs text-muted-foreground pt-1">
                Last updated: {lastUpdate.toLocaleTimeString()}
                {accuracy !== null && (
                  <span className="ml-2">
                    • Accuracy: {accuracy < 50 ? 'High' : accuracy < 100 ? 'Medium' : 'Low'} ({Math.round(accuracy)}m)
                  </span>
                )}
              </div>
            )}

            {hasActiveOrders && (
              <div className="flex items-center mt-2 text-xs text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                <span>Location shared with customer</span>
              </div>
            )}
          </>
        ) : error ? (
          <div className="text-red-500 text-sm pt-2 pb-4">
            {error}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <MapPin className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>No location data yet</p>
            <p className="text-xs mt-1">Press the button below to start tracking</p>
            {hasActiveOrders && (
              <p className="text-xs text-amber-500 mt-2">
                <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1" />
                You have active deliveries
              </p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-4">
        <div className="w-full space-y-2">
          {isTracking ? (
            <Button variant="destructive" onClick={stopTracking} className="w-full">
              Stop Tracking
            </Button>
          ) : (
            <Button onClick={startTracking} className="w-full">
              <Navigation className="mr-2 h-4 w-4" />
              Start Tracking
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center text-xs text-center text-muted-foreground pt-1">
                  <input
                    type="checkbox"
                    checked={autoTrackingEnabled}
                    onChange={(e) => setAutoTrackingEnabled(e.target.checked)}
                    className="mr-2"
                  />
                  <span>Auto-track with active orders</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Automatically start location tracking when you have active orders</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardFooter>
    </Card>
  );
}
