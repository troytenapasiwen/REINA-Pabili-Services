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

/**
 * Creates the default admin from environment variables if no admin exists.
 * Admin credentials must never be hardcoded into the source code.
 */
async function ensureDefaultAdmin() {
  const users = await storage.getAllUsers();
  const existingAdmin = users.find((user) => user.role === UserRole.ADMIN);

  // Do not create another admin if one already exists.
  if (existingAdmin) {
    return;
  }

  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL?.trim();
  const fullName =
    process.env.ADMIN_FULL_NAME?.trim() || "System Administrator";

  if (!username || !password || !email) {
    throw new Error(
      "ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_EMAIL must be set when no admin account exists.",
    );
  }

  if (password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters long.");
  }

  const existingUsername = await storage.getUserByUsername(username);
  if (existingUsername) {
    throw new Error(
      "ADMIN_USERNAME already belongs to another account. Choose a different username.",
    );
  }

  const existingEmail = await storage.getUserByEmail(email);
  if (existingEmail) {
    throw new Error(
      "ADMIN_EMAIL already belongs to another account. Choose a different email.",
    );
  }

  await storage.createUser({
    username,
    password: await hashPassword(password),
    email,
    fullName,
    role: UserRole.ADMIN,
    isActive: true,
    emailVerified: true,
    otpEnabled: false,
  });

  console.log("Default admin account created.");
}

