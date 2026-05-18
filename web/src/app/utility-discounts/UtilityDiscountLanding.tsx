type Props = {
  onStart: () => void;
};

export function UtilityDiscountLanding({ onStart }: Props) {
  return (
    <section className="utility-landing" aria-labelledby="utility-landing-title">
      <div className="utility-landing__copy">
        <p className="kicker">bill checkup</p>
        <h1 id="utility-landing-title">
          Check if you qualify for a lower PG&amp;E bill
        </h1>
        <p className="muted lead">
          Upload your bill or answer a few questions. We&apos;ll check CARE/FERA
          eligibility in minutes.
        </p>
        <button className="button button--emphasis" type="button" onClick={onStart}>
          Check my eligibility
        </button>
      </div>
      <div className="utility-landing__panel" aria-label="What this checks">
        <span>PG&amp;E</span>
        <strong>CARE / FERA</strong>
        <p>Income-qualified monthly utility discounts for California customers.</p>
      </div>
    </section>
  );
}
