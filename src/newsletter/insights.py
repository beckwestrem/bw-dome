from __future__ import annotations

from datetime import datetime

from newsletter.models import ActionItem, Digest
from newsletter.models import AccountSnapshot


def build_digest(owner_email: str, snapshots: list[AccountSnapshot]) -> Digest:
    actions: list[ActionItem] = []
    highlights: list[str] = []

    total_balance = sum(s.balance for s in snapshots)
    highlights.append(f"Total tracked balance: ${total_balance:,.2f}")

    for snapshot in snapshots:
        if snapshot.account_type == "credit":
            utilization = snapshot.metadata.get("utilization_pct")
            if utilization is not None and utilization > 30:
                actions.append(
                    ActionItem(
                        title=f"Reduce utilization on {snapshot.account_name}",
                        why=f"Utilization is at {utilization:.1f}% (target < 30%).",
                        impact="Can improve credit profile and reduce interest risk.",
                        next_step="Make an extra payment this week.",
                        priority="high",
                    )
                )

        if snapshot.account_type == "bank" and snapshot.balance < 1000:
            actions.append(
                ActionItem(
                    title=f"Top up low cash buffer in {snapshot.account_name}",
                    why=f"Balance is ${snapshot.balance:,.2f}.",
                    impact="Helps avoid overdraft and keeps emergency liquidity.",
                    next_step="Transfer funds from a reserve account.",
                    priority="high",
                )
            )

        if snapshot.account_type == "investment":
            drift = snapshot.metadata.get("allocation_drift_pct")
            if drift is not None and drift > 5:
                actions.append(
                    ActionItem(
                        title=f"Rebalance {snapshot.account_name}",
                        why=f"Allocation drift is {drift:.1f}%.",
                        impact="Keeps risk aligned with your target plan.",
                        next_step="Place a rebalance trade on your next session.",
                        priority="medium",
                    )
                )

    if not actions:
        actions.append(
            ActionItem(
                title="No urgent actions",
                why="No threshold breaches were detected.",
                impact="Portfolio and cash position look stable.",
                next_step="Review recurring subscriptions this weekend.",
                priority="low",
            )
        )

    actions.sort(key=lambda a: {"high": 0, "medium": 1, "low": 2}[a.priority])

    return Digest(
        generated_at=datetime.now(),
        owner_email=owner_email,
        snapshots=snapshots,
        actions=actions,
        highlights=highlights,
    )
