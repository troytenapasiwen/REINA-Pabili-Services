import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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

const tierConfig = {
  bronze: {
    label: "Bronze",
    color: "bg-amber-700",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: Award,
    description: "Welcome to our rewards program!",
  },
  silver: {
    label: "Silver",
    color: "bg-gray-400",
    textColor: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    icon: Star,
    description: "Free delivery coupon monthly + Priority support",
  },
  gold: {
    label: "Gold",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
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
      <Card className="animate-pulse">
        <CardContent className={compact ? "p-4" : "p-6"}>
          <div className="h-24 bg-gray-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error || !loyaltyAccount) {
    return null;
  }

  const tier = tierConfig[loyaltyAccount.tier as keyof typeof tierConfig] || tierConfig.bronze;
  const TierIcon = tier.icon;
  const progress = loyaltyAccount.progressToNextTier;

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border",
          tier.bgColor,
          tier.borderColor
        )}
        data-testid="loyalty-badge-compact"
      >
        <TierIcon className={cn("h-5 w-5", tier.textColor)} />
        <span className={cn("font-medium", tier.textColor)}>
          {tier.label}
        </span>
        <Badge variant="secondary" className="ml-1">
          {loyaltyAccount.pointsBalance.toLocaleString()} pts
        </Badge>
      </div>
    );
  }

  return (
    <Card
      className={cn("overflow-hidden border-2", tier.borderColor)}
      data-testid="loyalty-badge-card"
    >
      <div className={cn("h-2", tier.color)} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-full", tier.bgColor)}>
              <TierIcon className={cn("h-6 w-6", tier.textColor)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={cn("font-bold text-lg", tier.textColor)}>
                  {tier.label} Member
                </span>
              </div>
              <p className="text-sm text-gray-500">{tier.description}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Gift className="h-4 w-4 text-primary" />
              <span className="font-bold text-xl text-primary">
                {loyaltyAccount.pointsBalance.toLocaleString()}
              </span>
            </div>
            <span className="text-xs text-gray-500">points available</span>
          </div>
        </div>

        {!progress.isMaxTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <TrendingUp className="h-4 w-4" />
                Progress to {progress.nextTier}
              </span>
              <span className="text-gray-500">
                {progress.currentPoints.toLocaleString()} / {progress.pointsNeeded.toLocaleString()} pts
              </span>
            </div>
            <Progress
              value={progress.progressPercent}
              className="h-2"
              data-testid="loyalty-progress-bar"
            />
            <p className="text-xs text-gray-500 text-center">
              Earn {(progress.pointsNeeded - progress.currentPoints).toLocaleString()} more points to reach {progress.nextTier}!
            </p>
          </div>
        )}

        {progress.isMaxTier && (
          <div className="bg-primary/10 rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-yellow-700">
              You've reached the highest tier! Enjoy all premium benefits.
            </p>
          </div>
        )}

        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-gray-500 text-center">
            Earn 1 point for every ₱20 spent on orders
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
