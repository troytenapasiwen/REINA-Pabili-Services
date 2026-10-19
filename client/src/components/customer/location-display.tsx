import { MapPin, Home, Briefcase } from "lucide-react";
import { Customer } from "@shared/schema";

interface LocationDisplayProps {
  customer: Customer;
  iconSize?: number;
  showDefaultText?: boolean;
  className?: string;
}

/**
 * A consistent component for displaying a customer's location
 * throughout the application
 */
export function LocationDisplay({
  customer,
  iconSize = 16,
  showDefaultText = true,
  className = ""
}: LocationDisplayProps) {
  // Early return if customer is undefined or doesn't have location
  if (!customer) {
    return showDefaultText ? (
      <div className={`flex items-center text-muted-foreground ${className}`}>
        <MapPin className="mr-2" style={{ width: iconSize, height: iconSize }} />
        <span>No location set</span>
      </div>
    ) : null;
  }

  const hasAddress = Boolean(customer.defaultAddress);

  if (!hasAddress) {
    return showDefaultText ? (
      <div className={`flex items-center text-muted-foreground ${className}`}>
        <MapPin className="mr-2" style={{ width: iconSize, height: iconSize }} />
        <span>No address set</span>
      </div>
    ) : null;
  }

  // Choose appropriate icon for location type
  const renderLocationIcon = () => {
    if (customer.locationName === 'Home') {
      return (
        <Home
          className="mr-2 flex-shrink-0 text-primary"
          style={{ width: iconSize, height: iconSize, marginTop: iconSize > 16 ? 4 : 2 }}
        />
      );
    } else if (customer.locationName === 'Work') {
      return (
        <Briefcase
          className="mr-2 flex-shrink-0 text-indigo-500"
          style={{ width: iconSize, height: iconSize, marginTop: iconSize > 16 ? 4 : 2 }}
        />
      );
    } else {
      return (
        <MapPin
          className="mr-2 flex-shrink-0 text-primary"
          style={{ width: iconSize, height: iconSize, marginTop: iconSize > 16 ? 4 : 2 }}
        />
      );
    }
  };

  return (
    <div className={`flex items-start ${className}`}>
      {renderLocationIcon()}
      <div>
        {customer.locationName && (
          <div className="font-medium leading-tight flex items-center">
            {customer.locationName === 'Home' ? (
              <span className="text-primary">Home</span>
            ) : customer.locationName === 'Work' ? (
              <span className="text-indigo-500">Work</span>
            ) : (
              customer.locationName
            )}
          </div>
        )}
        <div className={customer.locationName ? "text-sm text-muted-foreground" : ""}>
          {customer.defaultAddress}
        </div>
      </div>
    </div>
  );
}
