import nodemailer from 'nodemailer';
import { storage } from './storage';
import { Request } from 'express';

// Helper function to get the base URL dynamically
export function getBaseUrl(req?: Request): string {
  // 1. Check for explicitly configured base URL (production)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }

  // 2. Derive from request headers (works with proxies/Replit)
  if (req) {
    // Trust proxy headers (app already has trust proxy set)
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || 'localhost:5000';
    return `${protocol}://${host}`;
  }

  // 3. Check for Replit-specific environment
  if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
    // Replit public URL format
    return `https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`;
  }

  // 4. Fallback to localhost for development
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}`;
}

// Email settings interface
export interface EmailSettings {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
}

// Default email settings (Gmail)
const defaultSettings: EmailSettings = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  username: process.env.SMTP_USERNAME || 'reinapabili@gmail.com',
  password: process.env.SMTP_PASSWORD || '',
  fromEmail: process.env.SMTP_FROM_EMAIL || 'reinapabili@gmail.com',
  fromName: 'Reina Pabili Services'
};

// Get email settings from database or use defaults
async function getEmailSettings(): Promise<EmailSettings> {
  try {
    const settings = await storage.getSetting('email_settings');

    if (settings && settings.value) {
      try {
        return JSON.parse(settings.value) as EmailSettings;
      } catch (e) {
        console.error('Failed to parse email settings:', e);
      }
    }

    return defaultSettings;
  } catch (error) {
    console.error('Error fetching email settings:', error);
    return defaultSettings;
  }
}

// Save email settings to database
export async function saveEmailSettings(emailSettings: EmailSettings): Promise<boolean> {
  try {
    // Validate required fields
    if (!emailSettings.host || !emailSettings.username || !emailSettings.password) {
      return false;
    }

    // Store settings as JSON string
    const settingsJson = JSON.stringify(emailSettings);

    // Check if settings already exist
    const existingSettings = await storage.getSetting('email_settings');

    if (existingSettings) {
      await storage.updateSetting('email_settings', settingsJson);
    } else {
      await storage.createSetting({
        key: 'email_settings',
        value: settingsJson,
        description: 'Email settings for password reset'
      });
    }

    return true;
  } catch (error) {
    console.error('Error saving email settings:', error);
    return false;
  }
}

// Create a nodemailer transporter with the current settings
async function createTransporter() {
  const settings = await getEmailSettings();

  // Return null if required settings are missing
  if (!settings.host || !settings.username || !settings.password) {
    console.error('Email settings incomplete. Cannot create transporter.');
    return null;
  }

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.username,
      pass: settings.password
    }
  });
}

// Send an email
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  try {
    const transporter = await createTransporter();

    if (!transporter) {
      console.error('Email transporter could not be created');
      return false;
    }

    const settings = await getEmailSettings();

    const info = await transporter.sendMail({
      from: `"${settings.fromName}" <${settings.fromEmail}>`,
      to,
      subject,
      text: stripHtml(html), // Plain text version
      html // HTML version
    });

    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// Send an email verification email
export async function sendEmailVerificationEmail(
  to: string,
  name: string,
  verificationToken: string,
  baseUrl: string
): Promise<boolean> {
  const subject = 'Verify Your Email - Reina Pabili Services';
  const verificationLink = `${baseUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #F06445; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0;">Reina Pabili Services</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
        <h2>Email Verification</h2>
        <p>Hello ${name || 'User'},</p>
        <p>Thank you for registering with Reina Pabili Services! Please verify your email address to complete your registration.</p>
        <p>To verify your email, click the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${verificationLink}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Verify Email Address</a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">
          ${verificationLink}
        </p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create an account with us, please ignore this email.</p>
        <p>Thank you,<br>The Reina Pabili Team</p>
      </div>
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #777;">
        <p>© ${new Date().getFullYear()} Reina Pabili Services. All rights reserved.</p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

// Send a password reset email
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetLink: string
): Promise<boolean> {
  const subject = 'Reset Your Reina Pabili Password';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #F06445; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0;">Reina Pabili Services</h1>
      </div>
      <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
        <h2>Password Reset Request</h2>
        <p>Hello ${name},</p>
        <p>We received a request to reset your password for your Reina Pabili account. If you didn't make this request, you can safely ignore this email.</p>
        <p>To reset your password, click the button below:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #F06445; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">Reset Password</a>
        </p>
        <p>If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="background-color: #f5f5f5; padding: 10px; word-break: break-all;">
          ${resetLink}
        </p>
        <p>This link will expire in 24 hours.</p>
        <p>Thank you,<br>The Reina Pabili Team</p>
      </div>
      <div style="text-align: center; padding: 20px; font-size: 12px; color: #777;">
        <p>© ${new Date().getFullYear()} Reina Pabili Services. All rights reserved.</p>
      </div>
    </div>
  `;

  return await sendEmail(to, subject, html);
}

// Convert HTML to plain text
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Test email settings connection
export async function testEmailSettings(settings: EmailSettings): Promise<boolean> {
  try {
    const transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: {
        user: settings.username,
        pass: settings.password
      }
    });

    // Verify connection configuration
    await transporter.verify();

    console.log('Email settings verified successfully');
    return true;
  } catch (error) {
    console.error('Email settings verification failed:', error);
    return false;
  }
}
