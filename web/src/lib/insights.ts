import type { Account, ActionItem, Transaction } from "@/lib/types";

/**
 * Action items from business-dashboard exports (stage, tickets, value, etc.).
 */

/** Large dollar-value threshold — tune to your book. */
const LARGE_VALUE_THRESHOLD = 25_000;
const RECEIVABLES_BALANCE_THRESHOLD = 1_000;
const BUSY_WEEK_LINE_ITEMS = 20;
const BUSY_WEEK_MAGNITUDE_SUM = 100_000;

function meta(account: Account, key: string): string {
  return account.metadata?.[key]?.trim() ?? "";
}

function parseCount(raw: string): number {
  const n = parseInt(raw.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

export function buildActionItems(
  accounts: Account[],
  transactions: Transaction[],
): ActionItem[] {
  const items: ActionItem[] = [];
  const primaryCurrency = accounts[0]?.currency ?? "USD";

  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentTx = transactions.filter(
    (t) => new Date(t.postedAt).getTime() >= now - weekMs,
  );
  const recentCount = recentTx.length;
  const recentMagnitudeSum = recentTx.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0,
  );

  for (const account of accounts) {
    const deal = meta(account, "deal_stage").toLowerCase();
    const status = meta(account, "completion_status").toLowerCase();
    const serviceStage = meta(account, "service_stage");
    const ticketStatus = meta(account, "ticket_status").toLowerCase();
    const ticketTask = meta(account, "ticket_task");
    const activeTickets = parseCount(meta(account, "active_tickets"));
    const pendingOrders = meta(account, "pending_orders").trim();
    const stageSummary = meta(account, "stage_summary");

    const completedSignal =
      /\b(completed|complete|done|closed)\b/i.test(deal) ||
      /\b(completed|complete|done|closed)\b/i.test(status) ||
      meta(account, "completed_items").length > 0;
    const soldSignal =
      /\bsold\b/i.test(deal) || /\bsold\b/i.test(status);

    if (soldSignal && !completedSignal) {
      items.push({
        id: `binding-${account.id}`,
        title: `Move to completed — ${account.name}`,
        why: "The file shows sold/in-progress but not completed yet.",
        nextStep:
          pendingOrders
            ? `Pending orders field: ${pendingOrders.slice(0, 120)}${pendingOrders.length > 120 ? "…" : ""}`
            : "Confirm the next step in your source system.",
        priority: "high",
      });
    }

    if (activeTickets > 0 && serviceStage) {
      items.push({
        id: `service-${account.id}`,
        title: `Service ticket — ${account.name}`,
        why: `Service: ${serviceStage}. ${activeTickets} open ticket(s).${ticketTask ? ` Task: ${ticketTask}.` : ""}`,
        nextStep:
          ticketStatus.includes("progress") || ticketStatus.includes("assigned")
            ? "Keep going on that ticket. Update the ticket date when you touch it."
            : "Someone needs to own this ticket.",
        priority: "high",
      });
    } else if (activeTickets > 0) {
      items.push({
        id: `tickets-${account.id}`,
        title: `Open tickets — ${account.name}`,
        why: `${activeTickets} open ticket(s), no service stage text.`,
        nextStep: "Open your source system and clear or assign them.",
        priority: "medium",
      });
    }

    if (stageSummary && !items.some((i) => i.id === `binding-${account.id}`)) {
      if (
        stageSummary.toLowerCase().includes("action") ||
        stageSummary.toLowerCase().includes("follow") ||
        stageSummary.toLowerCase().includes("need")
      ) {
        items.push({
          id: `summary-${account.id}`,
          title: `Read stage note — ${account.name}`,
          why: stageSummary.slice(0, 200) + (stageSummary.length > 200 ? "…" : ""),
          nextStep: "Read the stage summary and do what it says. Note what you did.",
          priority: "medium",
        });
      }
    }

    const isCustomerRow =
      account.type === "customer" || account.type === "other";

    if (
      account.type === "credit" &&
      Math.abs(account.balance) > RECEIVABLES_BALANCE_THRESHOLD
    ) {
      items.push({
        id: `receivables-${account.id}`,
        title: `Money owed? — ${account.name}`,
        why: `Balance shows ${fmt(Math.abs(account.balance), account.currency)}.`,
        nextStep: "Check if money is really owed or if billing is wrong.",
        priority: "high",
      });
    }

    if (
      isCustomerRow &&
      Math.abs(account.balance) >= LARGE_VALUE_THRESHOLD
    ) {
      items.push({
        id: `value-${account.id}`,
        title: `Large value — ${account.name}`,
        why: `Value is ${fmt(Math.abs(account.balance), account.currency)}.`,
        nextStep: "Big dollar account — check the status, owner, and next step.",
        priority: "high",
      });
    }
  }

  if (recentCount >= BUSY_WEEK_LINE_ITEMS) {
    items.push({
      id: "volume-triage",
      title: "Busy week (many rows moved)",
      why: `${recentCount} rows had activity in the last week.`,
      nextStep: "Lots of movement — skim deal stage and tickets and batch similar work.",
      priority: "medium",
    });
  }

  if (
    recentMagnitudeSum >= BUSY_WEEK_MAGNITUDE_SUM &&
    recentCount < BUSY_WEEK_LINE_ITEMS
  ) {
    items.push({
      id: "magnitude-spike",
      title: "Busy week (big dollars)",
      why: `Dollar volume this week is ${fmt(recentMagnitudeSum, primaryCurrency)}.`,
      nextStep: "Sort by dollar value and look at stage, status, and pending orders.",
      priority: "medium",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "clear",
      title: "No auto alerts",
      why: "Nothing in this file tripped the automatic flags.",
      nextStep: "Use your own judgment. Upload again after the next export.",
      priority: "low",
    });
  }

  return items.sort(
    (a, b) =>
      priorityOrder(a.priority) - priorityOrder(b.priority) ||
      a.title.localeCompare(b.title),
  );
}

function priorityOrder(priority: ActionItem["priority"]): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function fmt(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}
