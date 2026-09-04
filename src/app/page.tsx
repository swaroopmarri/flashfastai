import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WHATSAPP_HREF } from "@/lib/whatsapp";
import { NetworkIllustration } from "./_components/NetworkIllustration";
import { PricingCards } from "./_components/PricingCards";

const FEATURES = [
  {
    title: "Verification included",
    emoji: "✅",
    accent: "bg-indigo-100 text-indigo-700",
    description:
      "Every contact list is checked against MillionVerifier before you send, so you're not paying to email addresses that will just bounce.",
  },
  {
    title: "Import your lists",
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
    title: "Automatic suppression",
    emoji: "🛡️",
    accent: "bg-emerald-100 text-emerald-700",
    description:
      "Every campaign includes a working unsubscribe link, honored automatically and permanently — no re-uploading a suppressed contact by accident.",
  },
];

const PERMISSION_CARDS = [
  {
    title: "Verified contacts",
    description:
      "Verify email addresses before sending campaigns to help reduce invalid recipients and improve list quality.",
  },
  {
    title: "Easy unsubscribe",
    description: "Give recipients a clear way to unsubscribe from marketing communications.",
  },
  {
    title: "Suppression protection",
    description:
      "Unsubscribed and suppressed recipients aren't targeted by that account's future marketing campaigns.",
  },
  {
    title: "Responsible sending",
    description:
      "Customers are responsible for ensuring their campaigns comply with applicable email marketing, privacy, and anti-spam requirements.",
  },
];

const DELIVERABILITY_CARDS = [
  {
    title: "List verification",
    description: "Identify potentially invalid addresses before sending.",
  },
  {
    title: "Bounce handling",
    description:
      "Delivery failures reported by our sending provider are recorded against the contact automatically.",
  },
  {
    title: "Unsubscribe management",
    description: "Respect recipient opt-out requests with a working link on every campaign.",
  },
  {
    title: "Suppression",
    description: "Prevent previously suppressed recipients from being targeted again by your account.",
  },
  {
    title: "Domain authentication",
    description:
      "Campaigns are sent from a domain authenticated with SPF, DKIM, and DMARC to support reliable delivery.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Can I upload purchased email lists?",
    answer:
      "No. Campaign Monster does not permit purchased, rented, scraped, harvested, or otherwise unauthorized email lists — see our Acceptable Use Policy.",
  },
  {
    question: "Can I send cold emails?",
    answer:
      "Campaign Monster is designed for permission-based email marketing. Customers are responsible for ensuring they have appropriate permission or another lawful basis to communicate with their recipients.",
  },
  {
    question: "Does Campaign Monster support unsubscribe?",
    answer:
      "Yes. Every campaign includes a working unsubscribe link, and unsubscribing suppresses that address from future campaigns sent by that account.",
  },
  {
    question: "What happens when someone unsubscribes?",
    answer:
      "The address is added to your account's suppression list and is automatically excluded from every campaign you send afterward, even if it's re-uploaded later.",
  },
  {
    question: "Can I send to my whole list at once?",
    answer:
      "Each plan includes a monthly contact allowance (3,500 up to 45,000+, depending on plan) covering both verification and sending. Need more? Contact us to discuss a larger allowance.",
  },
  {
    question: "Does Campaign Monster verify email addresses?",
    answer:
      "Yes — every contact is checked by a third-party verification provider before it's eligible to receive a campaign, to help identify invalid or potentially undeliverable addresses. This reduces avoidable bounces; it doesn't guarantee inbox placement.",
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
          <span className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <Image src="/logo-icon.png" alt="" width={28} height={28} className="rounded-md" />
            Campaign Monster
          </span>
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
                Import, verify, and send permission-based email campaigns — all in one place.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600 lg:mx-0">
                Campaign Monster turns your customer and subscriber list into a clean,
                deliverable email campaign: real-time verification, one-click
                sending, and automatic unsubscribe handling — no separate tools required.
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

        {/* Permission-based sending */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="mb-3 text-center text-2xl font-semibold text-gray-900">
              Built for Permission-Based Email Marketing
            </h2>
            <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-gray-600">
              Campaign Monster is designed for businesses that send email to customers,
              subscribers, and contacts who have provided appropriate permission or for whom the
              sender has another lawful basis to communicate. We do not support spam, unsolicited
              bulk email, purchased or scraped mailing lists, or attempts to bypass recipient
              opt-out preferences.
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {PERMISSION_CARDS.map((c) => (
                <div key={c.title} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-2 font-medium text-gray-900">{c.title}</h3>
                  <p className="text-sm text-gray-600">{c.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Deliverability */}
        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">
            Protect Your Sender Reputation
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {DELIVERABILITY_CARDS.map((c) => (
              <div key={c.title} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-2 font-medium text-gray-900">{c.title}</h3>
                <p className="text-sm text-gray-600">{c.description}</p>
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
            <PricingCards />
            <p className="mt-8 text-center text-xs text-gray-400">
              Most competitors charge more, and bill email verification as a
              separate add-on. Here, it&apos;s already included in every plan.
              Prices shown exclude tax; applicable GST is added at checkout.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="mb-10 text-center text-2xl font-semibold text-gray-900">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <h3 className="font-medium text-gray-900">{item.question}</h3>
                <p className="mt-1 text-sm text-gray-600">{item.answer}</p>
              </div>
            ))}
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
                <Link href="/acceptable-use" className="text-sm text-gray-500 hover:text-gray-900">
                  Acceptable Use Policy
                </Link>
                <Link href="/report-abuse" className="text-sm text-gray-500 hover:text-gray-900">
                  Report Abuse
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
