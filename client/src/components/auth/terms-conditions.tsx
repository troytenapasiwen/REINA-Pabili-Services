import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";

interface TermsConditionsProps {
  isOpen: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function TermsConditions({ isOpen, onAccept, onDecline }: TermsConditionsProps) {
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    // Check if user has scrolled to within 50px of the bottom
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAccept = () => {
    if (hasAgreed && hasScrolledToEnd) {
      onAccept();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center">
            Reina Pabili Services – Terms & Conditions
          </DialogTitle>
          <DialogDescription className="text-center">
            Please read and accept our terms and conditions to continue using our service
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex-1 overflow-y-auto max-h-[50vh] pr-4"
          onScroll={handleScroll}
        >
          <div className="space-y-6 text-sm leading-relaxed">
            <div className="text-center text-muted-foreground">
              <p><strong>Effective Date:</strong> August 1, 2025</p>
              <p><strong>Last Updated:</strong> August 1, 2025</p>
            </div>

            <div className="space-y-4">
              <p>
                Welcome to Reina Pabili Services, your local delivery platform serving the communities of Real, Infanta, and General Nakar in Quezon Province. By accessing or using our mobile and web applications, you agree to comply with and be bound by the following Terms and Conditions.
              </p>
              <p className="font-medium">Please read them carefully.</p>
            </div>

            <Separator />

            <div className="space-y-6">
              <section>
                <h3 className="font-semibold text-base mb-2">1. Acceptance of Terms</h3>
                <p>
                  By creating an account, browsing, placing an order, or using any part of the Reina Pabili platform, you confirm that you have read, understood, and agreed to these Terms and Conditions.
                </p>
                <p className="mt-2 font-medium">
                  If you do not agree to any of these terms, you may not access or use the app.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">2. User Responsibilities</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>You agree to provide accurate, complete, and updated information during account registration and usage.</li>
                  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                  <li>You agree not to use the app for any unlawful or unauthorized purposes, including fraud, abuse, or misrepresentation.</li>
                  <li>You must be at least 18 years old to register. If under 18, parental or guardian consent is required.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">3. Service Scope</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Reina Pabili Services acts as a facilitator between customers, local vendors (restaurants/stores), and riders.</li>
                  <li>We do not produce, prepare, or own the items listed for delivery.</li>
                  <li>We are not liable for the quality, packaging, or safety of goods sold by third-party vendors.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">4. Orders and Cancellations</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Customers may cancel an order within a limited time frame, visible in the order tracking section.</li>
                  <li>Orders that have already been accepted by a rider or prepared by a vendor may no longer be canceled, or may incur a cancellation fee.</li>
                  <li>Reina Pabili reserves the right to cancel or refuse any order due to suspected fraud, unavailability, or system errors.</li>
                  <li>Refunds, if applicable, will follow the terms outlined in the Refund Policy.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">5. Delivery Policy</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Delivery times are estimated and may vary due to weather, traffic, vendor delays, or rider availability.</li>
                  <li>Customers must ensure availability at the provided delivery location and respond to the rider's communication attempts.</li>
                  <li>Failure to receive an order may result in loss of payment and account warnings.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">6. Payments</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Payments can be made via Cash on Delivery and Gcash</li>
                  <li>All payments are final unless an error or cancellation is confirmed and validated.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">7. Data Privacy</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>We collect personal data such as your name, contact number, address, and order history to fulfill our services.</li>
                  <li>Data is stored securely and only shared with parties essential for delivery, such as riders and vendors.</li>
                  <li>By using this app, you consent to our data practices as described in the Privacy Policy.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">8. Rider & Vendor Requirements</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Vendors must provide valid business permits to be listed on the platform.</li>
                  <li>Both parties agree to maintain professional conduct at all times.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">9. Account Termination</h3>
                <p>We reserve the right to suspend or terminate accounts that:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Violate these Terms</li>
                  <li>Provide false or misleading information</li>
                  <li>Abuse the service (e.g., fraudulent orders, verbal abuse of riders/vendors)</li>
                  <li>Breach applicable laws or community guidelines</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">10. Intellectual Property</h3>
                <p>
                  All content on the app, including logos, graphics, designs, and system functionalities, are the property of Reina Pabili Services or its licensors and are protected by applicable copyright and trademark laws.
                </p>
                <p className="mt-2">
                  You may not reuse or redistribute any part of the app without prior written permission.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">11. Limitation of Liability</h3>
                <p>Reina Pabili is not liable for:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Delays in delivery due to force majeure (e.g., typhoons, road closures)</li>
                  <li>Food-related health issues (e.g., allergies)</li>
                  <li>Inaccurate item descriptions from vendors</li>
                  <li>Unauthorized access to your account due to your own negligence</li>
                </ul>
                <p className="mt-2 font-medium">Use of the platform is at your own risk.</p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">12. Changes to the Terms</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>We may update these Terms from time to time. Users will be notified through the app or email.</li>
                  <li>Your continued use of the platform after updates constitutes acceptance of the revised Terms.</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">13. Contact Us</h3>
                <p>If you have questions, feedback, or complaints, please contact us through:</p>
                <div className="mt-2 space-y-1">
                  <p><strong>📧 Email:</strong> reinapabili@gmail.com</p>
                  <p><strong>📱 Mobile:</strong> 09467102726</p>
                  <p><strong>📍 Facebook Page:</strong> REINA Pabili Services</p>
                </div>
              </section>

              <Separator />

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-medium text-center">
                  ✅ By clicking "Agree" or continuing to use the app, you acknowledge that you have read and accepted the Reina Pabili Services Terms & Conditions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="agree-terms"
              checked={hasAgreed}
              onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
              disabled={!hasScrolledToEnd}
            />
            <label
              htmlFor="agree-terms"
              className={`text-sm ${!hasScrolledToEnd ? 'text-muted-foreground' : 'cursor-pointer'}`}
            >
              I have read and agree to the Terms and Conditions
              {!hasScrolledToEnd && " (Please scroll to the bottom first)"}
            </label>
          </div>

          <div className="flex justify-end space-x-2 w-full">
            <Button variant="outline" onClick={onDecline}>
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!hasAgreed || !hasScrolledToEnd}
              className="bg-primary hover:bg-primary/90"
            >
              Accept and Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
