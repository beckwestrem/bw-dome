"use client";

import type {
  FieldDefinition,
  FieldValue,
  FormCompletionDraft,
} from "@/lib/utility-discounts/types";
import { PGE_CARE_FERA_WORKFLOW } from "@/programs/pge_care_fera/workflow";

import { useMemo, useState } from "react";

type Props = {
  draft: FormCompletionDraft;
  onBack: () => void;
};

function formatValue(value: FieldValue | undefined) {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

function parseValue(type: FieldDefinition["type"], value: string): FieldValue {
  if (type === "number") {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }
  if (type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  if (type === "multiselect") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return value;
}

export function FormDraftReview({ draft, onBack }: Props) {
  const initialValues = useMemo(() => {
    const values: Record<string, string> = {};
    for (const field of draft.fields) {
      values[field.fieldKey] = formatValue(field.value);
    }
    return values;
  }, [draft.fields]);
  const [values, setValues] = useState(initialValues);
  const [editing, setEditing] = useState<Record<string, boolean>>({});

  const draftByKey = new Map(draft.fields.map((field) => [field.fieldKey, field]));
  const missingLabels = draft.missingFields
    .map(
      (fieldKey) =>
        PGE_CARE_FERA_WORKFLOW.fieldDefinitions.find(
          (field) => field.fieldKey === fieldKey,
        )?.label ?? fieldKey,
    )
    .join(", ");

  function updateValue(field: FieldDefinition, rawValue: string) {
    const parsed = parseValue(field.type, rawValue);
    setValues((current) => ({
      ...current,
      [field.fieldKey]: formatValue(parsed),
    }));
  }

  return (
    <section className="utility-result utility-draft" aria-live="polite">
      <div className="utility-result__header">
        <p className="kicker">review before pg&amp;e</p>
        <h1>Application draft</h1>
        <p className="muted lead">
          Review and edit these answers before opening PG&amp;E. This app does
          not submit the application.
        </p>
      </div>

      {draft.missingFields.length > 0 ? (
        <div className="privacy-notice">
          <strong>Missing fields:</strong> {missingLabels}
        </div>
      ) : null}

      <div className="utility-draft__sections">
        {PGE_CARE_FERA_WORKFLOW.formSections.map((section) => (
          <section className="utility-result__section" key={section.title}>
            <h2>{section.title}</h2>
            <div className="utility-draft__rows">
              {section.fieldKeys.map((fieldKey) => {
                const definition = PGE_CARE_FERA_WORKFLOW.fieldDefinitions.find(
                  (field) => field.fieldKey === fieldKey,
                );
                if (!definition) return null;

                const draftField = draftByKey.get(fieldKey);
                const isEditing = editing[fieldKey] ?? !draftField;
                const value = values[fieldKey] ?? "";

                return (
                  <div className="utility-draft-row" key={fieldKey}>
                    <div className="utility-draft-row__meta">
                      <strong>{definition.label}</strong>
                      <span>{definition.userHelpText}</span>
                    </div>
                    <div className="utility-draft-row__control">
                      {definition.type === "select" && definition.allowedValues ? (
                        <select
                          disabled={!isEditing}
                          value={value}
                          onChange={(event) =>
                            updateValue(definition, event.currentTarget.value)
                          }
                        >
                          <option value="">Missing</option>
                          {definition.allowedValues.map((allowedValue) => (
                            <option key={allowedValue} value={allowedValue}>
                              {allowedValue}
                            </option>
                          ))}
                        </select>
                      ) : definition.type === "boolean" ? (
                        <select
                          disabled={!isEditing}
                          value={
                            value === "Yes" ? "true" : value === "No" ? "false" : ""
                          }
                          onChange={(event) =>
                            updateValue(definition, event.currentTarget.value)
                          }
                        >
                          <option value="">Missing</option>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </select>
                      ) : (
                        <input
                          disabled={!isEditing}
                          inputMode={
                            definition.type === "number" ? "decimal" : undefined
                          }
                          value={value}
                          onChange={(event) =>
                            updateValue(definition, event.currentTarget.value)
                          }
                        />
                      )}
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() =>
                          setEditing((current) => ({
                            ...current,
                            [fieldKey]: !isEditing,
                          }))
                        }
                      >
                        {isEditing ? "Done" : "Edit"}
                      </button>
                    </div>
                    <div className="utility-draft-row__status">
                      <span>
                        Source: {draftField?.source.replace("_", " ") ?? "missing"}
                      </span>
                      <span>
                        Confidence: {draftField?.confidence ?? "needs answer"}
                      </span>
                      <span>
                        Review:{" "}
                        {!draftField || draftField.needsReview ? "needed" : "ok"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="utility-result__section">
        <h2>Warnings</h2>
        <ul className="utility-list">
          {draft.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
          <li>
            We only use this information to estimate eligibility and prepare
            your form. Review all answers before submitting to PG&amp;E.
          </li>
        </ul>
      </section>

      <div className="row">
        <a
          className="button"
          href={PGE_CARE_FERA_WORKFLOW.applicationUrl}
          rel="noreferrer"
          target="_blank"
        >
          Open PG&amp;E application
        </a>
        <button className="button secondary" type="button" onClick={onBack}>
          Back to result
        </button>
      </div>
    </section>
  );
}
