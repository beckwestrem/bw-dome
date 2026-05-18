import { NextResponse } from "next/server";

import { mergeNormalizedIntoApp } from "@/lib/merge-ingestion";
import { mcpIngestBodySchema, normalizedFromMcpBody } from "@/lib/mcp-schemas";
import { resolveOwnerId } from "@/lib/request-owner";
import { scopeIngestionToOwner } from "@/lib/scope-ingestion-ids";
import { readAppData, writeAppData } from "@/lib/storage";

/** When MCP_INGEST_SECRET is set, ingest uses this owner (automation). Override with MCP_INGEST_OWNER_ID. */
function mcpMachineOwnerId(): string {
  return process.env.MCP_INGEST_OWNER_ID?.trim() || "system_mcp";
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = mcpIngestBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => i.message).join("; ");
    return NextResponse.json({ error: "Validation failed", details: msg }, { status: 400 });
  }

  const normalized = normalizedFromMcpBody(parsed.data);

  const machineIngest = Boolean(process.env.MCP_INGEST_SECRET?.trim());
  const ownerId = machineIngest
    ? mcpMachineOwnerId()
    : await resolveOwnerId();
  const scoped = scopeIngestionToOwner(ownerId, normalized);
  const current = await readAppData(ownerId);
  const next = mergeNormalizedIntoApp(
    current,
    scoped,
    { id: `mcp-${Date.now()}`, sourceType: "mcp" },
  );
  await writeAppData(ownerId, next);

  return NextResponse.json({
    ok: true,
    accountsImported: scoped.accounts.length,
    transactionsImported: scoped.transactions.length,
  });
}
