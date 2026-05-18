"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
      credentials: "include",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as { error?: string }).error || "Login failed");
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="container auth-layout">
      <p className="kicker">Login</p>
      <h1>Sign in</h1>
      <p className="muted lead">Use the APP_PASSWORD configured for this app.</p>
      <form className="card" onSubmit={onSubmit}>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <div className="row">
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <Link className="button secondary" href="/">
            Back home
          </Link>
        </div>
      </form>
      {error && (
        <p className="status-banner" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

export default function LoginPage() {
  return <LoginForm />;
}
