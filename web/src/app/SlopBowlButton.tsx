"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PICNIC_URL =
  "https://order.trypicnic.com/?delivery_hub_id=0332f72b-9c05-4ca7-846b-33d4517269c9";

const FILL_MS = 3000;

export function SlopBowlButton() {
  const [filling, setFilling] = useState(false);
  const [cycle, setCycle] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setFilling(false);
    setCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (filling) return;
    setFilling(true);
    timerRef.current = setTimeout(() => {
      window.open(PICNIC_URL, "_blank", "noopener,noreferrer");
      reset();
    }, FILL_MS);
  };

  return (
    <section className="slop-section" aria-label="Daily lunch order">
      <p className="slop-section__hint muted">
        don&apos;t forget to press the daily slop bowl button
      </p>
      {filling && (
        <p className="slop-section__status" aria-live="polite">
          generating slop
        </p>
      )}
      <button
        type="button"
        className="slop-bowl-btn"
        onClick={handleClick}
        disabled={filling}
        aria-busy={filling}
        aria-label="Open Picnic order — daily slop bowl"
      >
        <div className="slop-bowl-btn__bowl" key={cycle}>
          <div className="slop-bowl-btn__rim" aria-hidden />
          <div
            className={`slop-bowl-btn__cavity${filling ? " slop-bowl-btn__cavity--filling" : ""}`}
            aria-hidden
          >
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--rice" />
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--beans" />
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--greens" />
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--chicken" />
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--sauce" />
            <div className="slop-bowl-btn__layer slop-bowl-btn__layer--tomato" />
          </div>
          <div className="slop-bowl-btn__base" aria-hidden />
        </div>
      </button>
    </section>
  );
}
