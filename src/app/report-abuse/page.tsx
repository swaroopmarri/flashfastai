import Link from "next/link";
import { ReportAbuseForm } from "./ReportAbuseForm";

export const metadata = { title: "Report Abuse — Campaign Monster" };

export default function ReportAbusePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← Back to Campaign Monster
      </Link>

      <h1 className="mb-2 mt-6 text-3xl font-semibold text-gray-900">Report Abuse</h1>
      <p className="mb-8 text-sm text-gray-600">
        If you believe an email sent through Campaign Monster violates our{" "}
        <Link href="/acceptable-use" className="text-indigo-600 hover:underline">
          Acceptable Use Policy
        </Link>{" "}
        or was sent without appropriate authorization, please report it to us. Our team reviews
        abuse reports and may investigate the associated account or campaign.
      </p>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <ReportAbuseForm />
      </div>
    </div>
  );
}
