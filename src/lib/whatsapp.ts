// One-touch WhatsApp contact link -- a single fixed number, not per-contact
// (contacts don't store a phone number anywhere in this app). Shared by the
// floating in-app button and the public landing page footer.
const WHATSAPP_NUMBER = "14106700167";
const WHATSAPP_MESSAGE = "Hi, I have a question about Campaign Monster.";

export const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
