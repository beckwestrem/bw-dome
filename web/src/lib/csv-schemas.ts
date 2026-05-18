import { createHash } from "node:crypto";

import type { Account, Transaction } from "@/lib/types";

export type CsvValidationIssue = { row: number; message: string };

const FIELD_ALIASES: Record<string, readonly string[]> = {
  company: ["company", "business", "customer", "client"],
  account_id: [
    "account_id",
    "accountid",
    "acct_id",
    "acct",
    "account_number",
    "account number",
    "acct no",
    "acct number",
    "account #",
  ],
  account_name: [
    "account_name",
    "name",
    "account",
    "title",
    "nickname",
    "account nickname",
    "from account",
    "bank account",
    "account title",
  ],
  account_type: ["account_type", "type", "category"],
  balance: ["balance", "current_balance", "bal"],
  currency: ["currency", "curr", "ccy"],
  posted_at: [
    "posted_at",
    "date",
    "posted",
    "transaction_date",
    "txn_date",
    "post_date",
  ],
  description: ["description", "memo", "payee", "detail", "narrative"],
  amount: ["amount", "amt", "value", "debit_credit"],
  debit: ["debit", "withdrawal", "withdrawals", "out", "payment"],
  credit: ["credit", "deposit", "deposits", "in"],
  // Business service dashboard export
  service_owner: ["service owner", "service_owner", "am", "account manager"],
  deal_stage: ["deal stage", "deal_stage"],
  service_stage: ["service stage", "service_stage"],
  ticket_task: ["ticket task", "ticket_task"],
  ticket_status: ["ticket status", "ticket_status"],
  completion_status: ["completion status", "completion_status", "status"],
  completed_items: ["completed items", "completed_items"],
  sold_items: ["sold items", "sold_items"],
  other_items: ["other items", "other_items"],
  total_value: ["total value", "total_value", "value"],
  total_revenue: ["total revenue", "total_revenue", "commission"],
  paid_dates: ["paid dates", "paid_dates"],
  pending_orders: ["pending orders", "pending_orders"],
  ticket_agent: ["ticket agent", "ticket_agent"],
  active_tickets: ["active tickets", "active_tickets"],
  resolved_tickets: ["resolved tickets", "resolved_tickets"],
  ticket_updated_at: ["ticket updated at", "ticket_updated_at"],
  stage_summary: ["stage summary", "stage_summary"],
  notes: ["notes"],
  last_communication: ["last communication", "last_communication"],
};

/** Columns stored on Account.metadata after ingest (plus total_value copy). */
const DASHBOARD_METADATA_KEYS: readonly string[] = [
  "service_owner",
  "deal_stage",
  "service_stage",
  "ticket_task",
  "ticket_status",
  "completion_status",
  "completed_items",
  "sold_items",
  "other_items",
  "total_revenue",
  "paid_dates",
  "pending_orders",
  "ticket_agent",
  "active_tickets",
  "resolved_tickets",
  "ticket_updated_at",
  "stage_summary",
  "notes",
  "last_communication",
];

/** Maps each lowercase CSV header to a canonical field name (or itself). */
export function buildHeaderMap(headersLower: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headersLower) {
    const key = stripBom(h).trim().toLowerCase();
    let canonical = key;
    for (const [can, aliases] of Object.entries(FIELD_ALIASES)) {
      if (key === can || aliases.includes(key)) {
        canonical = can;
        break;
      }
    }
    map[key] = canonical;
  }
  return map;
}

export function mapCsvRow(
  raw: Record<string, string>,
  headerMap: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = stripBom(k).trim().toLowerCase();
    const canonical = headerMap[key] ?? key;
    if (String(v).trim() === "") continue;
    out[canonical] = String(v).trim();
  }
  return out;
}

function stripBom(s: string): string {
  return s.replace(/^\uFEFF/, "");
}

export function stripBomFromText(text: string): string {
  return text.replace(/^\uFEFF/, "");
}

/** Pick delimiter: tab- or semicolon-separated (Excel EU) vs comma. */
export function detectDelimiter(headerLine: string): string {
  const line = stripBom(headerLine);
  const tabs = (line.match(/\t/g) ?? []).length;
  const semis = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  if (tabs > 0 && tabs >= semis && tabs >= commas) return "\t";
  if (semis > 0 && semis >= commas) return ";";
  return ",";
}

