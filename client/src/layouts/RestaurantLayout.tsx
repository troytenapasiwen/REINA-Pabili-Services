import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Utensils, ShoppingBag, BarChart,
  Settings, LogOut, Menu, Bell, Store, Star
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Restaurant } from "@shared/schema";
import { RestaurantOnboarding } from "@/components/restaurant/restaurant-onboarding";
import { BrandLogo } from "@/components/brand-logo";

type NavItem = {
  title: string;
  href: string;
  icon: ReactNode;
  active?: boolean;
};

interface RestaurantLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export default function RestaurantLayout({ children, title, description }: RestaurantLayoutProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // Fetch restaurant data
  const { data: restaurant, isLoading: isLoadingRestaurant } = useQuery<Restaurant | null>({
    queryKey: ["/api/restaurants/by-user"],
    enabled: !!user?.id,
  });

  const handleLogout = () => {
    setLogoutDialogOpen(true);
  };

  const confirmLogout = () => {
    logoutMutation.mutate();
    setLogoutDialogOpen(false);
  };

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: <LayoutDashboard size={20} />,
      active: location === "/"
    },
    {
      title: "Menu Management",
      href: "/restaurant/menu",
      icon: <Utensils size={20} />,
      active: location === "/restaurant/menu"
    },
    {
      title: "Orders",
      href: "/restaurant/orders",
      icon: <ShoppingBag size={20} />,
      active: location === "/restaurant/orders"
    },
    {
      title: "Analytics",
      href: "/restaurant/analytics",
      icon: <BarChart size={20} />,
      active: location === "/restaurant/analytics"
    },
    {
      title: "Customer Feedback",
      href: "/restaurant/feedback",
      icon: <Star size={20} />,
      active: location === "/restaurant/feedback"
    },
    {
      title: "Settings",
      href: "/restaurant/settings",
      icon: <Settings size={20} />,
      active: location === "/restaurant/settings"
    }
  ];

  const SidebarContent = (
    <div className="space-y-4 py-4">
      <div className="px-4 pb-2 flex items-center gap-2">
        <BrandLogo className="h-9 w-9" />
        <span className="text-lg font-bold text-primary">Reina Pabili</span>
      </div>
      <div className="px-4 py-2 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white">
          <Store size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">{user?.fullName || 'Restaurant'}</h3>
          <p className="text-sm text-gray-600">Restaurant Account</p>
        </div>
      </div>
      <Separator className="bg-gray-200" />
      <div className="px-2">
        <div className="space-y-1">
          {navItems.map((item) => (
            <div key={item.href}>
              <Link href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer ${
                    item.active
                      ? "bg-secondary/10 text-secondary font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </div>
              </Link>
            </div>
          ))}

          <Button
            variant="ghost"
            className="w-full justify-start px-3 py-2 text-destructive hover:bg-destructive/10 hover:text-destructive mt-4"
            onClick={handleLogout}
          >
            <LogOut size={20} className="mr-3" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-white border-r h-full overflow-y-auto">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 bg-white w-72">
          {SidebarContent}
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b h-16 px-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center">
            {isMobile && (
              <Button variant="ghost" size="icon" className="mr-2" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                2
              </Badge>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Avatar>
                    <AvatarFallback className="bg-secondary text-white">
                      {user?.fullName?.substring(0, 2).toUpperCase() || 'RE'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => window.location.href = "/restaurant/settings"}>
                  <Settings size={16} className="mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut size={16} className="mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 lg:pb-4">
          {isLoadingRestaurant ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : !restaurant ? (
            <div className="max-w-4xl mx-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <h3 className="text-amber-800 font-semibold text-lg mb-2">Restaurant Setup Required</h3>
                <p className="text-amber-700 mb-0">
                  Before you can start using the restaurant features, you need to set up your restaurant profile.
                  Please complete the onboarding process below.
                </p>
              </div>
              {user && <RestaurantOnboarding userId={user.id} />}
            </div>
          ) : (
            <>
              {!restaurant.isApproved && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                  <h3 className="text-amber-800 font-semibold text-lg mb-2">Awaiting Approval</h3>
                  <p className="text-amber-700 mb-0">
                    Your restaurant is currently pending approval from the administrator.
                    You'll be notified once it's approved and visible to customers.
                  </p>
                </div>
              )}
              {children}
            </>
          )}
        </main>

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white shadow-md border-t flex justify-around py-2 z-10">
            <div onClick={() => window.location.href = "/"} className={`p-2 text-center cursor-pointer ${location === "/" ? "text-secondary" : "text-gray-500"}`}>
              <LayoutDashboard size={20} className="mx-auto" />
              <span className="text-xs">Dashboard</span>
            </div>
            <div onClick={() => window.location.href = "/restaurant/menu"} className={`p-2 text-center cursor-pointer ${location === "/restaurant/menu" ? "text-secondary" : "text-gray-500"}`}>
              <Utensils size={20} className="mx-auto" />
              <span className="text-xs">Menu</span>
            </div>
            <div onClick={() => window.location.href = "/restaurant/orders"} className={`p-2 text-center cursor-pointer ${location === "/restaurant/orders" ? "text-secondary" : "text-gray-500"}`}>
              <ShoppingBag size={20} className="mx-auto" />
              <span className="text-xs">Orders</span>
            </div>
            <div onClick={() => window.location.href = "/restaurant/analytics"} className={`p-2 text-center cursor-pointer ${location === "/restaurant/analytics" ? "text-secondary" : "text-gray-500"}`}>
              <BarChart size={20} className="mx-auto" />
              <span className="text-xs">Analytics</span>
            </div>
          </nav>
        )}
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You'll need to sign in again to access your restaurant account.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center space-x-3 p-4 bg-muted/50 rounded-lg">
              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white">
                <Store size={20} />
              </div>
              <div>
                <p className="font-medium">{user?.fullName || 'Restaurant'}</p>
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
