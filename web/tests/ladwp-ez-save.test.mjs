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
    return require(nextPath);
  };

  new Function(
    "exports",
    "require",
    "module",
    "__filename",
    "__dirname",
    transpiled,
  )(
    loadedModule.exports,
    localRequire,
    loadedModule,
    resolvedPath,
    path.dirname(resolvedPath),
  );
  return loadedModule.exports;
}

const workflowModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/workflow.ts"),
);
const rulesModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/rules.ts"),
);
const draftModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/draft-service.ts"),
);

const { LADWP_EZ_SAVE_FIELDS, LADWP_EZ_SAVE_WORKFLOW } = workflowModule;
const { checkLadwpEzSaveEligibility, getLadwpEzSaveIncomeLimit } = rulesModule;
const { RulesBasedEzSaveDraftService } = draftModule;

test("LADWP workflow defines required MVP fields", () => {
  const defined = new Set(LADWP_EZ_SAVE_FIELDS.map((field) => field.fieldKey));
  for (const fieldKey of LADWP_EZ_SAVE_WORKFLOW.requiredFields) {
    assert.ok(defined.has(fieldKey), `${fieldKey} is defined`);
  }
});

test("LADWP workflow does not request sensitive blocklisted fields", () => {
  const fieldBlob = LADWP_EZ_SAVE_FIELDS.map(
    (field) => `${field.fieldKey} ${field.label}`,
  )
    .join(" ")
    .toLowerCase();

  for (const blocked of LADWP_EZ_SAVE_WORKFLOW.sensitiveFieldsBlocklist) {
    assert.equal(
      fieldBlob.includes(blocked.toLowerCase()),
      false,
      `${blocked} is not requested`,
    );
  }
});

test("LADWP income limits include additional household members", () => {
  assert.equal(getLadwpEzSaveIncomeLimit(1), 42300);
  assert.equal(getLadwpEzSaveIncomeLimit(8), 108300);
  assert.equal(getLadwpEzSaveIncomeLimit(10), 130300);
});

test("LADWP eligibility is deterministic from rules", () => {
  const result = checkLadwpEzSaveEligibility({
    utilityProvider: "LADWP",
    isLadwpCustomer: true,
    householdTotal: 4,
    annualGrossHouseholdIncome: 64000,
    isCustomerOfRecord: true,
    isPrimaryResidence: true,
    claimedAsDependent: false,
  });
  assert.equal(result.status, "SUPPORTED_LIKELY_ELIGIBLE");

  const tooHigh = checkLadwpEzSaveEligibility({
    utilityProvider: "LADWP",
    isLadwpCustomer: true,
    householdTotal: 4,
    annualGrossHouseholdIncome: 90000,
    isCustomerOfRecord: true,
    isPrimaryResidence: true,
    claimedAsDependent: false,
    llmSaysApproved: true,
  });
  assert.equal(tooHigh.status, "SUPPORTED_UNLIKELY_ELIGIBLE");
});

test("LADWP draft uses missingFields instead of invented values", async () => {
  const service = new RulesBasedEzSaveDraftService();
  const draft = await service.createDraft({
    utilityProvider: "LADWP",
    isLadwpCustomer: true,
    isCustomerOfRecord: true,
    isPrimaryResidence: true,
    claimedAsDependent: false,
  });

  assert.ok(draft.missingFields.includes("first_name"));
  assert.ok(draft.missingFields.includes("annual_gross_household_income"));
  assert.equal(
    draft.fields.some((field) => field.fieldKey === "first_name"),
    false,
  );
});
