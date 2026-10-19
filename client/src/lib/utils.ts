import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Calculate delivery fee based on formula: Base Fare + (Rate per km × Total Distance)
 *
 * @param baseFare Base fare amount in PHP
 * @param ratePerKm Rate per kilometer in PHP
 * @param distanceToRestaurant Distance from HQ/rider to restaurant in km
 * @param distanceToCustomer Distance from restaurant to customer in km
 * @returns Calculated delivery fee in PHP
 */
export function calculateDeliveryFee(
  baseFare: number,
  ratePerKm: number,
  distanceToRestaurant: number,
  distanceToCustomer: number
): number {
  // Calculate total distance
  const totalDistance = distanceToRestaurant + distanceToCustomer;

  // Apply the formula: Base Fare + (Rate per km × Total Distance)
  const deliveryFee = baseFare + (ratePerKm * totalDistance);

  // Round to 2 decimal places
  return Math.round(deliveryFee * 100) / 100;
}

/**
 * Calculate delivery fee with default settings when only total distance is available
 * Uses default base fare of 50 PHP, rate of 15 PHP per km, and platform fee of 2 PHP
 *
 * @param totalDistanceKm Total distance in kilometers
 * @returns Calculated delivery fee in PHP
 */
export function calculateDeliveryFeeSimple(totalDistanceKm: number): number {
  const DEFAULT_BASE_FARE = 50; // PHP
  const DEFAULT_RATE_PER_KM = 15; // PHP per km
  const DEFAULT_PLATFORM_FEE = 2; // PHP

  const deliveryFee = DEFAULT_BASE_FARE + (DEFAULT_RATE_PER_KM * totalDistanceKm) + DEFAULT_PLATFORM_FEE;

  // Round to nearest whole number
  return Math.round(deliveryFee);
}
