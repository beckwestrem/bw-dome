import Link from "next/link";

export default function Home() {
  return (
    <main className="container container--home">
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
          <h2>Submission support is getting faster</h2>
          <p>
            Today you can download the completed PDF and submit it through
            LADWP&apos;s listed options. Very soon, automated fax to program
            administrators will be available.
          </p>
        </article>
      </section>
    </main>
  );
}
