import { useState } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { User, UserRole, Order } from "@shared/schema";
import { Eye, UserCog } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function AdminUsers() {
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("customer");
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch users
  const { data: users, isLoading: isLoadingUsers, error: usersError } = useQuery<User[]>({
    queryKey: ["/api/users"],
    // Don't use unsupported options for TanStack Query v5
  });

  // Fetch orders for selected user
  const { data: userOrders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", selectedUser?.id],
    enabled: !!selectedUser && selectedUser.role === UserRole.CUSTOMER,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      // Also invalidate riders query in case this was a rider user
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      toast({
        title: "User updated",
        description: "The user has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter users based on active tab and search term
  const filteredUsers = users?.filter(user => {
    // First filter by role
    let roleMatch = true;
    if (activeTab === "customer") roleMatch = user.role === UserRole.CUSTOMER;
    else if (activeTab === "restaurant") roleMatch = user.role === UserRole.RESTAURANT;
    else if (activeTab === "rider") roleMatch = user.role === UserRole.RIDER;
    else if (activeTab === "admin") roleMatch = user.role === UserRole.ADMIN;

    // Then filter by search term
    let searchMatch = true;
    if (searchTerm.trim()) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      searchMatch =
        user.fullName?.toLowerCase().includes(lowerSearchTerm) ||
        user.username.toLowerCase().includes(lowerSearchTerm) ||
        user.email.toLowerCase().includes(lowerSearchTerm);
    }

    return roleMatch && searchMatch;
  }) || [];

  // Debug info for user filtering
  console.log("Search term:", searchTerm, "| Filtered users:", filteredUsers.length);

  // Handle user view
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  // Handle search
  const handleSearch = (term: string) => {
    console.log("Parent handleSearch called with term:", term);
    setSearchTerm(term);
  };

  // Handle active status toggle
  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive }
    });
  };

  // User table columns
  const userColumns = [
    {
      header: "User",
      accessorKey: (row: User) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-white">
              {row.fullName?.substring(0, 2).toUpperCase() || row.username.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{row.fullName || row.username}</p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Username",
      accessorKey: "username" as keyof User,
    },
    {
      header: "Role",
      accessorKey: "role" as keyof User,
      cell: (row: User) => {
        const roleLabels: Record<string, string> = {
          [UserRole.ADMIN]: "Admin",
          [UserRole.CUSTOMER]: "Customer",
          [UserRole.RESTAURANT]: "Restaurant",
          [UserRole.RIDER]: "Rider",
        };
        return <span>{roleLabels[row.role] || row.role}</span>;
      },
    },
    {
      header: "Status",
      accessorKey: "isActive" as keyof User,
      cell: (row: User) => (
        <span className={row.isActive ? "text-green-600" : "text-red-600"}>
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Last Login",
      accessorKey: (row: User) => row.lastLogin ? new Date(row.lastLogin).toLocaleString() : "Never",
    },
    {
      header: "Actions",
      accessorKey: (row: User) => (
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary"
            onClick={(e) => {
              e.stopPropagation();
              handleViewUser(row);
            }}
          >
            <Eye size={16} />
          </Button>
        </div>
      ),
    },
  ];

  // Order columns for user detail view
  const orderColumns = [
    {
      header: "Order ID",
      accessorKey: "id" as keyof Order,
      cell: (row: Order) => <span>#{row.id.toString().padStart(4, '0')}</span>,
    },
    {
      header: "Restaurant",
      accessorKey: (row: Order) => `Restaurant #${row.restaurantId}`,
    },
    {
      header: "Amount",
      accessorKey: (row: Order) => `₱ ${row.totalAmount.toFixed(2)}`,
    },
    {
      header: "Status",
      accessorKey: "status" as keyof Order,
    },
    {
      header: "Date",
      accessorKey: (row: Order) => row.createdAt ? new Date(row.createdAt).toLocaleString() : "N/A",
    },
  ];

  return (
    <AdminLayout title="User Management" description="Manage users on the platform">
      <Tabs defaultValue="customer" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="customer">Customers</TabsTrigger>
          <TabsTrigger value="restaurant">Restaurants</TabsTrigger>
          <TabsTrigger value="rider">Riders</TabsTrigger>
          <TabsTrigger value="admin">Admins</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            {activeTab === "customer" && "Customer Accounts"}
            {activeTab === "restaurant" && "Restaurant Accounts"}
            {activeTab === "rider" && "Rider Accounts"}
            {activeTab === "admin" && "Admin Accounts"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredUsers}
            columns={userColumns}
            isLoading={isLoadingUsers}
            searchPlaceholder="Search by name, username, or email..."
            searchTerm={searchTerm}
            onSearch={(term) => setSearchTerm(term)}
          />
        </CardContent>
      </Card>

      {/* View User Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>
              View and manage user information.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-lg bg-primary text-white">
                    {selectedUser.fullName?.substring(0, 2).toUpperCase() ||
                     selectedUser.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {selectedUser.fullName || selectedUser.username}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {selectedUser.role}
                    </span>
                    <span className={`text-xs ${selectedUser.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-0.5 rounded-full`}>
                      {selectedUser.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="user-active"
                    checked={selectedUser.isActive || false}
                    onCheckedChange={() => handleToggleActive(selectedUser)}
                  />
                  <Label htmlFor="user-active">Active</Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">Account Information</h4>
                  <p className="text-sm">
                    <span className="font-medium">Username:</span>{" "}
                    {selectedUser.username}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Full Name:</span>{" "}
                    {selectedUser.fullName || "Not provided"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Email:</span>{" "}
                    {selectedUser.email}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span>{" "}
                    {selectedUser.phone || "Not provided"}
                  </p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">Security Settings</h4>
                  <p className="text-sm">
                    <span className="font-medium">OTP Enabled:</span>{" "}
                    {selectedUser.otpEnabled ? "Yes" : "No"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Last Login:</span>{" "}
                    {selectedUser.lastLogin ? new Date(selectedUser.lastLogin).toLocaleString() : "Never"}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Account Created:</span>{" "}
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>

              {selectedUser.role === UserRole.CUSTOMER && (
                <div>
                  <h4 className="text-base font-medium mb-2">Order History</h4>
                  {isLoadingOrders ? (
                    <div className="text-center py-4">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-b-transparent rounded-full inline-block mr-2"></div>
                      Loading orders...
                    </div>
                  ) : userOrders && userOrders.length > 0 ? (
                    <DataTable
                      data={userOrders}
                      columns={orderColumns}
                      pageSize={5}
                    />
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No orders found for this user.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-between mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Implementation for password reset would go here
                    toast({
                      title: "Password reset email sent",
                      description: "A password reset link has been sent to the user's email.",
                    });
                  }}
                >
                  Reset Password
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleToggleActive(selectedUser)}
                >
                  {selectedUser.isActive ? "Deactivate Account" : "Activate Account"}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
