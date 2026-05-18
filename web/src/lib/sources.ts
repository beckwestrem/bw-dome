import { mcpIngestBodySchema, normalizedFromMcpBody } from "@/lib/mcp-schemas";
import type { Account, Transaction } from "@/lib/types";

export type NormalizedIngestion = {
  accounts: Account[];
  transactions: Transaction[];
};

export interface DataSourceAdapter<TInput> {
  sourceType: "csv_upload" | "mcp";
  ingest(input: TInput): Promise<NormalizedIngestion>;
}

/**
 * MCP / automation path: parse the same JSON body as `POST /api/ingest/mcp`,
 * then merge via `mergeNormalizedIntoApp` (see MCP route; CSV upload replaces prior CSV via `replaceCsvUploadInApp`).
 */
export class McpAdapter implements DataSourceAdapter<unknown> {
  sourceType = "mcp" as const;

  async ingest(input: unknown): Promise<NormalizedIngestion> {
    const parsed = mcpIngestBodySchema.parse(input);
    return normalizedFromMcpBody(parsed);
  }
}