export function splitDelimitedLine(line: string, delim: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

export function parseCsv(text: string): {
  headerMap: Record<string, string>;
  rows: Array<Record<string, string>>;
  delimiter: string;
} | null {
  const rawText = stripBomFromText(text);
  // Classic Mac (\r-only) and normalize CRLF so we always split on \n.
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const delimiter = detectDelimiter(lines[0]);
  const headerCells = splitDelimitedLine(lines[0], delimiter).map((h) =>
    stripBom(h).trim(),
  );
  const headersLower = headerCells.map((h) => h.toLowerCase());
  const headerMap = buildHeaderMap(headersLower);

  const rows = lines.slice(1).map((line) => {
    const cols = splitDelimitedLine(line, delimiter);
    const row: Record<string, string> = {};
    headersLower.forEach((h, idx) => {
      row[h] = (cols[idx] ?? "").trim();
    });
    return row;
  });

  return { headerMap, rows, delimiter };
}

function parseMoney(
  raw: string | undefined,
  required: boolean,
): { ok: true; value: number } | { ok: false; message: string } {
  if (raw === undefined || String(raw).trim() === "") {
    if (required) return { ok: false, message: "Amount is required" };
    return { ok: true, value: 0 };
  }

  let s = String(raw).trim().replace(/^\$/, "").replace(/\s/g, "");

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  } else if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1).trim();
  }

  // European: dot thousands + comma decimals, e.g. 1.234,56 (exactly 2 digits after comma)
  const europeanThousandsDecimal = /^\d{1,3}(\.\d{3})*,\d{2}$/;
  // European simple: 12,34 — NOT 3,840 (US thousands) because ,\d{2}$ requires exactly 2 fraction digits
  const europeanSimpleDecimal = /^\d{1,3},\d{2}$/;

  if (europeanThousandsDecimal.test(s) || europeanSimpleDecimal.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    // US / UK: strip thousands commas; keep a single decimal point if present
    s = s.replace(/,/g, "");
  }

  const n = Number(s);
  if (Number.isNaN(n)) {
    return { ok: false, message: "Amount must be a valid number" };
  }
  return { ok: true, value: negative ? -Math.abs(n) : n };
}

/** Single amount column, or separate debit (negative) / credit (positive). */
function resolveAmountColumn(m: Record<string, string>): {
  ok: true;
  value: number;
} | { ok: false; message: string } {
  if (m.amount?.trim()) {
    return parseMoney(m.amount, true);
  }
  const debit = parseMoney(m.debit, false);
  const credit = parseMoney(m.credit, false);
  const hasDebit = m.debit?.trim() && debit.ok && debit.value !== 0;
  const hasCredit = m.credit?.trim() && credit.ok && credit.value !== 0;
  if (hasDebit && hasCredit) {
    return {
      ok: true,
      value: credit.value - Math.abs(debit.value),
    };
  }
  if (hasDebit) {
    return { ok: true, value: -Math.abs(debit.value) };
  }
  if (hasCredit) {
    return { ok: true, value: Math.abs(credit.value) };
  }
  return { ok: false, message: "Amount is required (use amount, or debit/credit)" };
}

function normalizeAccountType(v: string | undefined): Account["type"] {
  if (!v) return "other";
  const lower = v.toLowerCase();
  if (
    lower.includes("bank") ||
    lower.includes("checking") ||
    lower.includes("savings")
  ) {
    return "bank";
  }
  if (lower.includes("invest")) return "investment";
  if (
    lower.includes("renewal") ||
    lower.includes("customer") ||
    lower.includes("client") ||
    lower.includes("business")
  ) {
    return "customer";
  }
  if (lower.includes("credit") || lower.includes("card")) return "credit";
  return "other";
}

function safeId(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (slug.length > 0) {
    return slug;
  }
  const h = createHash("sha256").update(value).digest("base64url").slice(0, 16);
  return `id-${h}`;
}

function stableTransactionId(
  accountId: string,
  postedAt: string,
  description: string,
  amount: number,
): string {
  const h = createHash("sha256")
    .update([accountId, postedAt, description, String(amount)].join("|"))
    .digest("base64url");
  return `${accountId.slice(0, 12)}-${h.slice(0, 20)}`;
}

function rowIsEmpty(raw: Record<string, string>): boolean {
  return !Object.values(raw).some((v) => String(v).trim() !== "");
}

function buildDashboardMetadata(m: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of DASHBOARD_METADATA_KEYS) {
    const v = m[key]?.trim();
    if (v) out[key] = v;
  }
  if (m.total_value?.trim()) {
    out.total_value = m.total_value.trim();
  }
  return out;
}

