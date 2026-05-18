"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { SessionNav } from "@/app/SessionNav";

type Settings = {
  emailDigestEnabled: boolean;
  sendTimesLocal: [string, string];
  digestEmail?: string | null;
  digestFooterNotes?: string | null;
};

function serializeForBaseline(s: Settings): string {
  return JSON.stringify({
    emailDigestEnabled: s.emailDigestEnabled,
    sendTimesLocal: s.sendTimesLocal,
    digestEmail: (s.digestEmail ?? "").trim(),
    digestFooterNotes: (s.digestFooterNotes ?? "").trim(),
  });
}

function formatSavedAt(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type DigestStatusPayload = {
  smtpConfigured: boolean;
  smtpMissingEnvNames?: string[];
  recipient: string | null;
  hasData: boolean;
  digestScheduled: boolean;
  hint: string;
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    emailDigestEnabled: false,
    sendTimesLocal: ["08:00", "18:00"],
    digestEmail: "",
    digestFooterNotes: "",
  });
  const baselineRef = useRef<string>("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [digestStatus, setDigestStatus] = useState<DigestStatusPayload | null>(
    null,
  );
  const [digestStatusLoading, setDigestStatusLoading] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const testResultRef = useRef<HTMLParagraphElement>(null);

  const [aeDraftText, setAeDraftText] = useState("");
  const [aeExecutiveEmail, setAeExecutiveEmail] = useState("");
  const [aeGenerating, setAeGenerating] = useState(false);
  const [aeSending, setAeSending] = useState(false);
  const [aeGenerateError, setAeGenerateError] = useState<string | null>(null);
  const [aeSendMessage, setAeSendMessage] = useState<string | null>(null);
  const aeSendResultRef = useRef<HTMLParagraphElement>(null);

  const sendBlockedReason = useMemo(() => {
    if (loadStatus !== "ready" || digestStatusLoading) return null;
    if (!digestStatus) {
      return "Could not load delivery status — tap Refresh status.";
    }
    if (!digestStatus.smtpConfigured) {
      const miss = digestStatus.smtpMissingEnvNames?.filter(Boolean) ?? [];
      if (miss.length > 0) {
        const where =
          process.env.NODE_ENV === "development"
            ? "Add to web/.env.local (see web/.env.example), then restart npm run dev"
            : "Add on Railway (web service → Variables), then redeploy";
        return `${where}: ${miss.join("; ")}`;
      }
      return "SMTP env vars are missing on this server (or redeploy after setting them).";
    }
    if (!digestStatus.recipient) {
      return "No recipient email — set Digest email below.";
    }
    if (!digestStatus.hasData) {
      return "No book data — upload a CSV on the Upload page first.";
    }
    return null;
  }, [loadStatus, digestStatusLoading, digestStatus]);

  const refreshDigestStatus = useCallback(async () => {
    setDigestStatusLoading(true);
    try {
      const r = await fetch("/api/digest/status", { credentials: "include" });
      if (!r.ok) {
        setDigestStatus(null);
        return;
      }
      const j = (await r.json()) as DigestStatusPayload;
      setDigestStatus(j);
    } catch {
      setDigestStatus(null);
    } finally {
      setDigestStatusLoading(false);
    }
  }, []);

  const dirty =
    loadStatus === "ready" &&
    serializeForBaseline(settings) !== baselineRef.current;

  useEffect(() => {
    fetch("/api/settings", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((json: Settings) => {
        const next: Settings = {
          ...json,
          digestEmail: json.digestEmail ?? "",
          digestFooterNotes: json.digestFooterNotes ?? "",
        };
        setSettings(next);
        baselineRef.current = serializeForBaseline(next);
        setLoadStatus("ready");
        setSaveBanner(null);
        void refreshDigestStatus();
      })
      .catch(() => {
        setLoadStatus("error");
        setSaveBanner("Could not load settings. Refresh or sign in again.");
      });
  }, [refreshDigestStatus]);

  const saveNow = useCallback(async () => {
    if (loadStatus !== "ready" || saving) return;
    setSaving(true);
    setSaveBanner(null);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
        credentials: "include",
      });
      if (!response.ok) {
        setSaveBanner("Could not save. Try again.");
        return;
      }
      const saved = (await response.json()) as Settings;
      const next: Settings = {
        ...saved,
        digestEmail: saved.digestEmail ?? "",
        digestFooterNotes: saved.digestFooterNotes ?? "",
      };
      setSettings(next);
      baselineRef.current = serializeForBaseline(next);
      setLastSavedAt(new Date());
      setSaveBanner(null);
      void refreshDigestStatus();
    } catch {
      setSaveBanner("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }, [loadStatus, saving, settings, refreshDigestStatus]);

  const sendTestDigest = useCallback(async () => {
    if (loadStatus !== "ready" || sendingTest) return;
    setSendingTest(true);
    setTestMessage(null);
    try {
      const r = await fetch("/api/digest/send-now", {
        method: "POST",
        credentials: "include",
      });
      const text = await r.text();
      let j: {
        ok?: boolean;
        message?: string;
        detail?: string;
        to?: string;
        messageId?: string;
      } = {};
      try {
        j = text ? (JSON.parse(text) as typeof j) : {};
      } catch {
        setTestMessage(
          `Bad response (HTTP ${r.status}). ${text.slice(0, 180)}${text.length > 180 ? "…" : ""}`,
        );
        return;
      }

      if (r.ok && j.ok === true) {
        const mid =
          typeof j.messageId === "string" && j.messageId.trim()
            ? ` Provider id: ${j.messageId.trim()}`
            : "";
        setTestMessage(
          (typeof j.message === "string" && j.message.trim()) ||
            `SMTP accepted for ${String(j.to ?? "recipient")}.${mid} Check inbox and spam folder.`,
        );
      } else {
        const detail =
          typeof j.detail === "string" && j.detail.trim()
            ? j.detail.trim()
            : `Request failed (HTTP ${r.status}).`;
        setTestMessage(
          j.to ? `${detail} (intended recipient: ${j.to})` : detail,
        );
      }
      void refreshDigestStatus();
      requestAnimationFrame(() => {
        testResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch {
      setTestMessage("Network error — could not reach the server.");
    } finally {
      setSendingTest(false);
    }
  }, [loadStatus, sendingTest, refreshDigestStatus]);

  const generateAeSummary = useCallback(async () => {
    if (loadStatus !== "ready" || aeGenerating) return;
    setAeGenerating(true);
    setAeGenerateError(null);
    setAeSendMessage(null);
    try {
      const r = await fetch("/api/ae-summary/generate", {
        method: "POST",
        credentials: "include",
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        text?: string;
        error?: string;
      };
      if (!r.ok || j.ok !== true) {
        setAeGenerateError(
          typeof j.error === "string" ? j.error : `Request failed (${r.status}).`,
        );
        return;
      }
      if (typeof j.text === "string") {
        setAeDraftText(j.text);
      }
    } catch {
      setAeGenerateError("Network error — could not reach the server.");
    } finally {
      setAeGenerating(false);
    }
  }, [loadStatus, aeGenerating]);

  const sendAeSummary = useCallback(async () => {
    if (loadStatus !== "ready" || aeSending) return;
    const text = aeDraftText.trim();
    const to = aeExecutiveEmail.trim();
    if (!text || !to) return;
    setAeSending(true);
    setAeSendMessage(null);
    setAeGenerateError(null);
    try {
      const r = await fetch("/api/ae-summary/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (r.ok && j.ok === true) {
        setAeSendMessage(
          typeof j.message === "string" ? j.message : `Sent to ${to}.`,
        );
      } else {
        setAeSendMessage(
          typeof j.error === "string"
            ? j.error
            : `Send failed (${r.status}).`,
        );
      }
      requestAnimationFrame(() => {
        aeSendResultRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } catch {
      setAeSendMessage("Network error — could not reach the server.");
    } finally {
      setAeSending(false);
    }
  }, [loadStatus, aeSending, aeDraftText, aeExecutiveEmail]);

  function onFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveNow();
  }

  return (
    <main className="container settings-page">
      <header className="page-hero">
        <p className="kicker">Settings</p>
        <h1>Email digest</h1>
        <p className="page-hero__lede muted">
          Personal digests, test sends, and stakeholder updates.
        </p>
      </header>

      <div className="settings-body">
        {loadStatus === "loading" && (
          <p className="settings-hint muted">Loading your settings…</p>
        )}

        <form
          id="digest-settings-form"
          className="settings-form"
          onSubmit={onFormSubmit}
          aria-busy={saving}
        >
          <section
            className="settings-panel settings-panel--digest-test"
            aria-labelledby="digest-test-heading"
          >
            <h2 id="digest-test-heading" className="settings-panel__title">
              Test delivery
            </h2>
            <p className="settings-panel__hint muted">
              One email using your saved recipient, upload, and notes.
            </p>
            {digestStatusLoading ? (
              <p className="digest-test-meta muted" aria-live="polite">
                Checking whether a test send is possible…
              </p>
            ) : sendBlockedReason ? (
              <p
                id="digest-send-blocked"
                className="digest-test-callout"
                role="status"
              >
                {sendBlockedReason}
              </p>
            ) : digestStatus?.recipient ? (
              <p className="digest-test-meta muted" aria-live="polite">
                Will send to{" "}
                <code className="digest-test-recipient">{digestStatus.recipient}</code>
              </p>
            ) : null}
            <div className="settings-test-actions">
              <button
                type="button"
                className="button"
                aria-describedby={
                  sendBlockedReason ? "digest-send-blocked" : undefined
                }
                disabled={
                  sendingTest ||
                  loadStatus !== "ready" ||
                  digestStatusLoading ||
                  !digestStatus?.smtpConfigured ||
                  !digestStatus?.recipient ||
                  !digestStatus?.hasData
                }
                onClick={() => void sendTestDigest()}
              >
                {sendingTest ? "Sending…" : "Send test digest now"}
              </button>
            </div>
            {testMessage ? (
              <p
                ref={testResultRef}
                className={`digest-test-result${testMessage.includes("SMTP accepted") || testMessage.includes("accepted for") ? " digest-test-result--ok" : ""}`}
                role="status"
              >
                {testMessage}
              </p>
            ) : null}
          </section>

          <section
            className="settings-panel settings-panel--ae-summary"
            aria-labelledby="ae-summary-heading"
          >
            <h2 id="ae-summary-heading" className="settings-panel__title">
              Daily summary for a stakeholder
            </h2>
            <p className="settings-panel__hint muted">
              End-of-day update from your upload and the notes in &quot;Extra
              context&quot; below (save those first if you changed them).
              Uses the same AI keys as the digest on the server (
              <code>ANTHROPIC_API_KEY</code> preferred).
            </p>
            <div className="settings-test-actions">
              <button
                type="button"
                className="button secondary"
                disabled={loadStatus !== "ready" || aeGenerating}
                onClick={() => void generateAeSummary()}
              >
                {aeGenerating ? "Generating…" : "Generate daily summary"}
              </button>
            </div>
            {aeGenerateError ? (
              <p className="digest-test-callout" role="alert">
                {aeGenerateError}
              </p>
            ) : null}
            <label className="ae-summary-draft-label">
              Summary (edit freely)
              <textarea
                className="ae-summary-draft"
                value={aeDraftText}
                onChange={(e) => setAeDraftText(e.target.value)}
                placeholder='Click "Generate daily summary…" to draft five bullets, or paste your own.'
                rows={12}
                spellCheck
              />
            </label>
            <p className="ae-summary-edit-hint muted">
              Edit and add context as needed.
            </p>
            <label>
              Stakeholder email
              <input
                type="email"
                value={aeExecutiveEmail}
                onChange={(e) => setAeExecutiveEmail(e.target.value)}
                placeholder="person@company.com"
                autoComplete="email"
              />
            </label>
            <div className="settings-test-actions">
              <button
                type="button"
                className="button"
                disabled={
                  aeSending ||
                  loadStatus !== "ready" ||
                  !aeDraftText.trim() ||
                  !aeExecutiveEmail.trim()
                }
                onClick={() => void sendAeSummary()}
              >
                {aeSending ? "Sending…" : "Send email"}
              </button>
            </div>
            {aeSendMessage ? (
              <p
                ref={aeSendResultRef}
                className={`digest-test-result${aeSendMessage.includes("accepted") || aeSendMessage.includes("Sent to") ? " digest-test-result--ok" : ""}`}
                role="status"
              >
                {aeSendMessage}
              </p>
            ) : null}
          </section>

          <section className="settings-panel" aria-labelledby="digest-where-heading">
            <h2 id="digest-where-heading" className="settings-panel__title">
              Where to send
            </h2>
            <p className="settings-panel__hint muted">
              Set the email address that should receive personal digest messages.
            </p>
            <label>
              Digest email
              <input
                type="email"
                value={settings.digestEmail ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, digestEmail: e.target.value }))
                }
                placeholder="you@company.com"
                autoComplete="email"
              />
            </label>
          </section>

          <section
            className="settings-panel"
            aria-labelledby="digest-context-heading"
          >
            <h2 id="digest-context-heading" className="settings-panel__title">
              Extra context in the email
            </h2>
            <p className="settings-panel__hint muted">
              Included in <strong>your</strong> digest email and sent to the
              stakeholder summary generator — blockers, escalations, reminders,
              and context the CSV does not include.
            </p>
            <label>
              Notes for the summary
              <textarea
                name="digestFooterNotes"
                rows={5}
                value={settings.digestFooterNotes ?? ""}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    digestFooterNotes: e.target.value,
                  }))
                }
                placeholder="e.g. Three customers ready for follow-up; Acme and Beta need replies; Harris is waiting on pricing…"
              />
            </label>
          </section>

          <section className="settings-panel" aria-labelledby="digest-schedule-heading">
            <h2 id="digest-schedule-heading" className="settings-panel__title">
              Schedule
            </h2>
            <p className="settings-panel__hint muted">
              Local times for morning and evening sends (when cron is configured).
            </p>
            <label className="toggle-field">
              <input
                type="checkbox"
                checked={settings.emailDigestEnabled}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    emailDigestEnabled: e.target.checked,
                  }))
                }
              />
              <span>Enable digest emails</span>
            </label>
            <div className="settings-time-grid">
              <label>
                Morning
                <input
                  type="time"
                  value={settings.sendTimesLocal[0]}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      sendTimesLocal: [e.target.value, s.sendTimesLocal[1]],
                    }))
                  }
                />
              </label>
              <label>
                Evening
                <input
                  type="time"
                  value={settings.sendTimesLocal[1]}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      sendTimesLocal: [s.sendTimesLocal[0], e.target.value],
                    }))
                  }
                />
              </label>
            </div>
          </section>
        </form>
      </div>

      <SessionNav />

      <div className="settings-save-bar" role="region" aria-label="Save digest settings">
        <div className="settings-save-bar__status">
          {saveBanner ? (
            <span className="settings-save-bar__message settings-save-bar__message--error">
              {saveBanner}
            </span>
          ) : saving ? (
            <span className="settings-save-bar__message muted">Saving…</span>
          ) : dirty ? (
            <span className="settings-save-bar__message settings-save-bar__message--pending">
              Unsaved changes
            </span>
          ) : lastSavedAt ? (
            <span className="settings-save-bar__message muted">
              Last saved {formatSavedAt(lastSavedAt)}
            </span>
          ) : loadStatus === "ready" ? (
            <span className="settings-save-bar__message muted">Up to date</span>
          ) : null}
        </div>
        <div className="settings-save-bar__actions">
          <button
            type="submit"
            form="digest-settings-form"
            className="button button--emphasis"
            disabled={saving || loadStatus !== "ready"}
          >
            {saving ? "Saving…" : "Save right now"}
          </button>
          <a className="button secondary" href="/dashboard">
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
