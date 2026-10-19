/**
 * Calculates the distance between two sets of coordinates using the Haversine formula.
 * @param lat1 Latitude of the first point in decimal degrees
 * @param lng1 Longitude of the first point in decimal degrees
 * @param lat2 Latitude of the second point in decimal degrees
 * @param lng2 Longitude of the second point in decimal degrees
 * @returns Distance in kilometers
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // If either coordinate is 0, return null (likely uninitialized)
  if (lat1 === 0 || lng1 === 0 || lat2 === 0 || lng2 === 0) {
    return 0;
  }

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

/**
 * Converts degrees to radians.
 * @param deg Value in degrees
 * @returns Value in radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Calculates the delivery fee based on distance.
 * @param distance Distance in kilometers
 * @param baseFare Base fare to charge (default: 50)
 * @param ratePerKm Rate per kilometer (default: 15)
 * @param platformFee Platform fee (default: 2)
 * @returns Calculated delivery fee
 */
export function calculateDeliveryFee(
  distance: number,
  baseFare: number = 50,
  ratePerKm: number = 15,
  platformFee: number = 2
): number {
  if (distance === 0) {
    return 0;
  }

  return Math.round(baseFare + ratePerKm * distance + platformFee);
}
