import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Customer, SavedAddress } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home as HomeIcon, Briefcase, MapPin, Trash2, Star, StarIcon, GraduationCap, Dumbbell, Users, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CustomerLocationPicker } from "./customer-location-picker";
import { EnhancedLocationPicker } from "./enhanced-location-picker";

interface SavedAddressesProps {
  onSelectAddress?: (address: SavedAddress) => void;
  selectedAddressName?: string;
  compact?: boolean;
  allowSetAsCurrent?: boolean;
}

export function SavedAddresses({ onSelectAddress, selectedAddressName, compact = false, allowSetAsCurrent = false }: SavedAddressesProps) {
  const { toast } = useToast();
  const [addAddressDialogOpen, setAddAddressDialogOpen] = useState(false);

  // Fetch customer profile data
  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
  });

  // Set address as current location mutation
  const setCurrentLocationMutation = useMutation({
    mutationFn: async (address: SavedAddress) => {
      const res = await apiRequest("PATCH", "/api/customers/location", {
        lat: address.lat,
        lng: address.lng,
        defaultAddress: address.address,
        locationName: address.name
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
      toast({
        title: "Current location updated",
        description: "Your current delivery location has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update location",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update saved addresses mutation
  const updateSavedAddressesMutation = useMutation({
    mutationFn: async (savedAddresses: SavedAddress[]) => {
      const res = await apiRequest("PATCH", "/api/customers/saved-addresses", {
        savedAddresses,
      });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers/profile"] });
      toast({
        title: "Addresses updated",
        description: "Your addresses have been successfully updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update addresses",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle setting an address as default
  const handleSetDefault = (address: SavedAddress) => {
    if (!customer || !customer.savedAddresses) return;

    // Cast savedAddresses to the correct type
    const addresses = customer.savedAddresses as SavedAddress[];

    // Update the addresses, setting isDefault for the selected one
    const updatedAddresses = addresses.map(addr => ({
      ...addr,
      isDefault: addr.name === address.name
    }));

    updateSavedAddressesMutation.mutate(updatedAddresses);
  };

  // Handle setting a saved address as current location
  const handleSetAsCurrent = (address: SavedAddress) => {
    setCurrentLocationMutation.mutate(address);

    // Also call onSelectAddress if provided
    if (onSelectAddress) {
      onSelectAddress(address);
    }
  };

  // Handle removing an address
  const handleRemoveAddress = (addressName: string) => {
    if (!customer || !customer.savedAddresses) return;

    // Cast savedAddresses to the correct type
    const addresses = customer.savedAddresses as SavedAddress[];

    // Filter out the address to remove
    const updatedAddresses = addresses.filter(addr => addr.name !== addressName);

    updateSavedAddressesMutation.mutate(updatedAddresses);
  };

  // Handle adding a new address (to be implemented with CustomerLocationPicker)
  const handleAddAddress = (address: string, locationName?: string, location?: { lat: number, lng: number }) => {
    if (!locationName || !location) return;
    if (!customer) return;

    // Cast savedAddresses to the correct type
    const addresses = (customer.savedAddresses as SavedAddress[]) || [];

    // Check if the name already exists
    if (addresses.some(addr => addr.name === locationName)) {
      toast({
        title: "Address name already exists",
        description: "Please use a different name for this address",
        variant: "destructive",
      });
      return;
    }

    // Add the new address
    const newAddress: SavedAddress = {
      name: locationName,
      address,
      lat: location.lat,
      lng: location.lng,
      isDefault: addresses.length === 0, // Set as default if it's the first address
    };

    updateSavedAddressesMutation.mutate([...addresses, newAddress]);
    setAddAddressDialogOpen(false);
  };

  // Get default address icon
  const getAddressIcon = (name: string) => {
    // Handle common location types
    if (name === "Home") return <HomeIcon className="h-4 w-4" />;
    if (name === "Work") return <Briefcase className="h-4 w-4" />;
    if (name === "School") return <GraduationCap className="h-4 w-4" />;
    if (name === "Gym") return <Dumbbell className="h-4 w-4" />;
    if (name.includes("Friend")) return <Users className="h-4 w-4" />;

    // Default icon for custom names
    return <MapPin className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If compact mode, show only the addresses without add button
  if (compact) {
    return (
      <div className="space-y-2">
        {customer && customer.savedAddresses && (customer.savedAddresses as SavedAddress[]).length > 0 ? (
          (customer.savedAddresses as SavedAddress[]).map((address) => (
            <Button
              key={address.name}
              variant={selectedAddressName === address.name ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => onSelectAddress && onSelectAddress(address)}
            >
              <div className="flex items-center">
                {getAddressIcon(address.name)}
                <span className="ml-2">{address.name}</span>
                {address.isDefault && <Star className="h-4 w-4 ml-2 text-amber-500" />}
              </div>
            </Button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No saved addresses yet</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h3 className="text-lg font-medium">Saved Addresses</h3>
          <p className="text-sm text-muted-foreground">You can save multiple locations with custom names</p>
        </div>
        <Button
          size="sm"
          onClick={() => setAddAddressDialogOpen(true)}
          className="w-full sm:w-auto"
        >
          Add Address
        </Button>
      </div>

      {customer && customer.savedAddresses && (customer.savedAddresses as SavedAddress[]).length > 0 ? (
        <div className="space-y-3">
          {(customer.savedAddresses as SavedAddress[]).map((address) => (
            <Card key={address.name} className="p-3 sm:p-4 transition-all hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                {/* Address Info */}
                <div className="flex items-start flex-1">
                  <div className={`rounded-full w-10 h-10 flex items-center justify-center mr-3 shrink-0 ${address.isDefault ? 'bg-primary text-white' : 'bg-muted'}`}>
                    {getAddressIcon(address.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex flex-wrap items-center mb-1 gap-2">
                      <span className="text-sm sm:text-base">{address.name}</span>
                      {address.isDefault && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 break-words">{address.address}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      Tap to use this address during checkout
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-1 sm:items-start">
                  {allowSetAsCurrent && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSetAsCurrent(address)}
                      title="Set as current location"
                      className="text-xs w-full sm:w-auto"
                    >
                      <MapPin className="h-3 w-3 mr-1 text-primary" />
                      Use this location
                    </Button>
                  )}

                  <div className="flex gap-1 justify-end sm:justify-start">
                    {!address.isDefault && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSetDefault(address)}
                        title="Set as default"
                        className="shrink-0"
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveAddress(address.name)}
                      title="Remove address"
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-6 sm:py-8 border rounded-lg bg-muted/30">
          <MapPin className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm sm:text-base text-muted-foreground">No saved addresses yet</p>
          <p className="text-xs sm:text-sm text-muted-foreground">Add addresses to make checkout faster</p>
        </div>
      )}

      {/* Add Address Dialog */}
      <Dialog open={addAddressDialogOpen} onOpenChange={setAddAddressDialogOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-auto p-4 sm:p-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg sm:text-xl">Add New Address</DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              Set a location and give it a descriptive name to help you recognize it easily
            </DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-sm mb-4">
              <p className="flex items-start sm:items-center">
                <Star className="h-4 w-4 mr-2 text-amber-500 mt-0.5 sm:mt-0 shrink-0" />
                <span className="text-xs sm:text-sm">
                  You can save multiple addresses with different names like "Home", "Work", "School", "Gym", "Friend's Place", or any custom name.
                </span>
              </p>
            </div>
          </div>
          <EnhancedLocationPicker onLocationSaved={handleAddAddress} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
