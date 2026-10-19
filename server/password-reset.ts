import { storage } from './storage';
import crypto from 'crypto';
import { sendPasswordResetEmail, getBaseUrl } from './email-service';
import { Request } from 'express';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// In-memory token storage (will be lost on server restart)
// In production, this should be stored in the database
interface PasswordResetToken {
  userId: number;
  token: string;
  expiresAt: Date;
}

const passwordResetTokens = new Map<string, PasswordResetToken>();

// Generate a password reset token for a user
export async function generatePasswordResetToken(email: string, req?: Request): Promise<boolean> {
  try {
    // Find user by email
    const user = await storage.getUserByEmail(email);

    // If user not found, return success anyway to prevent email enumeration
    if (!user) {
      console.log(`Password reset requested for non-existent email: ${email}`);
      return true;
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Store the token with expiration (24 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    passwordResetTokens.set(token, {
      userId: user.id,
      token,
      expiresAt
    });

    // Get the dynamic base URL
    const baseUrl = getBaseUrl(req);
    const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

    // Send reset email
    const emailSent = await sendPasswordResetEmail(
      user.email,
      user.fullName || user.username,
      resetLink
    );

    if (!emailSent) {
      console.error(`Failed to send password reset email to ${email}`);
      return false;
    }

    console.log(`Password reset link sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error generating password reset token:', error);
    return false;
  }
}

// Validate a password reset token
export async function validatePasswordResetToken(token: string): Promise<number | null> {
  try {
    // Check if token exists
    const tokenData = passwordResetTokens.get(token);

    if (!tokenData) {
      console.log('Token not found in storage');
      return null;
    }

    // Check if token is expired
    if (new Date() > tokenData.expiresAt) {
      console.log('Token expired');
      passwordResetTokens.delete(token);
      return null;
    }

    return tokenData.userId;
  } catch (error) {
    console.error('Error validating password reset token:', error);
    return null;
  }
}

// Reset a user's password using a token
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    // Validate token and get userId
    const userId = await validatePasswordResetToken(token);

    if (!userId) {
      return false;
    }

    // Hash the new password
    const hashedPassword = await hashPassword(newPassword);

    // Update the user's password
    const updatedUser = await storage.updateUser(userId, {
      password: hashedPassword
    });

    if (!updatedUser) {
      console.error(`Failed to update password for user ${userId}`);
      return false;
    }

    // Delete the used token
    passwordResetTokens.delete(token);

    console.log(`Password reset successful for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error resetting password:', error);
    return false;
  }
}

// Hash a password (copied from auth.ts to avoid circular dependencies)
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}
