"use client";

import { useEffect, useState } from "react";

type SessionState =
  | { status: "loading" }
  | { status: "hidden" }
  | { status: "guest" }
  | { status: "signedIn" };

export function SessionNav() {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json() as Promise<{ authEnabled: boolean; signedIn: boolean }>)
      .then((j) => {
        if (!j.authEnabled) setSession({ status: "hidden" });
        else if (j.signedIn) setSession({ status: "signedIn" });
        else setSession({ status: "guest" });
      })
      .catch(() => setSession({ status: "guest" }));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/";
  }

  if (session.status === "loading" || session.status === "hidden") {
    return null;
  }

  if (session.status === "signedIn") {
    return (
      <div className="row session-nav">
        <button type="button" className="button secondary" onClick={logout}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="row session-nav">
      <a className="button secondary" href="/login">
        Sign in
      </a>
    </div>
  );
}
