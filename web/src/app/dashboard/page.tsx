"use client";

import { useCallback, useEffect, startTransition, useState } from "react";

import { SessionNav } from "@/app/SessionNav";
import type { Account, ActionItem } from "@/lib/types";

const DONE_ACCOUNTS_KEY = "bwarp_dashboard_done_accounts";
const DONE_ACTIONS_KEY = "bwarp_dashboard_done_actions";
const URGENT_PRIORITIES_MAX = 5;

type Payload = {
  highlights: string[];
  actions: ActionItem[];
  accounts: Account[];
};

function loadStringIdList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function DashboardPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneAccountIds, setDoneAccountIds] = useState<string[]>([]);
  const [doneActionIds, setDoneActionIds] = useState<string[]>([]);

  useEffect(() => {
    const accounts = loadStringIdList(DONE_ACCOUNTS_KEY);
    const actions = loadStringIdList(DONE_ACTIONS_KEY);
    startTransition(() => {
      setDoneAccountIds(accounts);
      setDoneActionIds(actions);
    });
  }, []);

  useEffect(() => {
    fetch("/api/insights", { credentials: "include" })
      .then((r) => r.json())
      .then((json: Payload) => setData(json))
      .catch(() => setError("Could not load data. Try refresh or upload a file."));
  }, []);

  const toggleAccountDone = useCallback((id: string) => {
    setDoneAccountIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = [...set];
      try {
        localStorage.setItem(DONE_ACCOUNTS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  const toggleActionDone = useCallback((id: string) => {
    setDoneActionIds((prev) => {
      const set = new Set(prev);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      const next = [...set];
      try {
        localStorage.setItem(DONE_ACTIONS_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota */
      }
      return next;
    });
  }, []);

  const doneAccountSet = new Set(doneAccountIds);
  const doneActionSet = new Set(doneActionIds);

  return (
    <main className="container">
      <header className="page-hero">
        <p className="kicker">Dashboard</p>
        <h1>Your accounts</h1>
        <p className="page-hero__lede muted">
          Sorted by open tickets first, then oldest ticket update, then dollar
          value. Wrong amounts? Fix the spreadsheet and upload again.
        </p>
      </header>
      <div className="page-toolbar page-toolbar--spaced">
        <a className="button secondary" href="/upload">
          Upload CSV
        </a>
        <a className="button secondary" href="/settings">
          Email digest
        </a>
      </div>
      <SessionNav />

      {error && <p className="status-banner">{error}</p>}
      {!data && !error && (
        <p className="status-banner muted">Loading…</p>
      )}

      {data && (
        <>
          <section className="card">
            <h2>Numbers from your file</h2>
            <ul>
              {data.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Urgent priorities</h2>
            <ul className="account-list">
              {data.actions.slice(0, URGENT_PRIORITIES_MAX).map((a) => {
                const isDone = doneActionSet.has(a.id);
                return (
                  <li
                    key={a.id}
                    className={`account-row${isDone ? " account-row--done" : ""}`}
                  >
                    <div className="account-row__body">
                      <strong>{a.title}</strong>{" "}
                      <span className={`priority priority--${a.priority}`}>
                        {a.priority}
                      </span>
                      <div className="muted account-row__meta">{a.why}</div>
                      <div>{a.nextStep}</div>
                    </div>
                    <label className="account-row__check">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleActionDone(a.id)}
                        aria-label={`Done with priority: ${a.title}`}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <h2>Accounts — urgent first</h2>
            <ul className="account-list">
              {data.accounts.map((acc) => {
                const m = acc.metadata;
                const metaLine = m
                  ? [
                      m.ticket_updated_at &&
                        `Ticket updated: ${m.ticket_updated_at}`,
                      m.deal_stage && `Deal: ${m.deal_stage}`,
                      m.service_stage && `Service: ${m.service_stage}`,
                      m.active_tickets && `Open tickets: ${m.active_tickets}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "";
                const isDone = doneAccountSet.has(acc.id);
                return (
                  <li
                    key={acc.id}
                    className={`account-row${isDone ? " account-row--done" : ""}`}
                  >
                    <div className="account-row__body">
                      <strong>{acc.name}</strong> ({acc.type}) — Value{" "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: acc.currency,
                      }).format(acc.balance)}
                      {metaLine && (
                        <div className="muted account-row__meta">{metaLine}</div>
                      )}
                    </div>
                    <label className="account-row__check">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={() => toggleAccountDone(acc.id)}
                        aria-label={`Done with ${acc.name}`}
                      />
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
