import React, { useState } from 'react';
import AdminLayout from '@/layouts/AdminLayout';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mail, AlertCircle, CheckCircle2, Loader2, SwitchCamera } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';

// Schema for email settings form
const emailSettingsSchema = z.object({
  host: z.string().min(1, 'SMTP host is required'),
  port: z.coerce.number().int().min(1, 'Port must be a positive number'),
  secure: z.boolean().default(false),
  username: z.string().min(1, 'Username/email is required'),
  password: z.string().min(1, 'Password is required'),
  fromEmail: z.string().email('Please enter a valid from email address'),
  fromName: z.string().min(1, 'From name is required'),
});

type EmailSettings = z.infer<typeof emailSettingsSchema>;

export default function EmailSettingsPage() {
  const { toast } = useToast();
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState<string>('');

  // Fetch current email settings
  const { data: emailSettings, isLoading, error } = useQuery({
    queryKey: ['/api/admin/email-settings'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/email-settings');
      return await response.json();
    },
  });

  // Define form with default values
  const form = useForm<EmailSettings>({
    resolver: zodResolver(emailSettingsSchema),
    defaultValues: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      username: '',
      password: '',
      fromEmail: 'noreply@reinapabili.com',
      fromName: 'Reina Pabili Services',
    },
  });

  // Update form values when data is loaded
  React.useEffect(() => {
    if (emailSettings) {
      // If password comes back as asterisks, don't update the form field
      // This keeps any user entered password instead of overwriting with asterisks
      const password = emailSettings.password === '********'
        ? form.getValues('password')
        : emailSettings.password || '';

      form.reset({
        ...emailSettings,
        password,
        // Ensure port is a number
        port: typeof emailSettings.port === 'string'
          ? parseInt(emailSettings.port, 10)
          : emailSettings.port || 587,
      });
    }
  }, [emailSettings, form]);

  // Save email settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: EmailSettings) => {
      const response = await apiRequest('POST', '/api/admin/email-settings', settings);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-settings'] });
      toast({
        title: 'Email settings saved',
        description: 'Your email settings have been saved successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to save settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test email settings mutation
  const testSettingsMutation = useMutation({
    mutationFn: async (settings: EmailSettings) => {
      const response = await apiRequest('POST', '/api/admin/email-settings/test', settings);
      return await response.json();
    },
    onSuccess: (data) => {
      setTestSuccess(true);
      setTestMessage(data.message || 'Email settings connection test successful');
      toast({
        title: 'Test successful',
        description: 'The email settings connection test was successful.',
      });
    },
    onError: (error: Error) => {
      setTestSuccess(false);
      setTestMessage(error.message || 'Failed to connect with the provided email settings');
      toast({
        title: 'Test failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Form submission handler
  function onSubmit(values: EmailSettings) {
    saveSettingsMutation.mutate(values);
  }

  // Test settings handler
  function onTestSettings() {
    const values = form.getValues();
    setTestSuccess(null);
    setTestMessage('');
    testSettingsMutation.mutate(values);
  }

  // Gmail App Password help text
  const gmailAppPasswordInfo = (
    <Alert className="mt-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Using Gmail?</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          To use Gmail as your email provider, you need to enable 2-Step Verification and create an App Password:
        </p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Go to your Google Account settings</li>
          <li>Select "Security"</li>
          <li>Under "Signing in to Google," select "2-Step Verification" and turn it on</li>
          <li>Return to the Security section and select "App passwords"</li>
          <li>Generate a new app password for "Mail" and "Other (Custom name)"</li>
          <li>Use the generated password in the "Password" field above</li>
        </ol>
        <p className="mt-2">
          <a
            href="https://support.google.com/accounts/answer/185833"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Learn more about App Passwords
          </a>
        </p>
      </AlertDescription>
    </Alert>
  );

  if (isLoading) {
    return (
      <AdminLayout title="Email Settings" description="Configure email settings for password reset">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading email settings...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Email Settings" description="Configure email settings for password reset">
      <div className="max-w-3xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Mail className="mr-2 h-5 w-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure the email settings used for sending password reset emails.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMTP Host</FormLabel>
                        <FormControl>
                          <Input placeholder="smtp.gmail.com" {...field} />
                        </FormControl>
                        <FormDescription>
                          The SMTP server hostname.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="port"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Port</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="587"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            SMTP port number.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="secure"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>Secure SSL</FormLabel>
                          <div className="h-10 flex items-center">
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </div>
                          <FormDescription>
                            Use SSL (port 465).
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username/Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="your.email@gmail.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your email address or username.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="App Password"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          Your email password or app password.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fromEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="noreply@reinapabili.com"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The email address emails will be sent from.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fromName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Reina Pabili Services"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          The sender name for emails.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Test connection result */}
                {testSuccess !== null && (
                  <Alert className={testSuccess ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
                    {testSuccess ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertTitle className={testSuccess ? "text-green-800" : "text-red-800"}>
                      {testSuccess ? "Connection Successful" : "Connection Failed"}
                    </AlertTitle>
                    <AlertDescription className={testSuccess ? "text-green-700" : "text-red-700"}>
                      {testMessage}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Gmail app password info */}
                {form.watch('host').includes('gmail') && gmailAppPasswordInfo}

                <div className="flex space-x-3 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTestSettings}
                    disabled={testSettingsMutation.isPending || saveSettingsMutation.isPending}
                  >
                    {testSettingsMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </Button>

                  <Button
                    type="submit"
                    disabled={saveSettingsMutation.isPending}
                  >
                    {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
