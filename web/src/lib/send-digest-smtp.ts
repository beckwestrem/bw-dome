import nodemailer from "nodemailer";

/**
 * Read env at runtime (dynamic key) so deploy platforms can inject vars after build
 * without Next bundling them away as undefined.
 */
function envStr(...names: readonly string[]): string | undefined {
  for (const name of names) {
    const v = process.env[name];
    if (typeof v === "string") {
      const t = v.trim();
      if (t) return t;
    }
  }
  return undefined;
}

export type ResolvedSmtpEnv = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

/** Resolve SMTP settings from env (supports common Railway / provider aliases). */
export function resolveSmtpEnv(): ResolvedSmtpEnv | null {
  const host = envStr("SMTP_HOST");
  const user = envStr("SMTP_USERNAME", "SMTP_USER");
  const pass = envStr("SMTP_PASSWORD", "SMTP_PASS");
  const from = envStr(
    "DIGEST_SENDER_EMAIL",
    "SMTP_FROM",
    "MAIL_FROM",
    "EMAIL_FROM",
  );
  if (!host || !user || !pass || !from) {
    return null;
  }
  const portRaw = envStr("SMTP_PORT");
  const parsed = Number(portRaw || "587");
  const port =
    Number.isFinite(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : 587;
  return { host, port, user, pass, from };
}

export function smtpConfigured(): boolean {
  return resolveSmtpEnv() !== null;
}

/**
 * Human-readable list of what is still unset (for Settings diagnostics).
 * Uses primary names; aliases shown in parentheses where applicable.
 */
export function smtpMissingEnvNames(): string[] {
  const missing: string[] = [];
  if (!envStr("SMTP_HOST")) missing.push("SMTP_HOST");
  if (!envStr("SMTP_USERNAME", "SMTP_USER")) {
    missing.push("SMTP_USERNAME (alias: SMTP_USER)");
  }
  if (!envStr("SMTP_PASSWORD", "SMTP_PASS")) {
    missing.push("SMTP_PASSWORD (alias: SMTP_PASS)");
  }
  if (!envStr("DIGEST_SENDER_EMAIL", "SMTP_FROM", "MAIL_FROM", "EMAIL_FROM")) {
    missing.push(
      "DIGEST_SENDER_EMAIL (aliases: SMTP_FROM, MAIL_FROM, EMAIL_FROM)",
    );
  }
  return missing;
}

export async function sendDigestEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ messageId?: string }> {
  const cfg = resolveSmtpEnv();
  if (!cfg) {
    throw new Error("SMTP is not configured (missing env vars).");
  }

  const secure = cfg.port === 465;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  const messageId =
    typeof info.messageId === "string" ? info.messageId : undefined;
  console.info("[sendDigestEmail] accepted by SMTP", {
    to: params.to,
    messageId,
  });
  return { messageId };
}
