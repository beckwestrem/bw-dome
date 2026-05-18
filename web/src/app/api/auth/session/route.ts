import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { isPasswordAuthEnabled, verifySessionJwt } from "@/lib/auth-jwt";

/** Tells the nav whether to show Sign in vs Sign out (cookie is httpOnly). */
export async function GET() {
  if (!isPasswordAuthEnabled()) {
    return NextResponse.json({
      authEnabled: false,
      signedIn: true,
      guestLoginEnabled: false,
    });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const signedIn = Boolean(token && (await verifySessionJwt(token)));
  return NextResponse.json({
    authEnabled: true,
    signedIn,
    guestLoginEnabled: true,
  });
}
