import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import {
  guestOwnerIdFromSessionToken,
  isPasswordAuthEnabled,
} from "@/lib/auth-jwt";

/**
 * Stable id for scoping app data (uploads, insights, settings).
 * - Password session cookie → one id per login (new cookies get a new uuid)
 * - Legacy guest JWT (`sub: user`) → shared `legacy_guest` (old behavior)
 * - No auth → `legacy_shared` (everyone shares one dataset)
 */
export async function resolveOwnerId(): Promise<string> {
  if (isPasswordAuthEnabled()) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) {
      const guest = await guestOwnerIdFromSessionToken(token);
      if (guest) {
        return guest;
      }
    }
  }

  return "legacy_shared";
}
