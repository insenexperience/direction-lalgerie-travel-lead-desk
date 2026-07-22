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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
