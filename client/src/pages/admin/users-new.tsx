import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User, Order, UserRole, RiderFeedback, Customer } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "@/layouts/AdminLayout";
import { DataTable } from "@/components/ui/data-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Eye, AlertCircle, Trash2, Star } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminUsers() {
  const { toast } = useToast();
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("customer");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleUserCounts, setRoleUserCounts] = useState({
    [UserRole.CUSTOMER]: 0,
    [UserRole.RESTAURANT]: 0,
    [UserRole.RIDER]: 0,
    [UserRole.ADMIN]: 0
  });

  // Fetch users directly
  const {
    data: allUsers,
    isLoading: isLoadingUsers,
    error: usersError,
    refetch: refetchUsers
  } = useQuery<User[]>({
    queryKey: ["/api/users"]
  });

  // Set role-based user counts when users data is loaded
  useEffect(() => {
    if (allUsers) {
      const counts = {
        [UserRole.CUSTOMER]: 0,
        [UserRole.RESTAURANT]: 0,
        [UserRole.RIDER]: 0,
        [UserRole.ADMIN]: 0
      };

      allUsers.forEach(user => {
        if (user.role in counts) {
          counts[user.role as keyof typeof counts]++;
        }
      });

      setRoleUserCounts(counts);
      console.log("Users loaded, role counts:", counts);
    }
  }, [allUsers]);

  // Fetch orders for selected user if they are a customer
  const { data: userOrders, isLoading: isLoadingOrders } = useQuery<Order[]>({
    queryKey: ["/api/orders", selectedUser?.id],
    enabled: !!selectedUser && selectedUser.role === UserRole.CUSTOMER,
  });

  // Fetch customer profile for selected user if they are a customer
  const { data: customerProfile } = useQuery<Customer[]>({
    queryKey: ["/api/customers", { userId: selectedUser?.id }],
    enabled: !!selectedUser && selectedUser.role === UserRole.CUSTOMER,
  });

  // Fetch rider feedback for selected customer
  const { data: riderFeedback, isLoading: isLoadingRiderFeedback } = useQuery<RiderFeedback[]>({
    queryKey: [`/api/rider-feedback/customer/${customerProfile?.[0]?.id}`],
    enabled: !!customerProfile && customerProfile.length > 0 && customerProfile[0]?.id !== undefined,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<User> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      toast({
        title: "User deleted",
        description: "The user has been deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Filter users based on active tab and search term
  const filteredUsers = allUsers?.filter(user => {
    // Role filtering
    let roleMatch = false;
    if (activeTab === "customer") roleMatch = user.role === UserRole.CUSTOMER;
    if (activeTab === "restaurant") roleMatch = user.role === UserRole.RESTAURANT;
    if (activeTab === "rider") roleMatch = user.role === UserRole.RIDER;
    if (activeTab === "admin") roleMatch = user.role === UserRole.ADMIN;

    // Search filtering
    const searchMatch = !searchTerm.trim() ||
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    return roleMatch && searchMatch;
  }) || [];

  // Handle user view
  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setViewDialogOpen(true);
  };

  // Handle active status toggle
  const handleToggleActive = (user: User) => {
    updateUserMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive }
    });
  };

  // Handle delete user
  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  // Confirm delete user
  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  // Reset any errors and refetch data
  const handleRetry = () => {
    refetchUsers();
  };

  // User table columns
  const userColumns = [
    {
      header: "User",
      accessorKey: "user", // Changed to a string matching the transform function below
      cell: (row: User) => (
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-primary text-white">
              {(row.fullName?.substring(0, 2) || row.username.substring(0, 2)).toUpperCase()}
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
      accessorKey: "username",
    },
    {
      header: "Status",
      accessorKey: "isActive",
      cell: (row: User) => (
        <span className={row.isActive ? "text-green-600" : "text-red-600"}>
          {row.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Last Login",
      accessorKey: "lastLogin",
      cell: (row: User) => (row.lastLogin ?
        new Date(row.lastLogin).toLocaleDateString() : "Never")
    },
    {
      header: "Actions",
      accessorKey: "actions",
      cell: (row: User) => (
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-700"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteUser(row);
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  // Order columns for user detail view
  const orderColumns = [
    {
      header: "Order ID",
      accessorKey: "id",
      cell: (row: Order) => <span>#{row.id.toString().padStart(4, '0')}</span>,
    },
    {
      header: "Restaurant",
      accessorKey: "restaurantId",
      cell: (row: Order) => `Restaurant #${row.restaurantId}`
    },
    {
      header: "Amount",
      accessorKey: "totalAmount",
      cell: (row: Order) => `₱ ${row.totalAmount.toFixed(2)}`
    },
    {
      header: "Status",
      accessorKey: "status",
    },
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row: Order) => new Date(row.createdAt || Date.now()).toLocaleDateString()
    },
  ];

  return (
    <AdminLayout title="User Management" description="Manage users on the platform">
      <Tabs defaultValue="customer" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="customer">
            Customers ({roleUserCounts[UserRole.CUSTOMER]})
          </TabsTrigger>
          <TabsTrigger value="restaurant">
            Restaurants ({roleUserCounts[UserRole.RESTAURANT]})
          </TabsTrigger>
          <TabsTrigger value="rider">
            Riders ({roleUserCounts[UserRole.RIDER]})
          </TabsTrigger>
          <TabsTrigger value="admin">
            Admins ({roleUserCounts[UserRole.ADMIN]})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {usersError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error loading users</AlertTitle>
          <AlertDescription className="flex justify-between">
            <span>Failed to fetch user data. Please try again.</span>
            <Button size="sm" variant="outline" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

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
      {selectedUser && (
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>User Details</DialogTitle>
              <DialogDescription>
                View and manage user information.
              </DialogDescription>
            </DialogHeader>
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
                    checked={Boolean(selectedUser.isActive)}
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
                    {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleString() : "Unknown"}
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

              {/* Rider Feedback Section for Customers */}
              {selectedUser.role === UserRole.CUSTOMER && (
                <div className="mt-4">
                  <h4 className="text-base font-medium mb-2">Rider Feedback</h4>
                  {isLoadingRiderFeedback ? (
                    <div className="text-center py-4">
                      <div className="animate-spin h-6 w-6 border-2 border-primary border-b-transparent rounded-full inline-block mr-2"></div>
                      Loading feedback...
                    </div>
                  ) : riderFeedback && riderFeedback.length > 0 ? (
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {riderFeedback.map((feedback) => (
                        <div key={feedback.id} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Order #{feedback.orderId}</span>
                              <div className="flex items-center">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    className={`w-3 h-3 ${
                                      star <= feedback.rating
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {feedback.rating}/5
                                </span>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(feedback.createdAt!).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Additional ratings */}
                          <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                            {feedback.punctuality && (
                              <div>
                                <span className="text-muted-foreground">Punctuality:</span>{" "}
                                <span className="font-medium">{feedback.punctuality}/5</span>
                              </div>
                            )}
                            {feedback.communication && (
                              <div>
                                <span className="text-muted-foreground">Communication:</span>{" "}
                                <span className="font-medium">{feedback.communication}/5</span>
                              </div>
                            )}
                            {feedback.paymentEase && (
                              <div>
                                <span className="text-muted-foreground">Payment:</span>{" "}
                                <span className="font-medium">{feedback.paymentEase}/5</span>
                              </div>
                            )}
                          </div>

                          {feedback.comment && (
                            <p className="text-sm text-muted-foreground italic">
                              "{feedback.comment}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-4">
                      No rider feedback found for this customer.
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this user? This action cannot be undone.
              {userToDelete && (
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="font-medium">{userToDelete.fullName || userToDelete.username}</p>
                  <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete User
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
