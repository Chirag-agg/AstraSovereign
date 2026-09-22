"use client";

import * as React from "react";
import { gsap } from "gsap";
import { BOOT_STEPS } from "@/components/ui/terminal-loader";
import { prefersReducedMotion } from "@/lib/motion";

/**
 * Boot gate.
 *
 * The scanning eye and the boot checklist, full screen, on every page load.
 * The checklist ticks through while the page genuinely becomes ready; when
 * every line is checked the gate *holds* with "Click anywhere to enter" and
 * does not time itself out. The curtain splits only when the person says so.
 *
 * Because it has to be dismissed it is a labelled, focused button rather than
 * an aria-hidden overlay, and Enter / Space / Escape work like the click. The
 * click works at any point — before the checklist finishes it just completes
 * the list on the way out.
 *
 * There is no "already seen" flag: under React Strict Mode (on in dev) effects
 * run twice, and a flag set by the first run tore the gate down on the second.
 * Client-side navigation never remounts the root layout, so it only appears
 * on a real load.
 */

/** Pace of the checklist; each line is seen to complete. */
const STEP_MS = 420;
/** Arm anyway if readiness never resolves (stalled font, etc). */
const READY_CEILING_MS = 5000;

export function BootGate() {
  const [mounted, setMounted] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [armed, setArmed] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const leavingRef = React.useRef(false);

  React.useEffect(() => setMounted(true), []);

  // Lock scroll and take focus while the gate is up.
  React.useEffect(() => {
    if (!mounted || gone) return;
    document.documentElement.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [mounted, gone]);

  // Tick the checklist; reduced motion gets it complete at once.
  React.useEffect(() => {
    if (!mounted) return;
    if (prefersReducedMotion()) {
      setStep(BOOT_STEPS.length);
      return;
    }
    const id = window.setInterval(() => {
      setStep((s) => {
        if (s >= BOOT_STEPS.length) window.clearInterval(id);
        return Math.min(s + 1, BOOT_STEPS.length);
      });
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [mounted]);

  // Real readiness, with a ceiling.
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    if (!mounted) return;
    let alive = true;
    const done = () => alive && setReady(true);
    void Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      document.readyState === "complete"
        ? Promise.resolve()
        : new Promise<void>((r) => window.addEventListener("load", () => r(), { once: true })),
    ]).then(done);
    const ceiling = window.setTimeout(done, READY_CEILING_MS);
    return () => {
      alive = false;
      window.clearTimeout(ceiling);
    };
  }, [mounted]);

  // Armed only when the page is ready AND every line has been seen to tick.
  React.useEffect(() => {
    if (ready && step >= BOOT_STEPS.length) setArmed(true);
  }, [ready, step]);

  const dismiss = React.useCallback(() => {
    const root = rootRef.current;
    if (!root || leavingRef.current) return;
    leavingRef.current = true;
    setStep(BOOT_STEPS.length);
    const still = prefersReducedMotion();
    gsap
      .timeline({ onComplete: () => setGone(true) })
      .to(root.querySelector("[data-gate-content]"), { opacity: 0, duration: still ? 0 : 0.28, ease: "power2.in" })
      .to(root.querySelector("[data-curtain-top]"), { yPercent: -100, duration: still ? 0 : 0.72, ease: "power4.inOut" }, "<")
      .to(root.querySelector("[data-curtain-bottom]"), { yPercent: 100, duration: still ? 0 : 0.72, ease: "power4.inOut" }, "<");
  }, []);

  React.useEffect(() => {
    if (!mounted || gone) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mounted, gone, dismiss]);

  if (!mounted || gone) return null;

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label="Enter AstraSovereign"
      onClick={dismiss}
      className="fixed inset-0 z-[9999]"
      style={{ cursor: "pointer", outline: "none" }}
    >
      <div data-curtain-top className="absolute inset-x-0 top-0" style={{ height: "50.5%", background: "var(--canvas)" }} />
      <div data-curtain-bottom className="absolute inset-x-0 bottom-0" style={{ height: "50.5%", background: "var(--canvas)" }} />

      <div
        data-gate-content
        className="absolute inset-0 flex flex-col items-center justify-center gap-10"
        style={{ zIndex: 1 }}
      >
        <div className="flex flex-col items-center gap-5">
          <span className="loader-shell">
            <span className="loader" />
          </span>
          <span className="mono-label" style={{ letterSpacing: "0.12em" }}>
            {armed ? "Workbench ready" : "Starting the workbench"}
          </span>
        </div>

        <ol className="flex flex-col gap-1.5" style={{ minWidth: 320, listStyle: "none", margin: 0, padding: 0 }}>
          {BOOT_STEPS.map((entry, index) => {
            const state = index < step ? "ok" : index === step ? "run" : "wait";
            return (
              <li key={entry.label} className="flex items-baseline gap-3 font-mono" style={{ fontSize: 11.5 }}>
                <span
                  style={{
                    width: 12,
                    color: state === "ok" ? "var(--metric)" : state === "run" ? "var(--signal)" : "var(--graphite)",
                  }}
                >
                  {state === "ok" ? "✓" : state === "run" ? "›" : "·"}
                </span>
                <span style={{ color: state === "wait" ? "var(--graphite)" : "var(--stone)", minWidth: 128 }}>
                  {entry.label}
                </span>
                <span style={{ color: "var(--graphite)" }}>{entry.note}</span>
              </li>
            );
          })}
        </ol>

        <span
          className="font-mono uppercase"
          style={{
            fontSize: 10.5,
            letterSpacing: "0.24em",
            color: "var(--bone)",
            opacity: armed ? 1 : 0,
            transform: armed ? "translateY(0)" : "translateY(6px)",
            transition: "opacity 400ms ease, transform 400ms ease",
            animation: armed ? "gate-breathe 2.4s ease-in-out 0.4s infinite" : undefined,
          }}
        >
          Click anywhere to enter
        </span>
      </div>
    </div>
  );
}

export default BootGate;
