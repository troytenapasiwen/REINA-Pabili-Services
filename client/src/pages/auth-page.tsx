import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ShoppingBag, LogIn, User, Eye, EyeOff, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OTPInput } from "@/components/ui/otp-input";
import { UserRole } from "@shared/schema";
import { TermsConditions } from "@/components/auth/terms-conditions";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BrandLogo } from "@/components/brand-logo";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// Password strength validation function
const validateStrongPassword = (password: string) => {
  const hasLength = password.length >= 6;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return hasLength && hasLetter && hasNumber && hasSpecial;
};

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .refine(validateStrongPassword, {
      message: "Password must contain letters, numbers, and special characters"
    }),
  email: z.string().email("Please enter a valid email"),
  fullName: z.string().min(2, "Full name is required"),
  role: z.enum([UserRole.CUSTOMER, UserRole.RESTAURANT], {
    required_error: "Please select a role",
  }),
});

export default function AuthPage() {
  const [location, setLocation] = useLocation();
  const { user, isLoading, loginMutation, registerMutation, verifyOtpMutation } = useAuth();
  const { toast } = useToast();
  const [isOtpRequired, setIsOtpRequired] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [pendingRegistrationData, setPendingRegistrationData] = useState<any>(null);
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [checkingMaintenance, setCheckingMaintenance] = useState(true);
  const [showMaintenanceForAdmin, setShowMaintenanceForAdmin] = useState(false);

  // Password strength calculation
  const getPasswordRequirements = (password: string) => {
    return {
      hasLength: password.length >= 6,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
  };

  // Password strength indicator component
  const PasswordStrengthIndicator = ({ password }: { password: string }) => {
    const reqs = getPasswordRequirements(password);
    const isStrongPassword = Object.values(reqs).every(Boolean);

    return (
      <div className="mt-2 space-y-2">
        <div className="text-sm font-medium text-gray-700">Password Requirements:</div>
        <div className="space-y-1">
          <div className={`flex items-center text-xs ${reqs.hasLength ? 'text-green-600' : 'text-gray-500'}`}>
            {reqs.hasLength ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
            At least 6 characters
          </div>
          <div className={`flex items-center text-xs ${reqs.hasLetter ? 'text-green-600' : 'text-gray-500'}`}>
            {reqs.hasLetter ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Contains letters (a-z)
          </div>
          <div className={`flex items-center text-xs ${reqs.hasNumber ? 'text-green-600' : 'text-gray-500'}`}>
            {reqs.hasNumber ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Contains numbers (0-9)
          </div>
          <div className={`flex items-center text-xs ${reqs.hasSpecial ? 'text-green-600' : 'text-gray-500'}`}>
            {reqs.hasSpecial ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
            Contains special characters (!@#$%^&*)
          </div>
        </div>
        {password && (
          <div className="mt-2">
            <div className="text-xs text-gray-600 mb-1">Password Strength:</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isStrongPassword
                    ? 'bg-green-500 w-full'
                    : Object.values(reqs).filter(Boolean).length >= 3
                    ? 'bg-yellow-500 w-3/4'
                    : Object.values(reqs).filter(Boolean).length >= 2
                    ? 'bg-orange-500 w-1/2'
                    : 'bg-red-500 w-1/4'
                }`}
              />
            </div>
            <div className="text-xs mt-1 text-gray-600">
              {isStrongPassword
                ? 'Strong password'
                : Object.values(reqs).filter(Boolean).length >= 3
                ? 'Good password'
                : Object.values(reqs).filter(Boolean).length >= 2
                ? 'Fair password'
                : 'Weak password'
              }
            </div>
          </div>
        )}
      </div>
    );
  };

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      fullName: "",
      role: UserRole.CUSTOMER,
    },
  });

  // Handle login submission
  function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(values, {
      onSuccess: (data) => {
        // Check if OTP is enabled on the user's account
        if (data.otpEnabled) {
          setIsOtpRequired(true);
        } else {
          // Force a hard redirect to the home page
          window.location.href = '/';
        }
      },
      onError: (error: any) => {
        // Check if it's an email verification error
        if (error?.response?.status === 403 && error?.response?.data?.emailNotVerified) {
          const email = error?.response?.data?.email;
          toast({
            title: "Email Not Verified",
            description: (
              <div className="space-y-2">
                <p>{error?.response?.data?.message}</p>
                <Button
                  variant="link"
                  className="p-0 h-auto text-blue-600"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/resend-verification', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                      });
                      const data = await response.json();
                      toast({
                        title: "Email Sent",
                        description: data.message || "Verification email has been sent.",
                      });
                    } catch (err) {
                      toast({
                        title: "Error",
                        description: "Failed to send verification email.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  Resend verification email
                </Button>
              </div>
            ),
            variant: "destructive",
            duration: 10000, // Keep it visible longer
          });
        }
        // Check if it's a maintenance mode error
        else if (error?.response?.status === 503 || error?.message?.includes('maintenance')) {
          // Show maintenance message for admin users
          setShowMaintenanceForAdmin(true);
        }
      },
    });
  }

  // Handle registration submission
  function onRegisterSubmit(values: z.infer<typeof registerSchema>) {
    // Store registration data and show terms dialog
    setPendingRegistrationData(values);
    setShowTermsDialog(true);
  }

  // Handle terms acceptance
  function handleTermsAccept() {
    if (pendingRegistrationData) {
      // Include terms acceptance in registration data
      const registrationWithTerms = {
        ...pendingRegistrationData,
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
      };

      registerMutation.mutate(registrationWithTerms, {
        onSuccess: () => {
          setShowTermsDialog(false);
          setPendingRegistrationData(null);
          // Show success message about email verification
          toast({
            title: "Registration Successful!",
            description: "Please check your email to verify your account before logging in.",
            duration: 6000,
          });
          // Switch to login tab after a short delay
          setTimeout(() => {
            const loginTab = document.querySelector('[data-testid="tab-login"]') as HTMLButtonElement;
            if (loginTab) loginTab.click();
          }, 2000);
        },
        onError: () => {
          setShowTermsDialog(false);
          setPendingRegistrationData(null);
        }
      });
    }
  }

  // Handle terms decline
  function handleTermsDecline() {
    setShowTermsDialog(false);
    setPendingRegistrationData(null);
  }

  // Handle OTP verification
  function onOtpComplete(otp: string) {
    verifyOtpMutation.mutate({ otp }, {
      onSuccess: () => {
        // Force a hard redirect to the home page
        window.location.href = '/';
      }
    });
  }

  // Check maintenance mode on page load
  useEffect(() => {
    const checkMaintenanceMode = async () => {
      try {
        const response = await fetch("/api/public/maintenance-status");
        const data = await response.json();
        setIsMaintenanceMode(data.isMaintenanceMode);
      } catch (error) {
        console.error("Failed to check maintenance mode:", error);
      } finally {
        setCheckingMaintenance(false);
      }
    };

    checkMaintenanceMode();
  }, []);

  // Redirect if user is already logged in
  useEffect(() => {
    if (user && !isLoading) {
      window.location.href = "/";
    }
  }, [user, isLoading]);

  if (isLoading || checkingMaintenance) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      {/* Maintenance Mode Modal */}
      <Dialog open={isMaintenanceMode && !showMaintenanceForAdmin} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              System Maintenance
            </DialogTitle>
            <DialogDescription className="pt-3">
              Our system is currently undergoing scheduled maintenance. We apologize for any inconvenience.
              Please check back later.
            </DialogDescription>
          </DialogHeader>
          <Alert className="bg-yellow-50 border-yellow-200">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Maintenance in Progress</AlertTitle>
            <AlertDescription>
              We are working to improve your experience. The system will be back online shortly.
              If you are an administrator, you can still log in below.
            </AlertDescription>
          </Alert>
          <div className="text-sm text-muted-foreground text-center pt-2">
            Expected to be back online soon.
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Maintenance Notice */}
      {showMaintenanceForAdmin && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Alert className="bg-yellow-50 border-yellow-200 max-w-md">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Maintenance Mode Active</AlertTitle>
            <AlertDescription>
              The system is in maintenance mode. Only administrators can log in.
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Terms and Conditions Dialog */}
      <TermsConditions
        isOpen={showTermsDialog}
        onAccept={handleTermsAccept}
        onDecline={handleTermsDecline}
      />

      {/* Hero Section */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary p-12 flex-col justify-center text-white">
        <div className="max-w-md mx-auto">
          <div className="flex items-center mb-8">
            <BrandLogo className="h-14 w-14 ring-2 ring-white/40" />
            <h1 className="text-3xl font-bold ml-2">Reina Pabili Services</h1>
          </div>
          <h2 className="text-4xl font-bold mb-6">Fast, Reliable Delivery Services</h2>
          <p className="text-xl mb-8">
            Order from your favorite restaurants and have delicious meals delivered to your doorstep.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Wide Selection</h3>
              <p className="text-sm">Choose from hundreds of restaurants across the city</p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Fast Delivery</h3>
              <p className="text-sm">Get your food delivered within 30-45 minutes</p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Secure Payments</h3>
              <p className="text-sm">Multiple payment options for your convenience</p>
            </div>
            <div className="bg-white/10 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Live Tracking</h3>
              <p className="text-sm">Track your order in real-time from restaurant to door</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {isOtpRequired ? (
            <Card>
              <CardHeader>
                <CardTitle>Verify OTP</CardTitle>
                <CardDescription>
                  Please enter the one-time password to verify your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <OTPInput
                  length={6}
                  onComplete={onOtpComplete}
                  disabled={verifyOtpMutation.isPending}
                />
              </CardContent>
              <CardFooter className="flex flex-col items-start">
                <p className="text-sm text-muted-foreground mb-2">
                  Didn't receive the code?
                  <Button variant="link" className="p-0 h-auto ml-1">
                    Resend
                  </Button>
                </p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={() => setIsOtpRequired(false)}
                >
                  Back to Login
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login">
                <Card>
                  <CardHeader>
                    <CardTitle>Login to Reina Pabili Services</CardTitle>
                    <CardDescription>
                      Enter your credentials to access your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...loginForm}>
                      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                        <FormField
                          control={loginForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={loginForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex justify-between items-center">
                                <FormLabel>Password</FormLabel>
                                <Button
                                  variant="link"
                                  className="p-0 h-auto text-xs"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    window.location.href = '/forgot-password';
                                  }}
                                >
                                  Forgot Password?
                                </Button>
                              </div>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showLoginPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    {...field}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                                  >
                                    {showLoginPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">
                                      {showLoginPassword ? "Hide password" : "Show password"}
                                    </span>
                                  </Button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loginMutation.isPending}
                        >
                          {loginMutation.isPending ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                              Logging in...
                            </>
                          ) : (
                            <>
                              <LogIn className="mr-2 h-4 w-4" />
                              Login
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register" id="register-tab">
                <Card>
                  <CardHeader>
                    <CardTitle>Create an Account</CardTitle>
                    <CardDescription>
                      Fill in your details to register with Reina Pabili Services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                        <FormField
                          control={registerForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Enter your full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="Enter your email" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Choose a username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    type={showRegisterPassword ? "text" : "password"}
                                    placeholder="Choose a password"
                                    {...field}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                  >
                                    {showRegisterPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">
                                      {showRegisterPassword ? "Hide password" : "Show password"}
                                    </span>
                                  </Button>
                                </div>
                              </FormControl>
                              <PasswordStrengthIndicator password={field.value || ""} />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={registerForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Account Type</FormLabel>
                              <div className="flex gap-4">
                                <Button
                                  type="button"
                                  variant={field.value === UserRole.CUSTOMER ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => registerForm.setValue("role", UserRole.CUSTOMER)}
                                >
                                  Customer
                                </Button>
                                <Button
                                  type="button"
                                  variant={field.value === UserRole.RESTAURANT ? "default" : "outline"}
                                  className="flex-1"
                                  onClick={() => registerForm.setValue("role", UserRole.RESTAURANT)}
                                >
                                  Restaurant
                                </Button>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          className="w-full"
                          disabled={registerMutation.isPending}
                        >
                          {registerMutation.isPending ? (
                            <>
                              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                              Registering...
                            </>
                          ) : (
                            <>
                              <User className="mr-2 h-4 w-4" />
                              Register
                            </>
                          )}
                        </Button>
                      </form>
                    </Form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}

          {/* Mobile app logo for smaller screens */}
          <div className="lg:hidden mt-12 text-center">
            <div className="flex items-center justify-center mb-4">
              <BrandLogo className="h-12 w-12" />
              <h1 className="text-2xl font-bold ml-2 text-primary">Reina Pabili Services</h1>
            </div>
            <p className="text-sm text-muted-foreground">Fast, Reliable Delivery Services</p>
          </div>
        </div>
      </div>
    </div>
  );
}
