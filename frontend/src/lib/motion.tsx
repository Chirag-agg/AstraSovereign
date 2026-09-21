"use client";

import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { animate, stagger, utils } from "animejs";
import { scrambleText } from "animejs/text";

/**
 * Scroll and motion primitives.
 *
 * Two libraries, two jobs, no overlap:
 *   GSAP + ScrollTrigger drive anything tied to scroll position — parallax
 *   depth, section reveals, the pinned sequence. ScrollTrigger is the only
 *   thing here that reads layout, and it batches those reads itself.
 *   anime.js drives value animation that is not scroll-bound — counters
 *   settling on a real number, the terminal scramble on section headings.
 *
 * Every primitive is inert under `prefers-reduced-motion`: the element ends
 * up in its final state immediately rather than animating to it. Nothing
 * here gates content on JS — everything renders visible first and is then
 * taken over, so a failed hydration degrades to a static page instead of a
 * blank one.
 */

let registered = false;
function ensureScrollTrigger() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger);
  registered = true;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ hooks */

/**
 * Runs `setup` inside a GSAP context scoped to `ref`, so every tween and
 * ScrollTrigger it creates is reverted together on unmount. Without the
 * context, a route change leaves dead triggers measuring detached nodes.
 */
export function useGsap(
  setup: (context: { self: gsap.Context; element: HTMLElement }) => void,
  deps: React.DependencyList = [],
) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    ensureScrollTrigger();
    // gsap.context hands the context to its own callback; capturing the
    // `const` from inside would read it before initialisation.
    const ctx = gsap.context((self) => setup({ self: self as gsap.Context, element }), element);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/* ------------------------------------------------------------- components */

export interface ParallaxProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Positive drifts slower than the page, negative drifts faster. */
  speed?: number;
  children: React.ReactNode;
}

/**
 * Depth. The layer is translated against scroll by `speed × viewport`, on a
 * scrub so it tracks the scrollbar exactly rather than easing behind it.
 */
export function Parallax({ speed = 0.18, children, style, ...rest }: ParallaxProps) {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    gsap.fromTo(
      element,
      { yPercent: -speed * 50 },
      {
        yPercent: speed * 50,
        ease: "none",
        scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true },
      },
    );
  }, [speed]);

  return (
    <div ref={ref} style={{ willChange: "transform", ...style }} {...rest}>
      {children}
    </div>
  );
}

export interface RevealProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stagger direct children instead of animating the block as one. */
  stagger?: number;
  /** Distance travelled, px. */
  y?: number;
  delay?: number;
  children: React.ReactNode;
}

/** Section entrance: a short rise and fade, once, when it comes into view. */
export function Reveal({ stagger: step = 0, y = 26, delay = 0, children, ...rest }: RevealProps) {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    const targets = step > 0 ? Array.from(element.children) : [element];
    gsap.set(targets, { opacity: 0, y });
    gsap.to(targets, {
      opacity: 1,
      y: 0,
      duration: 0.62,
      delay,
      ease: "power3.out",
      stagger: step,
      scrollTrigger: { trigger: element, start: "top 88%", once: true },
    });
  }, [step, y, delay]);

  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}

export interface CountUpProps {
  /** The real value. Formatting is applied to the tweened number. */
  value: number;
  decimals?: number;
  /** Rendered verbatim before and after the number. */
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A number that settles on its real value when it scrolls into view.
 *
 * The final frame is always the exact `value` — the tween runs on a proxy and
 * the last write is a hard set, so a rounding artefact can never leave a
 * measured figure showing something it is not.
 */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "", className, style }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);

  const format = React.useCallback(
    (n: number) => `${prefix}${n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
    [prefix, suffix, decimals],
  );

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.textContent = format(value);
    if (prefersReducedMotion()) return;
    ensureScrollTrigger();

    const proxy = { n: 0 };
    let animation: ReturnType<typeof animate> | null = null;

    const trigger = ScrollTrigger.create({
      trigger: node,
      start: "top 92%",
      once: true,
      onEnter: () => {
        node.textContent = format(0);
        animation = animate(proxy, {
          n: value,
          duration: 1100,
          ease: "outExpo",
          onUpdate: () => {
            node.textContent = format(utils.round(proxy.n, decimals));
          },
          onComplete: () => {
            node.textContent = format(value);
          },
        });
      },
    });

    return () => {
      animation?.pause();
      trigger.kill();
    };
  }, [value, decimals, format]);

  return <span ref={ref} className={className} style={style} />;
}

/**
 * Terminal scramble. Characters cycle before resolving — the product's own
 * idiom, and the cheapest way to make a heading feel like a readout rather
 * than a slogan. Falls back to plain text when motion is reduced.
 */
export function Scramble({
  children,
  className,
  style,
  as: Tag = "span",
}: {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "span" | "div" | "h2" | "h3";
}) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    ensureScrollTrigger();
    const trigger = ScrollTrigger.create({
      trigger: node,
      start: "top 92%",
      once: true,
      onEnter: () => {
        // scrambleText returns a tween value, not a standalone call: it is
        // handed to animate() as the target property (textContent).
        animate(node, {
          textContent: scrambleText({ chars: "uppercase", duration: 760, ease: "linear" }),
        });
      },
    });
    return () => trigger.kill();
  }, [children]);

  return React.createElement(Tag, { ref, className, style }, children);
}

/**
 * Line-by-line headline entrance. Lines are split at render and each rises
 * out of its own overflow box, which is what makes it read as typeset rather
 * than as a fade.
 */
export function RiseLines({
  lines,
  className,
  style,
  delay = 0,
}: {
  lines: string[];
  className?: string;
  style?: React.CSSProperties;
  delay?: number;
}) {
  const ref = useGsap(({ element }) => {
    if (prefersReducedMotion()) return;
    const inner = element.querySelectorAll<HTMLElement>("[data-rise-line]");
    gsap.set(inner, { yPercent: 108 });
    gsap.to(inner, {
      yPercent: 0,
      duration: 0.9,
      delay,
      ease: "power4.out",
      stagger: 0.075,
    });
  }, [lines.join("|"), delay]);

  return (
    <span ref={ref} className={className} style={style}>
      {lines.map((line, index) => (
        <span key={index} style={{ display: "block", overflow: "hidden", paddingBottom: "0.04em" }}>
          <span data-rise-line style={{ display: "block" }}>
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}

/**
 * A one-pixel read-out of how far down the document you are. It is the same
 * grammar as the rest of the product: a measured value drawn as a rule, not a
 * decorative bar, and it scrubs with the scrollbar rather than easing behind it.
 */
export function ScrollProgress() {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || prefersReducedMotion()) return;
    ensureScrollTrigger();
    gsap.set(node, { scaleX: 0, transformOrigin: "left center" });
    const trigger = ScrollTrigger.create({
      start: 0,
      end: () => document.body.scrollHeight - window.innerHeight,
      scrub: true,
      onUpdate: (self) => gsap.set(node, { scaleX: self.progress }),
    });
    return () => trigger.kill();
  }, []);

  return (
    <div
      aria-hidden="true"
      style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 60, pointerEvents: "none" }}
    >
      <div ref={ref} style={{ height: "100%", background: "var(--signal)", transform: "scaleX(0)" }} />
    </div>
  );
}

/** anime.js stagger re-exported so callers do not reach past this module. */
export { stagger };
