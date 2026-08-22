import Link from "next/link";

export const metadata = { title: "Terms of Service — fastflash" };

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to fastflash
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-semibold text-gray-900">Terms of Service</h1>
      <p className="mb-10 text-sm text-gray-400">Last updated: [DATE]</p>

      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">1. What fastflash is</h2>
          <p>
            fastflash (&quot;the Service&quot;, &quot;we&quot;, &quot;us&quot;) is operated by
            fastflash ([ADDRESS]). The Service lets you upload contact
            lists, verify email addresses against a third-party verification
            provider, and send email marketing campaigns to your own
            contacts. By creating an account or using the Service, you agree
            to these Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            2. Your account and organization
          </h2>
          <p>
            You&apos;re responsible for keeping your login credentials
            confidential and for all activity that happens under your
            account. If you invite other members to your organization,
            you&apos;re responsible for what they do with the access you
            grant them, including quota usage and campaigns they send.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            3. You are responsible for your contact lists
          </h2>
          <p>
            This is the most important section for anyone sending email
            through fastflash: <strong>you are solely responsible for
            having a lawful basis and appropriate consent to email every
            contact you upload.</strong> The Service does not verify, and
            has no way to verify, how or where you obtained a contact list,
            or whether the people on it agreed to receive email from you.
          </p>
          <p className="mt-2">
            You agree not to upload or email contacts you don&apos;t have
            permission to contact, purchased or scraped lists you have no
            relationship with, or any list assembled in violation of
            anti-spam law (including CAN-SPAM, India&apos;s IT Act rules on
            unsolicited commercial email, GDPR, or equivalent regulations
            that apply to your recipients). We reserve the right to suspend
            or terminate accounts that generate spam complaints, high bounce
            rates, or abuse reports, and to cooperate with our email and
            verification providers&apos; own anti-abuse requirements, which
            we are contractually bound to follow.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            4. Verification and sending
          </h2>
          <p>
            Email verification is performed by a third-party provider
            (currently ZeroBounce) against the addresses you upload.
            Verification results (deliverable, risky, undeliverable) are
            estimates based on that provider&apos;s data and methodology —
            we don&apos;t guarantee a &quot;deliverable&quot; result means an
            email will actually reach an inbox, or that a message won&apos;t
            still bounce or be filtered as spam. Campaign email is sent
            through a third-party sending provider (currently Amazon SES) on
            your behalf, using the subject, body, and sender details you
            provide.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            5. Unsubscribes and suppression
          </h2>
          <p>
            Every campaign email includes an unsubscribe link. Once someone
            unsubscribes, we suppress that address from every future
            campaign you send, across every list it appears on, and it stays
            suppressed even if you re-upload it later. You agree not to
            attempt to work around this suppression or re-contact someone
            who has unsubscribed or reported a message as spam.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            6. Plans, billing, and quotas
          </h2>
          <p>
            Paid plans are billed monthly in advance and include a fixed
            monthly quota of verifications and sends, shared across your
            organization&apos;s members. Quotas reset on your monthly billing
            date; unused quota does not roll over. Prices and quota limits
            are as described on our pricing page at the time you subscribe,
            and we&apos;ll give reasonable notice before any price change
            takes effect for existing subscriptions.
          </p>
          <p className="mt-2">
            You can cancel at any time; cancellation takes effect at the end
            of your current billing period, and we don&apos;t charge for
            subsequent periods after that. We generally don&apos;t provide
            refunds for partial months already paid for, except where
            required by law or at our discretion for a genuine service
            failure on our part — contact us at swaroop.indus@gmail.com and we&apos;ll look
            at it case by case.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            7. Service &quot;as is&quot;
          </h2>
          <p>
            The Service is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. We don&apos;t guarantee uninterrupted
            availability, and we&apos;re not liable for indirect or
            consequential damages arising from your use of the Service,
            including lost business from a campaign that didn&apos;t send,
            a verification result that turned out to be wrong, or an account
            suspended for policy violations.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">8. Changes to these Terms</h2>
          <p>
            We may update these Terms from time to time. If we make a
            material change, we&apos;ll make a reasonable effort to notify
            you (e.g. by email or an in-app notice) before it takes effect.
            Continuing to use the Service after a change takes effect means
            you accept the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">9. Contact</h2>
          <p>
            Questions about these Terms: swaroop.indus@gmail.com · +1 410-670-0167 · [ADDRESS].
          </p>
        </section>
      </div>

      <p className="mt-12 rounded-md bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
        This is a working draft written for how fastflash actually
        functions today. Replace the bracketed placeholders and have it
        reviewed by a lawyer familiar with your jurisdiction before relying
        on it as your actual Terms of Service.
      </p>
    </div>
  );
}
