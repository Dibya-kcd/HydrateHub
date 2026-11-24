/**
 * Guided demo tour (salesman or owner), laid out for phone, tablet and desktop.
 *
 *  - Phone: header with progress, one step at a time (title, sample screen, explanation, tips, "Do this"), Back / Next
 *    fixed at the bottom. Owner tour has a "Jump to topic" sheet.
 *  - Tablet: same flow, larger sample screen, centred; two columns once the screen is wide enough.
 *  - Desktop: a step list on the left replaces the Jump sheet; sample screen and explanation sit side by side.
 *
 * Safe by construction: imports nothing from the app's data layer, makes no network request, saves nothing.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOURS, OWNER_JUMP, TourId } from './tourData';
import './sampleScreens.css';
import './tour.css';

interface Props {
  tour: TourId;
  onClose: () => void;
  /** 0-based step to open at. */
  initialStep?: number;
  onStepChange?: (step: number) => void;
}

export const DemoTour: React.FC<Props> = ({ tour, onClose, initialStep = 0, onStepChange }) => {
  const meta = TOURS[tour];
  const steps = meta.steps;
  const last = steps.length - 1;
  const [step, setStep] = useState(() => Math.min(last, Math.max(0, initialStep)));
  const [jumpOpen, setJumpOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const info = steps[step];

  const go = useCallback(
    (n: number) => {
      setStep((cur) => {
        const next = Math.min(last, Math.max(0, n));
        return next === cur ? cur : next;
      });
    },
    [last],
  );

  useEffect(() => {
    onStepChange?.(step);
    scrollRef.current?.scrollTo({ top: 0 });
    rootRef.current?.querySelector('.hhd-side__item.is-on')?.scrollIntoView({ block: 'nearest' });
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    rootRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (jumpOpen) setJumpOpen(false);
        else onClose();
      } else if (!jumpOpen && e.key === 'ArrowRight') go(step + 1);
      else if (!jumpOpen && e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [jumpOpen, onClose, go, step]);

  // Side list: consecutive steps with the same chapter label are grouped.
  const groups = useMemo(() => {
    const out: { name: string; items: { n: number; title: string }[] }[] = [];
    steps.forEach((s, n) => {
      const g = out[out.length - 1];
      if (g && g.name === s.chapter) g.items.push({ n, title: s.title });
      else out.push({ name: s.chapter, items: [{ n, title: s.title }] });
    });
    return out;
  }, [steps]);

  const isFirst = step === 0;
  const isLast = step === last;
  const pct = ((step + 1) / steps.length) * 100;

  return (
    <div className="hhd" role="dialog" aria-modal="true" aria-label={meta.title} ref={rootRef} tabIndex={-1}>
      <aside className="hhd-side" aria-label="Tour steps">
        <div className="hhd-side__brand">
          <span className="hhd-logo" aria-hidden="true">H</span>
          <span>
            <b>{meta.title}</b>
            <small>Sample data only. Nothing is saved.</small>
          </span>
        </div>
        <nav className="hhd-side__nav">
          {groups.map((g, gi) => (
            <div key={`${g.name}-${gi}`} className="hhd-side__group">
              <div className="hhd-side__chapter">{g.name}</div>
              {g.items.map((it) => (
                <button
                  key={it.n}
                  type="button"
                  className={`hhd-side__item${it.n === step ? ' is-on' : ''}${it.n < step ? ' is-done' : ''}`}
                  aria-current={it.n === step ? 'step' : undefined}
                  onClick={() => go(it.n)}
                >
                  <span className="hhd-side__num">{it.n < step ? '✓' : it.n + 1}</span>
                  <span>{it.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="hhd-main">
        <header className="hhd-top">
          <div className="hhd-top__row">
            <h1 className="hhd-top__title">{meta.title}</h1>
            <div className="hhd-top__acts">
              {tour === 'owner' && (
                <button type="button" className="hhd-jp" onClick={() => setJumpOpen(true)}>
                  Jump to topic
                </button>
              )}
              <button type="button" className="hhd-x" onClick={onClose} aria-label="Close demo">
                ✕
              </button>
            </div>
          </div>
          <div
            className="hhd-meter"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={steps.length}
            aria-valuenow={step + 1}
            aria-label="Tour progress"
          >
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="hhd-stp" aria-live="polite">
            Step {step + 1} of {steps.length} · {info.chapter}
          </div>
        </header>

        <div className="hhd-scroll" ref={scrollRef}>
          <div className="hhd-content" key={`${tour}-${step}`}>
            <h2 className="hhd-dh">{info.title}</h2>

            <figure className="hhd-stage">
              <div className="hhd-mn">
                <div className="mt" aria-hidden="true">
                  <span>{info.sample}</span>
                  <span />
                </div>
                <div className="mb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: info.html }} />
                {info.tap && (
                  <button
                    type="button"
                    className="tap hhd-tap"
                    style={{ left: `${info.tap.left}%`, top: info.tap.top }}
                    onClick={() => go(step + 1)}
                    tabIndex={-1}
                    aria-hidden="true"
                  >
                    👆
                  </button>
                )}
              </div>
              <figcaption className="hhd-sr">Sample screen: {info.sample}. Sample data only.</figcaption>
            </figure>

            <div className="hhd-coach">
              <p className="hhd-dt">{info.what}</p>
              {info.tips.map((t) => (
                <div className="hhd-gk" key={t}>
                  <b>GOOD TO KNOW</b>
                  {t}
                </div>
              ))}
              <div className="hhd-do">
                <span aria-hidden="true">👉</span>
                <span>{info.action}</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="hhd-foot">
          <div className="hhd-foot__in">
            {!isFirst && (
              <button type="button" className="hhd-btn hhd-btn--ghost" onClick={() => go(step - 1)}>
                Back
              </button>
            )}
            {isFirst ? (
              <button type="button" className="hhd-btn" onClick={() => go(1)}>
                {meta.startLabel}
              </button>
            ) : isLast ? (
              <button type="button" className="hhd-btn" onClick={tour === 'salesman' ? () => go(0) : onClose}>
                {meta.finishLabel}
              </button>
            ) : (
              <button type="button" className="hhd-btn" onClick={() => go(step + 1)}>
                Next
              </button>
            )}
          </div>
        </footer>
      </div>

      {jumpOpen && tour === 'owner' && (
        <>
          <div className="hhd-dim" onClick={() => setJumpOpen(false)} />
          <div className="hhd-sheet" role="dialog" aria-modal="true" aria-label="Jump to topic">
            <div className="hhd-grab" aria-hidden="true" />
            <div className="hhd-sheet__head">
              <b>Jump to topic</b>
              <button type="button" className="hhd-x hhd-x--dark" onClick={() => setJumpOpen(false)} aria-label="Close list">
                ✕
              </button>
            </div>
            <div className="hhd-sheet__list">
              {OWNER_JUMP.map((g) => (
                <div key={g.group}>
                  <div className="hhd-chh">{g.group}</div>
                  {g.items.map((it) => (
                    <button
                      key={it.step}
                      type="button"
                      className="hhd-jt"
                      onClick={() => {
                        go(it.step - 1);
                        setJumpOpen(false);
                      }}
                    >
                      <span>{it.label}</span>
                      <small>step {it.step}</small>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DemoTour;
