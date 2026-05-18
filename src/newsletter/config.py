from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass
class AccountConfig:
    id: str
    name: str
    type: str
    connector: str
    enabled: bool
    settings: dict[str, Any]


@dataclass
class AppConfig:
    owner_email: str
    sender_email: str
    send_times_local: list[str]
    accounts: list[AccountConfig]


def load_config(path: str | Path) -> AppConfig:
    data = yaml.safe_load(Path(path).read_text())
    return AppConfig(
        owner_email=data["owner_email"],
        sender_email=data["sender_email"],
        send_times_local=data["send_times_local"],
        accounts=[
            AccountConfig(
                id=a["id"],
                name=a["name"],
                type=a["type"],
                connector=a["connector"],
                enabled=bool(a.get("enabled", True)),
                settings=a.get("settings", {}),
            )
            for a in data["accounts"]
        ],
    )
