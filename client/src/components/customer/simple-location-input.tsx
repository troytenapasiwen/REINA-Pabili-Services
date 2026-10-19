import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

interface SimpleLocationInputProps {
  onAddressSubmit: (address: string, locationName: string) => void;
  defaultAddress?: string;
  defaultLocationName?: string;
}

export function SimpleLocationInput({
  onAddressSubmit,
  defaultAddress = "",
  defaultLocationName = "",
}: SimpleLocationInputProps) {
  const [address, setAddress] = useState(defaultAddress);
  const [locationName, setLocationName] = useState(defaultLocationName);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (address.trim()) {
      onAddressSubmit(address, locationName || "Location");
    }
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="address">Address</Label>
          <Input
            id="address"
            placeholder="Enter full address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="locationName">Location Name</Label>
          <Input
            id="locationName"
            placeholder="e.g., Home, Office, Store, etc."
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full">
          <MapPin className="w-4 h-4 mr-2" />
          Set Location
        </Button>
      </form>
    </Card>
  );
}
