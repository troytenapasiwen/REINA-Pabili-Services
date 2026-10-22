import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/contexts/cart-context";
import { useLanguage } from "@/contexts/language-context";
import { LanguageSwitcher } from "@/components/ui/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Home, Search, ShoppingBag, User,
  MapPin, FileText, ShoppingBasket
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EnhancedLocationPicker } from "@/components/customer/enhanced-location-picker";
import { useQuery } from "@tanstack/react-query";
import { Customer } from "@shared/schema";
import { PrivacyPolicyModal } from "@/components/privacy-policy-modal";
import { BrandLogo } from "@/components/brand-logo";

/*
  Reina Pabili brand tokens (same as the auth, home and restaurant pages):
    yellow #FFD527, orange #F76043, charcoal #282828.
  Square corners, 2px charcoal outlines, hard offset shadows. Text on orange is charcoal for contrast.
*/
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2";
const iconButtonClass = `flex h-11 w-11 items-center justify-center rounded-none border-2 border-[#282828] bg-white p-0 text-[#282828] shadow-[3px_3px_0_0_#282828] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[#FFD527] hover:shadow-[2px_2px_0_0_#282828] motion-reduce:transition-none ${focusRing}`;
const plainButtonClass = `h-12 rounded-none border-2 border-[#282828] bg-white px-5 text-base font-bold text-[#282828] hover:bg-gray-100 ${focusRing}`;

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

  const cartCount = getTotalItems();

  const navItems = [
    { href: "/", label: t.dashboard, icon: Home, active: currentPath === "/" },
    { href: "/orders", label: t.orders, icon: FileText, active: currentPath.startsWith("/orders") },
    { href: "/pabili", label: t.pabiliService, icon: ShoppingBasket, active: currentPath === "/pabili" },
    { href: "/cart", label: "Cart", icon: ShoppingBag, active: currentPath === "/cart", count: cartCount },
    { href: "/profile", label: t.profile, icon: User, active: currentPath.startsWith("/profile") },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col overflow-x-hidden bg-gray-50">
      {/* Header.
          Transparent mode keeps the original behaviour (overlaid on the page's banner), but the
          controls sit on solid white boxes so they stay readable over any image. The bar itself ignores
          pointer events so it never blocks the banner's own back button; only its controls are clickable. */}
      <header
        className={
          transparentHeader
            ? "pointer-events-none absolute left-0 right-0 top-0 z-10 p-4"
            : "border-b-[3px] border-[#282828] bg-white px-4 py-3"
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Brand. In transparent mode it is nudged right so the banner's back button (top-left) stays clear. */}
          <a
            href="/"
            aria-label="Reina Pabili Services home"
            className={`pointer-events-auto order-1 flex items-center gap-2.5 text-[#282828] ${focusRing} ${
              transparentHeader ? "ml-14 border-2 border-[#282828] bg-white py-1 pl-1 pr-3 shadow-[3px_3px_0_0_#282828]" : ""
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#282828] bg-[#FFD527] p-0.5 shadow-[2px_2px_0_0_#282828]">
              <BrandLogo className="h-full w-full rounded-none" />
            </span>
            <span className="text-lg font-extrabold uppercase tracking-tight">Reina Pabili Services</span>
          </a>

          {/* Delivery location: second row on mobile, inline from sm up */}
          {!transparentHeader && (
            <button
              type="button"
              onClick={() => setAddressDialogOpen(true)}
              aria-label={`Delivering to ${address || "your location"}. Change delivery location`}
              className={`order-3 flex h-11 w-full min-w-0 items-center gap-2 border-2 border-[#282828] bg-[#FFD527] px-3 text-left text-sm font-bold text-[#282828] shadow-[3px_3px_0_0_#282828] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[#FFE066] hover:shadow-[2px_2px_0_0_#282828] motion-reduce:transition-none sm:order-2 sm:w-auto sm:max-w-xs ${focusRing}`}
            >
              <MapPin size={16} className="shrink-0" aria-hidden="true" />
              <span className="truncate">{address || "Set your location"}</span>
            </button>
          )}

          <div className="pointer-events-auto order-2 ml-auto flex items-center gap-2.5 sm:order-3">
            {/* Language Switcher */}
            <div
              className={`flex h-11 items-center [&_button]:rounded-none ${
                transparentHeader ? "border-2 border-[#282828] bg-white px-1 shadow-[3px_3px_0_0_#282828]" : ""
              }`}
            >
              <LanguageSwitcher />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchOpen(true)}
              className={iconButtonClass}
              aria-label="Search"
            >
              <Search size={20} aria-hidden="true" />
            </Button>

            {user ? (
              <button
                type="button"
                onClick={() => window.location.href = "/profile"}
                aria-label="Open profile"
                className={`h-11 w-11 shrink-0 border-2 border-[#282828] shadow-[3px_3px_0_0_#282828] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_0_#282828] motion-reduce:transition-none ${focusRing}`}
              >
                <Avatar className="h-full w-full rounded-none">
                  <AvatarFallback className="rounded-none bg-[#F76043] text-sm font-extrabold text-[#282828]">
                    {user.fullName?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className={`h-11 rounded-none border-2 border-[#282828] bg-[#F76043] px-4 text-sm font-bold text-[#282828] shadow-[3px_3px_0_0_#282828] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:bg-[#FF7154] hover:shadow-[2px_2px_0_0_#282828] motion-reduce:transition-none ${focusRing}`}
                onClick={() => window.location.href = "/auth"}
              >
                Login
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={`flex-1 px-3 sm:px-0 ${!hideNav ? 'pb-28' : 'pb-4'}`}>
        {title && (
          <div className="container py-4">
            <h1 className="text-2xl font-extrabold uppercase tracking-tight text-[#282828]">{title}</h1>
            {description && <p className="mt-1 font-semibold text-gray-700">{description}</p>}
          </div>
        )}
        {children}
      </main>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-auto rounded-none border-2 border-[#282828] sm:max-w-3xl sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold uppercase tracking-tight text-[#282828]">
              Set Delivery Location
            </DialogTitle>
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
            <Button variant="outline" className={plainButtonClass} onClick={() => setAddressDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search Dialog */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="rounded-none border-2 border-[#282828] sm:max-w-md sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold uppercase tracking-tight text-[#282828]">
              Search
            </DialogTitle>
            <DialogDescription>
              Search for restaurants or dishes
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Search..."
              aria-label="Search restaurants or dishes"
              className="h-12 rounded-none border-2 border-[#282828] bg-white px-4 text-base focus-visible:border-[#282828] focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation */}
      {!hideNav && (
        <nav
          aria-label="Main navigation"
          className="fixed bottom-0 left-0 right-0 z-30 border-t-[3px] border-[#282828] bg-white pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pt-1.5 sm:px-6">
            {navItems.map(({ href, label, icon: Icon, active, count }) => (
              <li key={href} className="min-w-0 flex-1">
                <a
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 px-1 py-0.5 text-[11px] text-[#282828] ${focusRing}`}
                >
                  <span
                    className={`relative flex h-8 w-12 items-center justify-center border-2 ${
                      active
                        ? "border-[#282828] bg-[#FFD527] shadow-[2px_2px_0_0_#282828]"
                        : "border-transparent"
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    {typeof count === "number" && count > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center border-2 border-[#282828] bg-[#F76043] px-0.5 text-[10px] font-extrabold leading-none">
                        {count > 99 ? "99+" : count}
                        <span className="sr-only"> items in cart</span>
                      </span>
                    )}
                  </span>
                  <span className={`max-w-full truncate ${active ? "font-extrabold" : "font-semibold text-gray-700"}`}>
                    {label}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          {/* Privacy Policy link */}
          <div className="flex justify-center border-t-2 border-[#282828]/15">
            <PrivacyPolicyModal
              trigger={
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-bold text-gray-700 underline decoration-[#F76043] decoration-2 underline-offset-4 hover:text-[#282828] ${focusRing}`}
                >
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