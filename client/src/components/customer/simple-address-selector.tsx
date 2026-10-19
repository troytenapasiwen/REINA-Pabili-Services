import React, { useState } from "react";
import { SavedAddress } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

interface SimpleAddressSelectorProps {
  savedAddresses: SavedAddress[];
  onAddressSelected: (address: {
    address: string;
    lat: number;
    lng: number;
    locationName: string;
  }) => void;
  defaultValue?: string;
}

export function SimpleAddressSelector({
  savedAddresses,
  onAddressSelected,
  defaultValue
}: SimpleAddressSelectorProps) {
  const [customAddress, setCustomAddress] = useState("");
  const [customLocationName, setCustomLocationName] = useState("");
  const [useCustomAddress, setUseCustomAddress] = useState(false);

  const handleSavedAddressSelected = (name: string) => {
    const selectedAddress = savedAddresses.find(addr => addr.name === name);
    if (selectedAddress) {
      onAddressSelected({
        address: selectedAddress.address,
        lat: selectedAddress.lat,
        lng: selectedAddress.lng,
        locationName: selectedAddress.name
      });
      setUseCustomAddress(false);
    }
  };

  const handleCustomAddressSubmit = () => {
    // Use approximate coordinates for the custom address (actual coordinates would normally
    // come from geocoding but we're simplifying here)
    onAddressSelected({
      address: customAddress,
      lat: 0,
      lng: 0,
      locationName: customLocationName || "Custom Location"
    });
  };

  return (
    <div className="space-y-4">
      {!useCustomAddress ? (
        <>
          <div className="flex flex-col space-y-2">
            <Label>Select from saved addresses</Label>
            <Select
              onValueChange={handleSavedAddressSelected}
              defaultValue={defaultValue}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a saved address" />
              </SelectTrigger>
              <SelectContent>
                {savedAddresses.map(addr => (
                  <SelectItem key={addr.name} value={addr.name}>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2" />
                      <span>{addr.name}: {addr.address.substring(0, 25)}{addr.address.length > 25 ? '...' : ''}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setUseCustomAddress(true)}
            >
              Use a different address
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label>Enter address</Label>
              <Input
                placeholder="Full address"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Location name</Label>
              <Input
                placeholder="e.g., Friend's House, Shop, etc."
                value={customLocationName}
                onChange={(e) => setCustomLocationName(e.target.value)}
              />
            </div>

            <div className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUseCustomAddress(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!customAddress}
                onClick={handleCustomAddressSubmit}
              >
                Use this address
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
