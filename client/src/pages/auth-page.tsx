import { useState, useEffect, useRef, type KeyboardEvent, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ShoppingBag,
  LogIn,
  User,
  Eye,
  EyeOff,
  Check,
  X,
  AlertCircle,
  Bike,
  Store,
  ClipboardList,
  TrendingUp,
  Clock,
  ArrowRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
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

/* ------------------------------------------------------------------ */
/* Presentation helpers (visual only, no auth logic)                   */
/* ------------------------------------------------------------------ */

/*
  Reina Pabili brand tokens, sampled from the logo and the promo post:
    yellow   #FFD527   (logo background, promo background)
    orange   #F76043   (logo roof, scooter, chevrons)
    charcoal #282828   (promo headline text, road)
  White text on this orange is only ~3.1:1, so text that sits ON the orange is charcoal (4.7:1).
  Everything is square-cornered on purpose, with hard offset shadows and charcoal outlines.
*/
const inputClass =
  "h-12 rounded-none border-2 border-[#282828] bg-white px-4 text-base placeholder:text-gray-500 focus-visible:border-[#282828] focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 aria-[invalid=true]:border-red-700";
const labelClass = "text-sm font-bold text-[#282828]";
const messageClass = "font-semibold text-red-700";
const buttonBase =
  "h-12 rounded-none border-2 border-[#282828] text-base font-bold text-[#282828] transition-all motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 disabled:opacity-60";
const hardShadow =
  "shadow-[4px_4px_0_0_#282828] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#282828] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0";
const primaryButtonClass = `${buttonBase} ${hardShadow} w-full bg-[#F76043] hover:bg-[#FF7154]`;
const secondaryButtonClass = `${buttonBase} ${hardShadow} w-full bg-[#FFD527] hover:bg-[#FFE066]`;
const plainButtonClass = `${buttonBase} bg-white px-5 hover:bg-gray-100`;
const textLinkClass =
  "h-auto rounded-none p-0 font-bold text-[#282828] underline decoration-[#F76043] decoration-2 underline-offset-4 hover:bg-transparent hover:text-[#282828] hover:decoration-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2";
const panelClass = "border-0 bg-transparent shadow-none rounded-none";
const panelHeaderClass = "px-0 pt-0 pb-5 space-y-1.5";
const panelContentClass = "px-0 pb-0";
const titleClass = "text-3xl font-extrabold uppercase tracking-tight text-[#282828]";
const descriptionClass = "text-base text-gray-700";
const passwordToggleClass =
  "absolute right-1 top-1 h-10 w-10 rounded-none p-0 text-[#282828] hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#282828]";
// Tab panels are plain containers, not controls. Radix makes them focusable (tabIndex=0) and the shadcn
// TabsContent adds a focus-visible ring in --ring (same coral as --primary), which draws an orange box
// around the whole panel. The ring is removed on the panel only; inputs, buttons and tab triggers keep theirs.
const tabPanelClass = "mt-0 outline-none ring-0 ring-offset-0 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

// Password strength calculation (pure)
const getPasswordRequirements = (password: string) => {
  return {
    hasLength: password.length >= 6,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };
};

// Compact live password checklist + meter. Shown once the person focuses or types in the password
// field, so the form stays short until the rules are relevant.
function PasswordStrengthIndicator({ password }: { password: string }) {
  const reqs = getPasswordRequirements(password);
  const metCount = Object.values(reqs).filter(Boolean).length;
  const isStrongPassword = metCount === 4;

  const items: { met: boolean; label: string }[] = [
    { met: reqs.hasLength, label: "6+ characters" },
    { met: reqs.hasLetter, label: "Letters (a-z)" },
    { met: reqs.hasNumber, label: "Numbers (0-9)" },
    { met: reqs.hasSpecial, label: "Special (!@#$%^&*)" },
  ];

  const meterColor = isStrongPassword
    ? "bg-green-600"
    : metCount >= 3
    ? "bg-yellow-500"
    : metCount >= 2
    ? "bg-[#F76043]"
    : "bg-red-600";

  const strengthLabel = isStrongPassword
    ? "Strong password"
    : metCount >= 3
    ? "Good password"
    : metCount >= 2
    ? "Fair password"
    : "Weak password";

  return (
    <div className="mt-2 space-y-2">
      <span className="sr-only">Password requirements</span>
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-2 border border-[#282828] transition-colors duration-300 ${i < metCount && password ? meterColor : "bg-white"}`}
            />
          ))}
        </div>
        <span className="min-w-[7.5rem] text-right text-xs font-bold text-[#282828]" aria-live="polite">
          {password ? strengthLabel : "Enter a password"}
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-1 border px-2 py-1 text-xs font-semibold ${
              item.met
                ? "border-green-800 bg-green-100 text-green-900"
                : "border-gray-400 bg-white text-gray-700"
            }`}
          >
            {item.met ? (
              <Check className="h-3 w-3 shrink-0" aria-hidden="true" />
            ) : (
              <X className="h-3 w-3 shrink-0" aria-hidden="true" />
            )}
            <span>
              {item.label}
              <span className="sr-only">{item.met ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Three chevrons, the motif from the Reina Pabili promo post
function Chevrons({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 76 40" className={className} fill="none" stroke="currentColor" strokeWidth="8" aria-hidden="true">
      <polyline points="6,4 22,20 6,36" />
      <polyline points="32,4 48,20 32,36" />
      <polyline points="58,4 74,20 58,36" />
    </svg>
  );
}

// Decorative "Pabili request" ticket shown on the branding panel. Purely illustrative, hidden from
// assistive tech, and non-interactive.
function OrderPreview() {
  const items = [
    { name: "Pandesal", qty: "× 10" },
    { name: "Kape", qty: "× 3" },
    { name: "Itlog", qty: "× 6" },
  ];
  const steps: { label: string; state: "done" | "active" }[] = [
    { label: "Request sent", state: "done" },
    { label: "Rider shopping", state: "done" },
    { label: "On the way", state: "active" },
  ];

  return (
    <div
      className="pointer-events-none w-full max-w-sm -rotate-2 border-2 border-[#282828] bg-white p-5 text-[#282828] shadow-[6px_6px_0_0_#282828]"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center border-2 border-[#282828] bg-[#FFD527]">
            <ShoppingBag className="h-4 w-4" />
          </span>
          <span className="text-sm font-extrabold uppercase tracking-tight">Pabili request</span>
        </div>
        <span className="border-2 border-[#282828] bg-[#FFD527] px-2.5 py-0.5 text-xs font-bold">
          Arrives in 12 min
        </span>
      </div>

      <ul className="mt-4 divide-y-2 divide-[#282828]/10 border-y-2 border-[#282828]/10 text-sm">
        {items.map((item) => (
          <li key={item.name} className="flex items-center justify-between py-2">
            <span className="font-semibold">{item.name}</span>
            <span className="font-bold text-gray-600">{item.qty}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-start">
        {steps.map((step, i) => (
          <div key={step.label} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && <span className="absolute -left-1/2 top-3 h-0.5 w-full bg-[#282828]" />}
            <span
              className={`relative z-10 flex h-6 w-6 items-center justify-center border-2 border-[#282828] ${
                step.state === "done"
                  ? "bg-[#282828] text-[#FFD527]"
                  : "bg-[#F76043] text-[#282828] motion-safe:animate-pulse"
              }`}
            >
              {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : <Bike className="h-3.5 w-3.5" />}
            </span>
            <span className={`mt-2 text-xs ${step.state === "active" ? "font-extrabold" : "font-semibold text-gray-700"}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// What each account type gets, shown on the branding panel while registering.
const ROLE_BENEFITS: Record<string, { icon: LucideIcon; text: string }[]> = {
  [UserRole.CUSTOMER]: [
    { icon: ShoppingBag, text: "Order from restaurants near you" },
    { icon: Bike, text: "Pabili: riders shop and deliver for you" },
    { icon: Clock, text: "Track every order in real time" },
  ],
  [UserRole.RESTAURANT]: [
    { icon: Store, text: "Put your menu in front of nearby customers" },
    { icon: ClipboardList, text: "Manage incoming orders in one place" },
    { icon: TrendingUp, text: "See your sales and customer feedback" },
  ],
};

function RoleBenefits({ role }: { role: string }) {
  const benefits = ROLE_BENEFITS[role] ?? ROLE_BENEFITS[UserRole.CUSTOMER];
  return (
    <ul className="grid gap-3.5" aria-live="polite">
      {benefits.map(({ icon: Icon, text }) => (
        <li key={`${role}-${text}`} className="flex items-center gap-3.5 text-base font-bold text-[#282828]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#282828] bg-[#FFD527] shadow-[3px_3px_0_0_#282828]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

const ACCOUNT_TYPES = [
  { value: UserRole.CUSTOMER, label: "Customer", hint: "Order food and use Pabili" },
  { value: UserRole.RESTAURANT, label: "Restaurant", hint: "Sell and manage orders" },
] as const;

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

  // Presentation only: tab selection + scroll anchor (form values live in the react-hook-form instances above/below)
  const [activeTab, setActiveTab] = useState("login");
  const previousTab = useRef(activeTab);
  const tabsAnchorRef = useRef<HTMLDivElement>(null);

  // Presentation only: caps-lock warning, progressive disclosure of the password checklist,
  // and the two-step registration layout (which step is showing).
  const [loginCapsLock, setLoginCapsLock] = useState(false);
  const [registerCapsLock, setRegisterCapsLock] = useState(false);
  const [showPasswordHints, setShowPasswordHints] = useState(false);
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const registerStepMounted = useRef(false);

  // Auto-focus the first field only where there is a physical keyboard; on touch devices it would
  // pop the keyboard open over the page before the person has seen it.
  const canAutoFocus =
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;

  // After the newly selected form has rendered, bring its tab bar/heading into view, but only if
  // the user has scrolled past it. Runs on tab changes only (not on validation, dialogs or OTP).
  useEffect(() => {
    if (previousTab.current === activeTab) return;
    previousTab.current = activeTab;
    const anchor = tabsAnchorRef.current;
    if (!anchor || anchor.getBoundingClientRect().top >= 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    anchor.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [activeTab]);

  // Validation messages are unchanged. "onTouched" only changes WHEN they first appear:
  // after the person leaves a field (and then live as they fix it), instead of only on submit.
  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      username: "",
      password: "",
      email: "",
      fullName: "",
      role: UserRole.CUSTOMER,
    },
  });

  const selectedRole = registerForm.watch("role");

  // Move focus to the first field of the step that just appeared (not on first render).
  useEffect(() => {
    if (!registerStepMounted.current) {
      registerStepMounted.current = true;
      return;
    }
    registerForm.setFocus(registerStep === 1 ? "fullName" : "username");
  }, [registerStep]);

  const handleCapsLock = (
    e: KeyboardEvent<HTMLInputElement>,
    setter: (value: boolean) => void,
  ) => {
    if (typeof e.getModifierState === "function") {
      setter(e.getModifierState("CapsLock"));
    }
  };

  // Registration is split into two short steps purely for layout. Step 1 is validated with the
  // existing schema before moving on; the final submit still goes through onRegisterSubmit below.
  async function goToRegisterStepTwo() {
    const valid = await registerForm.trigger(["role", "fullName", "email"]);
    if (valid) setRegisterStep(2);
  }

  function handleRegisterFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (registerStep === 1) {
      // Enter on step 1 means "continue", not "submit"
      e.preventDefault();
      void goToRegisterStepTwo();
      return;
    }
    return registerForm.handleSubmit(onRegisterSubmit)(e);
  }

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
            setActiveTab("login");
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

  // Which story the branding panel tells: the order ticket for log in / OTP, role benefits for register.
  const isRegisterView = !isOtpRequired && activeTab === "register";

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#FFD527]">
      {/* Maintenance Mode Modal */}
      <Dialog open={isMaintenanceMode && !showMaintenanceForAdmin} onOpenChange={() => {}}>
        <DialogContent className="rounded-none border-2 border-[#282828] sm:rounded-none sm:max-w-md">
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
          <Alert className="rounded-none bg-yellow-50 border-yellow-200">
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
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md">
          <Alert className="rounded-none bg-yellow-50 border-yellow-200">
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

      {/* Page background: brand-colour geometry. Non-interactive and clipped to the page. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-16 -top-20 h-64 w-64 rotate-12 bg-white/40" />
        <Chevrons className="absolute right-[5%] top-8 hidden w-28 text-[#F76043] sm:block" />
        <div className="absolute -right-24 top-[42%] h-60 w-60 rotate-45 bg-[#F76043]/35" />
        <div className="absolute bottom-10 left-[2%] hidden h-0 w-0 rotate-12 border-b-[110px] border-l-[64px] border-r-[64px] border-b-[#F76043] border-l-transparent border-r-transparent sm:block" />
        <div className="absolute bottom-[12%] right-[4%] hidden h-16 w-16 -rotate-12 border-4 border-[#282828] sm:block" />
        <div className="absolute left-[38%] top-4 hidden h-3 w-3 bg-[#282828] sm:block" />
        <div className="absolute inset-x-0 bottom-4 h-2 opacity-80 [background:repeating-linear-gradient(90deg,#282828_0_36px,transparent_36px_72px)]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-8 lg:py-6">
        <div className="flex w-full flex-col lg:flex-row lg:items-stretch">
          {/* Branding panel (left on desktop, compact header on mobile/tablet) */}
          <aside className="relative flex flex-col overflow-hidden border-[3px] border-[#282828] bg-[#F76043] px-6 pb-14 pt-6 text-[#282828] shadow-[6px_6px_0_0_#282828] sm:px-10 sm:pt-8 lg:w-[54%] lg:flex-none lg:px-12 lg:pb-10 lg:pr-40 lg:pt-9 lg:shadow-[8px_8px_0_0_#282828]">
            {/* Panel shapes: kept away from text and from the strip hidden under the form card */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -right-16 -top-16 h-56 w-56 rotate-12 bg-white/20" />
              <div className="absolute -bottom-20 -left-16 h-60 w-60 rotate-45 bg-[#FFD527]/60" />
              <Chevrons className="absolute bottom-6 right-44 hidden w-20 text-[#282828]/25 lg:block" />
            </div>

            {/* Brand row */}
            <div className="relative z-10 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center border-2 border-[#282828] bg-white p-1 shadow-[3px_3px_0_0_#282828]">
                <BrandLogo className="h-full w-full rounded-none" />
              </div>
              <span className="text-xl font-extrabold uppercase tracking-tight">Reina Pabili Services</span>
            </div>

            <div className="relative z-10 mt-6 lg:my-auto lg:py-6">
              {isRegisterView ? (
                <>
                  <h1 className="max-w-md text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-white [text-shadow:3px_3px_0_#282828] sm:text-4xl lg:text-[2.75rem]">
                    Let's get you set up.
                  </h1>
                  <p className="mt-3 hidden max-w-md text-lg font-semibold sm:block">
                    Choose how you'll use Reina Pabili Services.
                  </p>
                  <div className="mt-7 hidden lg:block">
                    <RoleBenefits role={selectedRole} />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="max-w-md text-3xl font-extrabold uppercase leading-[1.05] tracking-tight text-white [text-shadow:3px_3px_0_#282828] sm:text-4xl lg:text-[2.75rem]">
                    Pabili po! We'll bring it to you.
                  </h1>
                  <p className="mt-3 hidden max-w-md text-lg font-semibold sm:block">
                    Order from local restaurants, or ask a rider to buy anything and deliver it to your door.
                  </p>
                  <div className="mt-8 hidden lg:block">
                    <OrderPreview />
                  </div>
                </>
              )}
            </div>
          </aside>

          {/* Form card: overlaps the branding panel on desktop and the panel's bottom edge on mobile */}
          <main className="relative z-10 -mt-6 mx-1 min-w-0 border-[3px] border-[#282828] bg-white px-5 py-7 shadow-[6px_6px_0_0_#282828] sm:mx-8 sm:px-10 lg:mx-0 lg:my-6 lg:-ml-28 lg:flex-1 lg:px-12 lg:py-8 lg:shadow-[8px_8px_0_0_#282828]">
            <div className="mx-auto w-full max-w-md">
              {isOtpRequired ? (
                <Card className={panelClass}>
                  <CardHeader className={panelHeaderClass}>
                    <CardTitle className={titleClass}>Verify OTP</CardTitle>
                    <CardDescription className={descriptionClass}>
                      Please enter the one-time password to verify your account
                    </CardDescription>
                  </CardHeader>
                  <CardContent className={panelContentClass}>
                    <div className="[&_input]:rounded-none [&_input]:border-2 [&_input]:border-[#282828]">
                      <OTPInput
                        length={6}
                        onComplete={onOtpComplete}
                        disabled={verifyOtpMutation.isPending}
                      />
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col items-start px-0 pb-0 pt-6">
                    <p className="text-sm text-gray-700 mb-2">
                      Didn't receive the code?
                      <Button variant="link" className={`${textLinkClass} ml-2`}>
                        Resend
                      </Button>
                    </p>
                    <Button
                      variant="outline"
                      className={`${plainButtonClass} mt-4`}
                      onClick={() => { setIsOtpRequired(false); setActiveTab("login"); }}
                    >
                      Back to login
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <div ref={tabsAnchorRef} className="scroll-mt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="hidden">
                    <TabsTrigger value="login" data-testid="tab-login">Login</TabsTrigger>
                    <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
                  </TabsList>

                  {/* Login Form */}
                  <TabsContent value="login" tabIndex={-1} className={tabPanelClass}>
                    <Card className={panelClass}>
                      <CardHeader className={panelHeaderClass}>
                        <CardTitle className={titleClass}>Welcome back</CardTitle>
                        <CardDescription className={descriptionClass}>
                          Log in with your username and password.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className={panelContentClass}>
                        <Form {...loginForm}>
                          <form
                            onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                            className="space-y-4"
                            aria-busy={loginMutation.isPending}
                          >
                            <FormField
                              control={loginForm.control}
                              name="username"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className={labelClass}>Username</FormLabel>
                                  <FormControl>
                                    <Input
                                      className={inputClass}
                                      placeholder="Enter your username"
                                      autoComplete="username"
                                      autoCapitalize="none"
                                      spellCheck={false}
                                      autoFocus={canAutoFocus}
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage className={messageClass} />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={loginForm.control}
                              name="password"
                              render={({ field }) => (
                                <FormItem>
                                  <div className="flex items-center justify-between gap-2">
                                    <FormLabel className={labelClass}>Password</FormLabel>
                                    <a
                                      href="/forgot-password"
                                      className="text-sm font-bold text-[#282828] underline decoration-[#F76043] decoration-2 underline-offset-4 hover:decoration-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2"
                                    >
                                      Forgot password?
                                    </a>
                                  </div>
                                  <FormControl>
                                    <div className="relative">
                                      <Input
                                        className={`${inputClass} pr-12`}
                                        type={showLoginPassword ? "text" : "password"}
                                        placeholder="Enter your password"
                                        autoComplete="current-password"
                                        {...field}
                                        onKeyDown={(e) => handleCapsLock(e, setLoginCapsLock)}
                                        onKeyUp={(e) => handleCapsLock(e, setLoginCapsLock)}
                                        onBlur={() => {
                                          field.onBlur();
                                          setLoginCapsLock(false);
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className={passwordToggleClass}
                                        aria-label={showLoginPassword ? "Hide password" : "Show password"}
                                        aria-pressed={showLoginPassword}
                                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                                      >
                                        {showLoginPassword ? (
                                          <EyeOff className="h-5 w-5" aria-hidden="true" />
                                        ) : (
                                          <Eye className="h-5 w-5" aria-hidden="true" />
                                        )}
                                      </Button>
                                    </div>
                                  </FormControl>
                                  {loginCapsLock && (
                                    <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                                      <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                      Caps Lock is on
                                    </p>
                                  )}
                                  <FormMessage className={messageClass} />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              className={primaryButtonClass}
                              disabled={loginMutation.isPending}
                            >
                              {loginMutation.isPending ? (
                                <>
                                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#282828] border-r-transparent"></div>
                                  Logging in...
                                </>
                              ) : (
                                <>
                                  <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Log in
                                </>
                              )}
                            </Button>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                    <div className="mt-6 border-t-2 border-[#282828] pt-5 text-center">
                      <p className="text-sm font-semibold text-gray-700">New to Reina Pabili Services?</p>
                      <Button
                        type="button"
                        variant="outline"
                        className={`${secondaryButtonClass} mt-3`}
                        onClick={() => setActiveTab("register")}
                      >
                        Create an account
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Register Form (two short steps so it fits on one screen) */}
                  <TabsContent value="register" id="register-tab" tabIndex={-1} className={tabPanelClass}>
                    <Card className={panelClass}>
                      <CardHeader className={panelHeaderClass}>
                        <CardTitle className={titleClass}>Create your account</CardTitle>
                        <CardDescription className={descriptionClass}>
                          {registerStep === 1
                            ? "Fill in your details to register with Reina Pabili Services"
                            : "Almost done. Choose how you'll log in."}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className={panelContentClass}>
                        {/* Progress */}
                        <ol className="mb-5 flex items-center gap-3" aria-label="Registration progress">
                          <li
                            className="flex items-center gap-2"
                            aria-current={registerStep === 1 ? "step" : undefined}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center border-2 border-[#282828] text-sm font-extrabold ${
                                registerStep === 1 ? "bg-[#F76043]" : "bg-[#FFD527]"
                              }`}
                            >
                              {registerStep > 1 ? <Check className="h-4 w-4" aria-hidden="true" /> : "1"}
                            </span>
                            <span className="text-sm font-bold text-[#282828]">About you</span>
                          </li>
                          <li role="presentation" className="h-0.5 flex-1 bg-[#282828]" />
                          <li
                            className="flex items-center gap-2"
                            aria-current={registerStep === 2 ? "step" : undefined}
                          >
                            <span
                              className={`flex h-7 w-7 items-center justify-center border-2 text-sm font-extrabold ${
                                registerStep === 2
                                  ? "border-[#282828] bg-[#F76043] text-[#282828]"
                                  : "border-gray-500 bg-white text-gray-700"
                              }`}
                            >
                              2
                            </span>
                            <span className={`text-sm font-bold ${registerStep === 2 ? "text-[#282828]" : "text-gray-700"}`}>
                              Your login
                            </span>
                          </li>
                        </ol>

                        <Form {...registerForm}>
                          <form
                            onSubmit={handleRegisterFormSubmit}
                            className="space-y-4"
                            aria-busy={registerMutation.isPending}
                          >
                            {/* Step 1: who you are. Kept mounted (just hidden) so values are never lost. */}
                            <div
                              className={registerStep === 1 ? "space-y-4" : "hidden"}
                              role="group"
                              aria-label="Step 1 of 2: About you"
                            >
                              <FormField
                                control={registerForm.control}
                                name="role"
                                render={({ field }) => (
                                  <FormItem>
                                    <span id="account-type-label" className={labelClass}>I'm signing up as</span>
                                    <div className="mt-1.5 grid grid-cols-2 gap-3" role="group" aria-labelledby="account-type-label">
                                      {ACCOUNT_TYPES.map((type) => {
                                        const selected = field.value === type.value;
                                        return (
                                          <button
                                            key={type.value}
                                            type="button"
                                            aria-pressed={selected}
                                            onClick={() => registerForm.setValue("role", type.value)}
                                            className={`relative min-h-[4.25rem] border-2 border-[#282828] px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 ${
                                              selected
                                                ? "bg-[#FFD527] shadow-[3px_3px_0_0_#282828]"
                                                : "bg-white hover:bg-gray-100"
                                            }`}
                                          >
                                            <span className="block text-sm font-extrabold text-[#282828]">{type.label}</span>
                                            <span className={`mt-0.5 block text-xs font-semibold ${selected ? "text-[#282828]" : "text-gray-700"}`}>
                                              {type.hint}
                                            </span>
                                            {selected && (
                                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center bg-[#282828] text-[#FFD527]">
                                                <Check className="h-3 w-3" aria-hidden="true" />
                                              </span>
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <FormMessage className={messageClass} />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={registerForm.control}
                                name="fullName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className={labelClass}>Full name</FormLabel>
                                    <FormControl>
                                      <Input
                                        className={inputClass}
                                        placeholder="Enter your full name"
                                        autoComplete="name"
                                        autoFocus={canAutoFocus}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage className={messageClass} />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={registerForm.control}
                                name="email"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className={labelClass}>Email</FormLabel>
                                    <FormControl>
                                      <Input
                                        className={inputClass}
                                        type="email"
                                        placeholder="Enter your email"
                                        autoComplete="email"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage className={messageClass} />
                                  </FormItem>
                                )}
                              />
                              <Button type="submit" className={primaryButtonClass}>
                                Continue
                                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                              </Button>
                            </div>

                            {/* Step 2: how you log in */}
                            <div
                              className={registerStep === 2 ? "space-y-4" : "hidden"}
                              role="group"
                              aria-label="Step 2 of 2: Your login"
                            >
                              <FormField
                                control={registerForm.control}
                                name="username"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className={labelClass}>Username</FormLabel>
                                    <FormControl>
                                      <Input
                                        className={inputClass}
                                        placeholder="Choose a username"
                                        autoComplete="username"
                                        autoCapitalize="none"
                                        spellCheck={false}
                                        {...field}
                                      />
                                    </FormControl>
                                    <FormMessage className={messageClass} />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={registerForm.control}
                                name="password"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className={labelClass}>Password</FormLabel>
                                    <FormControl>
                                      <div className="relative">
                                        <Input
                                          className={`${inputClass} pr-12`}
                                          type={showRegisterPassword ? "text" : "password"}
                                          placeholder="Choose a password"
                                          autoComplete="new-password"
                                          {...field}
                                          onFocus={() => setShowPasswordHints(true)}
                                          onKeyDown={(e) => handleCapsLock(e, setRegisterCapsLock)}
                                          onKeyUp={(e) => handleCapsLock(e, setRegisterCapsLock)}
                                          onBlur={() => {
                                            field.onBlur();
                                            setRegisterCapsLock(false);
                                          }}
                                        />
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className={passwordToggleClass}
                                          aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                                          aria-pressed={showRegisterPassword}
                                          onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                        >
                                          {showRegisterPassword ? (
                                            <EyeOff className="h-5 w-5" aria-hidden="true" />
                                          ) : (
                                            <Eye className="h-5 w-5" aria-hidden="true" />
                                          )}
                                        </Button>
                                      </div>
                                    </FormControl>
                                    {registerCapsLock && (
                                      <p role="status" className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                                        <AlertCircle className="h-4 w-4" aria-hidden="true" />
                                        Caps Lock is on
                                      </p>
                                    )}
                                    {(showPasswordHints || !!field.value) && (
                                      <PasswordStrengthIndicator password={field.value || ""} />
                                    )}
                                    <FormMessage className={messageClass} />
                                  </FormItem>
                                )}
                              />
                              <div className="flex gap-3">
                                <Button
                                  type="button"
                                  variant="outline"
                                  className={plainButtonClass}
                                  onClick={() => setRegisterStep(1)}
                                  disabled={registerMutation.isPending}
                                >
                                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                                  Back
                                </Button>
                                <Button
                                  type="submit"
                                  className={`${primaryButtonClass} flex-1`}
                                  disabled={registerMutation.isPending}
                                >
                                  {registerMutation.isPending ? (
                                    <>
                                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-[#282828] border-r-transparent"></div>
                                      Creating account...
                                    </>
                                  ) : (
                                    <>
                                      <User className="mr-2 h-4 w-4" aria-hidden="true" />
                                      Create account
                                    </>
                                  )}
                                </Button>
                              </div>
                              <p className="text-center text-xs font-semibold text-gray-700">
                                You'll review the Terms and Conditions next, before your account is created.
                              </p>
                            </div>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                    <p className="mt-5 border-t-2 border-[#282828] pt-4 text-center text-sm font-semibold text-gray-700">
                      Already have an account?{" "}
                      <Button type="button" variant="link" className={textLinkClass} onClick={() => setActiveTab("login")}>
                        Log in
                      </Button>
                    </p>
                  </TabsContent>
                </Tabs>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}