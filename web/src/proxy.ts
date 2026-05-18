import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { isPasswordAuthEnabled, verifySessionJwt } from "@/lib/auth-jwt";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|ico|png|jpg)$/)
  ) {
    return NextResponse.next();
  }

  let guestOk = false;
  if (isPasswordAuthEnabled()) {
    const t = request.cookies.get(SESSION_COOKIE)?.value;
    guestOk = Boolean(t && (await verifySessionJwt(t)));
  }

  if (pathname === "/" || pathname === "") {
    if (!isPasswordAuthEnabled()) {
      return NextResponse.next();
    }
    if (guestOk) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    if (pathname === "/login" && isPasswordAuthEnabled()) {
      const token = request.cookies.get(SESSION_COOKIE)?.value;
      if (token && (await verifySessionJwt(token))) {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
    return NextResponse.next();
  }

  if (!isPasswordAuthEnabled()) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/ingest/mcp")) {
    const mcpSecret = process.env.MCP_INGEST_SECRET?.trim();
    if (mcpSecret) {
      const authHeader = request.headers.get("authorization") ?? "";
      if (authHeader === `Bearer ${mcpSecret}`) {
        return NextResponse.next();
      }
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (guestOk) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("from", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/upload/:path*",
    "/settings/:path*",
    "/login",
    "/api/auth/:path*",
    "/api/insights/:path*",
    "/api/upload/:path*",
    "/api/settings/:path*",
    "/api/ingest/:path*",
    "/api/digest/:path*",
    "/api/ae-summary/:path*",
  ],
};
