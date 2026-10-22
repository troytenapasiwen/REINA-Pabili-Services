import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Crown, Star, Award, TrendingUp, Gift } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoyaltyAccountData {
  id: number;
  customerId: number;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  createdAt: string;
  progressToNextTier: {
    currentTier: string;
    nextTier: string | null;
    currentPoints: number;
    pointsNeeded: number;
    progressPercent: number;
    isMaxTier: boolean;
  };
  tierThresholds: {
    BRONZE: number;
    SILVER: number;
    GOLD: number;
  };
}

/*
  Reina Pabili brand tokens: yellow #FFD527, orange #F76043, charcoal #282828.
  Each tier gets one accent fill (used on the top strip and icon box); text on it is always charcoal.
*/
const tierConfig = {
  bronze: {
    label: "Bronze",
    accent: "bg-[#F76043]",
    icon: Award,
    description: "Welcome to our rewards program!",
  },
  silver: {
    label: "Silver",
    accent: "bg-gray-300",
    icon: Star,
    description: "Free delivery coupon monthly + Priority support",
  },
  gold: {
    label: "Gold",
    accent: "bg-[#FFD527]",
    icon: Crown,
    description: "Reduced free delivery threshold + 2% bonus points",
  },
};

export function LoyaltyBadge({ compact = false }: { compact?: boolean }) {
  const { data: loyaltyAccount, isLoading, error } = useQuery<LoyaltyAccountData>({
    queryKey: ["/api/loyalty/account"],
  });

  if (isLoading) {
    return (
      <div
        className="border-2 border-[#282828]/30 bg-white motion-safe:animate-pulse"
        aria-busy="true"
        aria-label="Loading membership"
      >
        <div className={compact ? "p-4" : "p-5"}>
          <div className="h-16 bg-gray-200" />
        </div>
      </div>
    );
  }

  if (error || !loyaltyAccount) {
    return null;
  }

  const tier =
    tierConfig[String(loyaltyAccount.tier).toLowerCase() as keyof typeof tierConfig] || tierConfig.bronze;
  const TierIcon = tier.icon;
  const progress = loyaltyAccount.progressToNextTier;

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-2 border-2 border-[#282828] bg-white px-3 py-1.5 text-[#282828] shadow-[3px_3px_0_0_#282828]"
        data-testid="loyalty-badge-compact"
      >
        <span className={cn("flex h-7 w-7 items-center justify-center border-2 border-[#282828]", tier.accent)}>
          <TierIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="font-extrabold">{tier.label}</span>
        <span className="border-2 border-[#282828] bg-[#FFD527] px-2 py-0.5 text-xs font-extrabold">
          {loyaltyAccount.pointsBalance.toLocaleString()} pts
        </span>
      </div>
    );
  }

  return (
    <section
      className="overflow-hidden border-2 border-[#282828] bg-white text-[#282828] shadow-[4px_4px_0_0_#282828]"
      data-testid="loyalty-badge-card"
      aria-label="Membership"
    >
      <div className={cn("h-2 border-b-2 border-[#282828]", tier.accent)} />
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center border-2 border-[#282828] shadow-[3px_3px_0_0_#282828]",
                tier.accent
              )}
            >
              <TierIcon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-extrabold uppercase leading-tight tracking-tight">
                {tier.label} Member
              </p>
              <p className="text-sm font-medium text-gray-700">{tier.description}</p>
            </div>
          </div>
          <div className="shrink-0 border-2 border-[#282828] bg-[#FFD527] px-3 py-1.5 text-right">
            <p className="flex items-center justify-end gap-1.5 text-xl font-extrabold leading-none">
              <Gift className="h-4 w-4" aria-hidden="true" />
              {loyaltyAccount.pointsBalance.toLocaleString()}
            </p>
            <p className="mt-1 text-xs font-bold">points available</p>
          </div>
        </div>

        {!progress.isMaxTier && (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm font-bold">
              <span className="flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                Progress to {progress.nextTier}
              </span>
              <span className="text-gray-700">
                {progress.currentPoints.toLocaleString()} / {progress.pointsNeeded.toLocaleString()} pts
              </span>
            </div>
            <Progress
              value={progress.progressPercent}
              className="h-4 rounded-none border-2 border-[#282828] bg-white [&>div]:bg-[#F76043]"
              data-testid="loyalty-progress-bar"
            />
            <p className="text-xs font-semibold text-gray-700">
              Earn {(progress.pointsNeeded - progress.currentPoints).toLocaleString()} more points to reach {progress.nextTier}!
            </p>
          </div>
        )}

        {progress.isMaxTier && (
          <div className="border-2 border-[#282828] bg-[#FFD527] px-3 py-2 text-center">
            <p className="text-sm font-bold">
              You've reached the highest tier! Enjoy all premium benefits.
            </p>
          </div>
        )}

        <p className="border-t-2 border-[#282828]/15 pt-3 text-xs font-semibold text-gray-700">
          Earn 1 point for every ₱20 spent on orders
        </p>
      </div>
    </section>
  );
}