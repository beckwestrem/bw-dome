import Link from "next/link";
import { ArrowRight, Check, FileText, Send } from "lucide-react";

import { EzHeader, EzIcon } from "./components/EzUi";
import { LADWP_EZ_SAVE_THRESHOLDS } from "@/programs/ladwp_ez_save/rules";

const trustPoints = [
  "Free to use",
  "Review everything before sending",
  "No income documents required with the initial application",
];

const eligibilityPoints = [
  ["LADWP residential customer", "The account must provide residential electric or water service."],
  ["Customer of record", "The application should match the person named on the LADWP account."],
  ["Primary residence", "The service address should be the home where you live most of the time."],
  ["Household income", "Your combined gross household income must fit LADWP’s current limits."],
  ["Dependent status", "Applicants generally cannot be claimed on another person’s tax return."],
];

export function HomeEzSaveTabs() {
  const incomeRows = Object.entries(LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome);

  return (
    <div className="ez-shell ez-home">
      <EzHeader />

      <main>
        <section className="ez-hero">
          <div className="ez-container ez-hero__grid">
            <div className="ez-hero__copy">
              <p className="ez-kicker">LADWP EZ-SAVE application help</p>
              <h1>Cut your utility bill and skip the application portal</h1>
              <p className="ez-hero__lead">
                Automated EZ-SAVE applications: in less than 5 minutes, LA residents
                can cut their utility bills with a single, free application.
              </p>
              <p className="ez-hero__note">
                Check your likely eligibility, prepare the official application,
                and send it to LADWP. LADWP makes the final decision.
              </p>
              <div className="ez-actions">
                <Link className="ez-button" href="/utility-discounts">
                  Check my eligibility <ArrowRight aria-hidden="true" size={17} />
                </Link>
                <a className="ez-button ez-button--secondary" href="#how-it-works">
                  How it works
                </a>
              </div>
              <ul className="ez-trust-list" aria-label="Service highlights">
                {trustPoints.map((point) => (
                  <li key={point}><Check aria-hidden="true" size={15} />{point}</li>
                ))}
              </ul>
            </div>

            <div className="ez-product-preview" aria-label="Example application progress">
              <div className="ez-product-preview__top">
                <div>
                  <span>EZ-SAVE application</span>
                  <strong>Ready in a few steps</strong>
                </div>
                <span className="ez-product-preview__badge">Secure review</span>
              </div>
              <div className="ez-product-preview__progress"><span /></div>
              <ol>
                <li className="is-done"><span>✓</span><div><strong>Eligibility checked</strong><small>You can continue either way</small></div></li>
                <li className="is-done"><span>✓</span><div><strong>Application prepared</strong><small>Every answer stays editable</small></div></li>
                <li className="is-current"><span>3</span><div><strong>Ready to send</strong><small>Fax directly or download the PDF</small></div></li>
              </ol>
              <div className="ez-product-preview__footer">
                <span>Estimated time</span><strong>Under 5 minutes</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="ez-section" id="how-it-works">
          <div className="ez-container">
            <div className="ez-section-heading">
              <p className="ez-kicker">How it works</p>
              <h2>One short path from questions to submission</h2>
              <p>Clear steps, plain language, and a chance to review everything before it leaves your hands.</p>
            </div>
            <div className="ez-how-grid">
              <article>
                <EzIcon><Check size={20} /></EzIcon><span className="ez-step-label">Step 1</span>
                <h3>Check eligibility</h3>
                <p>Answer a few quick questions. Even an uncertain result does not stop you from applying.</p>
              </article>
              <article>
                <EzIcon><FileText size={20} /></EzIcon><span className="ez-step-label">Step 2</span>
                <h3>Prepare the application</h3>
                <p>Enter your details manually or upload a bill to prefill basic account information.</p>
              </article>
              <article>
                <EzIcon><Send size={20} /></EzIcon><span className="ez-step-label">Step 3</span>
                <h3>Send it to LADWP</h3>
                <p>Review the completed application, then fax it directly or download the PDF.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="ez-section ez-section--subtle" id="eligibility">
          <div className="ez-container ez-eligibility-layout">
            <div>
              <p className="ez-kicker">Eligibility basics</p>
              <h2>What LADWP usually checks</h2>
              <p className="ez-section-intro">You can still apply if you are unsure. No proof of income is required with the initial application.</p>
              <div className="ez-eligibility-list">
                {eligibilityPoints.map(([title, description]) => (
                  <div key={title}><span aria-hidden="true"><Check size={14} /></span><div><strong>{title}</strong><p>{description}</p></div></div>
                ))}
              </div>
              <Link className="ez-button" href="/utility-discounts">Check my eligibility</Link>
            </div>

            <details className="ez-income-card">
              <summary>
                <span><small>Current income guide</small><strong>See household limits</strong></span>
                <span aria-hidden="true">＋</span>
              </summary>
              <div className="ez-income-grid">
                {incomeRows.map(([size, limit]) => (
                  <div key={size}><span>{size} {size === "1" ? "person" : "people"}</span><strong>${limit.toLocaleString()}</strong></div>
                ))}
              </div>
              <p>For households over 8 people, add ${LADWP_EZ_SAVE_THRESHOLDS.additionalPersonAmount.toLocaleString()} for each additional person.</p>
              <small>Income means combined gross annual household income. Limits effective {new Date(`${LADWP_EZ_SAVE_THRESHOLDS.effectiveDate}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</small>
            </details>
          </div>
        </section>

        <section className="ez-section" id="faq">
          <div className="ez-container ez-faq-layout">
            <div className="ez-section-heading ez-section-heading--left">
              <p className="ez-kicker">FAQ</p>
              <h2>Questions, answered clearly</h2>
              <p>Need more help? Text <a href="sms:+13233933120">(323) 393-3120</a>.</p>
            </div>
            <div className="ez-faq">
              <details><summary>Do I need to upload a bill?<span>＋</span></summary><p>No. Uploading a bill is optional. It can prefill basic details, but you can enter everything manually.</p></details>
              <details><summary>Do I need proof of income?<span>＋</span></summary><p>Not with the initial application. LADWP may ask you to verify eligibility after enrollment.</p></details>
              <details><summary>Does Buffalo Billsaver submit the application?<span>＋</span></summary><p>Yes, if you choose automatic fax. You can also download the completed PDF and submit it yourself.</p></details>
              <details><summary>What if I am not sure I qualify?<span>＋</span></summary><p>You can still apply. The quick check is only an estimate, and LADWP makes the final decision.</p></details>
              <details><summary>What if my bill is past due?<span>＋</span></summary><p>You can still apply, but enrollment is not immediate. Contact LADWP about payment arrangements if your service is at risk.</p></details>
            </div>
          </div>
        </section>

        <section className="ez-bottom-cta">
          <div className="ez-container">
            <div><p className="ez-kicker">Ready when you are</p><h2>Check in under a minute. Apply in under five.</h2></div>
            <Link className="ez-button ez-button--light" href="/utility-discounts">Get started <ArrowRight aria-hidden="true" size={17} /></Link>
          </div>
        </section>

        <section className="ez-disclaimer">
          <div className="ez-container">Buffalo Billsaver helps prepare and submit an application. LADWP determines final eligibility and approval.</div>
        </section>
      </main>

      <footer className="ez-footer">
        <div className="ez-container"><span>© {new Date().getFullYear()} Buffalo Billsaver</span><a href="sms:+13233933120">Help and feedback</a></div>
      </footer>
    </div>
  );
}
