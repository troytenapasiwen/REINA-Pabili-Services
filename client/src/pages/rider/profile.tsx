import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Edit3, Save, X, User, Car, Phone, Mail, Shield, MapPin, Radio, CircleOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import RiderLayout from '@/layouts/RiderLayout';
import { RiderStatus } from '@shared/schema';
import type { Rider, User as UserType } from '@shared/schema';
import { Switch } from '@/components/ui/switch';

// Schema for editing rider profile
const riderProfileSchema = z.object({
  licenseNumber: z.string().min(1, 'License number is required'),
  vehicleType: z.string().min(1, 'Vehicle type is required'),
  vehiclePlateNumber: z.string().min(1, 'Vehicle plate number is required'),
});

// Schema for editing user details
const userProfileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z.string().email('Invalid email address'),
});

type RiderProfileFormData = z.infer<typeof riderProfileSchema>;
type UserProfileFormData = z.infer<typeof userProfileSchema>;

export default function RiderProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isEditingRider, setIsEditingRider] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);

  // Fetch current rider data
  const { data: rider, isLoading: riderLoading } = useQuery<Rider>({
    queryKey: ['/api/riders/current'],
    enabled: !!user,
  });

  // Update rider status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await apiRequest('PATCH', '/api/riders/status', { status });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riders/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      toast({
        title: 'Status updated',
        description: `You are now ${rider?.status === RiderStatus.ACTIVE ? 'offline' : 'active'}.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Status update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleStatusToggle = () => {
    if (!rider) return;
    const newStatus = rider.status === RiderStatus.ACTIVE ? RiderStatus.OFFLINE : RiderStatus.ACTIVE;
    updateStatusMutation.mutate(newStatus);
  };

  // Forms for editing
  const riderForm = useForm<RiderProfileFormData>({
    resolver: zodResolver(riderProfileSchema),
    defaultValues: {
      licenseNumber: rider?.licenseNumber || '',
      vehicleType: rider?.vehicleType || '',
      vehiclePlateNumber: rider?.vehiclePlateNumber || '',
    },
  });

  const userForm = useForm<UserProfileFormData>({
    resolver: zodResolver(userProfileSchema),
    defaultValues: {
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      email: user?.email || '',
    },
  });

  // Update rider details mutation
  const updateRiderMutation = useMutation({
    mutationFn: async (data: RiderProfileFormData) => {
      if (!rider) throw new Error('No rider data available');
      const res = await apiRequest('PATCH', `/api/riders/${rider.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/riders/current'] });
      setIsEditingRider(false);
      toast({
        title: 'Profile updated',
        description: 'Your rider details have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Update user details mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserProfileFormData) => {
      if (!user) throw new Error('No user data available');
      const res = await apiRequest('PATCH', `/api/users/${user.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setIsEditingUser(false);
      toast({
        title: 'Profile updated',
        description: 'Your personal details have been updated successfully.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Update failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Reset rider form when rider data changes
  useEffect(() => {
    if (rider && !isEditingRider) {
      riderForm.reset({
        licenseNumber: rider.licenseNumber || '',
        vehicleType: rider.vehicleType || '',
        vehiclePlateNumber: rider.vehiclePlateNumber || '',
      });
    }
  }, [rider, isEditingRider]);

  // Reset user form when user data changes
  useEffect(() => {
    if (user && !isEditingUser) {
      userForm.reset({
        fullName: user.fullName || '',
        phone: user.phone || '',
        email: user.email || '',
      });
    }
  }, [user, isEditingUser]);

  const onSubmitRider = (data: RiderProfileFormData) => {
    updateRiderMutation.mutate(data);
  };

  const onSubmitUser = (data: UserProfileFormData) => {
    updateUserMutation.mutate(data);
  };

  if (riderLoading) {
    return (
      <RiderLayout title="Profile" description="Manage your account details">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </RiderLayout>
    );
  }

  return (
    <RiderLayout title="Profile" description="Manage your account details">
      <div className="space-y-6">
        {/* Profile Header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-lg bg-primary text-white">
                  {user?.fullName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'RD'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{user?.fullName}</h2>
                <p className="text-muted-foreground">Rider ID: RDR-{rider?.id.toString().padStart(3, '0')}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={rider?.status === 'active' ? 'default' : 'secondary'}>
                    {rider?.status || 'offline'}
                  </Badge>
                  {rider?.isVerified ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Unverified
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Toggle */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {rider?.status === RiderStatus.ACTIVE ? (
                <Radio className="h-5 w-5 text-green-600" />
              ) : (
                <CircleOff className="h-5 w-5 text-gray-600" />
              )}
              Availability Status
            </CardTitle>
            <CardDescription>
              Toggle your availability to receive new delivery requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {rider?.status === RiderStatus.ACTIVE ? 'You are currently ACTIVE' : 'You are currently OFFLINE'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {rider?.status === RiderStatus.ACTIVE
                    ? 'You can receive new delivery requests'
                    : 'You will not receive new delivery requests'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={rider?.status === RiderStatus.ACTIVE}
                  onCheckedChange={handleStatusToggle}
                  disabled={updateStatusMutation.isPending}
                  aria-label="Toggle availability status"
                />
                <Badge
                  variant="outline"
                  className={rider?.status === RiderStatus.ACTIVE
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-gray-50 text-gray-700 border-gray-200"}
                >
                  {rider?.status === RiderStatus.ACTIVE ? 'ACTIVE' : 'OFFLINE'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal contact details
              </CardDescription>
            </div>
            {!isEditingUser ? (
              <Button variant="outline" onClick={() => setIsEditingUser(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingUser(false);
                    userForm.reset();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={userForm.handleSubmit(onSubmitUser)}
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!isEditingUser ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm text-muted-foreground">{user?.fullName || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{user?.email || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{user?.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <Form {...userForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={userForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={userForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your phone number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={userForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter your email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        {/* Vehicle Information */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Vehicle Information
              </CardTitle>
              <CardDescription>
                Update your vehicle details and license information
              </CardDescription>
            </div>
            {!isEditingRider ? (
              <Button variant="outline" onClick={() => setIsEditingRider(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingRider(false);
                    riderForm.reset();
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={riderForm.handleSubmit(onSubmitRider)}
                  disabled={updateRiderMutation.isPending}
                >
                  {updateRiderMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!isEditingRider ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">License Number</p>
                    <p className="text-sm text-muted-foreground">{rider?.licenseNumber || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Vehicle Type</p>
                    <p className="text-sm text-muted-foreground">{rider?.vehicleType || 'Not provided'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Plate Number</p>
                    <p className="text-sm text-muted-foreground">{rider?.vehiclePlateNumber || 'Not provided'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <Form {...riderForm}>
                <form className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={riderForm.control}
                      name="licenseNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>License Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your license number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={riderForm.control}
                      name="vehicleType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select vehicle type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="motorcycle">Motorcycle</SelectItem>
                              <SelectItem value="bicycle">Bicycle</SelectItem>
                              <SelectItem value="car">Car</SelectItem>
                              <SelectItem value="tricycle">Tricycle</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={riderForm.control}
                      name="vehiclePlateNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Plate Number</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter plate number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </RiderLayout>
  );
}
