import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/contexts/cart-context";
import { useLanguage } from "@/contexts/language-context";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Home, Search, ShoppingBag, User,
  MapPin, Menu, X, FileText, ShoppingBasket
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CustomerLocationPicker } from "@/components/customer/customer-location-picker";
import { EnhancedLocationPicker } from "@/components/customer/enhanced-location-picker";
import { useQuery } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { PrivacyPolicyModal } from "@/components/privacy-policy-modal";
import { BrandLogo } from "@/components/brand-logo";

interface CustomerLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
  transparentHeader?: boolean;
  title?: string;
  description?: string;
}

export default function CustomerLayout({
  children,
  hideNav = false,
  transparentHeader = false,
  title,
  description
}: CustomerLayoutProps) {
  const [locationPath] = useLocation();
  const { user, logoutMutation } = useAuth();
  const { getTotalItems } = useCart();
  const { t } = useLanguage();
  const [searchOpen, setSearchOpen] = useState(false);
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [address, setAddress] = useState("");
  // Convert locationPath (which is a Location object) to a string for comparison
  const currentPath = locationPath as string;

  // Fetch customer profile data
  const { data: customer, isLoading } = useQuery<Customer>({
    queryKey: ["/api/customers/profile"],
    enabled: !!user && user.role === "customer",
  });

  // Update address display when customer data changes
  useEffect(() => {
    if (customer) {
      // Use location name if available
      if (customer.locationName) {
        setAddress(customer.locationName);
      } else if (customer.defaultAddress) {
        setAddress(customer.defaultAddress);
      } else if (customer.location && typeof customer.location === 'object' &&
                 'lat' in customer.location && 'lng' in customer.location) {
        // If no formatted address but we have coordinates, display those
        setAddress(`${Number(customer.location.lat).toFixed(4)}, ${Number(customer.location.lng).toFixed(4)}`);
      } else {
        setAddress("Set your location");
      }
    }
  }, [customer]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className={`${transparentHeader ? 'bg-transparent absolute top-0 left-0 right-0 z-10' : 'bg-white border-b'} p-4`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div
              onClick={() => window.location.href = "/"}
              className="text-lg font-bold text-primary flex items-center cursor-pointer"
            >
              <BrandLogo className="h-8 w-8 mr-2" />
              Reina Pabili
            </div>

            {!transparentHeader && (
              <button
                onClick={() => setAddressDialogOpen(true)}
                className="text-xs flex items-center ml-2 text-gray-600"
              >
                <MapPin size={14} className="mr-1" />
                <span className="truncate max-w-[150px]">{address}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <LanguageSwitcher />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className={transparentHeader ? "text-white" : ""}
            >
              <Search size={20} />
            </Button>

            {user ? (
              <Avatar
                className="h-8 w-8 cursor-pointer"
                onClick={() => window.location.href = "/profile"}
              >
                <AvatarFallback className="bg-primary text-white text-xs">
                  {user.fullName?.substring(0, 2).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className={transparentHeader ? "text-white hover:bg-white/20" : ""}
                onClick={() => window.location.href = "/auth"}
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 px-3 sm:px-0 ${!hideNav ? 'pb-20' : 'pb-4'}`}>
        {title && (
          <div className="container py-4">
            <h1 className="text-2xl font-bold">{title}</h1>
            {description && <p className="text-muted-foreground mt-1">{description}</p>}
          </div>
        )}
        {children}
      </main>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Set Delivery Location</DialogTitle>
            <DialogDescription>
              Pin your location on the map to set your delivery address.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <EnhancedLocationPicker
              onLocationSaved={(newAddress, locationName) => {
                // Prioritize location name over address for display
                setAddress(locationName || newAddress);
                setAddressDialogOpen(false);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Search</DialogTitle>
            <DialogDescription>
              Search for restaurants or dishes
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input placeholder="Search..." />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t py-2 px-6 z-10">
          <div className="flex justify-between">
            <div
              onClick={() => window.location.href = "/"}
              className={`flex flex-col items-center cursor-pointer ${currentPath === "/" ? "text-primary" : "text-gray-500"}`}
            >
              <Home size={20} />
              <span className="text-xs mt-1">{t.dashboard}</span>
            </div>
            <div
              onClick={() => window.location.href = "/orders"}
              className={`flex flex-col items-center cursor-pointer ${currentPath.startsWith("/orders") ? "text-primary" : "text-gray-500"}`}
            >
              <FileText size={20} />
              <span className="text-xs mt-1">{t.orders}</span>
            </div>
            <div
              onClick={() => window.location.href = "/pabili"}
              className={`flex flex-col items-center cursor-pointer ${currentPath === "/pabili" ? "text-primary" : "text-gray-500"}`}
            >
              <ShoppingBasket size={20} />
              <span className="text-xs mt-1">{t.pabiliService}</span>
            </div>
            <div
              onClick={() => window.location.href = "/cart"}
              className={`flex flex-col items-center cursor-pointer ${currentPath === "/cart" ? "text-primary" : "text-gray-500"}`}
            >
              <div className="relative">
                <ShoppingBag size={20} />
                {getTotalItems() > 0 && (
                  <Badge
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {getTotalItems()}
                  </Badge>
                )}
              </div>
              <span className="text-xs mt-1">Cart</span>
            </div>
            <div
              onClick={() => window.location.href = "/profile"}
              className={`flex flex-col items-center cursor-pointer ${currentPath.startsWith("/profile") ? "text-primary" : "text-gray-500"}`}
            >
              <User size={20} />
              <span className="text-xs mt-1">{t.profile}</span>
            </div>
          </div>
          {/* Privacy Policy link */}
          <div className="flex justify-center py-2 border-t">
            <PrivacyPolicyModal
              trigger={
                <button className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">
                  Privacy Policy
                </button>
              }
            />
          </div>
        </nav>
      )}
    </div>
  );
}
