import { useState, useEffect } from "react";
import AdminLayout from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Rider, RiderStatus, InsertRider, User, UserRole } from "@shared/schema";
import { Plus, Eye, Map, Check, X, Ban, CheckCircle } from "lucide-react";
import { SimpleRiderMap } from "@/components/admin/simple-rider-map";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Form validation schema for existing users
const riderFormSchema = z.object({
  userId: z.number().int().positive("User ID is required"),
  licenseNumber: z.string().min(5, "License number is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehiclePlateNumber: z.string().min(1, "Vehicle plate number is required"),
  status: z.enum([RiderStatus.ACTIVE, RiderStatus.WAITING, RiderStatus.OFFLINE]),
  isVerified: z.boolean().default(false),
  queuePosition: z.number().int().nullable().optional(),
});

// Form validation schema for creating a new rider with a new user account
const newRiderFormSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  email: z.string().email("Please enter a valid email"),
  fullName: z.string().min(3, "Full name is required"),
  phone: z.string().optional(),
  licenseNumber: z.string().min(5, "License number is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  vehiclePlateNumber: z.string().min(1, "Vehicle plate number is required"),
  status: z.enum([RiderStatus.ACTIVE, RiderStatus.WAITING, RiderStatus.OFFLINE]),
  isVerified: z.boolean().default(false),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RiderFormValues = z.infer<typeof riderFormSchema>;
type NewRiderFormValues = z.infer<typeof newRiderFormSchema>;

export default function AdminRiders() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRider, setSelectedRider] = useState<Rider | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Form for creating rider using existing user
  const form = useForm<RiderFormValues>({
    resolver: zodResolver(riderFormSchema),
    defaultValues: {
      userId: 0,
      licenseNumber: "",
      vehicleType: "",
      vehiclePlateNumber: "",
      status: RiderStatus.OFFLINE,
      isVerified: false,
      queuePosition: null,
    },
  });

  // Form for creating new rider with new user account
  const newUserForm = useForm<NewRiderFormValues>({
    resolver: zodResolver(newRiderFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      fullName: "",
      phone: "",
      licenseNumber: "",
      vehicleType: "",
      vehiclePlateNumber: "",
      status: RiderStatus.OFFLINE,
      isVerified: false,
    },
  });

  // Reset forms when modal opens
  useEffect(() => {
    if (createDialogOpen) {
      form.reset();
      newUserForm.reset();
    }
  }, [createDialogOpen, form, newUserForm]);

  // Fetch riders
  const { data: riders, isLoading: isLoadingRiders } = useQuery<Rider[]>({
    queryKey: ["/api/riders"],
  });

  // Fetch users to assign as riders
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Update rider queue position
  const updateQueuePositionMutation = useMutation({
    mutationFn: async ({ id, queuePosition }: { id: number, queuePosition: number | null }) => {
      const response = await apiRequest("PATCH", `/api/riders/${id}`, { queuePosition });
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Queue position updated",
        description: "The rider's queue position has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update queue position",
        description: error.message || "An error occurred while updating the queue position.",
        variant: "destructive",
      });
    },
  });

  // Register new user mutation
  const registerUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; email: string; fullName: string; phone?: string; role: string }) => {
      const res = await apiRequest("POST", "/api/register", data);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "User created",
        description: "New rider account created successfully",
      });
      return data;
    },
    onError: (error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create rider mutation
  const createRiderMutation = useMutation({
    mutationFn: async (data: InsertRider) => {
      const res = await apiRequest("POST", "/api/riders", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      toast({
        title: "Rider created",
        description: "The rider has been registered successfully",
      });
      setCreateDialogOpen(false);
      setIsNewUser(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to register rider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update rider mutation
  const updateRiderMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Rider> }) => {
      const res = await apiRequest("PATCH", `/api/riders/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      // Also invalidate users query since status is synced
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Rider updated",
        description: "The rider has been updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update rider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Verify rider mutation
  const verifyRiderMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/riders/${id}`, { isVerified: true });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/riders"] });
      toast({
        title: "Rider verified",
        description: "The rider has been verified successfully",
      });
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to verify rider",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle rider view
  const handleViewRider = (rider: Rider) => {
    setSelectedRider(rider);
    setViewDialogOpen(true);
  };

  // Handle rider verification
  const handleVerifyRider = (id: number) => {
    verifyRiderMutation.mutate(id);
  };

  // Handle toggling rider status
  const handleToggleStatus = (rider: Rider) => {
    const newStatus = rider.status === RiderStatus.ACTIVE
      ? RiderStatus.OFFLINE
      : RiderStatus.ACTIVE;

    // Confirm status change
    if (window.confirm(`Are you sure you want to change the rider's status to ${newStatus.toUpperCase()}?`)) {
      updateRiderMutation.mutate({
        id: rider.id,
        data: { status: newStatus }
      });
    }
  };

  // Handle existing user rider form submission
  const onSubmit = (values: RiderFormValues) => {
    createRiderMutation.mutate(values as InsertRider);
  };

  // Handle new user rider form submission
  const onSubmitNewUser = async (values: NewRiderFormValues) => {
    try {
      // First create the user
      const userData = await registerUserMutation.mutateAsync({
        username: values.username,
        password: values.password,
        email: values.email,
        fullName: values.fullName,
        phone: values.phone,
        role: UserRole.RIDER,
      });

      if (userData && userData.id) {
        // Then create the rider with the new user ID
        createRiderMutation.mutate({
          userId: userData.id,
          licenseNumber: values.licenseNumber,
          vehicleType: values.vehicleType,
          vehiclePlateNumber: values.vehiclePlateNumber,
          status: values.status,
          isVerified: values.isVerified,
        });
      }
    } catch (error) {
      toast({
        title: "Error registering rider",
        description: "There was a problem creating the rider. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Rider table columns
  const riderColumns = [
    {
      header: "Rider",
      accessorKey: "id",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return <div>No data</div>;

        const user = users?.find(u => u.id === rider.userId);
        return (
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback className="bg-primary text-white">
                {user?.fullName?.substring(0, 2).toUpperCase() || 'RD'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{user?.fullName || `Rider #${rider.id}`}</p>
              <p className="text-xs text-muted-foreground">ID: RDR-{rider.id.toString().padStart(3, '0')}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Contact",
      accessorKey: "id",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return 'N/A';

        const user = users?.find(u => u.id === rider.userId);
        return user?.phone || 'N/A';
      },
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return <div>No status</div>;

        return <StatusBadge status={rider.status || 'offline'} type="rider" />;
      },
    },
    {
      header: "Verification",
      accessorKey: "isVerified",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return <div>Unknown</div>;

        return rider.isVerified ?
          <span className="text-green-600 flex items-center">
            <Check size={16} className="mr-1" /> Verified
          </span> :
          <span className="text-amber-500 flex items-center">
            <X size={16} className="mr-1" /> Unverified
          </span>;
      },
    },
    {
      header: "Vehicle",
      accessorKey: "vehicleType",
    },
    {
      header: "Queue Position",
      accessorKey: "queuePosition",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return 'N/A';

        return (
          <div className="flex items-center space-x-2">
            <span>{rider.queuePosition !== null ? rider.queuePosition : "N/A"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-primary"
              onClick={(e) => {
                e.stopPropagation();

                const newPosition = window.prompt("Enter new queue position (or leave empty to remove from queue):",
                  rider.queuePosition !== null ? rider.queuePosition.toString() : "");

                if (newPosition === null) return;

                const queuePosition = newPosition.trim() === "" ? null : parseInt(newPosition);

                if (queuePosition === null || !isNaN(queuePosition)) {
                  updateQueuePositionMutation.mutate({
                    id: rider.id,
                    queuePosition: queuePosition
                  });
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-edit">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </Button>
          </div>
        );
      },
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (info: any) => {
        const rider = info.row?.original || info;
        if (!rider) return <div>No actions</div>;

        return (
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary"
              onClick={(e) => {
                e.stopPropagation();
                handleViewRider(rider);
              }}
            >
              <Eye size={16} />
            </Button>
            {!rider.isVerified && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  handleVerifyRider(rider.id);
                }}
              >
                <Check size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleStatus(rider);
              }}
            >
              {rider.status === RiderStatus.ACTIVE ? <Ban size={16} /> : <CheckCircle size={16} />}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout title="Rider Management" description="Manage riders on the platform">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">All Riders</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowMap(!showMap)}>
            <Map className="mr-2 h-4 w-4" /> View Map
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Add Rider
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Register New Rider</DialogTitle>
                <DialogDescription>
                  Enter the rider details to register them on the platform.
                </DialogDescription>
              </DialogHeader>

              <div className="mb-6">
                <div className="flex items-center space-x-4 border-b">
                  <button
                    className={`py-2 px-4 font-medium ${!isNewUser ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setIsNewUser(false)}
                  >
                    Existing User
                  </button>
                  <button
                    className={`py-2 px-4 font-medium ${isNewUser ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
                    onClick={() => setIsNewUser(true)}
                  >
                    Create New Account
                  </button>
                </div>
              </div>

              {isNewUser ? (
                <Form {...newUserForm}>
                  <form onSubmit={newUserForm.handleSubmit(onSubmitNewUser)} className="space-y-4">
                    <div className="space-y-4 border-b pb-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Account Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={newUserForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Username</FormLabel>
                              <FormControl>
                                <Input placeholder="Username" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newUserForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="Email address" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={newUserForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newUserForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Confirm Password</FormLabel>
                              <FormControl>
                                <Input type="password" placeholder="Confirm password" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={newUserForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Full Name</FormLabel>
                              <FormControl>
                                <Input placeholder="Full name" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newUserForm.control}
                          name="phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Phone number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-muted-foreground">Rider Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={newUserForm.control}
                          name="licenseNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>License Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Driver's license number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newUserForm.control}
                          name="vehicleType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle Type</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select vehicle type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="motorcycle">Motorcycle</SelectItem>
                                  <SelectItem value="bicycle">Bicycle</SelectItem>
                                  <SelectItem value="car">Car</SelectItem>
                                  <SelectItem value="scooter">Scooter</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={newUserForm.control}
                          name="vehiclePlateNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Vehicle Plate Number</FormLabel>
                              <FormControl>
                                <Input placeholder="Vehicle plate number" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={newUserForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select status" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value={RiderStatus.OFFLINE}>Offline</SelectItem>
                                  <SelectItem value={RiderStatus.WAITING}>Waiting</SelectItem>
                                  <SelectItem value={RiderStatus.ACTIVE}>Active</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        type="submit"
                        disabled={registerUserMutation.isPending || createRiderMutation.isPending}
                      >
                        {(registerUserMutation.isPending || createRiderMutation.isPending) ? (
                          <div className="flex items-center">
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                            Registering...
                          </div>
                        ) : (
                          "Register Rider"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="userId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>User</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            value={field.value ? field.value.toString() : undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a user" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {users?.filter(user => user.role === UserRole.RIDER && !riders?.some(r => r.userId === user.id)).map((user) => (
                                <SelectItem key={user.id} value={user.id.toString()}>
                                  {user.fullName || user.username} ({user.email})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>License Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Driver's license number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="vehicleType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select vehicle type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="motorcycle">Motorcycle</SelectItem>
                                <SelectItem value="bicycle">Bicycle</SelectItem>
                                <SelectItem value="car">Car</SelectItem>
                                <SelectItem value="scooter">Scooter</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="vehiclePlateNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vehicle Plate Number</FormLabel>
                            <FormControl>
                              <Input placeholder="Vehicle plate number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={RiderStatus.OFFLINE}>Offline</SelectItem>
                                <SelectItem value={RiderStatus.WAITING}>Waiting</SelectItem>
                                <SelectItem value={RiderStatus.ACTIVE}>Active</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        type="submit"
                        disabled={createRiderMutation.isPending}
                      >
                        {createRiderMutation.isPending ? (
                          <div className="flex items-center">
                            <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                            Registering...
                          </div>
                        ) : (
                          "Register Rider"
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Show map or table view */}
      {showMap ? (
        <SimpleRiderMap riders={riders || []} users={users || []} />
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Active Riders</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={riders || []}
              columns={riderColumns as any}
              isLoading={isLoadingRiders}
              searchPlaceholder="Search riders..."
            />
          </CardContent>
        </Card>
      )}

      {/* View Rider Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rider Details</DialogTitle>
            <DialogDescription>
              View detailed information about this rider.
            </DialogDescription>
          </DialogHeader>
          {selectedRider && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 pb-4 border-b">
                {selectedRider.riderPhotoUrl ? (
                  <img
                    src={selectedRider.riderPhotoUrl}
                    alt="Rider Photo"
                    className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <Avatar className={`h-16 w-16 ${selectedRider.riderPhotoUrl ? 'hidden' : ''}`}>
                  <AvatarFallback className="text-lg bg-primary text-white">
                    RD
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">
                    {users?.find(u => u.id === selectedRider.userId)?.fullName || `Rider #${selectedRider.id}`}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    ID: RDR-{selectedRider.id.toString().padStart(3, '0')}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedRider.status || 'offline'} type="rider" />
                    {selectedRider.isVerified ? (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">Contact Information</h4>
                  <p className="text-sm">
                    <span className="font-medium">Email:</span>{" "}
                    {users?.find(u => u.id === selectedRider.userId)?.email || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Phone:</span>{" "}
                    {users?.find(u => u.id === selectedRider.userId)?.phone || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-1">Vehicle Information</h4>
                  <p className="text-sm">
                    <span className="font-medium">Type:</span> {selectedRider.vehicleType}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Plate:</span> {selectedRider.vehiclePlateNumber || 'N/A'}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">License:</span> {selectedRider.licenseNumber}
                  </p>
                </div>
              </div>

              {/* Display License Photo if available */}
              {selectedRider.licensePhotoUrl && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">License Photo</h4>
                  <div className="relative">
                    <img
                      src={selectedRider.licensePhotoUrl}
                      alt="Driver's License"
                      className="w-full max-w-md mx-auto rounded-lg border border-gray-200 shadow-sm"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = target.nextElementSibling;
                        if (errorDiv) {
                          errorDiv.classList.remove('hidden');
                        }
                      }}
                    />
                    <div className="hidden text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-muted-foreground">Unable to load license photo</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Display Rider Photo if available */}
              {selectedRider.riderPhotoUrl && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">Rider Photo</h4>
                  <div className="relative">
                    <img
                      src={selectedRider.riderPhotoUrl}
                      alt="Rider Photo"
                      className="w-full max-w-md mx-auto rounded-lg border border-gray-200 shadow-sm"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const errorDiv = target.nextElementSibling;
                        if (errorDiv) {
                          errorDiv.classList.remove('hidden');
                        }
                      }}
                    />
                    <div className="hidden text-center py-4 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-sm text-muted-foreground">Unable to load rider photo</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <div className="flex gap-2">
                  {!selectedRider.isVerified && (
                    <Button
                      onClick={() => handleVerifyRider(selectedRider.id)}
                      disabled={verifyRiderMutation.isPending}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Verify Rider
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => handleToggleStatus(selectedRider)}
                    disabled={updateRiderMutation.isPending}
                    className="flex-1"
                  >
                    {selectedRider.status === RiderStatus.ACTIVE ? (
                      <>
                        <Ban className="mr-2 h-4 w-4" />
                        Set Offline
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Set Active
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
