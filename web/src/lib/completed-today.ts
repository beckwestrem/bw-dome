import type { Account } from "@/lib/types";

function meta(account: Account, key: string): string {
  return account.metadata?.[key]?.trim() ?? "";
}

/** True when export fields indicate the account is completed. */
export function accountShowsCompleted(account: Account): boolean {
  const deal = meta(account, "deal_stage").toLowerCase();
  const status = meta(account, "completion_status").toLowerCase();
  return (
    /\b(completed|complete|done|closed)\b/i.test(deal) ||
    /\b(completed|complete|done|closed)\b/i.test(status) ||
    meta(account, "completed_items").length > 0
  );
}

/** Calendar YYYY-MM-DD for an instant in `timeZone` (e.g. en-CA). */
export function calendarDateInTimeZone(
  isoUtc: string,
  timeZone: string,
): string | null {
  const t = Date.parse(isoUtc);
  if (!Number.isFinite(t)) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(t));
  } catch {
    return null;
  }
}

export function todayCalendarDateInTimeZone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
}

/**
 * Completed in export AND account row `updatedAt` falls on today's calendar date in `timeZone`.
 * Uses latest upload merge time as proxy for "status updated" when source history is not stored.
 */
export function listAccountsCompletedUpdatedToday(
  accounts: Account[],
  timeZone: string,
): Account[] {
  const today = todayCalendarDateInTimeZone(timeZone);
  return accounts.filter((a) => {
    if (!accountShowsCompleted(a)) return false;
    const d = calendarDateInTimeZone(a.updatedAt, timeZone);
    return d !== null && d === today;
  });
}

export function resolveSummaryTimeZone(): string {
  const raw =
    process.env.SUMMARY_TIMEZONE?.trim() ||
    process.env.AE_SUMMARY_TIMEZONE?.trim();
  if (raw) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: raw }).format(new Date());
      return raw;
    } catch {
      /* fall through */
    }
  }
  return "America/Chicago";
}
