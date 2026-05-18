import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { isPasswordAuthEnabled, sessionCookieOptions, signSessionJwt } from "@/lib/auth-jwt";

export async function POST(request: Request) {
  if (!isPasswordAuthEnabled()) {
    return NextResponse.json(
      { error: "APP_PASSWORD is not set; auth is disabled." },
      { status: 503 },
    );
  }

  let body: { password?: string };
  try {
    body = (await request.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.APP_PASSWORD!.trim();
  const given = body.password ?? "";
  if (given !== expected) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const token = await signSessionJwt();
  const maxAge = 60 * 60 * 24 * 7;
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  return res;
}
