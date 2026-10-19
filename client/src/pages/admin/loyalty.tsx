import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Crown, Star, Award, Users, Gift, TrendingUp, Plus, Minus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface LoyaltyAccount {
  id: number;
  customerId: number;
  pointsBalance: number;
  lifetimePoints: number;
  tier: string;
  createdAt: string;
  lastActivityAt: string | null;
  customerName: string;
  customerEmail: string;
}

interface LoyaltyStats {
  bronze: number;
  silver: number;
  gold: number;
  totalPoints: number;
}

const tierConfig = {
  bronze: {
    label: "Bronze",
    color: "bg-amber-700",
    textColor: "text-amber-700",
    icon: Award,
  },
  silver: {
    label: "Silver",
    color: "bg-gray-400",
    textColor: "text-gray-600",
    icon: Star,
  },
  gold: {
    label: "Gold",
    color: "bg-yellow-500",
    textColor: "text-yellow-600",
    icon: Crown,
  },
};

export default function AdminLoyaltyPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<LoyaltyAccount | null>(null);
  const [pointsDelta, setPointsDelta] = useState<string>("");
  const [adjustDescription, setAdjustDescription] = useState("");

  const { data: accounts, isLoading: isLoadingAccounts } = useQuery<LoyaltyAccount[]>({
    queryKey: ["/api/admin/loyalty/accounts"],
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery<LoyaltyStats>({
    queryKey: ["/api/admin/loyalty/stats"],
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: { accountId: number; pointsDelta: number; description: string }) => {
      return await apiRequest("POST", "/api/admin/loyalty/adjust", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loyalty/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/loyalty/stats"] });
      toast({
        title: "Points Adjusted",
        description: "Loyalty points have been updated successfully.",
      });
      setAdjustDialogOpen(false);
      setSelectedAccount(null);
      setPointsDelta("");
      setAdjustDescription("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to adjust loyalty points.",
        variant: "destructive",
      });
    },
  });

  const handleAdjustPoints = (account: LoyaltyAccount, isAddition: boolean) => {
    setSelectedAccount(account);
    setPointsDelta(isAddition ? "" : "-");
    setAdjustDescription("");
    setAdjustDialogOpen(true);
  };

  const handleSubmitAdjustment = () => {
    if (!selectedAccount || !pointsDelta) return;

    const delta = parseInt(pointsDelta);
    if (isNaN(delta) || delta === 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid non-zero number.",
        variant: "destructive",
      });
      return;
    }

    adjustMutation.mutate({
      accountId: selectedAccount.id,
      pointsDelta: delta,
      description: adjustDescription || `Manual adjustment by admin`,
    });
  };

  const filteredAccounts = accounts?.filter((account) =>
    account.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.customerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = isLoadingAccounts || isLoadingStats;

  if (isLoading) {
    return (
      <AdminLayout title="Loyalty Program" description="Manage customer loyalty accounts and points">
        <div className="flex justify-center items-center p-10">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  const getTierBadge = (tier: string) => {
    const config = tierConfig[tier as keyof typeof tierConfig] || tierConfig.bronze;
    const TierIcon = config.icon;
    return (
      <Badge className={`${config.color} text-white`}>
        <TierIcon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <AdminLayout title="Loyalty Program" description="Manage customer loyalty accounts and points">
      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="stat-card-total-members">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{accounts?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Active loyalty accounts</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-card-bronze">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bronze Members</CardTitle>
              <Award className="h-4 w-4 text-amber-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.bronze || 0}</div>
              <p className="text-xs text-muted-foreground">0 - 999 points</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-card-silver">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Silver Members</CardTitle>
              <Star className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.silver || 0}</div>
              <p className="text-xs text-muted-foreground">1,000 - 4,999 points</p>
            </CardContent>
          </Card>

          <Card data-testid="stat-card-gold">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gold Members</CardTitle>
              <Crown className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.gold || 0}</div>
              <p className="text-xs text-muted-foreground">5,000+ points</p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="stat-card-total-points">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points in Circulation</CardTitle>
            <Gift className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">
              {stats?.totalPoints?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">Points available across all accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Loyalty Accounts</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                  data-testid="input-search-loyalty"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredAccounts && filteredAccounts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Points Balance</TableHead>
                    <TableHead className="text-right">Lifetime Points</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAccounts.map((account) => (
                    <TableRow key={account.id} data-testid={`row-loyalty-${account.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{account.customerName}</div>
                          <div className="text-sm text-muted-foreground">{account.customerEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>{getTierBadge(account.tier)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {account.pointsBalance.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {account.lifetimePoints.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAdjustPoints(account, true)}
                            data-testid={`button-add-points-${account.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAdjustPoints(account, false)}
                            data-testid={`button-remove-points-${account.id}`}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No loyalty accounts found.</p>
                <p className="text-sm mt-1">Accounts are created when customers place their first order.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Loyalty Points</DialogTitle>
            <DialogDescription>
              {selectedAccount && (
                <>
                  Adjust points for <strong>{selectedAccount.customerName}</strong>.
                  Current balance: <strong>{selectedAccount.pointsBalance.toLocaleString()}</strong> points.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Points (use negative for deduction)</label>
              <Input
                type="number"
                placeholder="e.g. 100 or -50"
                value={pointsDelta}
                onChange={(e) => setPointsDelta(e.target.value)}
                data-testid="input-points-delta"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                placeholder="e.g. Promotional bonus, Customer complaint resolution"
                value={adjustDescription}
                onChange={(e) => setAdjustDescription(e.target.value)}
                data-testid="input-adjust-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmitAdjustment}
              disabled={adjustMutation.isPending || !pointsDelta}
              data-testid="button-confirm-adjust"
            >
              {adjustMutation.isPending ? "Adjusting..." : "Confirm Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
