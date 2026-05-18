from __future__ import annotations

import csv
from datetime import datetime, timedelta
from pathlib import Path

from newsletter.config import AccountConfig
from newsletter.connectors.base import Connector
from newsletter.models import AccountEvent, AccountSnapshot


class CsvBankConnector(Connector):
    def collect(self, account: AccountConfig) -> AccountSnapshot:
        csv_path = Path(account.settings["csv_path"])
        rows = []
        if csv_path.exists():
            with csv_path.open("r", newline="") as f:
                reader = csv.DictReader(f)
                rows = list(reader)

        balance = float(account.settings.get("current_balance", 0.0))
        recent_cutoff = datetime.now() - timedelta(days=7)
        recent = []
        for row in rows:
            posted = datetime.fromisoformat(row["posted_at"])
            amount = float(row["amount"])
            if posted >= recent_cutoff:
                recent.append(
                    {
                        "posted_at": row["posted_at"],
                        "description": row["description"],
                        "amount": amount,
                    }
                )

        events = []
        outflow = sum(abs(t["amount"]) for t in recent if t["amount"] < 0)
        if outflow > float(account.settings.get("weekly_outflow_alert", 1500)):
            events.append(
                AccountEvent(
                    title="Outflow spike",
                    detail=f"Last 7-day outflow is ${outflow:,.2f}.",
                    severity="warning",
                )
            )

        return AccountSnapshot(
            account_id=account.id,
            account_name=account.name,
            account_type=account.type,
            balance=balance,
            transactions_7d=recent,
            events=events,
        )
