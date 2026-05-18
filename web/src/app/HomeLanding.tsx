"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SessionJson = {
  authEnabled: boolean;
  signedIn: boolean;
  guestLoginEnabled?: boolean;
};

export function HomeLanding() {
  const [session, setSession] = useState<SessionJson | null>(null);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json() as Promise<SessionJson>)
      .then((j) => setSession(j))
      .catch(() =>
        setSession({ authEnabled: true, signedIn: false, guestLoginEnabled: false }),
      );
  }, []);

  if (session === null) {
    return (
      <div className="landing-actions" aria-busy="true">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  if (!session.authEnabled) {
    return (
      <div className="row landing-actions">
        <Link className="button" href="/dashboard">
          Dashboard
        </Link>
        <Link className="button secondary" href="/upload">
          Upload file
        </Link>
        <Link className="button secondary" href="/settings">
          Settings
        </Link>
      </div>
    );
  }

  if (session.signedIn) {
    return (
      <div className="row landing-actions">
        <Link className="button" href="/dashboard">
          Dashboard
        </Link>
        <Link className="button secondary" href="/upload">
          Upload file
        </Link>
        <Link className="button secondary" href="/settings">
          Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="landing-gate">
      <p className="muted">
        Sign in with your app password to upload CSVs and keep your dashboard
        private.
      </p>
      <div className="row landing-actions">
        {session.guestLoginEnabled ? (
          <Link className="button" href="/login">
            Sign in
          </Link>
        ) : null}
        {!session.guestLoginEnabled ? (
          <p className="muted">
            Authentication is not configured. Set APP_PASSWORD to enable sign-in.
          </p>
        ) : null}
      </div>
    </div>
  );
}
