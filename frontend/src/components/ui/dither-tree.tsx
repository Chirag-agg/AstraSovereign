"use client";

import * as React from "react";

/**
 * Dithered growth field.
 *
 * A branching structure grown procedurally and stamped onto a coarse pixel
 * grid, then revealed cell by cell in growth order so it reads as something
 * developing rather than something fading in. Cells are coloured by heat —
 * deep ember at the trunk through signal orange to bone at the tips — which
 * is the product's own palette, not a decorative gradient.
 *
 * Why it belongs on this page: the thing being sold is a knowledge base that
 * grows on your own hardware and never leaves it. A structure that branches
 * out of a single root and stays inside its own frame is the argument, drawn.
 *
 * Implementation notes:
 *   - 2D canvas, not WebGL. On a demo box the GPU is running a 7B model, and
 *     a background shader competing for it is a self-inflicted stutter.
 *   - Cells are drawn once, incrementally: each frame paints only the cells
 *     revealed since the last one, so a frame costs O(new cells), not O(all).
 *   - Deterministic per seed, so a re-render never reshuffles the picture.
 *   - Click to regrow from a new seed.
 */

interface Cell {
  x: number;
  y: number;
  /** 0..1 along the growth timeline. */
  t: number;
  /** 0..1, trunk to tip. Drives colour and alpha. */
  heat: number;
  size: number;
}

interface Node {
  x: number;
  y: number;
  label: string;
}

