import Link from "next/link";

export default function Home() {
  return (
    <main className="container container--home">
      <header className="hero home-hero home-hero--ladwp">
        <p className="kicker">LADWP EZ-SAVE</p>
        <h1>Lower your LADWP bill and protect your utility service</h1>
        <p className="muted lead">
          Check whether your household may qualify for LADWP&apos;s EZ-SAVE
          Program, then prepare a filled application PDF you can review, sign,
          and submit through LADWP&apos;s listed options.
        </p>
        <div className="row">
          <Link className="button button--emphasis" href="/utility-discounts">
            Start EZ-SAVE check
          </Link>
          <Link className="button secondary" href="/utility-discounts/ladwp-ez-save">
            Learn about EZ-SAVE
          </Link>
        </div>
      </header>

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
            participants receive discount benefits and shutoff protections tied
            to the program. Past-due bills may still need separate LADWP
            payment arrangements.
          </p>
        </article>
        <article className="ladwp-home-card">
          <p className="kicker">review first</p>
          <h2>You stay in control of submission</h2>
          <p>
            Download the filled PDF, review every field, sign it, and choose
            LADWP&apos;s online, fax, or mail submission route.
          </p>
        </article>
      </section>
    </main>
  );
}
