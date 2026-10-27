import { describe, it, expect } from "vitest";
import { NextResponse } from "next/server";
import { withSecurityHeaders } from "@/lib/security/headers";

describe("withSecurityHeaders", () => {
  it("menambahkan X-Frame-Options: DENY", () => {
    const res = withSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("menambahkan X-Content-Type-Options: nosniff", () => {
    const res = withSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("menambahkan X-XSS-Protection: 0", () => {
    const res = withSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("X-XSS-Protection")).toBe("0");
  });

  it("menambahkan Referrer-Policy", () => {
    const res = withSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin"
    );
  });

  it("menambahkan Permissions-Policy", () => {
    const res = withSecurityHeaders(NextResponse.json({ ok: true }));
    expect(res.headers.get("Permissions-Policy")).toBeTruthy();
  });

  it("tidak mengubah status code response", () => {
    const res = withSecurityHeaders(
      NextResponse.json({ error: "not found" }, { status: 404 })
    );
    expect(res.status).toBe(404);
  });

  it("tidak mengubah body response", async () => {
    const res = withSecurityHeaders(
      NextResponse.json({ success: true, data: "test" })
    );
    const body = await res.json();
    expect(body).toEqual({ success: true, data: "test" });
  });
});
