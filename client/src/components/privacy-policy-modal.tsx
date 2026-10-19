import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Mail, Phone, MapPin } from "lucide-react";

interface PrivacyPolicyModalProps {
  trigger?: React.ReactNode;
  className?: string;
}

export function PrivacyPolicyModal({ trigger, className }: PrivacyPolicyModalProps) {
  const defaultTrigger = (
    <Button variant="ghost" className={className}>
      <Shield className="h-4 w-4 mr-2" />
      Privacy Policy
    </Button>
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Privacy Policy and Terms of Use
          </DialogTitle>
          <DialogDescription>
            Effective Date: August 1, 2025
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <div className="bg-primary/5 p-4 rounded-lg">
              <p className="text-primary font-medium">
                Welcome to REINA Pabili Services – your trusted food delivery partner in Real, Infanta, and General Nakar, Quezon.
                By using our mobile application, you agree to our Privacy Policy and Terms of Use outlined below.
              </p>
            </div>

            <section>
              <h3 className="font-semibold text-lg mb-3">1. Information We Collect</h3>
              <p className="mb-3">When you use our services, we collect the following:</p>

              <div className="space-y-3">
                <div>
                  <h4 className="font-medium">a. Personal Information</h4>
                  <ul className="list-disc ml-6 space-y-1 text-gray-600">
                    <li>Full Name</li>
                    <li>Delivery Address</li>
                    <li>Contact Number</li>
                    <li>Email Address (if provided)</li>
                    <li>Profile photo (optional)</li>
                    <li>Preferred language/dialect</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium">b. Order & Payment Information</h4>
                  <ul className="list-disc ml-6 space-y-1 text-gray-600">
                    <li>Order history and preferences</li>
                    <li>Payment method (Cash on Delivery and Gcash via receipts)</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium">c. Device & Usage Data</h4>
                  <ul className="list-disc ml-6 space-y-1 text-gray-600">
                    <li>IP address, device type, and app usage statistics</li>
                    <li>Location (only when you permit GPS services)</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">2. How We Use Your Information</h3>
              <p className="mb-2">We use your data to:</p>
              <ul className="list-disc ml-6 space-y-1 text-gray-600">
                <li>Process and deliver your food orders</li>
                <li>Improve app functionality and user experience</li>
                <li>Communicate order updates and promotions</li>
                <li>Enhance customer support</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">3. Data Protection & Security</h3>
              <p className="text-gray-600">
                We implement appropriate security measures to protect your data from unauthorized access, disclosure, or loss.
                However, no method of transmission over the internet or mobile networks is 100% secure.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">4. Data Sharing</h3>
              <p className="mb-2">We do not sell your data. We may only share your information with:</p>
              <ul className="list-disc ml-6 space-y-1 text-gray-600">
                <li>Delivery riders and partner vendors for fulfilling orders</li>
                <li>Legal authorities when required by law</li>
                <li>Service providers that support app features (e.g., maps, notifications)</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">5. User Rights</h3>
              <p className="mb-2">You have the right to:</p>
              <ul className="list-disc ml-6 space-y-1 text-gray-600">
                <li>Access or update your personal information</li>
                <li>Request deletion of your account</li>
                <li>Opt-out of marketing communications</li>
              </ul>
              <p className="mt-2 text-gray-600">
                To make any of these requests, please email us at: <strong>reinapabili@gmail.com</strong>
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">6. Cookies & Tracking Technologies</h3>
              <p className="text-gray-600">
                We use cookies and analytics tools to enhance your app experience. You may disable cookies via your device settings,
                though some features may not function properly.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3">7. Children's Privacy</h3>
              <p className="text-gray-600">
                Our services are not intended for children under 18. We do not knowingly collect personal data from minors.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-lg mb-3 text-primary">📝 Terms of Use</h3>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">1. Acceptance of Terms</h4>
                  <p className="text-gray-600">
                    By accessing or using our app, you agree to be bound by these Terms of Use.
                    If you do not agree, please refrain from using our services.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">2. User Responsibilities</h4>
                  <p className="mb-2">You agree to:</p>
                  <ul className="list-disc ml-6 space-y-1 text-gray-600">
                    <li>Provide accurate delivery information</li>
                    <li>Respect riders and vendors</li>
                    <li>Not misuse the app for unlawful activities</li>
                    <li>Maintain confidentiality of your account credentials</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium">3. Service Availability</h4>
                  <p className="text-gray-600">
                    We strive to ensure continuous service but do not guarantee that the app will always be available or error-free.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">4. Account Suspension</h4>
                  <p className="text-gray-600">
                    We reserve the right to suspend or delete accounts that violate our terms or engage in fraudulent or abusive behavior.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">5. Changes to Policy</h4>
                  <p className="text-gray-600">
                    We may update this policy from time to time. You will be notified of significant changes via the app or email.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium">6. Contact Us</h4>
                  <p className="mb-2">For any concerns or questions regarding this Policy & Privacy, please contact:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span>reinapabili@gmail.com</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="h-4 w-4" />
                      <span>09467102826</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>Pob. 1 Infanta, Quezon</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <div className="bg-primary/10 p-4 rounded-lg mt-6">
              <p className="text-primary font-medium text-center">
                Thank you for trusting REINA Pabili Services! We value your privacy and strive to provide a safe, secure, and delicious delivery experience.
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
