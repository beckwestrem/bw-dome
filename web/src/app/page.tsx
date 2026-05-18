import { HomeLanding } from "@/app/HomeLanding";
import Link from "next/link";

export default function Home() {
  return (
    <main className="container container--home">
      <header className="hero home-hero">
        <p className="kicker">Buffalo</p>
        <h1>Choose what you want to work on</h1>
        <p className="muted lead">
          This app now has two separate tools: the original account manager for
          business CSV work, and a new LADWP bill checker for EZ-SAVE
          eligibility and application prep.
        </p>
      </header>

      <section className="product-switchboard" aria-label="Products">
        <article className="product-card product-card--primary">
          <div>
            <p className="kicker">new bill checker</p>
            <h2>LADWP EZ-SAVE checkup</h2>
            <p>
              Answer a few utility bill questions to estimate whether you may
              qualify for EZ-SAVE, then prepare a reviewable application draft
              before opening LADWP.
            </p>
          </div>
          <ul className="product-card__points">
            <li>LADWP-first MVP</li>
            <li>Deterministic eligibility rules</li>
            <li>Review-before-submit form draft</li>
          </ul>
          <Link className="button button--emphasis" href="/utility-discounts">
            Check my LADWP bill
          </Link>
        </article>

        <article className="product-card">
          <div>
            <p className="kicker">original account manager</p>
            <h2>Business work queue</h2>
            <p>
              Upload a business CSV and sort rows into a dashboard so you can
              see which accounts need attention first.
            </p>
          </div>
          <ul className="product-card__points">
            <li>CSV upload and validation</li>
            <li>Prioritized dashboard</li>
            <li>Private app-password access</li>
          </ul>
          <HomeLanding />
        </article>
      </section>
    </main>
  );
}
