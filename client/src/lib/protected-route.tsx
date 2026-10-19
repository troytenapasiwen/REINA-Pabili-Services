import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Route, useLocation } from "wouter";
import { UserRole } from "@shared/schema";

interface ProtectedRouteProps {
  path: string;
  component: React.ComponentType;
  roles?: (typeof UserRole)[keyof typeof UserRole][];
}

export function ProtectedRoute({
  path,
  component: Component,
  roles
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <Route path={path}>
        {() => (
          <div className="flex items-center justify-center min-h-screen">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
      </Route>
    );
  }

  // Check if user is authenticated
  if (!user) {
    return (
      <Route path={path}>
        {() => {
          setLocation("/auth");
          return <div></div>; // Return empty div instead of null
        }}
      </Route>
    );
  }

  // Check if user has required role
  if (roles && !roles.includes(user.role as (typeof UserRole)[keyof typeof UserRole])) {
    let redirectPath = "/";

    // Redirect based on user role
    if (user.role === UserRole.ADMIN) {
      redirectPath = "/";
    } else if (user.role === UserRole.RESTAURANT) {
      redirectPath = "/";
    } else if (user.role === UserRole.CUSTOMER) {
      redirectPath = "/";
    }

    return (
      <Route path={path}>
        {() => {
          setLocation(redirectPath);
          return <div></div>; // Return empty div instead of null
        }}
      </Route>
    );
  }

  // Use a render function to pass the component directly
  return <Route path={path}>{() => <Component />}</Route>;
}