function resolvePostedAtIso(m: Record<string, string>): string {
  const raw = m.ticket_updated_at?.trim() || m.posted_at?.trim();
  if (raw && !Number.isNaN(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }
  return new Date().toISOString();
}

export type IngestCsvOptions = {
  /** When the CSV has no account column (typical bank export), use this for every row. */
  defaultAccountName?: string;
};

export function ingestCsvRows(
  fileName: string,
  rows: Array<Record<string, string>>,
  headerMap: Record<string, string>,
  options?: IngestCsvOptions,
):
  | { ok: true; data: { accounts: Account[]; transactions: Transaction[] } }
  | { ok: false; issues: CsvValidationIssue[] } {
  const issues: CsvValidationIssue[] = [];
  const accountMap = new Map<string, Account>();
  const transactions: Transaction[] = [];
  const fallbackAccount = options?.defaultAccountName?.trim() || "";

  rows.forEach((raw, index) => {
    const line = index + 2;
    if (rowIsEmpty(raw)) {
      return;
    }

    const m = mapCsvRow(raw, headerMap);

    const hasTxnAmount =
      Boolean(m.amount?.trim()) ||
      Boolean(m.debit?.trim()) ||
      Boolean(m.credit?.trim());

    const isDashboardRow =
      !hasTxnAmount &&
      (Boolean(m.company?.trim()) ||
        (Boolean(m.total_value?.trim()) &&
          Boolean(
            m.account_name?.trim() ||
              m.account_id?.trim() ||
              fallbackAccount,
          )));

    if (isDashboardRow) {
      const idPart =
        m.company?.trim() ||
        m.account_name?.trim() ||
        m.account_id?.trim() ||
        fallbackAccount;
      if (!idPart) {
        issues.push({
          row: line,
          message:
            "Dashboard row needs Company (or account name) or Default account name.",
        });
        return;
      }

      const valueResult = parseMoney(m.total_value, false);
      if (!valueResult.ok) {
        issues.push({ row: line, message: valueResult.message });
        return;
      }

      const accountId = safeId(idPart);
      const accountName =
        m.company?.trim() ||
        m.account_name?.trim() ||
        m.account_id?.trim() ||
        fallbackAccount ||
        fileName;
      const metadata = buildDashboardMetadata(m);
      const postedAtIso = resolvePostedAtIso(m);
      const parts = [
        m.stage_summary?.trim(),
        m.service_stage?.trim(),
        m.ticket_task?.trim(),
      ].filter(Boolean);
      const description =
        parts.join(" · ") || "Business dashboard row";
      const amount = valueResult.value;
      const currency = m.currency?.trim() || "USD";

      const nextAccount: Account = {
        id: accountId,
        name: accountName,
        type: "customer",
        balance: amount,
        currency,
        sourceType: "csv_upload",
        sourceRef: fileName,
        updatedAt: new Date().toISOString(),
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      };

      if (!accountMap.has(accountId)) {
        accountMap.set(accountId, nextAccount);
      } else {
        const cur = accountMap.get(accountId)!;
        cur.balance = amount || cur.balance;
        cur.updatedAt = nextAccount.updatedAt;
        cur.metadata = {
          ...(cur.metadata ?? {}),
          ...metadata,
        };
      }

      transactions.push({
        id: stableTransactionId(accountId, postedAtIso, description, amount),
        accountId,
        postedAt: postedAtIso,
        description,
        amount,
      });
      return;
    }

    const idPart =
      m.company?.trim() ||
      m.account_id?.trim() ||
      m.account_name?.trim() ||
      fallbackAccount;
    if (!idPart) {
      issues.push({
        row: line,
        message:
          "Need Company, account_id, or account_name in the file, or enter Default account name (for simple exports with amount per row).",
      });
      return;
    }

    const amountResult = resolveAmountColumn(m);
    if (!amountResult.ok) {
      issues.push({ row: line, message: amountResult.message });
      return;
    }

    const balanceResult = parseMoney(m.balance, false);
    if (!balanceResult.ok) {
      issues.push({ row: line, message: balanceResult.message });
      return;
    }

    const postedRaw =
      m.posted_at?.trim() || new Date().toISOString().slice(0, 10);
    if (Number.isNaN(Date.parse(postedRaw))) {
      issues.push({
        row: line,
        message: `Invalid date for posted_at: ${m.posted_at ?? "(empty)"}`,
      });
      return;
    }

    const accountId = safeId(idPart);
    const accountName =
      m.company?.trim() ||
      m.account_name?.trim() ||
      m.account_id?.trim() ||
      fallbackAccount ||
      fileName;
    const accountType = normalizeAccountType(m.account_type);
    const currency = m.currency?.trim() || "USD";
    const postedAt = postedRaw;
    const description = m.description?.trim() || "Uploaded transaction";
    const balance = balanceResult.value;
    const amount = amountResult.value;

    if (!accountMap.has(accountId)) {
      accountMap.set(accountId, {
        id: accountId,
        name: accountName,
        type: accountType,
        balance,
        currency,
        sourceType: "csv_upload",
        sourceRef: fileName,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const current = accountMap.get(accountId)!;
      current.balance = balance || current.balance;
      current.updatedAt = new Date().toISOString();
    }

    transactions.push({
      id: stableTransactionId(accountId, postedAt, description, amount),
      accountId,
      postedAt,
      description,
      amount,
    });
  });

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  if (transactions.length === 0) {
    return {
      ok: false,
      issues: [
        {
          row: 0,
          message:
            "No data rows found after the header. Check delimiter (comma vs semicolon) and that rows are not empty.",
        },
      ],
    };
  }

  return {
    ok: true,
    data: {
      accounts: [...accountMap.values()],
      transactions,
    },
  };
}
