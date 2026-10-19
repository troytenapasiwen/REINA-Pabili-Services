import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, UserRole, RiderStatus, otpSchema } from "@shared/schema";
import { generateOTP, verifyOTP } from "./utils";
import { sendEmailVerificationEmail, getBaseUrl } from "./email-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}

    namespace session {
      interface SessionData {
        justRegisteredRider?: boolean;
        otpPending?: boolean;
      }
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set.");
  }

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => {
    if (!req.session.otpPending || !req.path.startsWith("/api/")) {
      return next();
    }

    if (["/api/login", "/api/verify-otp", "/api/logout"].includes(req.path)) {
      return next();
    }

    return res.status(403).json({
      requiresOtp: true,
      message: "OTP verification required",
    });
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

        // Pass the user even if unverified - the login endpoint will handle the verification check
        // This allows the endpoint to return a richer response with email info for resend functionality
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password, email, role, fullName } = req.body;

      // Check if username or email already exists
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email is already registered with ANY role
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        // Provide detailed error message about email being already in use
        const roleText = existingEmail.role ? `already registered as ${existingEmail.role}` : "already registered";
        return res.status(400).json({
          message: `This email address is ${roleText}. Please use a different email or login with your existing account.`
        });
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Generate email verification token
      const verificationToken = randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Create user with email verification fields
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        email,
        role: role || UserRole.CUSTOMER,
        fullName,
        isActive: true,
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        otpEnabled: false,
      });

      // Send verification email
      try {
        const baseUrl = getBaseUrl(req);
        await sendEmailVerificationEmail(email, fullName || username, verificationToken, baseUrl);
        console.log(`Verification email sent to ${email} with base URL: ${baseUrl}`);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }

      // Create additional record based on role
      if (user.role === UserRole.CUSTOMER) {
        await storage.createCustomer({
          userId: user.id,
          defaultAddress: "",
          savedAddresses: [],
        });
      } else if (user.role === UserRole.RESTAURANT) {
        // Create a restaurant record for restaurant users
        await storage.createRestaurant({
          userId: user.id,
          name: fullName || `${username}'s Restaurant`,
          description: "New restaurant on Reina Pabili Services",
          address: "",
          phone: "",
          email: email,
          isActive: true,
          deliveryFee: 50,
          categories: ["General"],
          openingTime: "09:00",
          closingTime: "21:00",
        });
      } else if (user.role === UserRole.RIDER) {
        // Set a flag in the session for rider registration
        // This will be used by the /api/riders endpoint to allow creation
        if (req.session) {
          req.session.justRegisteredRider = true;
        }
      }

      // Only login the user if it's not an admin creating the account
      // If an admin is creating the account, preserve the admin's session
      const isAdminCreatingAccount = req.isAuthenticated() && req.user.role === UserRole.ADMIN;

      if (isAdminCreatingAccount) {
        // Admin is creating the account, don't login the new user
        // Just return the created user data
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      } else {
        // Don't automatically login unverified users - they must verify email first
        // Admin users are an exception and can login immediately
        if (user.role === UserRole.ADMIN) {
          // Admin users can login immediately without email verification
          req.login(user, (err) => {
            if (err) return next(err);

            // Remove password before sending response
            const { password, ...userWithoutPassword } = user;
            res.status(201).json(userWithoutPassword);
          });
        } else {
          // Regular users must verify email before they can login
          // Remove password before sending response
          const { password, ...userWithoutPassword } = user;
          res.status(201).json({
            ...userWithoutPassword,
            emailVerificationRequired: true,
            message: "Registration successful! Please check your email to verify your account before logging in."
          });
        }
      }
    } catch (error) {
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info.message || "Invalid credentials" });

      // Check email verification status (skip for admin users)
      if (user.role !== UserRole.ADMIN && !user.emailVerified) {
        return res.status(403).json({
          message: "Please verify your email address before logging in. Check your email for the verification link.",
          emailNotVerified: true,
          email: user.email
        });
      }

      // Check maintenance mode
      try {
        const maintenanceSetting = await storage.getSetting("maintenanceMode");
        const isMaintenanceMode = maintenanceSetting?.value === "true";

        // If in maintenance mode and user is not an admin, block login
        if (isMaintenanceMode && user.role !== UserRole.ADMIN) {
          return res.status(503).json({
            message: "The system is currently under maintenance. Please try again later.",
            maintenanceMode: true
          });
        }
      } catch (error) {
        console.error("Error checking maintenance mode:", error);
        // Continue with login if there's an error checking maintenance mode
      }

      req.login(user, async (err) => {
        if (err) return next(err);

        // Update last login time
        await storage.updateUser(user.id, { lastLogin: new Date() });

        // If the user is a rider, make sure they have a rider profile and set status to ACTIVE
        if (user.role === UserRole.RIDER) {
          try {
            // First check if they already have a rider profile
            let rider = await storage.getRiderByUserId(user.id);

            if (!rider) {
              // Create a new rider profile with ACTIVE status
              console.log("Creating rider profile for rider user on login");
              rider = await storage.createRider({
                userId: user.id,
                licenseNumber: "PENDING",
                vehicleType: "motorcycle",
                vehiclePlateNumber: "PENDING",
                status: RiderStatus.ACTIVE,
                currentLocation: {},
                isVerified: false,
              });
              console.log("Created rider profile on login with ID:", rider.id);
            } else {
              // Update existing rider to ACTIVE status
              console.log("Setting existing rider to ACTIVE status, ID:", rider.id);
              await storage.updateRider(rider.id, { status: RiderStatus.ACTIVE });
            }
          } catch (error) {
            console.error("Error creating/updating rider profile on login:", error);
            // Continue login process even if rider profile update fails
          }
        }

        // Generate OTP if enabled
        if (user.otpEnabled) {
          req.session.otpPending = true;
          const otpSecret = user.otpSecret || generateOTP();
          if (!user.otpSecret) {
            await storage.updateUser(user.id, { otpSecret });
          }
          return res.status(200).json({
            requiresOtp: true,
            message: "OTP required"
          });
        }

        req.session.otpPending = false;

        // Remove password before sending response
        const { password, otpSecret, ...userWithoutSensitiveInfo } = user;
        return res.status(200).json(userWithoutSensitiveInfo);
      });
    })(req, res, next);
  });

  // Verify OTP endpoint
  app.post("/api/verify-otp", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);

      if (!user || !user.otpEnabled || !user.otpSecret) {
        return res.status(400).json({ message: "OTP not enabled for this user" });
      }

      const { otp } = req.body;

      const validationResult = otpSchema.safeParse({ otp });
      if (!validationResult.success) {
        return res.status(400).json({ message: "Invalid OTP format" });
      }

      const isValid = verifyOTP(user.otpSecret, otp);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid OTP" });
      }

      delete req.session.otpPending;

      // Remove sensitive info before sending the response
      const { password, otpSecret, ...userWithoutSensitiveInfo } = user;
      return res.status(200).json(userWithoutSensitiveInfo);
    } catch (error) {
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Remove sensitive info before sending the response
    const { password, otpSecret, ...userWithoutSensitiveInfo } = req.user;
    res.json(userWithoutSensitiveInfo);
  });

  // Enable OTP for a user
  app.post("/api/enable-otp", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const otpSecret = generateOTP();

      await storage.updateUser(userId, {
        otpEnabled: true,
        otpSecret
      });

      res.status(200).json({ message: "OTP enabled successfully" });
    } catch (error) {
      next(error);
    }
  });

  // Disable OTP for a user
  app.post("/api/disable-otp", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;

      await storage.updateUser(userId, {
        otpEnabled: false,
        otpSecret: null
      });

      res.status(200).json({ message: "OTP disabled successfully" });
    } catch (error) {
      next(error);
    }
  });


}
