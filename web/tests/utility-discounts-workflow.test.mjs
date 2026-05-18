import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(import.meta.url);
const moduleCache = new Map();

function resolveTs(specifier, fromFile) {
  if (specifier.startsWith("@/")) {
    return path.join(root, "src", `${specifier.slice(2)}.ts`);
  }
  if (specifier.startsWith(".")) {
    return path.join(path.dirname(fromFile), `${specifier}.ts`);
  }
  return specifier;
}

function loadTs(filePath) {
  const resolvedPath = path.resolve(filePath);
  const cached = moduleCache.get(resolvedPath);
  if (cached) return cached.exports;

  const source = fs.readFileSync(resolvedPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const loadedModule = { exports: {} };
  moduleCache.set(resolvedPath, loadedModule);

  const localRequire = (specifier) => {
    const nextPath = resolveTs(specifier, resolvedPath);
    if (nextPath.endsWith(".ts")) return loadTs(nextPath);
    return awaitlessRequire(nextPath);
  };

  const runner = new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    transpiled,
  );
  runner(
    loadedModule.exports,
    localRequire,
    loadedModule,
    resolvedPath,
    path.dirname(resolvedPath),
  );
  return loadedModule.exports;
}

function awaitlessRequire(specifier) {
  return require(specifier);
}

const workflowModule = loadTs(
  path.join(root, "src/programs/pge_care_fera/workflow.ts"),
);
const rulesModule = loadTs(
  path.join(root, "src/lib/utility-discounts/care-fera-rules.ts"),
);
const draftModule = loadTs(
  path.join(root, "src/lib/utility-discounts/form-draft-service.ts"),
);

const { PGE_CARE_FERA_WORKFLOW } = workflowModule;
const { checkPgeCareFeraEligibility, normalizeEligibilityInput } = rulesModule;
const { RulesBasedFormDraftService } = draftModule;

test("PG&E CARE/FERA workflow defines required MVP fields", () => {
  const requiredFields = [
    "utility_provider",
    "zip_code",
    "household_size",
    "annual_gross_income",
    "assistance_programs",
    "bill_in_user_name",
    "is_past_due",
  ];
  const definedFields = new Set(
    PGE_CARE_FERA_WORKFLOW.fieldDefinitions.map((field) => field.fieldKey),
  );

  for (const fieldKey of requiredFields) {
    assert.ok(definedFields.has(fieldKey), `${fieldKey} is defined`);
    assert.ok(
      PGE_CARE_FERA_WORKFLOW.requiredUserInputs.includes(fieldKey),
      `${fieldKey} is a required user input`,
    );
  }
});

test("sensitive blocklisted fields are not requested as draft fields", () => {
  const fieldBlob = PGE_CARE_FERA_WORKFLOW.fieldDefinitions
    .map((field) => `${field.fieldKey} ${field.label}`)
    .join(" ")
    .toLowerCase();

  for (const blocked of PGE_CARE_FERA_WORKFLOW.sensitiveFieldsBlocklist) {
    assert.equal(
      fieldBlob.includes(blocked.toLowerCase()),
      false,
      `${blocked} is not requested`,
    );
  }
});

test("LLM-fillable fields have source attribution rules", () => {
  const llmFillable = PGE_CARE_FERA_WORKFLOW.fieldDefinitions.filter(
    (field) => field.canLlmFill,
  );

  assert.ok(llmFillable.length > 0);
  for (const field of llmFillable) {
    assert.ok(field.sourcePriority.length > 0, `${field.fieldKey} has sources`);
    assert.ok(
      PGE_CARE_FERA_WORKFLOW.fieldMappingRules[field.fieldKey],
      `${field.fieldKey} has mapping rules`,
    );
  }
});

test("eligibility logic ignores LLM-like output", () => {
  const baseInput = {
    utilityProvider: "PGE",
    zipCode: "94110",
    householdSize: 2,
    annualGrossIncome: 42000,
    assistancePrograms: [],
    billInUserName: true,
    isPastDue: false,
  };
  const withLlmNoise = {
    ...baseInput,
    llmProgram: "NONE",
    llmConfidence: "UNLIKELY",
  };

  assert.deepEqual(
    checkPgeCareFeraEligibility(baseInput),
    checkPgeCareFeraEligibility(withLlmNoise),
  );
});

test("form draft marks missing fields instead of inventing values", async () => {
  const service = new RulesBasedFormDraftService();
  const input = normalizeEligibilityInput({
    utilityProvider: "PGE",
    billInUserName: true,
    isPastDue: false,
  });
  const draft = await service.createDraft(input);
  const draftedKeys = new Set(draft.fields.map((field) => field.fieldKey));

  assert.ok(draft.missingFields.includes("zip_code"));
  assert.ok(draft.missingFields.includes("household_size"));
  assert.ok(draft.missingFields.includes("annual_gross_income"));
  assert.equal(draftedKeys.has("zip_code"), false);
  assert.equal(draftedKeys.has("household_size"), false);
  assert.equal(draftedKeys.has("annual_gross_income"), false);
});