export async function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET must be set.");
  }

  await ensureDefaultAdmin();

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000,
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  app.use((req, res, next) => {
    if (!req.session.otpPending || !req.path.startsWith("/api/")) {
      return next();
    }

    if (
      ["/api/login", "/api/verify-otp", "/api/logout"].includes(req.path)
    ) {
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
          return done(null, false, {
            message: "Invalid username or password",
          });
        }

        if (!user.isActive) {
          return done(null, false, { message: "Account is disabled" });
        }

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

      if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        password.length === 0 ||
        typeof email !== "string" ||
        !email.trim()
      ) {
        return res.status(400).json({
          message: "Username, password, and email are required.",
        });
      }

      const requestedRole = role || UserRole.CUSTOMER;
      const isAdminCreatingAccount =
        req.isAuthenticated() && req.user.role === UserRole.ADMIN;

      // Admin accounts can only be provisioned through environment settings.
      if (requestedRole === UserRole.ADMIN) {
        return res.status(403).json({
          message: "Admin accounts cannot be created through registration.",
        });
      }

      const allowedRoles = [
        UserRole.CUSTOMER,
        UserRole.RESTAURANT,
        UserRole.RIDER,
      ];

      if (!allowedRoles.includes(requestedRole)) {
        return res.status(400).json({ message: "Invalid account role." });
      }

      // Check if username already exists.
      const existingUsername = await storage.getUserByUsername(
        username.trim(),
      );

      if (existingUsername) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email is already registered with any role.
      const normalizedEmail = email.trim();
      const existingEmail = await storage.getUserByEmail(normalizedEmail);

      if (existingEmail) {
        const roleText = existingEmail.role
          ? `already registered as ${existingEmail.role}`
          : "already registered";

        return res.status(400).json({
          message: `This email address is ${roleText}. Please use a different email or log in with your existing account.`,
        });
      }

      const hashedPassword = await hashPassword(password);
      const verificationToken = randomBytes(32).toString("hex");
      const verificationExpires = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      );

      const isCustomer = requestedRole === UserRole.CUSTOMER;

      const user = await storage.createUser({
        username: username.trim(),
        password: hashedPassword,
        email: normalizedEmail,
        role: requestedRole,
        fullName,
        isActive: true,
        emailVerified: isCustomer,
        emailVerificationToken: isCustomer ? null : verificationToken,
        emailVerificationExpires: isCustomer ? null : verificationExpires,
        otpEnabled: false,
      });

      // Customers do not need email verification.
      // Keep the existing verification email behavior for other roles.
      if (!isCustomer) {
        try {
          const baseUrl = getBaseUrl(req);
          await sendEmailVerificationEmail(
            normalizedEmail,
            fullName || username,
            verificationToken,
            baseUrl,
          );
          console.log(`Verification email sent to ${normalizedEmail}`);
        } catch (emailError) {
          console.error("Failed to send verification email:", emailError);
          // Preserve the existing behavior if email delivery fails.
        }
      }

      // Create the related record for the selected role.
      if (user.role === UserRole.CUSTOMER) {
        await storage.createCustomer({
          userId: user.id,
          defaultAddress: "",
          savedAddresses: [],
        });
      } else if (user.role === UserRole.RESTAURANT) {
        await storage.createRestaurant({
          userId: user.id,
          name: fullName || `${username}'s Restaurant`,
          description: "New restaurant on Reina Pabili Services",
          address: "",
          phone: "",
          email: normalizedEmail,
          isActive: true,
          deliveryFee: 50,
          categories: ["General"],
          openingTime: "09:00",
          closingTime: "21:00",
        });
      } else if (user.role === UserRole.RIDER) {
        if (req.session) {
          req.session.justRegisteredRider = true;
        }
      }

      // Preserve the administrator's session when they create another account.
      if (isAdminCreatingAccount) {
        const { password: _password, otpSecret: _otpSecret, ...safeUser } = user;
        return res.status(201).json(safeUser);
      }

      // Automatically log customers in after registration.
      if (user.role === UserRole.CUSTOMER) {
        return req.login(user, (err) => {
          if (err) {
            return next(err);
          }

          const {
            password: _password,
            otpSecret: _otpSecret,
            ...safeUser
          } = user;

          return res.status(201).json(safeUser);
        });
      }

      // Preserve the existing registration response for restaurant and rider accounts.
      const {
        password: _password,
        otpSecret: _otpSecret,
        ...safeUser
      } = user;

      return res.status(201).json({
        ...safeUser,
        emailVerificationRequired: true,
        message:
          "Registration successful! Please check your email to verify your account before logging in.",
      });
    } catch (error) {
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", async (err, user, info) => {
      if (err) {
        return next(err);
      }

      if (!user) {
        return res
          .status(401)
          .json({ message: info?.message || "Invalid credentials" });
      }

      // Email verification remains required for restaurant and rider accounts,
      // but not for admins or customers.
      if (
        user.role !== UserRole.ADMIN &&
        user.role !== UserRole.CUSTOMER &&
        !user.emailVerified
      ) {
        return res.status(403).json({
          message:
            "Please verify your email address before logging in. Check your email for the verification link.",
          emailNotVerified: true,
          email: user.email,
        });
      }

      // Check maintenance mode.
      try {
        const maintenanceSetting = await storage.getSetting("maintenanceMode");
        const isMaintenanceMode = maintenanceSetting?.value === "true";

        if (isMaintenanceMode && user.role !== UserRole.ADMIN) {
          return res.status(503).json({
            message:
              "The system is currently under maintenance. Please try again later.",
            maintenanceMode: true,
          });
        }
      } catch (error) {
        console.error("Error checking maintenance mode:", error);
      }

      req.login(user, async (err) => {
        if (err) {
          return next(err);
        }

        try {
          await storage.updateUser(user.id, { lastLogin: new Date() });
        } catch (error) {
          console.error("Error updating last login:", error);
        }

        // Preserve the existing rider-profile handling.
        if (user.role === UserRole.RIDER) {
          try {
            let rider = await storage.getRiderByUserId(user.id);

            if (!rider) {
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
              console.log(
                "Setting existing rider to ACTIVE status, ID:",
                rider.id,
              );

              await storage.updateRider(rider.id, {
                status: RiderStatus.ACTIVE,
              });
            }
          } catch (error) {
            console.error(
              "Error creating/updating rider profile on login:",
              error,
            );
          }
        }

        // Generate OTP if enabled.
        if (user.otpEnabled) {
          req.session.otpPending = true;
          const otpSecret = user.otpSecret || generateOTP();

          if (!user.otpSecret) {
            await storage.updateUser(user.id, { otpSecret });
          }

          return res.status(200).json({
            requiresOtp: true,
            message: "OTP required",
          });
        }

        req.session.otpPending = false;

        const {
          password: _password,
          otpSecret: _otpSecret,
          ...safeUser
        } = user;

        return res.status(200).json(safeUser);
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
        return res
          .status(400)
          .json({ message: "OTP not enabled for this user" });
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

      const {
        password: _password,
        otpSecret: _otpSecret,
        ...safeUser
      } = user;

      return res.status(200).json(safeUser);
    } catch (error) {
      next(error);
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) {
        return next(err);
      }

      res.sendStatus(200);
    });
  });

  // Get current user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const {
      password: _password,
      otpSecret: _otpSecret,
      ...safeUser
    } = req.user;

    return res.json(safeUser);
  });

  // Enable OTP for the current user.
  app.post("/api/enable-otp", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const otpSecret = generateOTP();

      await storage.updateUser(userId, {
        otpEnabled: true,
        otpSecret,
      });

      return res.status(200).json({
        message: "OTP enabled successfully",
      });
    } catch (error) {
      next(error);
    }
  });

  // Disable OTP for the current user.
  app.post("/api/disable-otp", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;

      await storage.updateUser(userId, {
        otpEnabled: false,
        otpSecret: null,
      });

      return res.status(200).json({
        message: "OTP disabled successfully",
      });
    } catch (error) {
      next(error);
    }
  });
}
