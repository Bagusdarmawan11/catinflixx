import { NextRequest, NextResponse } from "next/server";

// Nama cookie harus sinkron dengan AUTH_CONFIG.cookieName di config/index.ts
const SESSION_COOKIE = "catinflix_session";

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

  // Di Edge Runtime kita hanya bisa cek keberadaan cookie.
  // Verifikasi penuh (JWT signature) dilakukan di setiap API route / Server Component.
  const isAuthenticated = !!req.cookies.get(SESSION_COOKIE)?.value;

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
