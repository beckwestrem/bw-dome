"use client";

import { FormEvent, useState } from "react";

import { SessionNav } from "@/app/SessionNav";
import {
  postFormDataWithUploadProgress,
  type UploadProgressPhase,
} from "@/lib/upload-with-progress";

type Issue = { row: number; message: string };

export default function UploadPage() {
  const [status, setStatus] = useState<string>("No file yet.");
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressPhase, setProgressPhase] = useState<UploadProgressPhase | null>(
    null,
  );
  const [uploadPercent, setUploadPercent] = useState<number | null>(0);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".csv")) {
      setStatus("Pick a .csv file.");
      setIssues([]);
      return;
    }

    setLoading(true);
    setIssues([]);
    setStatus("Starting upload…");
    setProgressPhase("uploading");
    setUploadPercent(0);

    try {
      const { ok, json } = await postFormDataWithUploadProgress(
        "/api/upload",
        formData,
        setUploadPercent,
        setProgressPhase,
      );

      if (!ok) {
        if (Array.isArray(json.issues)) {
          setIssues(json.issues as Issue[]);
          setStatus(
            (typeof json.error === "string" && json.error) ||
              "Fix the problems below and try again.",
          );
        } else {
          const base =
            (typeof json.error === "string" && json.error) || "Upload failed.";
          const detail =
            typeof json.detail === "string" && json.detail.trim()
              ? ` (${json.detail})`
              : "";
          setStatus(`${base}${detail}`);
        }
        return;
      }

      const accounts =
        typeof json.accountsImported === "number" ? json.accountsImported : 0;
      const txns =
        typeof json.transactionsImported === "number"
          ? json.transactionsImported
          : 0;
      setStatus(`Done. ${accounts} account(s), ${txns} row(s).`);
    } catch {
      setStatus("Network error or timeout — check your connection and try again.");
    } finally {
      setLoading(false);
      setProgressPhase(null);
      setUploadPercent(null);
    }
  }

  const showProgress = loading && progressPhase !== null;
  const pct = uploadPercent ?? 0;
  const indeterminate =
    progressPhase === "uploading" && uploadPercent === null;
  const processing = progressPhase === "processing";

  return (
    <main className="container">
      <header className="page-hero">
        <p className="kicker">Upload</p>
        <h1>Business upload</h1>
        <p className="upload-subtitle muted">
          CSV prioritization and KPIs
        </p>
        <p className="page-hero__lede muted upload-instructions">
          Need a money column (or debit/credit) and a company column — or one
          default name for the whole file. Each upload replaces your previous CSV
          snapshot. Row errors list below the form.
        </p>
      </header>
      <form className="card" onSubmit={onSubmit}>
        <label>
          File
          <input type="file" name="file" accept=".csv" required />
        </label>
        <label>
          Default name (only if the file has no company column)
          <input
            type="text"
            name="defaultAccountName"
            placeholder="One label for every row in this file"
            autoComplete="off"
          />
        </label>
        <p className="muted">
          Use this when every row is really the same account and the export does
          not name it.
        </p>
        <div className="row">
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Uploading…" : "Upload"}
          </button>
          <a className="button secondary" href="/dashboard">
            Dashboard
          </a>
        </div>
        {showProgress && (
          <div
            className="upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={
              indeterminate ? undefined : processing ? 100 : pct
            }
            aria-valuetext={
              processing
                ? "Processing on server"
                : indeterminate
                  ? "Uploading file"
                  : `Uploading ${pct}%`
            }
            aria-busy="true"
          >
            <div className="upload-progress__label">
              <span>
                {processing
                  ? "Processing on server…"
                  : indeterminate
                    ? "Uploading…"
                    : `Sending file… ${pct}%`}
              </span>
            </div>
            <div className="upload-progress__track">
              <div
                className={
                  indeterminate
                    ? "upload-progress__fill upload-progress__fill--indeterminate"
                    : "upload-progress__fill"
                }
                style={
                  indeterminate
                    ? undefined
                    : { width: `${processing ? 100 : pct}%` }
                }
              />
            </div>
          </div>
        )}
      </form>
      <p className="status-banner">{status}</p>
      {issues.length > 0 && (
        <ul className="card">
          {issues.map((i) => (
            <li key={`${i.row}-${i.message}`}>
              <strong>Row {i.row}:</strong> {i.message}
            </li>
          ))}
        </ul>
      )}
      <SessionNav />
    </main>
  );
}
