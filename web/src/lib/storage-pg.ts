import { ensureSchema, getSql } from "@/lib/db";
import type { Account, AppData, SourceType, Transaction, UserSettings } from "@/lib/types";

/** Transaction client from `sql.begin` — only `unsafe` needed for batched inserts. */
type PgTxnUnsafe = {
  unsafe: (
    query: string,
    parameters?: unknown[] | undefined,
  ) => Promise<unknown>;
};

/** Keep batches under Postgres param limits (~65k); 10 cols × 400 = 4k params. */
const ACCOUNT_INSERT_CHUNK = 400;
/** 5 columns × 800 = 4k params. */
const TRANSACTION_INSERT_CHUNK = 800;

function chunk<T>(items: T[], size: number): T[][] {
  if (items.length === 0) {
    return [];
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function insertAccountsBatch(
  txn: PgTxnUnsafe,
  ownerId: string,
  batch: Account[],
): Promise<unknown> {
  let p = 1;
  const fragments: string[] = [];
  const params: unknown[] = [];
  for (const a of batch) {
    fragments.push(
      `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::timestamptz, $${p++}::jsonb, $${p++})`,
    );
    params.push(
      a.id,
      a.name,
      a.type,
      a.balance,
      a.currency,
      a.sourceType,
      a.sourceRef,
      a.updatedAt,
      JSON.stringify(a.metadata ?? {}),
      ownerId,
    );
  }
  return txn.unsafe(
    `INSERT INTO accounts (id, name, type, balance, currency, source_type, source_ref, updated_at, metadata, owner_id) VALUES ${fragments.join(", ")}`,
    params,
  );
}

function insertTransactionsBatch(
  txn: PgTxnUnsafe,
  batch: Transaction[],
): Promise<unknown> {
  let p = 1;
  const fragments: string[] = [];
  const params: unknown[] = [];
  for (const t of batch) {
    fragments.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(t.id, t.accountId, t.postedAt, t.description, t.amount);
  }
  return txn.unsafe(
    `INSERT INTO transactions (id, account_id, posted_at, description, amount) VALUES ${fragments.join(", ")}`,
    params,
  );
}

type IngestionRow = AppData["ingestions"][number];

function insertIngestionsBatch(
  txn: PgTxnUnsafe,
  ownerId: string,
  batch: IngestionRow[],
): Promise<unknown> {
  let p = 1;
  const fragments: string[] = [];
  const params: unknown[] = [];
  for (const i of batch) {
    fragments.push(`($${p++}, $${p++}, $${p++}::timestamptz, $${p++})`);
    params.push(i.id, i.sourceType, i.createdAt, ownerId);
  }
  return txn.unsafe(
    `INSERT INTO ingestions (id, source_type, created_at, owner_id) VALUES ${fragments.join(", ")}`,
    params,
  );
}

const defaultSettings: UserSettings = {
  emailDigestEnabled: false,
  sendTimesLocal: ["08:00", "18:00"],
  digestEmail: null,
  digestFooterNotes: null,
};

export type DigestSubscriberRow = {
  owner_id: string;
  email_digest_enabled: boolean;
  send_time_morning: string;
  send_time_evening: string;
  digest_email: string | null;
};

export async function listDigestSubscribersPg(): Promise<DigestSubscriberRow[]> {
  const sql = getSql();
  await ensureSchema(sql);
  return await sql<DigestSubscriberRow[]>`
    SELECT owner_id, email_digest_enabled, send_time_morning, send_time_evening, digest_email
    FROM digest_settings
    WHERE email_digest_enabled = true
  `;
}

export async function readAppDataPg(ownerId: string): Promise<AppData> {
  const sql = getSql();
  await ensureSchema(sql);

  const [settingsRow] = await sql<
    {
      email_digest_enabled: boolean;
      send_time_morning: string;
      send_time_evening: string;
      digest_email: string | null;
      digest_footer_notes: string | null;
    }[]
  >`
    SELECT email_digest_enabled, send_time_morning, send_time_evening, digest_email, digest_footer_notes
    FROM digest_settings
    WHERE owner_id = ${ownerId}
  `;

  const settings: UserSettings = settingsRow
    ? {
        emailDigestEnabled: settingsRow.email_digest_enabled,
        sendTimesLocal: [
          settingsRow.send_time_morning,
          settingsRow.send_time_evening,
        ] as [string, string],
        digestEmail: settingsRow.digest_email,
        digestFooterNotes: settingsRow.digest_footer_notes,
      }
    : defaultSettings;

  const accountRows = await sql<
    {
      id: string;
      name: string;
      type: string;
      balance: number;
      currency: string;
      source_type: string;
      source_ref: string;
      updated_at: Date;
      metadata: Record<string, string> | null;
    }[]
  >`
    SELECT id, name, type, balance, currency, source_type, source_ref, updated_at, metadata
    FROM accounts
    WHERE owner_id = ${ownerId}
    ORDER BY updated_at DESC
  `;

  const accounts: Account[] = accountRows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as Account["type"],
    balance: r.balance,
    currency: r.currency,
    sourceType: r.source_type as SourceType,
    sourceRef: r.source_ref,
    updatedAt: r.updated_at.toISOString(),
    metadata:
      r.metadata && Object.keys(r.metadata).length > 0 ? r.metadata : undefined,
  }));

  const accountIds = accounts.map((a) => a.id);
  const txRows =
    accountIds.length === 0
      ? []
      : await sql<
          {
            id: string;
            account_id: string;
            posted_at: string;
            description: string;
            amount: number;
          }[]
        >`
          SELECT id, account_id, posted_at, description, amount
          FROM transactions
          WHERE account_id IN ${sql(accountIds)}
          ORDER BY posted_at DESC
        `;

  const transactions: Transaction[] = txRows.map((r) => ({
    id: r.id,
    accountId: r.account_id,
    postedAt: r.posted_at,
    description: r.description,
    amount: r.amount,
  }));

  const ingRows = await sql<
    { id: string; source_type: string; created_at: Date }[]
  >`
    SELECT id, source_type, created_at
    FROM ingestions
    WHERE owner_id = ${ownerId}
    ORDER BY created_at DESC
  `;

  const ingestions = ingRows.map((r) => ({
    id: r.id,
    sourceType: r.source_type as SourceType,
    createdAt: r.created_at.toISOString(),
  }));

  return { accounts, transactions, settings, ingestions };
}

