import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Edge middleware: optimistic auth gate.
 *
 * Prisma can't run on the edge, so we only check for the presence of a valid
 * session cookie here and redirect accordingly. Fine-grained role checks are
 * enforced server-side in layouts/pages via `requireRole` / `requirePermission`.
 */
const PUBLIC_ROUTES = ["/login", "/register", "/unauthorized"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = getSessionCookie(request);
  const isAuthed = Boolean(sessionCookie);
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // Authenticated users shouldn't see auth pages.
  if (isAuthed && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated users can't reach protected areas.
  if (!isAuthed && !isPublic) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
