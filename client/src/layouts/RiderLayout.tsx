import React, { ReactNode, useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Home,
  Clock,
  Map,
  Settings,
  User,
  LogOut,
  Menu,
  X,
  Package,
  Radio,
  Navigation,
  Shield,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RiderStatus } from "@shared/schema";
import type { Rider } from "@shared/schema";
import { PrivacyPolicyModal } from "@/components/privacy-policy-modal";
import { useQuery } from "@tanstack/react-query";
import { BrandLogo } from "@/components/brand-logo";

interface RiderLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function RiderLayout({ children, title, description }: RiderLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Fetch current rider data to show status
  const { data: rider } = useQuery<Rider>({
    queryKey: ['/api/riders/current'],
    enabled: !!user && user.role === 'rider',
  });

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: <Home className="h-5 w-5" />,
      active: location === "/" && user?.role === "rider",
    },
    {
      name: "Active Deliveries",
      href: "/rider/deliveries",
      icon: <Package className="h-5 w-5" />,
      active: location === "/rider/deliveries",
    },
    {
      name: "Navigation Map",
      href: "/rider/map",
      icon: <Map className="h-5 w-5" />,
      active: location === "/rider/map",
    },
    {
      name: "Documents",
      href: "/rider/documents",
      icon: <User className="h-5 w-5" />,
      active: location === "/rider/documents",
    },
    {
      name: "Profile",
      href: "/rider/profile",
      icon: <User className="h-5 w-5" />,
      active: location === "/rider/profile",
    },
    {
      name: "Settings",
      href: "/rider/settings",
      icon: <Settings className="h-5 w-5" />,
      active: location === "/rider/settings",
    },
  ];

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logoutMutation.mutate();
    setLogoutDialogOpen(false);
  };

  const NavLink = ({ item }: { item: typeof navItems[0] }) => (
    <Link href={item.href}>
      <span
        className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:bg-gray-100 cursor-pointer ${
          item.active ? "bg-gray-100 text-gray-900 font-medium" : "text-gray-500 hover:text-gray-900"
        }`}
      >
        {item.icon}
        {item.name}
      </span>
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Mobile Header */}
      {isMobile && (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-white px-4 sm:px-6">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 sm:max-w-none">
              <div className="flex h-full flex-col">
                <div className="flex items-center border-b px-2 py-4">
                  <Link href="/">
                    <span className="flex items-center gap-2 font-semibold cursor-pointer">
                      <BrandLogo className="h-8 w-8" />
                      <span className="text-primary text-xl">Reina Pabili</span>
                    </span>
                  </Link>
                </div>
                <nav className="grid gap-1 px-2 py-4">
                  {navItems.map((item) => (
                    <SheetClose key={item.href} asChild>
                      <NavLink item={item} />
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-auto p-4 space-y-2">
                  <SheetClose asChild>
                    <PrivacyPolicyModal className="w-full justify-start" />
                  </SheetClose>
                  <SheetClose asChild>
                    <Button onClick={handleLogout} variant="ghost" className="w-full justify-start gap-3">
                      <LogOut className="h-5 w-5" />
                      Logout
                    </Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <Link href="/">
            <span className="flex items-center gap-2 font-semibold cursor-pointer">
              <BrandLogo className="h-8 w-8" />
              <span className="text-primary text-xl">Reina Pabili</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {rider && (
              <Badge
                variant="outline"
                className={rider.status === RiderStatus.ACTIVE
                  ? "bg-green-50 text-green-700 border-green-200"
                  : rider.status === RiderStatus.BUSY
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-gray-50 text-gray-700 border-gray-200"
                }
              >
                <Radio className="h-3 w-3 mr-1" />
                {rider.status === RiderStatus.ACTIVE ? 'Active' : rider.status === RiderStatus.BUSY ? 'Busy' : 'Offline'}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user?.username?.charAt(0).toUpperCase() || "R"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/rider/profile">
                    <span className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Profile
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/rider/settings">
                    <span className="flex items-center cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <PrivacyPolicyModal
                    trigger={
                      <div className="flex items-center cursor-pointer px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground w-full">
                        <Shield className="mr-2 h-4 w-4" />
                        Privacy Policy
                      </div>
                    }
                    className="p-0"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
      )}

      {/* Desktop Layout */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar for desktop */}
        {!isMobile && (
          <aside className="hidden md:flex w-64 flex-col border-r bg-white z-10">
            <div className="flex h-14 items-center border-b px-4 py-2">
              <Link href="/">
                <span className="flex items-center gap-2 font-semibold">
                  <BrandLogo className="h-8 w-8" />
                  <span className="text-primary text-xl">Reina Pabili</span>
                </span>
              </Link>
            </div>
            <nav className="flex-1 overflow-auto py-4 px-2">
              <div className="grid gap-1">
                {navItems.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </nav>
            <div className="border-t p-4">
              <div className="flex items-center gap-4 mb-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user?.username?.charAt(0).toUpperCase() || "R"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{user?.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-xs text-gray-500">Rider</p>
                    {rider && (
                      <Badge
                        variant="outline"
                        className={
                          rider.status === RiderStatus.ACTIVE
                            ? "bg-green-50 text-green-700 border-green-200 text-xs px-1.5 py-0"
                            : rider.status === RiderStatus.BUSY
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-xs px-1.5 py-0"
                            : "bg-gray-50 text-gray-700 border-gray-200 text-xs px-1.5 py-0"
                        }
                      >
                        {rider.status === RiderStatus.ACTIVE ? 'Active' : rider.status === RiderStatus.BUSY ? 'Busy' : 'Offline'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <PrivacyPolicyModal className="w-full justify-start" />
                <Button onClick={handleLogout} variant="outline" className="w-full justify-start gap-3">
                  <LogOut className="h-5 w-5" />
                  Logout
                </Button>
              </div>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="container max-w-7xl py-4 px-4 sm:py-6 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
                {description && <p className="text-muted-foreground text-sm sm:text-base">{description}</p>}
              </div>
              {location !== "/rider/map" && (
                <Link href="/rider/map">
                  <span className="flex items-center gap-2 bg-primary text-white px-3 py-2 sm:px-4 sm:py-2 rounded-md hover:bg-primary/90 transition-colors cursor-pointer text-sm sm:text-base">
                    <Navigation className="h-4 w-4" />
                    <span className="sm:hidden">Map</span>
                    <span className="hidden sm:inline">Navigation Map</span>
                  </span>
                </Link>
              )}
            </div>
            {children}
          </div>
        </main>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You'll need to sign in again to access your rider account.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white">
                <Radio size={20} />
              </div>
              <div>
                <p className="font-medium">{user?.fullName || user?.username || 'Rider'}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogoutDialogOpen(false)}
              disabled={logoutMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmLogout}
              disabled={logoutMutation.isPending}
            >
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
