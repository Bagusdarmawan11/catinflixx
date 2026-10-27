import { NextResponse } from "next/server";

/**
 * Tambahkan HTTP security headers ke NextResponse.
 * Dipanggil di setiap API route yang mengembalikan response.
 */
export function withSecurityHeaders(response: NextResponse): NextResponse {
  // Cegah clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Cegah MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Matikan XSS auditor lama (berbahaya di beberapa browser)
  response.headers.set("X-XSS-Protection", "0");

  // Referrer policy: kurangi kebocoran URL
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // HSTS: hanya production, karena dev pakai HTTP
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains"
    );
  }

  // Permissions Policy: batasi fitur browser yang tidak dipakai
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=()"
  );

  return response;
}

/**
 * Buat error response dengan security headers.
 */
export function secureErrorResponse(
  body: object,
  status: number
): NextResponse {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}

/**
 * Buat sukses response dengan security headers.
 */
export function secureJsonResponse(
  body: object,
  status = 200
): NextResponse {
  return withSecurityHeaders(NextResponse.json(body, { status }));
}
