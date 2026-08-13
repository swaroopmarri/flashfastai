import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { findRecipientByMessageId, applyComplaint, applyBounce } from "@/lib/sesFeedback";

interface SnsEnvelope {
  Type: string;
  Message: string;
  SubscribeURL?: string;
}

interface SesNotificationMessage {
  notificationType: "Bounce" | "Complaint" | "Delivery";
  mail: { messageId: string };
  bounce?: { bounceType: string; bounceSubType: string };
  complaint?: { complaintFeedbackType?: string };
}

// AWS posts the subscription-confirmation handshake to a real
// sns.<region>.amazonaws.com URL -- only follow it if it actually looks
// like one, so a malformed/spoofed body can't turn this into an
// open-ended server-side fetch of an attacker-chosen URL.
function isSnsUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com$/.test(hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("secret") !== process.env.SES_NOTIFICATIONS_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let envelope: SnsEnvelope;
  try {
    envelope = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (envelope.Type === "SubscriptionConfirmation") {
    if (envelope.SubscribeURL && isSnsUrl(envelope.SubscribeURL)) {
      await fetch(envelope.SubscribeURL);
    }
    return NextResponse.json({ ok: true });
  }

  if (envelope.Type !== "Notification") {
    return NextResponse.json({ ok: true });
  }

  let message: SesNotificationMessage;
  try {
    message = JSON.parse(envelope.Message);
  } catch {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  if (message.notificationType !== "Bounce" && message.notificationType !== "Complaint") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();
  const recipient = await findRecipientByMessageId(supabase, message.mail.messageId);
  if (!recipient) {
    // Not one of our sends (or too old to still have a matching row) --
    // nothing to suppress.
    return NextResponse.json({ ok: true });
  }

  if (message.notificationType === "Complaint") {
    await applyComplaint(supabase, recipient);
  } else if (message.notificationType === "Bounce" && message.bounce?.bounceType === "Permanent") {
    // Transient bounces (mailbox full, greylisting, etc.) aren't a
    // permanent suppression signal -- only "Permanent" bounces mark the
    // contact undeliverable.
    await applyBounce(supabase, recipient, message.bounce.bounceSubType || "unknown");
  }

  return NextResponse.json({ ok: true });
}