/** Deterministic PRNG so one seed always draws the same tree. */
function makeRandom(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

type Ramp = [number, number, number][];

/**
 * Heat is contrast against the paper, not brightness in the abstract. On the
 * dark canvas the tips run up to bone; on light paper the same tips run down
 * to ink, because a near-white tip on cream is not a shimmer, it is a gap.
 */
const HEAT_DARK: Ramp = [
  [64, 14, 2],
  [112, 28, 4],
  [168, 52, 8],
  [214, 78, 16],
  [238, 96, 24],
  [246, 138, 62],
  [250, 182, 126],
  [238, 238, 238],
];

const HEAT_LIGHT: Ramp = [
  [226, 196, 164],
  [222, 160, 104],
  [220, 128, 56],
  [212, 100, 28],
  [196, 83, 15],
  [158, 64, 14],
  [104, 48, 18],
  [40, 34, 28],
];

function heatColor(heat: number, alpha: number, ramp: Ramp = HEAT_DARK): string {
  const HEAT = ramp;
  const scaled = Math.max(0, Math.min(0.999, heat)) * (HEAT.length - 1);
  const index = Math.floor(scaled);
  const mix = scaled - index;
  const a = HEAT[index];
  const b = HEAT[Math.min(HEAT.length - 1, index + 1)];
  const r = Math.round(a[0] + (b[0] - a[0]) * mix);
  const g = Math.round(a[1] + (b[1] - a[1]) * mix);
  const bl = Math.round(a[2] + (b[2] - a[2]) * mix);
  return `rgba(${r},${g},${bl},${alpha})`;
}

interface GrowOptions {
  width: number;
  height: number;
  grid: number;
  seed: number;
}

/**
 * Grows the branch skeleton and stamps it into grid cells. Returns cells in
 * no particular order; each carries its own reveal time.
 */
function grow({ width, height, grid, seed }: GrowOptions): { cells: Cell[]; nodes: Node[] } {
  const random = makeRandom(seed);
  const stamped = new Map<string, Cell>();
  const nodes: Node[] = [];

  const rootX = width * 0.36;
  const baseY = height * 0.99;

  const put = (px: number, py: number, t: number, heat: number, thickness: number, depth = 0) => {
    const thinning = Math.min(0.5, depth * 0.07);
    // Stamp a square of cells whose radius follows branch thickness, with a
    // dithered edge so the silhouette breaks up instead of reading as a bar.
    const radius = Math.max(1, Math.round(thickness / grid));
    for (let ox = -radius; ox <= radius; ox++) {
      for (let oy = -radius; oy <= radius; oy++) {
        const dist = Math.hypot(ox, oy) / (radius + 0.001);
        if (dist > 1) continue;
        // Edge cells drop out probabilistically — this is what makes it read
        // as dithered rather than as a solid stroke.
        if (random() < thinning) continue;
        if (dist > 0.45 && random() < (dist - 0.45) * 1.9) continue;
        const gx = Math.round(px / grid) + ox;
        const gy = Math.round(py / grid) + oy;
        if (gx < 0 || gy < 0 || gx * grid > width || gy * grid > height) continue;
        const key = `${gx}:${gy}`;
        const existing = stamped.get(key);
        if (existing && existing.t <= t) continue;
        stamped.set(key, {
          x: gx * grid,
          y: gy * grid,
          t,
          heat: Math.min(1, heat + random() * 0.22 - 0.08),
          size: random() < 0.14 ? grid - 1 : grid - 2,
        });
      }
    }
  };

  const MAX_DEPTH = 9;

  const branch = (
    x: number,
    y: number,
    angle: number,
    length: number,
    thickness: number,
    depth: number,
    tStart: number,
    tSpan: number,
  ) => {
    if (depth > MAX_DEPTH || length < grid * 1.4 || thickness < 0.7) {
      if (depth > 4 && random() < 0.1 && nodes.length < 5) {
        nodes.push({ x, y, label: `${Math.floor(random() * 90 + 10)}` });
      }
      return;
    }

    // Only the outermost ring is allowed to droop; everything below it is
    // held above the horizon.
    const ceiling = depth >= MAX_DEPTH - 1 ? -0.08 : -0.3;
    const clamp = (v: number) => Math.max(-Math.PI + 0.3, Math.min(ceiling, v));

    const steps = Math.max(4, Math.round(length / (grid * 0.55)));
    let cx = x;
    let cy = y;
    let a = clamp(angle);

    for (let i = 0; i < steps; i++) {
      const progress = i / steps;
      // Wander, more at the tips than the trunk.
      a = clamp(a + (random() - 0.5) * 0.15 * (depth / 3 + 0.35));
      cx += Math.cos(a) * (length / steps);
      cy += Math.sin(a) * (length / steps);
      const heat = Math.min(0.96, depth / (MAX_DEPTH + 1.5) + progress * 0.1 + random() * 0.06);
      put(cx, cy, tStart + tSpan * progress, heat, thickness * (1 - progress * 0.3), depth);
    }

    const childSpan = tSpan * 0.85;
    const childStart = tStart + tSpan;
    const splits = depth < 2 ? 3 : random() < 0.74 ? 2 : 1;

    for (let s = 0; s < splits; s++) {
      // Spread is measured off the branch's own heading, widening with depth
      // so the silhouette opens into a canopy instead of a spike.
      const spread = (0.3 + random() * 0.38) * (1 + depth * 0.1);
      const dir = splits === 1 ? (random() < 0.5 ? -1 : 1) : s === 0 ? -1 : s === 1 ? 1 : 0;
      branch(
        cx,
        cy,
        a + dir * spread,
        length * (0.62 + random() * 0.2),
        thickness * 0.68,
        depth + 1,
        childStart,
        childSpan,
      );
    }
  };

  const trunkLength = height * 0.3;
  branch(rootX, baseY, -Math.PI / 2, trunkLength, grid * 4.6, 0, 0, 0.16);

  // A second, shorter stem offset from the first reads as a thicket rather
  // than a single specimen, and fills the frame's right side.
  branch(rootX + grid * 7, baseY, -Math.PI / 2 + 0.2, trunkLength * 0.74, grid * 2.6, 1, 0.06, 0.15);

  return { cells: [...stamped.values()], nodes };
}

export interface DitherTreeProps {
  className?: string;
  style?: React.CSSProperties;
  /** Cell pitch in CSS pixels. Larger reads chunkier. */
  grid?: number;
  /** Seconds the growth takes. */
  duration?: number;
}

export function DitherTree({ className, style, grid = 7, duration = 3.4 }: DitherTreeProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [seed, setSeed] = React.useState(20260921);
  const [theme, setTheme] = React.useState<string>("dark");

  // The field is painted once into a bitmap, so a token swap cannot reach it
  // the way it reaches the DOM. Watch the attribute and regrow.
  React.useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute("data-theme") || "dark");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cells: Cell[] = [];
    let nodes: Node[] = [];
    let cursor = 0;
    let start = 0;
    let raf = 0;
    let running = false;
    let dpr = 1;

    const ramp = (): Ramp =>
      document.documentElement.getAttribute("data-theme") === "light" ? HEAT_LIGHT : HEAT_DARK;

    const paintCell = (cell: Cell) => {
      // Tip cells carry the brightest heat and the lowest alpha spread, so the
      // canopy shimmers while the trunk stays solid.
      ctx.fillStyle = heatColor(cell.heat, 0.55 + cell.heat * 0.45, ramp());
      ctx.fillRect(cell.x, cell.y, cell.size, cell.size);
    };

    // The node markers are registration marks, not decoration: a small open
    // square with a crosshair running *through* it, which is how a survey or
    // print reticle is drawn. The earlier version filled the square and put
    // the strokes on the diagonals, which is the exact glyph a browser uses
    // for an image it could not load — on a page whose whole claim is that
    // nothing is fetched from anywhere, five of those read as five failures.
    const paintNodes = () => {
      const css = getComputedStyle(document.documentElement);
      const canvasColor = css.getPropertyValue("--canvas").trim() || "#101010";
      const ink = css.getPropertyValue("--bone").trim() || "#eeeeee";

      ctx.save();
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);

      for (const node of nodes) {
        const s = 11;
        const arm = 8;
        // Punch a hole in the dither so the mark sits on the canvas, not in it.
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = canvasColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, arm + 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.66;
        ctx.strokeStyle = ink;
        ctx.strokeRect(node.x - s / 2 + 0.5, node.y - s / 2 + 0.5, s - 1, s - 1);

        // Crosshair on the axes, extending past the square on all four sides.
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(node.x - arm, node.y + 0.5);
        ctx.lineTo(node.x + arm, node.y + 0.5);
        ctx.moveTo(node.x + 0.5, node.y - arm);
        ctx.lineTo(node.x + 0.5, node.y + arm);
        ctx.stroke();
      }
      ctx.restore();
    };

    const frame = (now: number) => {
      if (!running) return;
      const elapsed = (now - start) / 1000;
      const progress = Math.min(1, elapsed / duration);
      // Ease so the trunk appears quickly and the canopy takes its time.
      const eased = 1 - Math.pow(1 - progress, 2.1);

      while (cursor < cells.length && cells[cursor].t <= eased) {
        paintCell(cells[cursor]);
        cursor++;
      }

      if (progress >= 1) {
        paintNodes();
        running = false;
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const build = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const grown = grow({ width, height, grid, seed });
      // Painting in growth order is what lets each frame draw only the new
      // cells instead of re-sorting or re-scanning the whole set.
      cells = grown.cells.sort((a, b) => a.t - b.t);
      nodes = grown.nodes;
      cursor = 0;

      if (reduced) {
        for (const cell of cells) paintCell(cell);
        paintNodes();
        return;
      }
      start = performance.now();
      running = true;
      raf = requestAnimationFrame(frame);
    };

    build();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        cancelAnimationFrame(raf);
        running = false;
        build();
      }, 180);
    };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
    };
  }, [seed, grid, duration, theme]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      onClick={() => setSeed((s) => s + 1)}
      style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair", ...style }}
      aria-hidden="true"
    />
  );
}

export default DitherTree;
