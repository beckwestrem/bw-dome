import type { Account } from "@/lib/types";

/**
 * Urgency sort for business triage: open work, stale touches, then largest value.
 */

function activeTicketCount(a: Account): number {
  const raw = a.metadata?.active_tickets ?? "";
  const n = parseInt(String(raw).replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Oldest touch first (stale tickets rise to top). Missing ticket date falls back
 * to row updatedAt, then deprioritized last.
 */
function effectiveTicketTimeMs(a: Account): number {
  const raw = a.metadata?.ticket_updated_at?.trim();
  if (raw) {
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  const u = Date.parse(a.updatedAt);
  if (Number.isFinite(u)) return u;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Urgency: open tickets first → oldest Ticket Updated At → highest value.
 */
export function sortAccountsByUrgency(accounts: Account[]): Account[] {
  return [...accounts].sort((a, b) => {
    const openA = activeTicketCount(a) > 0 ? 0 : 1;
    const openB = activeTicketCount(b) > 0 ? 0 : 1;
    if (openA !== openB) return openA - openB;

    const ta = effectiveTicketTimeMs(a);
    const tb = effectiveTicketTimeMs(b);
    if (ta !== tb) return ta - tb;

    return Math.abs(b.balance) - Math.abs(a.balance);
  });
}
