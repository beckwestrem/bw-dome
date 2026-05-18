from __future__ import annotations

from abc import ABC, abstractmethod

from newsletter.config import AccountConfig
from newsletter.models import AccountSnapshot


class Connector(ABC):
    @abstractmethod
    def collect(self, account: AccountConfig) -> AccountSnapshot:
        raise NotImplementedError
