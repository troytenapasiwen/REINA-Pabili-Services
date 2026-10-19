import logoUrl from "@assets/image_1781445990205.png";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
  textClassName?: string;
}

export function BrandLogo({ className, showText = false, textClassName }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src={logoUrl}
        alt="Reina Pabili Services"
        className={cn("h-9 w-9 rounded-md object-contain", className)}
        data-testid="img-brand-logo"
      />
      {showText && (
        <span className={cn("font-bold text-primary", textClassName)}>Reina Pabili</span>
      )}
    </span>
  );
}
