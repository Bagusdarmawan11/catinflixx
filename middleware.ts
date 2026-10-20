import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/jwt";
import { AUTH_CONFIG } from "@/config";

// Route yang membutuhkan autentikasi
const PROTECTED_ROUTES = ["/watchlist", "/watch-party", "/profile"];

// Route yang hanya bisa diakses tanpa login (redirect ke / jika sudah login)
const AUTH_ROUTES = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_ROUTES.some((route) =>
    pathname.startsWith(route)
  );
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  const token = req.cookies.get(AUTH_CONFIG.cookieName)?.value;
  const payload = token ? verifyToken(token) : null;
  const isAuthenticated = payload !== null;

  // Redirect ke login jika akses route protected tanpa auth
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect ke home jika sudah login tapi akses halaman auth
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match semua request path kecuali:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - api routes (handled separately)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
