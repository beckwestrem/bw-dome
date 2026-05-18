import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  const password = process.env.APP_PASSWORD?.trim();
  if (!password) {
    throw new Error("APP_PASSWORD is not set");
  }
  return new TextEncoder().encode(password);
}

export function isPasswordAuthEnabled(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export async function signSessionJwt(): Promise<string> {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return new SignJWT({ sub: `guest:${id}` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifySessionJwt(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecret());
    return true;
  } catch {
    return false;
  }
}

/** Maps verified session JWT to an owner id for data scoping. */
export async function guestOwnerIdFromSessionToken(
  token: string,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sub = typeof payload.sub === "string" ? payload.sub : null;
    if (!sub) {
      return null;
    }
    if (sub === "user") {
      return "legacy_guest";
    }
    if (sub.startsWith("guest:")) {
      return sub;
    }
    return `guest:${sub}`;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
