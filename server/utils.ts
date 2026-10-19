import crypto from 'crypto';

// Generate a random OTP secret
export function generateOTP(): string {
  return crypto.randomBytes(20).toString('hex');
}

// Verify OTP
export function verifyOTP(secret: string, otp: string): boolean {
  // In a real implementation, this would use TOTP verification
  // For simplicity in this demo, we'll just compare the last 6 digits of the hash of the secret
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  const expectedOtp = hash.substring(hash.length - 6);

  return otp === expectedOtp;
}

// Generate a random string for various purposes
export function generateRandomString(length: number): string {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length);
}

// Generate a random password
export function generateRandomPassword(): string {
  return generateRandomString(12);
}

// Format date to a readable string
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Calculate order ETA based on distance and preparation time
export function calculateETA(distance: number, preparationTime: number): number {
  // Assume average speed of 20km/h = 0.33km/min
  const deliveryTime = distance / 0.33;
  return preparationTime + deliveryTime;
}

// Format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount);
}

// Generate a unique order ID with a prefix
export function generateOrderId(): string {
  const prefix = 'ORD';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}${random}`;
}

// Calculate distance between two coordinates
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Haversine formula
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}

/**
 * Validate latitude value
 */
export function validateLatitude(lat: number): boolean {
  return lat >= -90 && lat <= 90;
}

/**
 * Validate longitude value
 */
export function validateLongitude(lng: number): boolean {
  return lng >= -180 && lng <= 180;
}

/**
 * Validate radius value in kilometers
 */
export function validateRadius(radius: number): boolean {
  return radius >= 0.1 && radius <= 1000;
}
