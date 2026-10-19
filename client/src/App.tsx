import React from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import AuthPage from "@/pages/auth-page";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import TestPage from "@/pages/test-page";

import { RestaurantCheck } from "@/components/restaurant/restaurant-check";
import { CartProvider } from "@/contexts/cart-context";
import { NotificationProvider } from "@/hooks/use-notifications";
import { LanguageProvider } from "@/contexts/language-context";

// Admin Pages
import AdminDashboard from "@/pages/admin/dashboard";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminRestaurants from "@/pages/admin/restaurants";
import AdminOrders from "@/pages/admin/orders";
import AdminRiders from "@/pages/admin/riders";
import AdminUsers from "@/pages/admin/users-new";
import AdminPayments from "@/pages/admin/payments";
import AdminSettings from "@/pages/admin/settings";
import AdminMenuItems from "@/pages/admin/menu-items";
import AdminHealthPage from "@/pages/admin/health";
import AdminFeedbackPage from "@/pages/admin/feedback";
import AdminLoyaltyPage from "@/pages/admin/loyalty";

// Restaurant Pages
import RestaurantDashboard from "@/pages/restaurant/dashboard";
import RestaurantMenu from "@/pages/restaurant/menu";
import RestaurantOrders from "@/pages/restaurant/orders";
import RestaurantAnalytics from "@/pages/restaurant/analytics";
import RestaurantSettings from "@/pages/restaurant/settings";
import RestaurantSetupPage from "@/pages/restaurant/setup";
import RestaurantProfile from "@/pages/restaurant/profile";
import RestaurantFeedback from "@/pages/restaurant/feedback";

// Customer Pages
import CustomerHome from "@/pages/customer/home";
import CustomerRestaurantDetails from "@/pages/customer/restaurant-details";
import CustomerCart from "@/pages/customer/cart";
import CustomerProfile from "@/pages/customer/profile";
import CustomerOrders from "@/pages/customer/orders";
import CustomerCheckout from "@/pages/customer/checkout";
import CustomerOrderDetails from "@/pages/customer/order-details";
import EditProfilePage from "@/pages/customer/edit-profile";
import PabiliPage from "@/pages/customer/pabili-steps";

// Rider Pages
import RiderDashboard from "@/pages/rider/dashboard";
import RiderMapPage from "@/pages/rider/map";
import RiderProfile from "@/pages/rider/profile";
import RiderDocuments from "@/pages/rider/documents";
import RiderLayout from "@/layouts/RiderLayout";

// Layout detection based on user role
import { UserRole } from "@shared/schema";

function Router() {
  const { user } = useAuth();
  const userRole = user?.role;

  return (
    <Switch>
      {/* Auth routes */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/test" component={TestPage} />

      {/* Admin routes */}
      <ProtectedRoute
        path="/"
        component={() => userRole === UserRole.ADMIN ? <AdminDashboard /> :
                         userRole === UserRole.RESTAURANT ? <RestaurantDashboard /> :
                         userRole === UserRole.RIDER ? <RiderDashboard /> :
                         <CustomerHome />}
      />

      {/* Admin specific routes */}
      <ProtectedRoute path="/admin/analytics" component={AdminAnalytics} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/restaurants" component={AdminRestaurants} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/menu-items" component={AdminMenuItems} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/orders" component={AdminOrders} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/riders" component={AdminRiders} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/users" component={AdminUsers} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/payments" component={AdminPayments} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/feedback" component={AdminFeedbackPage} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/loyalty" component={AdminLoyaltyPage} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/settings" component={AdminSettings} roles={[UserRole.ADMIN]} />
      <ProtectedRoute path="/admin/health" component={AdminHealthPage} roles={[UserRole.ADMIN]} />

      {/* Restaurant specific routes */}
      <ProtectedRoute path="/restaurant/setup" component={RestaurantSetupPage} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/menu" component={RestaurantMenu} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/orders" component={RestaurantOrders} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/analytics" component={RestaurantAnalytics} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/feedback" component={RestaurantFeedback} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/settings" component={RestaurantSettings} roles={[UserRole.RESTAURANT]} />
      <ProtectedRoute path="/restaurant/:id" component={RestaurantProfile} roles={[UserRole.RESTAURANT]} />

      {/* Customer specific routes */}
      <ProtectedRoute path="/restaurants/:id" component={CustomerRestaurantDetails} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/cart" component={CustomerCart} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/checkout" component={CustomerCheckout} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/profile" component={CustomerProfile} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/profile/edit" component={EditProfilePage} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/orders" component={CustomerOrders} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/orders/:id" component={CustomerOrderDetails} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/pabili" component={PabiliPage} roles={[UserRole.CUSTOMER]} />
      <ProtectedRoute path="/pabili-steps" component={PabiliPage} roles={[UserRole.CUSTOMER]} />

      {/* Rider specific routes */}
      <ProtectedRoute path="/rider/deliveries" component={RiderDashboard} roles={[UserRole.RIDER]} />
      <ProtectedRoute path="/rider/profile" component={RiderProfile} roles={[UserRole.RIDER]} />
      <ProtectedRoute path="/rider/documents" component={RiderDocuments} roles={[UserRole.RIDER]} />
      <ProtectedRoute path="/rider/history" component={() => <RiderLayout title="Delivery History" description="View your past deliveries"><div className="p-6 bg-white rounded-lg border">History page under construction</div></RiderLayout>} roles={[UserRole.RIDER]} />
      <ProtectedRoute path="/rider/map" component={RiderMapPage} roles={[UserRole.RIDER]} />
      <ProtectedRoute path="/rider/settings" component={() => <RiderLayout title="Settings" description="Manage your rider settings"><div className="p-6 bg-white rounded-lg border">Settings page under construction</div></RiderLayout>} roles={[UserRole.RIDER]} />

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <TooltipProvider>
      <Toaster />
      <LanguageProvider>
        <RestaurantCheck>
          <CartProvider>
            <NotificationProvider>
              <Router />
            </NotificationProvider>
          </CartProvider>
        </RestaurantCheck>
      </LanguageProvider>
    </TooltipProvider>
  );
}

export default App;
