import { useEffect, useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Mail, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const [location] = useLocation();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error' | 'idle'>('idle');
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);
  const { toast } = useToast();

  // Extract token from URL query params
  const getTokenFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  };

  useEffect(() => {
    const token = getTokenFromUrl();
    if (token) {
      verifyEmail(token);
    }
  }, [location]);

  const verifyEmail = async (token: string) => {
    setVerificationStatus('loading');
    try {
      const response = await apiRequest('POST', '/api/verify-email', { token });

      if (response.ok) {
        const data = await response.json();
        setVerificationStatus('success');
        toast({
          title: "Success!",
          description: data.message || "Your email has been verified successfully.",
        });
      } else {
        const error = await response.json();
        setVerificationStatus('error');
        toast({
          title: "Verification Failed",
          description: error.message || "Invalid or expired verification token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setVerificationStatus('error');
      toast({
        title: "Error",
        description: "An error occurred while verifying your email.",
        variant: "destructive",
      });
    }
  };

  const handleResendEmail = async () => {
    if (!resendEmail) {
      toast({
        title: "Email Required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setResending(true);
    try {
      const response = await apiRequest('POST', '/api/resend-verification', { email: resendEmail });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Email Sent",
          description: data.message || "Verification email has been sent.",
        });
        setResendEmail('');
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to send verification email.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred while sending verification email.",
        variant: "destructive",
      });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md" data-testid="verify-email-card">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Email Verification</CardTitle>
        </CardHeader>
        <CardContent>
          {verificationStatus === 'loading' && (
            <div className="text-center py-8" data-testid="status-loading">
              <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-500" />
              <p className="text-gray-600 dark:text-gray-400">
                Verifying your email address...
              </p>
            </div>
          )}

          {verificationStatus === 'success' && (
            <div className="text-center py-8" data-testid="status-success">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Email Verified!</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Your email has been successfully verified. You can now log in to your account.
              </p>
              <Link href="/login">
                <Button className="w-full" data-testid="button-login">
                  Go to Login
                </Button>
              </Link>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="text-center py-8" data-testid="status-error">
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Verification Failed</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                The verification link is invalid or has expired.
              </p>
              <div className="space-y-4">
                <div className="text-left">
                  <Label htmlFor="email">Enter your email to resend verification</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      data-testid="input-email"
                    />
                    <Button
                      onClick={handleResendEmail}
                      disabled={resending}
                      data-testid="button-resend"
                    >
                      {resending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="button-back-login">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {verificationStatus === 'idle' && !getTokenFromUrl() && (
            <div className="text-center py-8" data-testid="status-idle">
              <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Email Verification</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Please check your email for the verification link we sent you.
              </p>
              <div className="space-y-4">
                <div className="text-left">
                  <Label htmlFor="resend-email">Didn't receive an email?</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="your@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      data-testid="input-resend-email"
                    />
                    <Button
                      onClick={handleResendEmail}
                      disabled={resending}
                      data-testid="button-resend-email"
                    >
                      {resending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Resend'
                      )}
                    </Button>
                  </div>
                </div>
                <Link href="/login">
                  <Button variant="outline" className="w-full" data-testid="button-login-page">
                    Back to Login
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
