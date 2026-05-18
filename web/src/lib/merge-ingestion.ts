import type { AppData, SourceType } from "@/lib/types";
import type { NormalizedIngestion } from "@/lib/sources";

export function mergeNormalizedIntoApp(
  current: AppData,
  normalized: NormalizedIngestion,
  ingestion: { id: string; sourceType: SourceType },
): AppData {
  const mergedAccounts = mergeAccounts(current.accounts, normalized.accounts);
  const mergedTransactions = dedupeTransactions([
    ...current.transactions,
    ...normalized.transactions,
  ]);
  return {
    ...current,
    accounts: mergedAccounts,
    transactions: mergedTransactions,
    ingestions: [
      ...current.ingestions,
      {
        id: ingestion.id,
        sourceType: ingestion.sourceType,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

function mergeAccounts<T extends { id: string; updatedAt: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const map = new Map(existing.map((item) => [item.id, item]));
  for (const item of incoming) {
    map.set(item.id, item);
  }
  return [...map.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function dedupeTransactions<T extends { id: string }>(transactions: T[]): T[] {
  const map = new Map<string, T>();
  for (const t of transactions) map.set(t.id, t);
  return [...map.values()];
}

/**
 * Drop prior CSV upload snapshot and use this one. Keeps `sourceType: "mcp"` accounts,
 * their transactions, and MCP ingestion log entries; preserves settings.
 */
export function replaceCsvUploadInApp(
  current: AppData,
  normalized: NormalizedIngestion,
  ingestion: { id: string; sourceType: SourceType },
): AppData {
  const mcpAccounts = current.accounts.filter((a) => a.sourceType === "mcp");
  const mcpIds = new Set(mcpAccounts.map((a) => a.id));
  const mcpTransactions = current.transactions.filter((t) =>
    mcpIds.has(t.accountId),
  );
  const mcpIngestions = current.ingestions.filter((i) => i.sourceType === "mcp");

  const accounts = [...mcpAccounts, ...normalized.accounts].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  const transactions = dedupeTransactions([
    ...mcpTransactions,
    ...normalized.transactions,
  ]);

  return {
    ...current,
    accounts,
    transactions,
    ingestions: [
      ...mcpIngestions,
      {
        id: ingestion.id,
        sourceType: ingestion.sourceType,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
