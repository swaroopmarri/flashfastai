import Link from "next/link";

export const metadata = { title: "Terms of Service — Campaign Monster" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to Campaign Monster
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-semibold text-gray-900">Terms of Service</h1>
      <p className="mb-10 text-sm text-gray-400">Last updated: [DATE]</p>

      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">1. Acceptance of these Terms</h2>
          <p>
            Campaign Monster (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;,
            &quot;our&quot;) is operated by Campaign Monster ([ADDRESS]). By checking the
            acceptance box at signup, creating an account, or otherwise accessing or using the
            Service, you agree to be bound by these Terms of Service and our Privacy Policy in
            full. If you don&apos;t agree, don&apos;t create an account or use the Service. If
            you are accepting on behalf of an organization, you represent that you have the
            authority to bind that organization to these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            2. Your account and organization
          </h2>
          <p>
            You&apos;re responsible for keeping your login credentials confidential and for all
            activity that occurs under your account, whether or not you authorized it. If you
            invite other members to your organization, you&apos;re solely responsible for their
            conduct, quota usage, and every campaign sent under your organization, and you agree
            to ensure they comply with these Terms. We are not liable for any loss arising from
            unauthorized access to your account that results from your failure to safeguard your
            credentials.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            3. You are solely responsible for your contact lists
          </h2>
          <p>
            <strong>
              You are solely and entirely responsible for having a lawful basis and appropriate
              consent to email every contact you upload, and for compliance with every law that
              applies to those contacts, including CAN-SPAM, India&apos;s IT Act and rules on
              unsolicited commercial email, GDPR, and any equivalent regulation in any
              jurisdiction where your recipients are located.
            </strong>{" "}
            The Service does not verify, and has no way to verify, how or where you obtained a
            contact list, or whether the people on it consented to receive email from you. We
            take no responsibility for the legality, accuracy, or source of any list you upload.
          </p>
          <p className="mt-2">
            You agree not to upload or email contacts you don&apos;t have permission to contact,
            purchased or scraped lists, or any list assembled in violation of applicable law. We
            may suspend or terminate your account immediately and without notice if we suspect
            your use of the Service violates this section, generates spam complaints, produces
            abnormal bounce rates, or otherwise creates risk to our relationship with our email or
            verification providers, and we are not liable to you for any resulting loss.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">4. Verification and sending</h2>
          <p>
            Email verification is performed by a third-party provider (currently
            MillionVerifier); campaign sending is performed by a third-party provider (currently
            Amazon SES). Verification results (deliverable, risky, undeliverable) are
            probabilistic estimates only.{" "}
            <strong>
              We make no guarantee, express or implied, that a &quot;deliverable&quot; result
              means an email will reach an inbox, that a campaign will send successfully, or that
              any verification or sending provider will be available at any given time.
            </strong>{" "}
            We are not responsible for outages, rate limits, account suspensions, or errors
            originating from MillionVerifier, Amazon SES, Razorpay, or any other third-party
            provider the Service relies on, and any interruption to the Service caused by such a
            provider is not a breach of these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            5. Unsubscribes and suppression
          </h2>
          <p>
            Every campaign email includes an unsubscribe link. Once someone unsubscribes, we
            suppress that address from every future campaign you send, across every list it
            appears on, and it stays suppressed even if you re-upload it later. You agree not to
            attempt to circumvent this suppression or re-contact anyone who has unsubscribed or
            reported a message as spam; doing so is grounds for immediate termination.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            6. Fees, billing, and prepayment
          </h2>
          <p>
            Paid plans include a fixed monthly allowance of verifications and sends, shared
            across your organization. Monthly plans are billed in advance and renew
            automatically each cycle; 6-month and 12-month plans are billed in advance for the
            full prepaid term and also renew automatically at that same cadence unless cancelled
            before the renewal date.
          </p>
          <p className="mt-2">
            <strong>
              All fees, including prepaid 6-month and 12-month terms, are non-refundable once
              charged, in whole or in part, regardless of how much of your allowance you use,
              except where a refund is required by law.
            </strong>{" "}
            Cancelling stops future renewal charges but does not refund the current billing
            period or any prepaid term already paid. Unused allowance does not carry over between
            billing periods and is forfeited on renewal, downgrade, or cancellation. We may
            change prices or plan allowances at any time by posting updated pricing on the
            Service; continuing to use the Service, or renewing a subscription, after a price
            change takes effect constitutes your acceptance of the new price.
          </p>
          <p className="mt-2">
            If a payment fails and is not successfully retried, we may immediately suspend your
            organization&apos;s validation and sending allowance until payment is resolved,
            without further notice, and without liability to us for any resulting disruption to
            your campaigns.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            7. Suspension and termination
          </h2>
          <p>
            We may suspend or terminate your account or access to the Service at any time, with
            or without cause and with or without notice, including for suspected violation of
            these Terms, non-payment, suspected fraud or abuse, or if we discontinue the Service.
            Termination does not entitle you to a refund of any fees already paid. Sections 3, 6,
            8, 9, 10, and 11 survive termination of these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            8. Disclaimer of warranties
          </h2>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE,&quot; WITHOUT
            WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING ANY IMPLIED
            WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
            WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE, OR
            THAT ANY VERIFICATION RESULT OR CAMPAIGN OUTCOME WILL MEET YOUR EXPECTATIONS.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">9. Limitation of liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR OFFICERS, EMPLOYEES, AND SERVICE
            PROVIDERS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
            PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR BUSINESS OPPORTUNITY,
            ARISING OUT OF OR RELATING TO YOUR USE OF THE SERVICE, EVEN IF WE HAVE BEEN ADVISED OF
            THE POSSIBILITY OF SUCH DAMAGES. OUR TOTAL AGGREGATE LIABILITY TO YOU FOR ANY CLAIM
            ARISING OUT OF OR RELATING TO THE SERVICE OR THESE TERMS WILL NOT EXCEED THE AMOUNT
            YOU ACTUALLY PAID US IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING
            RISE TO THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">10. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Campaign Monster and its officers
            and employees from any claim, demand, loss, liability, or expense (including
            reasonable legal fees) arising out of or related to: (a) the contact lists you upload
            or the contacts you email; (b) your violation of any law, including anti-spam or data
            protection law; (c) your violation of these Terms; or (d) content you send through the
            Service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            11. Governing law and disputes
          </h2>
          <p>
            These Terms are governed by the laws of India, without regard to conflict-of-law
            principles. Any dispute arising out of or relating to these Terms or the Service will
            be subject to the exclusive jurisdiction of the courts of [CITY], India, and you
            consent to that jurisdiction and waive any objection to venue there.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">12. Intellectual property</h2>
          <p>
            We own all right, title, and interest in the Service, including its software, design,
            and branding. You retain ownership of the contact data and campaign content you
            upload, and grant us a limited license to process it solely to provide the Service to
            you. Nothing in these Terms transfers any of our intellectual property to you.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">13. Changes to these Terms</h2>
          <p>
            We may update these Terms at any time by posting the revised version on the Service.
            The &quot;Last updated&quot; date above reflects the most recent revision. Continuing
            to use the Service after a revised version is posted constitutes your acceptance of
            it, whether or not you received a separate notice.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">14. General</h2>
          <p>
            If any provision of these Terms is found unenforceable, the remaining provisions stay
            in full effect. These Terms, together with the Privacy Policy, are the entire
            agreement between you and us regarding the Service and supersede any prior agreement
            on the subject. Our failure to enforce any provision is not a waiver of it.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">15. Contact</h2>
          <p>
            Questions about these Terms: swaroop.indus@gmail.com · +1 410-670-0167 · [ADDRESS].
          </p>
        </section>
      </div>

      <p className="mt-12 rounded-md bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
        This is a working draft written for how Campaign Monster actually functions today, drafted
        to favor the company on the points that most commonly generate disputes (refunds,
        liability, third-party outages, account termination). Replace the bracketed placeholders
        and have it reviewed by a lawyer familiar with your jurisdiction before relying on it as
        your actual Terms of Service.
      </p>
    </div>
  );
}
