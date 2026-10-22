import React, { useState, useCallback } from "react";
import { FileText } from "lucide-react";
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

/*
  Visual language shared with the login / registration screen:
  square corners, 2-3px charcoal (#282828) outlines, hard offset shadows,
  brand yellow (#FFD527) and brand orange (#F76043). Text on orange is charcoal for contrast.
*/
const headingClass =
  "mb-2 text-base font-extrabold uppercase tracking-tight text-[#282828]";
const listClass =
  "space-y-1.5 pl-5 [list-style-type:square] marker:text-[#282828]";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-l-4 border-[#F76043] pl-4">
      <h3 className={headingClass}>{title}</h3>
      {children}
    </section>
  );
}

export function TermsConditions({ isOpen, onAccept, onDecline }: TermsConditionsProps) {
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  // Presentation only: reading-progress bar under the header
  const [progress, setProgress] = useState(0);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    // Check if user has scrolled to within 50px of the bottom
    if (scrollTop + clientHeight >= scrollHeight - 50) {
      setHasScrolledToEnd(true);
    }
    const scrollable = scrollHeight - clientHeight;
    setProgress(scrollable > 0 ? Math.min(100, Math.round((scrollTop / scrollable) * 100)) : 100);
  };

  // Safety net: if the text is short enough that it can never scroll (very tall screens),
  // treat it as already read so the checkbox can't stay disabled forever.
  const bodyRef = useCallback((node: HTMLDivElement | null) => {
    if (node && node.clientHeight > 0 && node.scrollHeight <= node.clientHeight + 50) {
      setHasScrolledToEnd(true);
    }
  }, []);

  const handleAccept = () => {
    if (hasAgreed && hasScrolledToEnd) {
      onAccept();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      {/* The built-in corner "X" did nothing here (the dialog only closes via Decline / Accept),
          so it is hidden with [&>button]:hidden rather than left as a dead control. */}
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-none border-[3px] border-[#282828] bg-white p-0 shadow-[8px_8px_0_0_#282828] sm:rounded-none [&>button]:hidden">
        <DialogHeader className="space-y-0 border-b-[3px] border-[#282828] bg-[#FFD527] px-5 py-4 text-left sm:px-8 sm:py-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center border-2 border-[#282828] bg-white shadow-[3px_3px_0_0_#282828]">
              <FileText className="h-5 w-5 text-[#282828]" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="text-lg font-extrabold uppercase leading-tight tracking-tight text-[#282828] sm:text-xl">
                Reina Pabili Services – Terms & Conditions
              </DialogTitle>
              <DialogDescription className="text-sm font-semibold text-[#282828]">
                Please read and accept our terms and conditions to continue using our service
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Reading progress */}
        <div className="h-1.5 w-full shrink-0 bg-[#282828]/15" aria-hidden="true">
          <div
            className="h-full bg-[#F76043] transition-[width] motion-reduce:transition-none"
            style={{ width: `${hasScrolledToEnd ? 100 : progress}%` }}
          />
        </div>

        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#282828] sm:px-8"
          onScroll={handleScroll}
          tabIndex={0}
          role="region"
          aria-label="Terms and Conditions text"
        >
          <div className="space-y-6 text-sm leading-relaxed text-gray-800">
            <div className="grid gap-2 border-2 border-[#282828] bg-[#FFD527]/25 p-4 text-[#282828] sm:grid-cols-2">
              <p><strong>Effective Date:</strong> August 1, 2025</p>
              <p><strong>Last Updated:</strong> August 1, 2025</p>
            </div>

            <div className="space-y-4">
              <p>
                Welcome to Reina Pabili Services, your local delivery platform serving the communities of Real, Infanta, and General Nakar in Quezon Province. By accessing or using our mobile and web applications, you agree to comply with and be bound by the following Terms and Conditions.
              </p>
              <p className="font-bold text-[#282828]">Please read them carefully.</p>
            </div>

            <Separator className="bg-[#282828]/20" />

            <div className="space-y-7">
              <Section title="1. Acceptance of Terms">
                <p>
                  By creating an account, browsing, placing an order, or using any part of the Reina Pabili platform, you confirm that you have read, understood, and agreed to these Terms and Conditions.
                </p>
                <p className="mt-2 font-bold text-[#282828]">
                  If you do not agree to any of these terms, you may not access or use the app.
                </p>
              </Section>

              <Section title="2. User Responsibilities">
                <ul className={listClass}>
                  <li>You agree to provide accurate, complete, and updated information during account registration and usage.</li>
                  <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
                  <li>You agree not to use the app for any unlawful or unauthorized purposes, including fraud, abuse, or misrepresentation.</li>
                  <li>You must be at least 18 years old to register. If under 18, parental or guardian consent is required.</li>
                </ul>
              </Section>

              <Section title="3. Service Scope">
                <ul className={listClass}>
                  <li>Reina Pabili Services acts as a facilitator between customers, local vendors (restaurants/stores), and riders.</li>
                  <li>We do not produce, prepare, or own the items listed for delivery.</li>
                  <li>We are not liable for the quality, packaging, or safety of goods sold by third-party vendors.</li>
                </ul>
              </Section>

              <Section title="4. Orders and Cancellations">
                <ul className={listClass}>
                  <li>Customers may cancel an order within a limited time frame, visible in the order tracking section.</li>
                  <li>Orders that have already been accepted by a rider or prepared by a vendor may no longer be canceled, or may incur a cancellation fee.</li>
                  <li>Reina Pabili reserves the right to cancel or refuse any order due to suspected fraud, unavailability, or system errors.</li>
                  <li>Refunds, if applicable, will follow the terms outlined in the Refund Policy.</li>
                </ul>
              </Section>

              <Section title="5. Delivery Policy">
                <ul className={listClass}>
                  <li>Delivery times are estimated and may vary due to weather, traffic, vendor delays, or rider availability.</li>
                  <li>Customers must ensure availability at the provided delivery location and respond to the rider's communication attempts.</li>
                  <li>Failure to receive an order may result in loss of payment and account warnings.</li>
                </ul>
              </Section>

              <Section title="6. Payments">
                <ul className={listClass}>
                  <li>Payments can be made via Cash on Delivery and Gcash</li>
                  <li>All payments are final unless an error or cancellation is confirmed and validated.</li>
                </ul>
              </Section>

              <Section title="7. Data Privacy">
                <ul className={listClass}>
                  <li>We collect personal data such as your name, contact number, address, and order history to fulfill our services.</li>
                  <li>Data is stored securely and only shared with parties essential for delivery, such as riders and vendors.</li>
                  <li>By using this app, you consent to our data practices as described in the Privacy Policy.</li>
                </ul>
              </Section>

              <Section title="8. Rider & Vendor Requirements">
                <ul className={listClass}>
                  <li>Vendors must provide valid business permits to be listed on the platform.</li>
                  <li>Both parties agree to maintain professional conduct at all times.</li>
                </ul>
              </Section>

              <Section title="9. Account Termination">
                <p>We reserve the right to suspend or terminate accounts that:</p>
                <ul className={`${listClass} mt-2`}>
                  <li>Violate these Terms</li>
                  <li>Provide false or misleading information</li>
                  <li>Abuse the service (e.g., fraudulent orders, verbal abuse of riders/vendors)</li>
                  <li>Breach applicable laws or community guidelines</li>
                </ul>
              </Section>

              <Section title="10. Intellectual Property">
                <p>
                  All content on the app, including logos, graphics, designs, and system functionalities, are the property of Reina Pabili Services or its licensors and are protected by applicable copyright and trademark laws.
                </p>
                <p className="mt-2">
                  You may not reuse or redistribute any part of the app without prior written permission.
                </p>
              </Section>

              <Section title="11. Limitation of Liability">
                <p>Reina Pabili is not liable for:</p>
                <ul className={`${listClass} mt-2`}>
                  <li>Delays in delivery due to force majeure (e.g., typhoons, road closures)</li>
                  <li>Food-related health issues (e.g., allergies)</li>
                  <li>Inaccurate item descriptions from vendors</li>
                  <li>Unauthorized access to your account due to your own negligence</li>
                </ul>
                <p className="mt-2 font-bold text-[#282828]">Use of the platform is at your own risk.</p>
              </Section>

              <Section title="12. Changes to the Terms">
                <ul className={listClass}>
                  <li>We may update these Terms from time to time. Users will be notified through the app or email.</li>
                  <li>Your continued use of the platform after updates constitutes acceptance of the revised Terms.</li>
                </ul>
              </Section>

              <Section title="13. Contact Us">
                <p>If you have questions, feedback, or complaints, please contact us through:</p>
                <div className="mt-2 space-y-1">
                  <p><strong>📧 Email:</strong> reinapabili@gmail.com</p>
                  <p><strong>📱 Mobile:</strong> 09467102726</p>
                  <p><strong>📍 Facebook Page:</strong> REINA Pabili Services</p>
                </div>
              </Section>

              <Separator className="bg-[#282828]/20" />

              <div className="border-2 border-[#282828] bg-[#FFD527] p-4 shadow-[4px_4px_0_0_#282828]">
                <p className="text-center font-bold text-[#282828]">
                  ✅ By clicking "Agree" or continuing to use the app, you acknowledge that you have read and accepted the Reina Pabili Services Terms & Conditions.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-4 border-t-[3px] border-[#282828] bg-white px-5 py-4 sm:flex-col sm:justify-start sm:space-x-0 sm:px-8">
          <div className="flex items-start gap-3">
            <Checkbox
              id="agree-terms"
              checked={hasAgreed}
              onCheckedChange={(checked) => setHasAgreed(checked as boolean)}
              disabled={!hasScrolledToEnd}
              className="mt-0.5 h-6 w-6 shrink-0 rounded-none border-2 border-[#282828] data-[state=checked]:bg-[#F76043] data-[state=checked]:text-[#282828] focus-visible:ring-[#282828]"
            />
            <label
              htmlFor="agree-terms"
              className={`text-sm font-semibold ${!hasScrolledToEnd ? "text-gray-600" : "cursor-pointer text-[#282828]"}`}
            >
              I have read and agree to the Terms and Conditions
              {!hasScrolledToEnd && " (Please scroll to the bottom first)"}
            </label>
          </div>

          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={onDecline}
              className="h-12 rounded-none border-2 border-[#282828] bg-white px-6 text-base font-bold text-[#282828] hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2"
            >
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              disabled={!hasAgreed || !hasScrolledToEnd}
              className="h-12 rounded-none border-2 border-[#282828] bg-[#F76043] px-6 text-base font-bold text-[#282828] shadow-[4px_4px_0_0_#282828] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#FF7154] hover:shadow-[2px_2px_0_0_#282828] active:translate-x-1 active:translate-y-1 active:shadow-none focus-visible:ring-2 focus-visible:ring-[#282828] focus-visible:ring-offset-2 disabled:translate-x-0 disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none motion-reduce:transition-none"
            >
              Accept and Continue
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}