type Props = {
  program: string;
};

export function ProgramChecklist({ program }: Props) {
  const label = program === "FERA" ? "FERA" : "CARE/FERA";

  return (
    <section className="utility-result__section" aria-labelledby="checklist-title">
      <h2 id="checklist-title">What to have ready</h2>
      <ul className="utility-list">
        <li>Your PG&amp;E bill or online account access</li>
        <li>Household size</li>
        <li>Gross household income before taxes</li>
        <li>Proof of qualifying assistance program, if you use one</li>
        <li>The name on the utility bill</li>
      </ul>
      <p className="muted utility-fineprint">
        PG&amp;E uses one application to screen for {label}.
      </p>
    </section>
  );
}
