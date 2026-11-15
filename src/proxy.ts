import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { isFrontendPreview } from "@/lib/preview-mode";

export async function proxy(request: NextRequest) {
  if (isFrontendPreview()) {
    const pathname = request.nextUrl.pathname;
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Backend routes are paused in frontend preview." }, { status: 503 });
    }
    if (["/admin", "/payments", "/orders", "/auth/callback"].some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
