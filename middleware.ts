import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Pages voyageur et workers authentifiés par leur secret : aucune session à rafraîchir. */
function isTravelerPath(pathname: string): boolean {
  return (
    pathname === "/q" ||
    pathname.startsWith("/q/") ||
    pathname.startsWith("/api/q/") ||
    pathname === "/api/traveler-project-status" ||
    pathname === "/api/project-status-emails" ||
    pathname === "/api/cron/keepalive"
  );
}

export async function middleware(request: NextRequest) {
  if (isTravelerPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  return updateSession(request);
}

// /relecture est servi par un autre projet (réécriture dans next.config.ts) : pas de session CRM à rafraîchir.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|relecture|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
