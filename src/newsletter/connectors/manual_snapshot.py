from __future__ import annotations

import json
from pathlib import Path

from newsletter.config import AccountConfig
from newsletter.connectors.base import Connector
from newsletter.models import AccountEvent, AccountSnapshot


class ManualSnapshotConnector(Connector):
    def collect(self, account: AccountConfig) -> AccountSnapshot:
        snapshot_path = Path(account.settings["snapshot_path"])
        if not snapshot_path.exists():
            return AccountSnapshot(
                account_id=account.id,
                account_name=account.name,
                account_type=account.type,
                balance=0.0,
                events=[
                    AccountEvent(
                        title="Missing snapshot",
                        detail=f"No data file found at {snapshot_path}.",
                        severity="warning",
                    )
                ],
            )

        data = json.loads(snapshot_path.read_text())
        return AccountSnapshot(
            account_id=account.id,
            account_name=account.name,
            account_type=account.type,
            balance=float(data.get("balance", 0)),
            currency=data.get("currency", "USD"),
            transactions_7d=data.get("transactions_7d", []),
            events=[
                AccountEvent(**event) for event in data.get("events", [])
            ],
            metadata=data.get("metadata", {}),
        )
