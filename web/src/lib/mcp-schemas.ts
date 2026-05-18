import { z } from "zod";

import type { Account, Transaction } from "@/lib/types";

const sourceTypeSchema = z.enum(["csv_upload", "mcp"]);

export const accountIngestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(["customer", "bank", "investment", "credit", "other"]),
  balance: z.number(),
  currency: z.string().optional().default("USD"),
  sourceType: sourceTypeSchema.optional(),
  sourceRef: z.string().optional(),
  updatedAt: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const transactionIngestSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  postedAt: z.string().min(1),
  description: z.string().optional().default(""),
  amount: z.number(),
});

export const mcpIngestBodySchema = z.object({
  accounts: z.array(accountIngestSchema).default([]),
  transactions: z.array(transactionIngestSchema).default([]),
});

export type McpIngestBody = z.infer<typeof mcpIngestBodySchema>;

export function normalizedFromMcpBody(parsed: McpIngestBody): {
  accounts: Account[];
  transactions: Transaction[];
} {
  const now = new Date().toISOString();
  const accounts: Account[] = parsed.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    balance: a.balance,
    currency: a.currency,
    sourceType: a.sourceType ?? "mcp",
    sourceRef: a.sourceRef ?? "mcp",
    updatedAt: a.updatedAt ?? now,
    metadata:
      a.metadata && Object.keys(a.metadata).length > 0 ? a.metadata : undefined,
  }));
  const transactions: Transaction[] = parsed.transactions.map((t) => ({
    id: t.id,
    accountId: t.accountId,
    postedAt: t.postedAt,
    description: t.description,
    amount: t.amount,
  }));
  return { accounts, transactions };
}
