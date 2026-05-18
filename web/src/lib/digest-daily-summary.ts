import { accountShowsCompleted } from "@/lib/completed-today";
import type { Account, ActionItem, AppData } from "@/lib/types";

function meta(account: Account, key: string): string {
  return account.metadata?.[key]?.trim() ?? "";
}

function accountTextBlob(a: Account): string {
  return [
    meta(a, "deal_stage"),
    meta(a, "completion_status"),
    meta(a, "stage_summary"),
    meta(a, "ticket_task"),
    meta(a, "service_stage"),
    meta(a, "pending_orders"),
    meta(a, "ticket_status"),
  ].join(" ");
}

const ESCALATION_HINT = /harris|iheb|ether|aarti|re-?marketing|\biq\b|iq bind|post-?sale|post sale/i;

/**
 * Five bullets for the personal digest the business operator reads for themselves.
 * Same data discipline as before; wording is operational triage, not a handoff.
 */
export function buildDailyAmDigestBullets(
  data: AppData,
  actions: ActionItem[],
): string[] {
  const accounts = data.accounts;

  const completedAccounts = accounts.filter(accountShowsCompleted);
  const bulletCompleted =
    completedAccounts.length > 0
      ? `Completed-status signals in your export: ${completedAccounts.length} account(s) show completed-related fields — e.g. ${completedAccounts
          .slice(0, 3)
          .map((a) => a.name)
          .join(", ")}${completedAccounts.length > 3 ? "…" : ""}. Final delivery vs pending is not in this file; note it in your saved context if you need it on your radar.`
      : "Completed work: this export does not flag any accounts as completed in stage, status, or completion fields — if you know work finished today, capture that in your saved notes (we do not guess).";

  const bindingActions = actions.filter((x) => x.id.startsWith("binding-"));
  const bulletPending =
    bindingActions.length > 0
      ? `In-progress work: ${bindingActions.length} account(s) read as sold/in-progress but not completed — review pending orders and stages in the action list; timeline and blockers are only what those fields show.`
      : "Pipeline: no sold-but-not-completed flags in this export — if you are carrying timing or blockers in your head, add them to your saved notes for your own digest.";

  const ticketActions = actions.filter(
    (x) => x.id.startsWith("service-") || x.id.startsWith("tickets-"),
  );
  const bulletActions =
    ticketActions.length > 0
      ? `Tasks / tickets: ${ticketActions.length} account(s) have ticket or task signals — use the detailed list below to prioritize your day; only claims supported by uploaded columns.`
      : "Service load: no ticket/service rows tripped our flags — if follow-ups are not reflected in the sheet, log them in your saved notes so your next digest reflects them.";

  const escAccounts = accounts.filter((a) => ESCALATION_HINT.test(accountTextBlob(a)));
  const bulletEsc =
    escAccounts.length > 0
      ? `Escalation wording in export text: ${escAccounts
          .slice(0, 3)
          .map((a) => a.name)
          .join(", ")}${escAccounts.length > 3 ? "…" : ""} — double-check routing and status in your source system; we do not infer owner or live status from keywords alone.`
      : "Escalations: no Harris / Iheb / Ether / Aarti / re-marketing / IQ-bind / post-sale wording in the fields we read — track real escalations in your saved notes if they matter for your book.";

  const highOther = actions.filter(
    (x) =>
      x.priority === "high" &&
      !x.id.startsWith("binding-") &&
      !x.id.startsWith("service-") &&
      !x.id.startsWith("tickets-"),
  );
  const bulletOther =
    highOther.length > 0
      ? `Other high-priority flags: ${highOther.length} item(s) (e.g. receivables / large value) — details in the action list; this is a data snapshot, not a full diary of your day.`
      : `Book snapshot: ${accounts.length} account row(s), ${data.transactions.length} transaction line(s) in this upload — use the ranked list below to see where to focus; add narrative in your saved notes when the export is silent.`;

  return [
    bulletCompleted,
    bulletPending,
    bulletActions,
    bulletEsc,
    bulletOther,
  ];
}
