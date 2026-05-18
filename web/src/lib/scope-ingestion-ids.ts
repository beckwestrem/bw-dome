import { createHash } from "node:crypto";

import type { NormalizedIngestion } from "@/lib/sources";

/** Short stable prefix so account/txn primary keys are unique per owner in shared Postgres. */
function ownerKeyPrefix(ownerId: string): string {
  return createHash("sha256").update(ownerId).digest("base64url").slice(0, 12);
}

/**
 * Prefixes account and transaction ids so different password sessions never collide on
 * global PKs (`accounts.id`, `transactions.id`).
 */
export function scopeIngestionToOwner(
  ownerId: string,
  data: NormalizedIngestion,
): NormalizedIngestion {
  const p = ownerKeyPrefix(ownerId);
  const map = new Map<string, string>();

  const accounts = data.accounts.map((a) => {
    const nid = `${p}__${a.id}`.slice(0, 220);
    map.set(a.id, nid);
    return { ...a, id: nid };
  });

  const transactions = data.transactions.map((t) => {
    const newAccountId =
      map.get(t.accountId) ?? `${p}__${t.accountId}`.slice(0, 220);
    const nid = `${p}__${t.id}`.slice(0, 240);
    return { ...t, id: nid, accountId: newAccountId };
  });

  return { accounts, transactions };
}
