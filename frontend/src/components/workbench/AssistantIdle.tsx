"use client";

import * as React from "react";
import { gsap } from "gsap";
import { DotMatrix } from "@/components/ui/dot-matrix";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { useGsap, prefersReducedMotion } from "@/lib/motion";

/**
 * The assistant's resting state.
 *
 * The empty panel used to be a paragraph in a grey box. It is the first thing
 * anyone sees in the workbench, so it now carries the dot-matrix field at low
 * weight and the four stages a task will actually pass through, with a pulse
 * travelling the rail between them.
 *
 * The motion is affordable here for a specific reason: this component only
 * exists while no job is running. The moment a task starts it unmounts and the
 * GPU goes back to the model — the pulse can never compete with inference.
 */

const STAGES = [
  { key: "extract", label: "Extract", note: "reads the attachment" },
  { key: "retrieve", label: "Retrieve", note: "grounds it in your SOPs" },
  { key: "compute", label: "Compute", note: "runs the maths in a sandbox" },
  { key: "draft", label: "Draft", note: "writes the file" },
];

export function AssistantIdle({ onSubmit, demoTask }: { onSubmit: (task: string) => void; demoTask: string }) {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;

    const nodes = element.querySelectorAll<HTMLElement>("[data-stage-node]");
    const pulse = element.querySelector<HTMLElement>("[data-rail-pulse]");
    const rail = element.querySelector<HTMLElement>("[data-rail]");

    gsap.from(nodes, { opacity: 0, y: 10, duration: 0.5, stagger: 0.09, ease: "power3.out" });

    if (pulse && rail) {
      // A single dot walking the rail: the pipeline is sequential, and this is
      // the cheapest honest way to say so while nothing is running.
      gsap.set(pulse, { xPercent: 0, opacity: 0 });
      gsap
        .timeline({ repeat: -1, repeatDelay: 1.1 })
        .to(pulse, { opacity: 1, duration: 0.2 })
        .to(pulse, { xPercent: 100, duration: 2.6, ease: "none" }, 0)
        .to(pulse, { opacity: 0, duration: 0.3 }, 2.4);
    }

    // Stop burning frames when the tab is in the background.
    const onVisibility = () => {
      if (document.hidden) gsap.globalTimeline.pause();
      else gsap.globalTimeline.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div
      ref={ref}
      className="relative overflow-hidden"
      style={{ border: "1px solid var(--carbon)", borderRadius: 8, background: "var(--surface-panel)" }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: 0.22,
          maskImage: "radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(120% 90% at 50% 0%, #000 0%, transparent 72%)",
        }}
      >
        <DotMatrix pitch={26} dot={5} />
      </div>

      <div className="relative" style={{ padding: "30px 28px 28px" }}>
        <span className="inline-flex items-center gap-2 font-mono uppercase" style={{ fontSize: 10.5, letterSpacing: "0.12em", color: "var(--stone)" }}>
          <span className="astra-pulse" style={{ width: 6, height: 6, background: "var(--signal)" }} />
          On-premise agent runtime
        </span>

        <h2
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--display)",
            fontVariationSettings: "'wdth' 86",
            fontWeight: 500,
            fontSize: 30,
            lineHeight: 1.04,
            letterSpacing: "-0.03em",
            color: "var(--bone)",
            maxWidth: "20ch",
          }}
        >
          Describe the job. It runs here.
        </h2>

        <p style={{ margin: "12px 0 0", maxWidth: "62ch", fontSize: 14.5, lineHeight: 1.55, color: "var(--granite)" }}>
          Attach a scan or a report and say what you need from it. Models, OCR, the vector
          store and the code sandbox all execute on this machine — nothing is uploaded, and
          every step below is recorded in the audit trail as it happens.
        </p>

        {/* The rail. Four stages, one pulse. */}
        <div style={{ marginTop: 30, position: "relative" }}>
          <div
            data-rail
            aria-hidden="true"
            style={{ position: "absolute", left: 0, right: 0, top: 7, height: 1, background: "var(--carbon)", overflow: "hidden" }}
          >
            <span
              data-rail-pulse
              style={{
                position: "absolute",
                left: 0,
                top: -1,
                width: 46,
                height: 3,
                background: "linear-gradient(90deg, transparent, var(--signal), transparent)",
              }}
            />
          </div>

          <ol className="grid gap-4 sm:grid-cols-4" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {STAGES.map((stage, index) => (
              <li key={stage.key} data-stage-node>
                <span
                  aria-hidden="true"
                  className="block"
                  style={{ width: 9, height: 9, borderRadius: 99, border: "1px solid var(--ash)", background: "var(--surface-panel)", marginBottom: 14 }}
                />
                <span className="flex items-baseline gap-2">
                  <span className="font-mono tnum" style={{ fontSize: 10.5, color: "var(--graphite)" }}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 14.5, color: "var(--bone)" }}>{stage.label}</span>
                </span>
                <span className="block" style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: "var(--granite)" }}>
                  {stage.note}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <LiquidCarveButton variant="ghost" size="md" arrow onClick={() => onSubmit(demoTask)}>
            Run the sample task
          </LiquidCarveButton>
          <span className="font-mono" style={{ fontSize: 11, color: "var(--graphite)" }}>
            {demoTask}
          </span>
        </div>
      </div>
    </div>
  );
}

export default AssistantIdle;
