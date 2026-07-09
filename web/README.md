# Lower Bill Access Web App

This is the main web app for helping people prepare utility discount
applications and lower their bills.

The first full module is **LADWP EZ-SAVE**. It is built as a practical
application-prep workflow, not a chatbot and not a generic benefits portal.

The app also keeps the older business CSV dashboard and the PG&E CARE/FERA
prototype as secondary modules.

## What The App Does

- Checks likely eligibility with deterministic rules
- Prepares a reviewable application draft
- Shows missing fields clearly
- Helps the user copy answers for the official application
- Hands the user off to the official utility program page
- Avoids SSNs, bank details, income document uploads, and other unnecessary sensitive data

It does **not** guarantee approval or submit applications automatically.

## License

This code is visible for review, but it is not currently open source. Do not
fork, reuse, host, modify, or redistribute it without written permission from
the copyright owner. See the repository root `LICENSE`.

## Run Locally

Requires Node 20 or newer.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Without `DATABASE_URL`, data is stored in `web/data/app-data.json`, which is fine for local development.

## Utility Discount Modules

Primary flow:

```text
/utility-discounts
/utility-discounts/ladwp-ez-save
```

LADWP files:

```text
src/programs/ladwp_ez_save/workflow.ts
src/programs/ladwp_ez_save/rules.ts
src/programs/ladwp_ez_save/draft-service.ts
src/programs/ladwp_ez_save/pdf-service.ts
```

API routes:

```text
POST /api/programs/ladwp-ez-save/check
POST /api/programs/ladwp-ez-save/draft
POST /api/programs/ladwp-ez-save/pdf
```

The PDF route is currently a clean stub. Real PDF filling should be added only
after mapping the official LADWP PDF fields and adding a PDF form library.

Secondary PG&E files are kept under:

```text
src/programs/pge_care_fera/
src/lib/utility-discounts/
```

## CSV Upload

This is the older account manager product. It is still available from the home
page as **Business work queue**.

Each upload replaces the previous CSV snapshot from file upload. Data ingested through the automation API is kept alongside the latest file upload. Settings are unchanged.

The upload parser accepts:
- a money column such as `amount`, `value`, `balance`, debit/credit columns, or a dashboard value column
- a name column such as `company`, `client`, `account`, `account_name`, or `name`
- optional operational columns such as stage, ticket status, ticket task, owner, notes, last communication, and updated-at dates

Invalid rows return `422` with:

```json
{ "issues": [{ "row": 2, "message": "Amount is required" }] }
```

Example headers:

```text
account_id,account_name,account_type,balance,currency,posted_at,description,amount
```

For dashboard-style rows, you can also upload columns like:

```text
company,deal stage,service stage,ticket task,ticket status,total value,total revenue,pending orders,ticket updated at,notes
```

Those legacy column names are still accepted for compatibility, but the app presents them as generic business status, value, and task signals.

## Auth

When `APP_PASSWORD` is set, these require a signed session cookie:
- `/dashboard`
- `/upload`
- `/settings`
- `/api/insights`
- `/api/upload`
- `/api/settings`

If `APP_PASSWORD` is unset, auth is disabled for local development.

For any public or shared deployment, set `APP_PASSWORD` before allowing real
users, uploads, or application-prep data. The unauthenticated mode is only for
local development.

Also set:
- `CRON_SECRET` before enabling scheduled digest sends
- `MCP_INGEST_SECRET` before allowing automation to write through `/api/ingest/mcp`
- SMTP variables before sending mail
- LLM API keys only if generated summaries are desired

Never commit real `.env`, `.env.local`, production database URLs, SMTP
credentials, API keys, user uploads, or generated `web/data` runtime files.

## Storage

When `DATABASE_URL` is set, the app uses Postgres for accounts, transactions, settings, ingestions, and LADWP EZ-SAVE signed fax submission receipts. Tables are created automatically on first request.

Without `DATABASE_URL`, the app uses local JSON storage at `web/data/app-data.json`.

LADWP EZ-SAVE automatic fax requires `DATABASE_URL` so the app can keep a receipt-token submission record. Set `SINCH_FAX_PROJECT_ID`, `SINCH_FAX_ACCESS_KEY`, and `SINCH_FAX_ACCESS_SECRET` for Sinch Fax API delivery. `SINCH_FAX_CALLBACK_URL` is optional. The older `LADWP_EZ_SAVE_FAX_WEBHOOK_URL` fallback is still supported for a custom fax relay.

## Email Digests

The app does not send mail until SMTP variables are configured. Copy names from `web/.env.example`.

| Variable | Purpose |
|----------|---------|
| `SMTP_HOST` | Mail provider hostname |
| `SMTP_PORT` | Usually `587` or `465` |
| `SMTP_USERNAME` | SMTP login (alias: `SMTP_USER`) |
| `SMTP_PASSWORD` | SMTP password or app password (alias: `SMTP_PASS`) |
| `DIGEST_SENDER_EMAIL` | From address (aliases: `SMTP_FROM`, `MAIL_FROM`, `EMAIL_FROM`) |

The Settings page lists any missing variables.

To send on a schedule, post to `/api/cron/digest` with:

```text
Authorization: Bearer <CRON_SECRET>
```

## LLM Summaries

Digest and stakeholder summary bullets can be drafted with an LLM. If no LLM key is set, the app uses deterministic rule-based bullets.

Provider order:
1. `ANTHROPIC_API_KEY`
2. `OPENAI_API_KEY`
3. rule-based fallback

Optional model variables:
- `ANTHROPIC_MODEL`
- `OPENAI_MODEL`

The LLM only runs when sending/generating a digest or stakeholder summary. Dashboard prioritization remains rule-based in `src/lib/account-ranking.ts` and `src/lib/insights.ts`.
