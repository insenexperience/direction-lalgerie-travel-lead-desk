import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Page voyageur publique (/q/<token> + API) : aucune session Supabase à rafraîchir. */
function isTravelerPath(pathname: string): boolean {
  return (
    pathname === "/q" ||
    pathname.startsWith("/q/") ||
    pathname.startsWith("/api/q/")
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
