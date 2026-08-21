import Link from "next/link";

export const metadata = { title: "Privacy Policy — flashfastai" };

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to flashfastai
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-semibold text-gray-900">Privacy Policy</h1>
      <p className="mb-10 text-sm text-gray-400">Last updated: [DATE]</p>

      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">1. Who this covers</h2>
          <p>
            This policy explains what [BUSINESS_NAME] (&quot;we&quot;,
            &quot;us&quot;) collects when you use flashfastai, and — because
            flashfastai is a tool for emailing your own contacts — it also
            explains what happens to the contact data you upload about other
            people.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            2. What we collect
          </h2>
          <p className="font-medium text-gray-900">About you, the account holder:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Your email address and password (stored securely, hashed — we never see your plaintext password)</li>
            <li>Your organization name and role (admin or member)</li>
            <li>Usage data: how many verifications and sends you&apos;ve used against your monthly quota</li>
          </ul>
          <p className="mt-3 font-medium text-gray-900">
            About the contacts you upload:
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Email address, and optionally name and company, from whatever file or paste you upload</li>
            <li>Verification status and result (deliverable, risky, undeliverable, pending) once checked</li>
            <li>Campaign activity for that address: which campaigns it was sent, whether it unsubscribed, bounced, or was reported as spam</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            3. How we use it
          </h2>
          <p>We use this data only to run the Service for you, specifically to:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Authenticate you and keep your organization&apos;s data separate from every other customer&apos;s</li>
            <li>Send the email addresses you upload to our verification provider (ZeroBounce) to check deliverability</li>
            <li>Send the campaign emails you compose, through our sending provider (Amazon SES), to the recipients you choose</li>
            <li>Enforce unsubscribe requests and suppress those addresses from future sends</li>
            <li>Enforce your plan&apos;s monthly quota</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            4. We do not sell your data
          </h2>
          <p>
            We do not sell, rent, or trade your account data or your
            contacts&apos; data to anyone, for any purpose. We don&apos;t use
            your uploaded contact lists for our own marketing, and we
            don&apos;t share them with other customers. The only outside
            parties who ever see contact data are the service providers
            described below, and only to the extent needed to run the
            feature you used.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            5. Third-party service providers
          </h2>
          <p>We rely on a small number of providers to operate the Service:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li><strong>Supabase</strong> — hosts our database and handles authentication</li>
            <li><strong>ZeroBounce</strong> — receives the email addresses you submit for verification</li>
            <li><strong>Amazon SES</strong> — sends the campaign emails you compose, and reports back bounces/complaints</li>
            <li><strong>Vercel</strong> — hosts the application itself</li>
          </ul>
          <p className="mt-2">
            Each of these providers processes data only as needed to provide
            their service to us, under their own security and privacy
            commitments.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            6. Your responsibility for contacts you upload
          </h2>
          <p>
            If you upload someone else&apos;s email address, you are the
            party responsible for having a lawful basis to hold and email
            that data — we act as a processor of the contact data you
            provide, not as the party who decided to collect it. See our{" "}
            <Link href="/terms" className="text-indigo-600 hover:underline">
              Terms of Service
            </Link>{" "}
            for more on this.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">
            7. Data retention and deletion
          </h2>
          <p>
            We keep account and contact data for as long as your account is
            active. If you delete a contact list, it&apos;s removed from
            your account; unsubscribe records are kept indefinitely even
            after a contact is otherwise deleted, since that&apos;s what
            prevents that address from being emailed again by mistake. If
            you close your account, contact us at swaroop.indus@gmail.com and we&apos;ll
            delete your account data within a reasonable period, except
            where we&apos;re required to retain something (e.g. billing
            records) for legal or accounting reasons.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">8. Security</h2>
          <p>
            Access to your data is protected by row-level security at the
            database layer, meaning your organization&apos;s contacts and
            campaigns are only ever queryable by your own account and
            members you&apos;ve invited. Passwords are hashed, not stored in
            plaintext. No system is perfectly secure, and we can&apos;t
            guarantee absolute security, but we take reasonable, standard
            precautions to protect your data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">9. Your choices</h2>
          <p>
            You can access, export, or delete your contact lists at any time
            from within the app. You can request a copy of your account
            data, or ask us to delete it, by writing to swaroop.indus@gmail.com.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">10. Changes to this policy</h2>
          <p>
            If we make a material change to how we handle your data,
            we&apos;ll make a reasonable effort to notify you before it
            takes effect.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">11. Contact</h2>
          <p>Questions about this policy: swaroop.indus@gmail.com · +1 410-670-0167 · [ADDRESS].</p>
        </section>
      </div>

      <p className="mt-12 rounded-md bg-yellow-50 px-4 py-3 text-xs text-yellow-800">
        This is a working draft written for how flashfastai actually
        functions today. Replace the bracketed placeholders and have it
        reviewed by a lawyer familiar with your jurisdiction (and any data
        protection law your recipients fall under) before relying on it as
        your actual Privacy Policy.
      </p>
    </div>
  );
}
