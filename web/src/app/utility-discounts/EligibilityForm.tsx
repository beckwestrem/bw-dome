"use client";

import { FormEvent, useState } from "react";

import type { EligibilityResult } from "@/lib/utility-discounts/types";
import { QUALIFYING_ASSISTANCE_PROGRAMS } from "@/programs/pge_care_fera/workflow";

import { PrivacyNotice } from "./PrivacyNotice";

type Props = {
  onResult: (result: EligibilityResult, input: EligibilityFormPayload) => void;
};

export type EligibilityFormPayload = {
  utilityProvider: string;
  zipCode?: string;
  firstName?: string;
  lastName?: string;
  serviceAddress?: string;
  email?: string;
  phone?: string;
  preferredLanguage?: string;
  householdSize?: number;
  annualGrossIncome?: number;
  assistancePrograms: string[];
  billInUserName: boolean;
  isSubmeteredTenant?: boolean;
  isPastDue: boolean;
};

function optionalText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

export function EligibilityForm({ onResult }: Props) {
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);

  function toggleProgram(program: string) {
    setSelectedPrograms((current) =>
      current.includes(program)
        ? current.filter((item) => item !== program)
        : [...current, program],
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("Checking eligibility…");

    const formData = new FormData(event.currentTarget);
    const submetered = formData.get("isSubmeteredTenant");
    const payload: EligibilityFormPayload = {
      utilityProvider: String(formData.get("utilityProvider") ?? ""),
      zipCode: optionalText(formData, "zipCode"),
      firstName: optionalText(formData, "firstName"),
      lastName: optionalText(formData, "lastName"),
      serviceAddress: optionalText(formData, "serviceAddress"),
      email: optionalText(formData, "email"),
      phone: optionalText(formData, "phone"),
      preferredLanguage: optionalText(formData, "preferredLanguage"),
      householdSize: optionalNumber(formData, "householdSize"),
      annualGrossIncome: optionalNumber(formData, "annualGrossIncome"),
      assistancePrograms: selectedPrograms,
      billInUserName: formData.get("billInUserName") === "yes",
      isSubmeteredTenant:
        submetered === "yes" ? true : submetered === "no" ? false : undefined,
      isPastDue: formData.get("isPastDue") === "yes",
    };

    try {
      const response = await fetch("/api/utility-discounts/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await response.json()) as EligibilityResult & {
        error?: string;
      };

      if (!response.ok) {
        setStatus(json.error ?? "Could not check eligibility right now.");
        return;
      }

      onResult(json, payload);
      setStatus("");
    } catch {
      setStatus("Network error. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="utility-form" onSubmit={onSubmit}>
      <div className="utility-form__grid">
        <label>
          Utility provider
          <select name="utilityProvider" defaultValue="PGE">
            <option value="PGE">PG&amp;E</option>
            <option value="SCE">Southern California Edison</option>
            <option value="SDGE">SDG&amp;E</option>
            <option value="OTHER">Other / not sure</option>
          </select>
        </label>

        <label>
          ZIP code
          <input
            inputMode="numeric"
            maxLength={5}
            name="zipCode"
            pattern="[0-9]{5}"
            placeholder="94110"
          />
        </label>

        <label>
          First name
          <input autoComplete="given-name" name="firstName" placeholder="Alex" />
        </label>

        <label>
          Last name
          <input autoComplete="family-name" name="lastName" placeholder="Rivera" />
        </label>

        <label>
          Service address
          <input
            autoComplete="street-address"
            name="serviceAddress"
            placeholder="123 Market St"
          />
        </label>

        <label>
          Household size
          <input
            inputMode="numeric"
            min={1}
            name="householdSize"
            placeholder="2"
            type="number"
          />
        </label>

        <label>
          Gross annual household income
          <input
            inputMode="decimal"
            min={0}
            name="annualGrossIncome"
            placeholder="42000"
            step="1"
            type="number"
          />
        </label>

        <label>
          Is the bill in your name?
          <select name="billInUserName" defaultValue="yes">
            <option value="yes">Yes</option>
            <option value="no">No / not sure</option>
          </select>
        </label>

        <label>
          Is the bill currently past due?
          <select name="isPastDue" defaultValue="no">
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        <label>
          Are you a submetered tenant?
          <select name="isSubmeteredTenant" defaultValue="">
            <option value="">Not sure</option>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>

        <label>
          Email (optional)
          <input
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            type="email"
          />
        </label>

        <label>
          Phone
          <input
            autoComplete="tel"
            inputMode="tel"
            name="phone"
            placeholder="415-555-0142"
            type="tel"
          />
        </label>

        <label>
          Preferred language
          <select name="preferredLanguage" defaultValue="">
            <option value="">Choose one</option>
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="Chinese">Chinese</option>
            <option value="Tagalog">Tagalog</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label>
          Bill upload
          <input
            accept=".pdf,image/*"
            disabled
            name="billUpload"
            type="file"
          />
          <span className="muted utility-fineprint">
            Form-first MVP. Bill extraction can be added here later.
          </span>
        </label>
      </div>

      <fieldset className="utility-programs">
        <legend>Qualifying assistance programs</legend>
        <p className="muted utility-fineprint">
          Select any household programs that apply.
        </p>
        <div className="utility-programs__grid">
          {QUALIFYING_ASSISTANCE_PROGRAMS.map((program) => (
            <label className="toggle-field" key={program}>
              <input
                checked={selectedPrograms.includes(program)}
                onChange={() => toggleProgram(program)}
                type="checkbox"
              />
              <span>{program}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <PrivacyNotice />

      <div className="row">
        <button className="button" disabled={loading} type="submit">
          {loading ? "Checking…" : "Check eligibility"}
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </div>
    </form>
  );
}
