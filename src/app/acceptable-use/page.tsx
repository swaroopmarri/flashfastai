import Link from "next/link";

export const metadata = { title: "Acceptable Use Policy — Campaign Monster" };

export default function AcceptableUsePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to Campaign Monster
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-semibold text-gray-900">Acceptable Use Policy</h1>
      <p className="mb-10 text-sm text-gray-500">
        Campaign Monster is committed to responsible, permission-based email communication.
      </p>

      <div className="space-y-8 text-gray-700">
        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Permission-based email</h2>
          <p>
            Customers may only send email to recipients for whom they have obtained appropriate
            permission or have another lawful basis to communicate. Customers are responsible for
            maintaining appropriate records supporting their right to communicate with their
            recipients.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Prohibited mailing lists</h2>
          <p>Campaign Monster prohibits the use of:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Purchased email lists</li>
            <li>Rented email lists</li>
            <li>Scraped email addresses</li>
            <li>Harvested email addresses</li>
            <li>Automatically collected email addresses without appropriate permission</li>
            <li>Lists obtained from unauthorized third parties</li>
            <li>Lists containing recipients who have previously opted out</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Spam and unsolicited email</h2>
          <p>
            Campaign Monster may not be used to send unsolicited bulk email, spam, phishing
            messages, deceptive communications, or other unwanted commercial messages.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Unsubscribe requirements</h2>
          <p>
            Marketing emails must provide recipients with a clear and functional mechanism to
            unsubscribe. Customers must honor recipient unsubscribe requests and must not attempt
            to circumvent suppression mechanisms.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Bounce and complaint management</h2>
          <p>
            Customers are expected to maintain healthy mailing lists and monitor delivery
            performance, including bounces, complaints, and unsubscribe activity. Campaign Monster
            may restrict sending activity when campaigns create excessive delivery, complaint,
            abuse, or reputation risks.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Account suspension</h2>
          <p>
            Campaign Monster reserves the right to investigate, restrict, suspend, or terminate
            accounts or campaigns that violate this policy or create unacceptable abuse,
            deliverability, or reputation risks.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Customer responsibility</h2>
          <p>Customers are responsible for:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>Their recipient lists</li>
            <li>The source of their email addresses</li>
            <li>Obtaining appropriate permission or maintaining another lawful basis for communication</li>
            <li>Campaign content</li>
            <li>Unsubscribe compliance</li>
            <li>Applicable privacy and anti-spam laws</li>
            <li>Maintaining appropriate records of consent or authorization</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-medium text-gray-900">Reporting a violation</h2>
          <p>
            If you believe an email sent through Campaign Monster violates this policy, please{" "}
            <Link href="/report-abuse" className="text-indigo-600 hover:underline">
              report it to us
            </Link>
            .
          </p>
        </section>
      </div>

      <p className="mt-12 text-xs text-gray-400">
        This policy works alongside our{" "}
        <Link href="/terms" className="text-indigo-600 hover:underline">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-indigo-600 hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}
