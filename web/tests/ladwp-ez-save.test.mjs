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
const pdfModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/pdf-service.ts"),
);
const submissionModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/submission-service.ts"),
);
const billExtractionModule = loadTs(
  path.join(root, "src/programs/ladwp_ez_save/bill-extraction-service.ts"),
);

const { LADWP_EZ_SAVE_FIELDS, LADWP_EZ_SAVE_WORKFLOW } = workflowModule;
const { checkLadwpEzSaveEligibility, getLadwpEzSaveIncomeLimit } = rulesModule;
const { RulesBasedEzSaveDraftService } = draftModule;
const { PdfLibEzSavePdfService } = pdfModule;
const { LadwpFaxSubmissionService, prepareLadwpEmailDraft } = submissionModule;
const { LocalTextBillExtractionService } = billExtractionModule;

async function sampleLadwpDraft() {
  const draftService = new RulesBasedEzSaveDraftService();
  return draftService.createDraft({
    utilityProvider: "LADWP",
    isLadwpCustomer: true,
    firstName: "Jamie",
    lastName: "Rivera",
    middleInitial: "Q",
    serviceAddressStreetNumber: "123",
    serviceAddressStreetName: "Main St",
    apartmentNumber: "4B",
    phone: "2135551212",
    mobilePhone: "3105553434",
    householdTotal: 4,
    householdAdults: 2,
    householdChildren: 2,
    annualGrossHouseholdIncome: 64000,
    isCustomerOfRecord: true,
    isPrimaryResidence: true,
    claimedAsDependent: false,
    newApplicationOrRenewal: "new_application",
    consentToPrepareApplication: true,
    accountNumber: "1234567890",
  });
}

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

test("LADWP PDF service fills the official application template", async () => {
  const pdfService = new PdfLibEzSavePdfService();
  const draft = await sampleLadwpDraft();

  const result = await pdfService.fillApplicationPdf(draft);

  assert.equal(result.ok, true);
  assert.equal(result.fileName, "ladwp-ez-save-application-draft.pdf");
  assert.ok(result.bytes.length > 400_000);
  assert.equal(Buffer.from(result.bytes).subarray(0, 4).toString(), "%PDF");
});

test("LADWP email draft prepares a mailto handoff with attachment instructions", async () => {
  const draft = await sampleLadwpDraft();
  const result = prepareLadwpEmailDraft(draft, "application.pdf");

  assert.equal(result.ok, true);
  assert.equal(result.recipientEmail, null);
  assert.ok(result.mailtoHref.startsWith("mailto:?subject="));
  assert.match(decodeURIComponent(result.mailtoHref), /Attach this signed PDF/);
  assert.match(result.officialSubmissionNote, /does not list an email/);
});

test("LADWP fax service reports not configured without a provider", async () => {
  const service = new LadwpFaxSubmissionService({
    async fillApplicationPdf() {
      throw new Error("PDF should not be generated without a fax provider");
    },
  });
  const result = await service.sendFax(await sampleLadwpDraft());

  assert.equal(result.ok, false);
  assert.equal(result.status, "not_configured");
  assert.equal(result.faxNumber, LADWP_EZ_SAVE_WORKFLOW.faxNumber);
});

test("LADWP fax service sends base64 PDF payload through configured provider", async () => {
  const service = new LadwpFaxSubmissionService(
    {
      async fillApplicationPdf() {
        return {
          ok: true,
          fileName: "application.pdf",
          bytes: Uint8Array.from([37, 80, 68, 70]),
        };
      },
    },
    {
      async sendFax(input) {
        assert.equal(input.to, LADWP_EZ_SAVE_WORKFLOW.faxNumber);
        assert.equal(input.fileName, "application.pdf");
        assert.equal(input.pdfBase64, Buffer.from("%PDF").toString("base64"));
        return { ok: true, confirmationId: "fax_123" };
      },
    },
  );
  const result = await service.sendFax(await sampleLadwpDraft());

  assert.equal(result.ok, true);
  assert.equal(result.confirmationId, "fax_123");
});

test("LADWP bill extraction prefills obvious fields from text bills", async () => {
  const service = new LocalTextBillExtractionService();
  const billText = `
    Los Angeles Department of Water and Power
    Account Number: 123 456 7890
    Customer: Jamie Rivera
    Service Address: 123 Main St, Los Angeles, CA 90012
    Total Amount Due: $184.42
    Phone: 213-555-1212
    Past due balance
  `;

  const result = await service.extract({
    fileName: "ladwp-bill.txt",
    contentType: "text/plain",
    bytes: new TextEncoder().encode(billText),
  });
  const fields = Object.fromEntries(
    result.fields.map((field) => [field.fieldKey, field.value]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.provider, "local_text");
  assert.equal(fields.utilityProvider, "LADWP");
  assert.equal(fields.isLadwpCustomer, true);
  assert.equal(fields.accountNumber, "1234567890");
  assert.equal(fields.firstName, "Jamie");
  assert.equal(fields.lastName, "Rivera");
  assert.equal(fields.serviceAddressStreetNumber, "123");
  assert.equal(fields.serviceAddressStreetName, "Main St");
  assert.equal(fields.zipCode, "90012");
  assert.equal(fields.monthlyBillAmount, 184.42);
  assert.equal(fields.pastDueStatus, true);
  assert.match(result.warnings.join(" "), /Review all bill-derived fields/);
});

test("LADWP bill extraction does not require LLM/OCR to continue manually", async () => {
  const service = new LocalTextBillExtractionService();
  const result = await service.extract({
    fileName: "ladwp-bill.pdf",
    contentType: "application/pdf",
    bytes: Uint8Array.from([37, 80, 68, 70]),
  });

  assert.equal(result.ok, false);
  assert.equal(result.provider, "local_text");
  assert.deepEqual(result.fields, []);
  assert.match(result.warnings.join(" "), /PDF\/image extraction needs an LLM or OCR provider/);
});
