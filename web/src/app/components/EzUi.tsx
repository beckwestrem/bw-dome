import Link from "next/link";
import type { ReactNode } from "react";

export function EzBrandMark() {
  return (
    <span className="ez-brand-mark" aria-hidden="true">
      <span />
    </span>
  );
}

export function EzBrand() {
  return (
    <Link className="ez-brand" href="/" aria-label="Buffalo Billsaver home">
      <EzBrandMark />
      <span>Buffalo Billsaver</span>
    </Link>
  );
}

export function EzHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`ez-nav${compact ? " ez-nav--compact" : ""}`}>
      <div className="ez-container ez-nav__inner">
        <EzBrand />
        {!compact ? (
          <nav className="ez-nav__links" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#eligibility">Eligibility</a>
            <a href="#faq">FAQ</a>
          </nav>
        ) : null}
        <Link className="ez-button ez-button--small" href="/utility-discounts">
          Start application
        </Link>
      </div>
    </header>
  );
}

export function EzIcon({ children }: { children: ReactNode }) {
  return (
    <span className="ez-icon" aria-hidden="true">
      {children}
    </span>
  );
}

const steps = ["Eligibility check", "Application", "Review", "Submit"];

export function EzStepIndicator({ current }: { current: number }) {
  return (
    <nav className="ez-stepper" aria-label="Application progress">
      <ol>
        {steps.map((label, index) => {
          const number = index + 1;
          const complete = number < current;
          const active = number === current;
          return (
            <li
              className={complete ? "is-complete" : active ? "is-active" : ""}
              key={label}
              aria-current={active ? "step" : undefined}
            >
              <span className="ez-stepper__number">{complete ? "✓" : number}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function EzStatusBanner({
  tone,
  title,
  children,
}: {
  tone: "success" | "warning" | "error" | "neutral" | "pending";
  title: string;
  children: ReactNode;
}) {
  const symbol = tone === "success" ? "✓" : tone === "error" ? "!" : tone === "warning" ? "!" : "i";
  return (
    <div className={`ez-status ez-status--${tone}`} role="status" aria-live="polite">
      <span className="ez-status__icon" aria-hidden="true">{symbol}</span>
      <div>
        <strong>{title}</strong>
        <div>{children}</div>
      </div>
    </div>
  );
}

export function EzRadioGroup({
  legend,
  name,
  defaultValue,
  options,
  help,
}: {
  legend: string;
  name: string;
  defaultValue?: string;
  options: { label: string; value: "yes" | "no" | "" }[];
  help?: string;
}) {
  return (
    <fieldset className="ez-field ez-radio-group">
      <legend>{legend}</legend>
      <div className="ez-segmented">
        {options.map((option) => (
          <label key={`${name}-${option.label}`}>
            <input
              defaultChecked={option.value === defaultValue}
              name={name}
              type="radio"
              value={option.value}
              required
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {help ? <p className="ez-field__help">{help}</p> : null}
    </fieldset>
  );
}
