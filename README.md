# Lower Bill Access Project

This project is about helping working-class Americans get access to lower
utility bills without having to decode confusing program pages, PDFs, or
government-style forms.

The first full workflow is for **LADWP EZ-SAVE**, an income-qualified utility
discount program in Los Angeles. The app helps a person answer a few questions,
checks likely eligibility with deterministic rules, prepares an application
draft, and shows the fastest official handoff options.

The goal is simple:

- help people understand whether they may qualify
- prepare the application answers in plain language
- make the next step obvious
- avoid collecting sensitive information that is not needed
- never imply guaranteed approval

## License

(this is only temporary, intended to be open source soon)

This repository is currently published for visibility and review only. It is
not open source and does not grant permission to fork, reuse, host, modify, or
redistribute the code. See [`LICENSE`](LICENSE).

## Main App

The production web app lives in [`web/`](web/).

It currently includes:

- **LADWP EZ-SAVE bill checker**  
  The primary module. It checks likely eligibility, prepares a reviewable
  application draft, and guides the user to LADWP submission options.

- **PG&E CARE/FERA module**  
  A preserved secondary module for PG&E discount eligibility and application
  prep.

- **Business work queue**  
  The older CSV upload dashboard for prioritizing account or work items.

## Run the Web App Locally

Requires Node 20 or newer.

```bash
cd web
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

The utility discount flow is at:

```text
http://localhost:3000/utility-discounts
```

## Production Configuration

Local development can run without authentication, but any public or shared
deployment must set production secrets before accepting real users or uploads:

- `APP_PASSWORD` to enable password-protected access for private pages and APIs
- `CRON_SECRET` before enabling scheduled digest sends
- `MCP_INGEST_SECRET` before allowing machine ingestion from automation
- SMTP variables before sending email
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` only if LLM-generated summaries are desired

Do not commit real `.env`, `.env.local`, database URLs, SMTP credentials, API
keys, user uploads, or generated runtime data.

## Tests

From `web/`:

```bash
npm test
npm run lint
npm run build
```

## Program Design

Program-specific details live in structured files under:

```text
web/src/programs/
```

For example:

- `web/src/programs/ladwp_ez_save/workflow.ts`
- `web/src/programs/ladwp_ez_save/rules.ts`
- `web/src/programs/pge_care_fera/workflow.ts`

Eligibility decisions are deterministic. LLMs, where used later, should only
help with field cleanup, explanations, or draft formatting. They should not
decide eligibility or invent missing information.

## Legacy Python Newsletter

The original Python newsletter code is still in `src/newsletter/`. It can send
account insight emails from local CSV/JSON data, but it is no longer the main
focus of the project.

To run it:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp config/accounts.example.yaml config/accounts.yaml
cp .env.example .env
```

Then:

```bash
PYTHONPATH=src python -m newsletter.app --dry-run
```
