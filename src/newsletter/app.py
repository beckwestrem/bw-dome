from __future__ import annotations

import argparse
import os
import time
from datetime import datetime

from newsletter.config import AccountConfig, load_config
from newsletter.connectors.csv_bank import CsvBankConnector
from newsletter.connectors.manual_snapshot import ManualSnapshotConnector
from newsletter.insights import build_digest
from newsletter.mailer import send_html_email
from newsletter.render import render_html


def collect_snapshots(accounts: list[AccountConfig]):
    snapshots = []
    for account in accounts:
        if not account.enabled:
            continue
        if account.connector == "csv_bank":
            snapshots.append(CsvBankConnector().collect(account))
        elif account.connector == "manual_snapshot":
            snapshots.append(ManualSnapshotConnector().collect(account))
        else:
            raise ValueError(f"Unknown connector: {account.connector}")
    return snapshots


def run_once(config_path: str, dry_run: bool):
    config = load_config(config_path)
    snapshots = collect_snapshots(config.accounts)
    digest = build_digest(config.owner_email, snapshots)
    html = render_html(digest)

    if dry_run:
        print(html)
        return

    send_html_email(
        smtp_host=os.environ["SMTP_HOST"],
        smtp_port=int(os.environ.get("SMTP_PORT", "587")),
        smtp_username=os.environ["SMTP_USERNAME"],
        smtp_password=os.environ["SMTP_PASSWORD"],
        sender=config.sender_email,
        recipient=config.owner_email,
        subject="Your Account Insight Digest",
        html_body=html,
    )
    print(f"Sent digest to {config.owner_email} at {datetime.now().isoformat()}")


def run_scheduler(config_path: str):
    config = load_config(config_path)
    send_times = set(config.send_times_local)
    sent_marker = set()

    while True:
        now = datetime.now()
        hhmm = now.strftime("%H:%M")
        marker = now.strftime("%Y-%m-%d") + "-" + hhmm
        if hhmm in send_times and marker not in sent_marker:
            run_once(config_path, dry_run=False)
            sent_marker.add(marker)
        time.sleep(20)


def main():
    parser = argparse.ArgumentParser(description="Twice-daily account insight newsletter.")
    parser.add_argument("--config", default="config/accounts.yaml")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--schedule", action="store_true")
    args = parser.parse_args()

    if args.schedule:
        run_scheduler(args.config)
    else:
        run_once(args.config, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