export async function writeAppDataPg(
  ownerId: string,
  next: AppData,
): Promise<void> {
  const db = getSql();
  await ensureSchema(db);

  await db.begin(async (txn) => {
    const t = txn as unknown as PgTxnUnsafe;
    await txn.unsafe(
      `DELETE FROM transactions
       WHERE account_id IN (SELECT id FROM accounts WHERE owner_id = $1)`,
      [ownerId],
    );
    await txn.unsafe(`DELETE FROM accounts WHERE owner_id = $1`, [ownerId]);
    await txn.unsafe(`DELETE FROM ingestions WHERE owner_id = $1`, [ownerId]);

    for (const batch of chunk(next.accounts, ACCOUNT_INSERT_CHUNK)) {
      await insertAccountsBatch(t, ownerId, batch);
    }

    for (const batch of chunk(next.transactions, TRANSACTION_INSERT_CHUNK)) {
      await insertTransactionsBatch(t, batch);
    }

    if (next.ingestions.length > 0) {
      for (const batch of chunk(next.ingestions, 500)) {
        await insertIngestionsBatch(t, ownerId, batch);
      }
    }

    await txn.unsafe(
      `INSERT INTO digest_settings (owner_id, email_digest_enabled, send_time_morning, send_time_evening, digest_email, digest_footer_notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (owner_id) DO UPDATE SET
         email_digest_enabled = EXCLUDED.email_digest_enabled,
         send_time_morning = EXCLUDED.send_time_morning,
         send_time_evening = EXCLUDED.send_time_evening,
         digest_email = EXCLUDED.digest_email,
         digest_footer_notes = EXCLUDED.digest_footer_notes`,
      [
        ownerId,
        next.settings.emailDigestEnabled,
        next.settings.sendTimesLocal[0],
        next.settings.sendTimesLocal[1],
        next.settings.digestEmail?.trim() || null,
        next.settings.digestFooterNotes?.trim() || null,
      ],
    );
  });
}

export async function updateSettingsPg(
  ownerId: string,
  settings: UserSettings,
): Promise<void> {
  const sql = getSql();
  await ensureSchema(sql);
  await sql`
    INSERT INTO digest_settings (owner_id, email_digest_enabled, send_time_morning, send_time_evening, digest_email, digest_footer_notes)
    VALUES (
      ${ownerId},
      ${settings.emailDigestEnabled},
      ${settings.sendTimesLocal[0]},
      ${settings.sendTimesLocal[1]},
      ${settings.digestEmail?.trim() || null},
      ${settings.digestFooterNotes?.trim() || null}
    )
    ON CONFLICT (owner_id) DO UPDATE SET
      email_digest_enabled = EXCLUDED.email_digest_enabled,
      send_time_morning = EXCLUDED.send_time_morning,
      send_time_evening = EXCLUDED.send_time_evening,
      digest_email = EXCLUDED.digest_email,
      digest_footer_notes = EXCLUDED.digest_footer_notes
  `;
}
