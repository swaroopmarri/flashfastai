import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/middleware";

const CANONICAL_HOST = "campaign-monster.com";

export async function middleware(request: NextRequest) {
  // Vercel serves every deployment on its own *.vercel.app URL in addition
  // to the custom domain -- redirect those (and any other non-canonical
  // host) to the real domain so customers only ever see/bookmark/share
  // campaign-monster.com. Left alone for local dev (localhost).
  const host = request.nextUrl.hostname;
  if (host !== CANONICAL_HOST && host !== "localhost") {
    const canonicalUrl = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(canonicalUrl, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
