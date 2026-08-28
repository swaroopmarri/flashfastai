import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WHATSAPP_HREF } from "@/lib/whatsapp";
import { PRICING_PLANS } from "@/lib/pricingPlans";
import { NetworkIllustration } from "./_components/NetworkIllustration";

const FEATURES = [
  {
    title: "Verification included",
    emoji: "✅",
    accent: "bg-indigo-100 text-indigo-700",
    description:
      "Every contact list is checked against ZeroBounce before you send, so you're not paying to email addresses that will just bounce.",
  },
  {
    title: "Upload any way",
    emoji: "📤",
    accent: "bg-sky-100 text-sky-700",
    description:
      "CSV, Excel, or just paste a list — Campaign Monster finds the email column automatically, no template to match.",
  },
  {
    title: "My Network",
    emoji: "🌐",
    accent: "bg-amber-100 text-amber-700",
    description:
      "Every contact across every list, grouped by company and deduplicated by email, so you always know who's verified and who isn't.",
  },
  {
    title: "Built-in compliance",
    emoji: "🛡️",
    accent: "bg-emerald-100 text-emerald-700",
    description:
      "Every campaign includes a working unsubscribe link, honored automatically and permanently — no re-uploading a suppressed contact by accident.",
  },
];

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-semibold text-gray-900">Campaign Monster</span>
          <nav className="hidden items-center gap-6 text-sm text-gray-600 sm:flex">
            <a href="#features" className="hover:text-gray-900">
              Features
            </a>
            <a href="#pricing" className="hover:text-gray-900">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log In
            </Link>
            <Link
              href="/login"
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-br from-indigo-50 via-white to-sky-50">
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 px-4 py-16 sm:py-20 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-semibold tracking-tight text-gray-900 sm:text-5xl">
                Upload, verify, and send email campaigns — all in one place.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600 lg:mx-0">
                Campaign Monster takes a raw contact list and turns it into a clean,
                deliverable email campaign: real-time verification, one-click
                sending, and automatic compliance — no separate tools required.
              </p>
              <div className="mt-8">
                <Link
                  href="/login"
                  className="inline-block rounded-md bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-500"
                >
                  Get Started Free
                </Link>
              </div>
            </div>

            <div className="mx-auto aspect-[380/260] w-full max-w-md overflow-hidden rounded-2xl shadow-lg">
              <NetworkIllustration />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full text-lg ${f.accent}`}
                >
                  {f.emoji}
                </div>
                <h3 className="mb-2 font-medium text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-600">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-gradient-to-b from-white to-indigo-50/60 py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-2 text-center text-2xl font-semibold text-gray-900">
              Simple, predictable pricing
            </h2>
            <p className="mb-10 text-center text-sm text-gray-500">
              Every plan includes email verification, unlimited campaigns, My
              Network, and automatic unsubscribe handling.
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PRICING_PLANS.map((plan) => {
                const isPopular = plan.id === "pro";
                return (
                  <div
                    key={plan.id}
                    className={`relative overflow-hidden rounded-lg border bg-white text-center shadow-sm ${
                      isPopular ? "border-indigo-400 ring-2 ring-indigo-200" : "border-gray-200"
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                        Most popular
                      </span>
                    )}
                    <div
                      className={`px-6 py-6 text-white ${
                        isPopular
                          ? "bg-gradient-to-r from-indigo-600 to-sky-500"
                          : "bg-gradient-to-r from-gray-700 to-gray-500"
                      }`}
                    >
                      <p className="text-sm font-medium uppercase tracking-wide opacity-90">
                        {plan.name}
                      </p>
                      <p className="mt-1 text-3xl font-semibold">
                        ₹{plan.priceInr.toLocaleString("en-IN")}
                        <span className="text-sm font-normal opacity-80">/mo</span>
                      </p>
                      <p className="mt-1 text-xs opacity-90">
                        Up to {plan.contacts.toLocaleString("en-IN")} contacts
                      </p>
                    </div>

                    <div className="p-6">
                      <ul className="space-y-1.5 text-left text-xs text-gray-700">
                        <li>✓ Verification included</li>
                        <li>✓ Unlimited campaigns</li>
                        <li>✓ My Network</li>
                        <li>✓ Suppression handling</li>
                      </ul>

                      <Link
                        href="/login"
                        className="mt-6 block rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                      >
                        Get Started
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-8 text-center text-xs text-gray-400">
              Most competitors charge more, and bill email verification as a
              separate add-on. Here, it&apos;s already included in every plan.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div>
              <p className="font-medium text-gray-900">Campaign Monster</p>
              <p className="mt-1 text-sm text-gray-500">[ADDRESS]</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Contact</p>
              <p className="mt-1 text-sm text-gray-500">swaroop.indus@gmail.com</p>
              <p className="text-sm text-gray-500">+1 410-670-0167</p>
              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:underline"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-green-700" aria-hidden="true">
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.94 1.38-.5.08-1.12.11-1.81-.11-.42-.13-.95-.31-1.64-.6-2.88-1.24-4.76-4.14-4.9-4.33-.15-.19-1.17-1.56-1.17-2.98s.75-2.11 1.01-2.4c.27-.28.58-.35.78-.35.19 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2 .89 2.15.07.15.11.32.02.51-.09.19-.14.31-.27.48-.14.17-.29.38-.41.51-.14.14-.28.29-.12.57.15.28.68 1.13 1.47 1.83 1.01.9 1.86 1.19 2.14 1.32.28.14.44.11.61-.07.16-.17.7-.82.89-1.1.19-.28.38-.23.63-.14.26.09 1.65.78 1.93.92.28.14.47.21.53.33.07.12.07.68-.16 1.37Z" />
                </svg>
                Chat on WhatsApp
              </a>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Legal</p>
              <div className="mt-1 flex flex-col gap-1">
                <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-900">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-900">
                  Privacy Policy
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-8 border-t border-gray-100 pt-6 text-xs text-gray-400">
            © {new Date().getFullYear()} Campaign Monster. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
