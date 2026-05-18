import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function getSql(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!client) {
    client = postgres(url, { max: 1 });
  }
  return client;
}

export async function ensureSchema(
  sql: ReturnType<typeof postgres>,
): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      id int PRIMARY KEY DEFAULT 1,
      email_digest_enabled boolean NOT NULL DEFAULT false,
      send_time_morning text NOT NULL DEFAULT '08:00',
      send_time_evening text NOT NULL DEFAULT '18:00',
      CONSTRAINT app_settings_single_row CHECK (id = 1)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id text PRIMARY KEY,
      name text NOT NULL,
      type text NOT NULL,
      balance double precision NOT NULL,
      currency text NOT NULL DEFAULT 'USD',
      source_type text NOT NULL,
      source_ref text NOT NULL DEFAULT '',
      updated_at timestamptz NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id text PRIMARY KEY,
      account_id text NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
      posted_at text NOT NULL,
      description text NOT NULL,
      amount double precision NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS ingestions (
      id text PRIMARY KEY,
      source_type text NOT NULL,
      created_at timestamptz NOT NULL
    )
  `;
  await sql`
    ALTER TABLE accounts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb
  `;
  await sql`
    INSERT INTO app_settings (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS digest_settings (
      owner_id text PRIMARY KEY,
      email_digest_enabled boolean NOT NULL DEFAULT false,
      send_time_morning text NOT NULL DEFAULT '08:00',
      send_time_evening text NOT NULL DEFAULT '18:00'
    )
  `;
  await sql`ALTER TABLE digest_settings ADD COLUMN IF NOT EXISTS digest_email text`;
  await sql`ALTER TABLE digest_settings ADD COLUMN IF NOT EXISTS digest_footer_notes text`;

  await sql`
    INSERT INTO digest_settings (owner_id, email_digest_enabled, send_time_morning, send_time_evening)
    SELECT 'legacy_shared', email_digest_enabled, send_time_morning, send_time_evening
    FROM app_settings WHERE id = 1
    ON CONFLICT (owner_id) DO NOTHING
  `;

  await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS owner_id text`;
  await sql`
    UPDATE accounts SET owner_id = 'legacy_shared' WHERE owner_id IS NULL
  `;
  await sql`
    ALTER TABLE accounts ALTER COLUMN owner_id SET DEFAULT 'legacy_shared'
  `;
  await sql`
    ALTER TABLE accounts ALTER COLUMN owner_id SET NOT NULL
  `;

  await sql`ALTER TABLE ingestions ADD COLUMN IF NOT EXISTS owner_id text`;
  await sql`
    UPDATE ingestions SET owner_id = 'legacy_shared' WHERE owner_id IS NULL
  `;
  await sql`
    ALTER TABLE ingestions ALTER COLUMN owner_id SET DEFAULT 'legacy_shared'
  `;
  await sql`
    ALTER TABLE ingestions ALTER COLUMN owner_id SET NOT NULL
  `;
}
