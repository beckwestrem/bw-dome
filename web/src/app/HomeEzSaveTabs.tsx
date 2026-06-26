"use client";

import Link from "next/link";
import { useState } from "react";

import { LADWP_EZ_SAVE_THRESHOLDS } from "@/programs/ladwp_ez_save/rules";
import { LADWP_EZ_SAVE_WORKFLOW } from "@/programs/ladwp_ez_save/workflow";

type HomeTab = "home" | "eligibility" | "more";

const tabs: { key: HomeTab; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "eligibility", label: "Eligibility check" },
  { key: "more", label: "More info" },
];

export function HomeEzSaveTabs() {
  const [activeTab, setActiveTab] = useState<HomeTab>("home");

  return (
    <>
      <nav className="utility-tabbar home-tabbar" aria-label="EZ-SAVE home sections">
        {tabs.map((tab) => (
          <button
            aria-current={activeTab === tab.key ? "page" : undefined}
            className="utility-tabbar__button"
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "home" ? <HomePanel /> : null}
      {activeTab === "eligibility" ? <EligibilityInfo /> : null}
      {activeTab === "more" ? <MoreInfo /> : null}
    </>
  );
}

function HomePanel() {
  return (
    <>
      <header className="hero home-hero home-hero--ladwp">
        <p className="kicker">LADWP EZ-SAVE</p>
        <h1>
          Automated EZ-SAVE Applications: in less than 5 minutes, LA residents
          can cut their utility bills with a single, free application.
        </h1>
        <p className="muted lead">
          Answer a few short questions to automate your application quickly.
        </p>
        <div className="row">
          <Link className="button button--emphasis" href="/utility-discounts">
            Start application
          </Link>
          <Link className="button secondary" href="/utility-discounts/ladwp-ez-save">
            Learn about EZ-SAVE
          </Link>
        </div>
      </header>

      <HomeHighlights />
    </>
  );
}

function HomeHighlights() {
  return (
    <section className="ladwp-home-grid" aria-label="EZ-SAVE highlights">
      <article className="ladwp-home-card">
        <p className="kicker">monthly discount</p>
        <h2>EZ-SAVE is for income-qualified LADWP households</h2>
        <p>
          The program is for eligible LADWP residential customers. This tool
          checks the core household and income details, then builds the
          application draft from your answers.
        </p>
      </article>
      <article className="ladwp-home-card">
        <p className="kicker">service protection</p>
        <h2>Enrollment can help keep utilities on</h2>
        <p>
          Once LADWP accepts and enrolls a customer in EZ-SAVE, program
          participants receive discount benefits and shutoff protections tied to
          the program. Past-due bills may still need separate LADWP payment
          arrangements.
        </p>
      </article>
      <article className="ladwp-home-card">
        <p className="kicker">review first</p>
        <h2>Submission support is getting faster</h2>
        <p>
          Today you can download the completed PDF and submit it through
          LADWP&apos;s fax or mail options. Very soon, automated fax to program
          administrators will be available inside this app.
        </p>
      </article>
    </section>
  );
}

function EligibilityInfo() {
  const incomeRows = Object.entries(LADWP_EZ_SAVE_THRESHOLDS.householdMaxIncome);

  return (
    <section className="utility-info-page" aria-labelledby="home-eligibility-title">
      <div className="utility-info-page__header">
        <p className="kicker">eligibility check</p>
        <h1 id="home-eligibility-title">What LADWP usually checks</h1>
        <p className="muted lead">
          Even if you are unsure about your eligibility, you can still apply.
          LADWP makes the final decision.
        </p>
      </div>

      <div className="eligibility-chart" aria-label="EZ-SAVE eligibility requirements">
        <div className="eligibility-chart__row">
          <strong>LADWP residential customer</strong>
          <span>The account should be for your home&apos;s LADWP electric or water service.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Customer of record</strong>
          <span>The application should match the person named on the LADWP account.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Primary residence</strong>
          <span>The address should be where you live most of the time.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Not claimed as a dependent</strong>
          <span>Applicants generally cannot be listed as someone else&apos;s tax dependent.</span>
        </div>
        <div className="eligibility-chart__row">
          <strong>Household income</strong>
          <span>Household income is compared with LADWP&apos;s current income limits.</span>
        </div>
      </div>

      <section className="utility-income-table" aria-labelledby="home-income-limits-title">
        <h2 id="home-income-limits-title">Current income guide</h2>
        <div className="utility-income-table__grid">
          {incomeRows.map(([size, limit]) => (
            <div className="utility-income-table__cell" key={size}>
              <span>
                {size} person{size === "1" ? "" : "s"}
              </span>
              <strong>${limit.toLocaleString()}</strong>
            </div>
          ))}
        </div>
        <p className="muted utility-fineprint">
          For households over 8 people, add $
          {LADWP_EZ_SAVE_THRESHOLDS.additionalPersonAmount.toLocaleString()} for
          each additional person.
        </p>
      </section>
    </section>
  );
}

function MoreInfo() {
  return (
    <section className="utility-info-page" aria-labelledby="home-more-info-title">
      <div className="utility-info-page__header">
        <p className="kicker">more info</p>
        <h1 id="home-more-info-title">Learn more before you apply</h1>
        <p className="muted lead">
          EZ-SAVE can lower monthly LADWP costs for eligible households. This
          tool prepares a draft, but LADWP reviews and approves the application.
        </p>
      </div>

      <div className="utility-landing__actions utility-info-page__actions">
        <a
          className="button button--emphasis"
          href={LADWP_EZ_SAVE_WORKFLOW.applicationUrl}
          rel="noreferrer"
          target="_blank"
        >
          Learn about EZ-SAVE
        </a>
        <a className="button secondary" href="sms:+13233933120">
          Text assistance or feedback
        </a>
      </div>

      <p className="privacy-notice">
        Text <strong>+1 (323) 393-3120</strong> to get assistance or provide
        feedback.
      </p>

      <section className="utility-info-grid" aria-label="Why EZ-SAVE matters">
        <article>
          <h2>Lower monthly LADWP costs</h2>
          <p>
            EZ-SAVE is designed to reduce utility bills for eligible LADWP
            residential customers. A lower bill can make it easier to stay
            current each month.
          </p>
        </article>
        <article>
          <h2>Protection after enrollment</h2>
          <p>
            After LADWP accepts the application and enrolls the account,
            participants receive program protections related to utility shutoff
            for late payment.
          </p>
        </article>
        <article>
          <h2>No income proof uploaded here</h2>
          <p>
            The EZ-SAVE application does not require proof of income with the
            initial packet. LADWP may verify eligibility later.
          </p>
        </article>
      </section>
    </section>
  );
}
