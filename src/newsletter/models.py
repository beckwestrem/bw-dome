from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class AccountEvent:
    title: str
    detail: str
    severity: str = "info"


@dataclass
class AccountSnapshot:
    account_id: str
    account_name: str
    account_type: str
    balance: float
    currency: str = "USD"
    transactions_7d: list[dict[str, Any]] = field(default_factory=list)
    events: list[AccountEvent] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ActionItem:
    title: str
    why: str
    impact: str
    next_step: str
    priority: str = "medium"


@dataclass
class Digest:
    generated_at: datetime
    owner_email: str
    snapshots: list[AccountSnapshot]
    actions: list[ActionItem]
    highlights: list[str]
