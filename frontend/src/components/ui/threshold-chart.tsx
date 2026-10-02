"use client";

import * as React from "react";
import { TANK_204_COURSES, T_MIN_MM, T_ALERT_MM, type CourseReading } from "@/lib/metrics";

/**
 * Shell-thickness profile, Tank 204.
 *
 * Threshold chart on the project's benchmark fixture.
 *
 * The shaded band is the margin between the 2026 survey reading and the
 * minimum permissible thickness computed by the API 653 one-foot method as
 * written in SOP-09 Rev 3. Green is margin. Red is a course below the limit,
 * and there are two of them — that is the point of the fixture.
 */

const MARGIN = { top: 26, right: 20, bottom: 40, left: 46 };
const FALLBACK_WIDTH = 720;

export interface ThresholdChartProps {
  width: number;
  height: number;
}

function getSplinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

export function ThresholdChart({ width, height }: ThresholdChartProps) {
  const uid = React.useId().replace(/:/g, "");
  if (width < 60 || height < 60) return null;

  const xMax = Math.max(0, width - MARGIN.left - MARGIN.right);
  const yMax = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Scales
  const xScale = (c: number) => ((c - 1) / (6 - 1)) * xMax;
  const yScale = (v: number) => yMax - ((v - 10.2) / (14.4 - 10.2)) * yMax;

  const yLimit = yScale(T_MIN_MM);
  const yAlert = yScale(T_ALERT_MM);

  const points = TANK_204_COURSES.map((d) => ({
    x: xScale(d.course),
    y: yScale(d.current_mm),
    data: d,
  }));

  const curvePath = getSplinePath(points);
  const firstPt = points[0] || { x: 0, y: 0 };
  const lastPt = points[points.length - 1] || { x: xMax, y: 0 };
  const areaPath = `${curvePath} L ${lastPt.x.toFixed(2)} ${yLimit.toFixed(2)} L ${firstPt.x.toFixed(2)} ${yLimit.toFixed(2)} Z`;

  const yTicks = [11, 12, 13, 14];

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Tank 204 shell thickness against the minimum permissible limit"
      style={{ overflow: "visible" }}
    >
      <defs>
        <clipPath id={`clip-above-${uid}`}>
          <rect x={0} y={0} width={xMax} height={Math.max(0, yLimit)} />
        </clipPath>
        <clipPath id={`clip-below-${uid}`}>
          <rect x={0} y={Math.max(0, yLimit)} width={xMax} height={Math.max(0, yMax - yLimit)} />
        </clipPath>
      </defs>

      <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
        {/* Grid rows */}
        {yTicks.map((tick) => (
          <line
            key={`grid-${tick}`}
            x1={0}
            x2={xMax}
            y1={yScale(tick)}
            y2={yScale(tick)}
            stroke="#221f1d"
            strokeWidth={1}
          />
        ))}

        {/* X Axis (Bottom) */}
        <line x1={0} x2={xMax} y1={yMax} y2={yMax} stroke="#302c29" strokeWidth={1} />
        {TANK_204_COURSES.map((d) => {
          const x = xScale(d.course);
          return (
            <g key={`x-tick-${d.course}`} transform={`translate(${x}, ${yMax})`}>
              <line x1={0} x2={0} y1={0} y2={4} stroke="#302c29" strokeWidth={1} />
              <text
                x={0}
                y={16}
                textAnchor="middle"
                fill="#8a8380"
                fontSize={11}
                fontFamily="var(--mono)"
              >
                C{d.course}
              </text>
            </g>
          );
        })}

        {/* Y Axis (Left) */}
        <line x1={0} x2={0} y1={0} y2={yMax} stroke="#302c29" strokeWidth={1} />
        {yTicks.map((tick) => {
          const y = yScale(tick);
          return (
            <g key={`y-tick-${tick}`} transform={`translate(0, ${y})`}>
              <line x1={-4} x2={0} y1={0} y2={0} stroke="#302c29" strokeWidth={1} />
              <text
                x={-8}
                y={4}
                textAnchor="end"
                fill="#8a8380"
                fontSize={11}
                fontFamily="var(--mono)"
              >
                {tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Threshold area bands */}
        {/* Green Margin (above t_min) */}
        <path
          d={areaPath}
          fill="#a0ca92"
          fillOpacity={0.16}
          clipPath={`url(#clip-above-${uid})`}
        />
        {/* Red Breach (below t_min) */}
        <path
          d={areaPath}
          fill="#e5484d"
          fillOpacity={0.26}
          clipPath={`url(#clip-below-${uid})`}
        />

        {/* Alert band line */}
        <line
          x1={0}
          x2={xMax}
          y1={yAlert}
          y2={yAlert}
          stroke="#d9a441"
          strokeWidth={1}
          strokeDasharray="2,4"
        />
        <text
          x={xMax}
          y={yAlert - 6}
          textAnchor="end"
          fill="#d9a441"
          fontSize={10}
          fontFamily="var(--mono)"
        >
          ALERT {T_ALERT_MM.toFixed(2)}
        </text>

        {/* Limit line */}
        <line
          x1={0}
          x2={xMax}
          y1={yLimit}
          y2={yLimit}
          stroke="#e5484d"
          strokeWidth={1.2}
        />
        <text
          x={xMax}
          y={yLimit + 13}
          textAnchor="end"
          fill="#e5484d"
          fontSize={10}
          fontFamily="var(--mono)"
        >
          t_min {T_MIN_MM.toFixed(2)} mm
        </text>

        {/* Reading curve line */}
        <path
          d={curvePath}
          fill="none"
          stroke="#eeeeee"
          strokeWidth={1.6}
        />

        {/* Data points */}
        {points.map(({ x, y, data: d }) => {
          const failing = d.status === "REPAIR_REQUIRED";
          const refer = d.status === "REFER_TO_ENGINEERING";
          return (
            <circle
              key={d.course}
              cx={x}
              cy={y}
              r={3.4}
              fill={failing ? "#e5484d" : refer ? "#d9a441" : "#101010"}
              stroke={failing ? "#e5484d" : refer ? "#d9a441" : "#eeeeee"}
              strokeWidth={1.4}
            />
          );
        })}
      </g>
    </svg>
  );
}

/** Width-aware wrapper — ResizeObserver, no window resize listener. */
export function ResponsiveThresholdChart({ height = 300 }: { height?: number }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof ResizeObserver === "undefined") {
      setWidth(Math.round(node.getBoundingClientRect().width) || FALLBACK_WIDTH);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.round(next));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width: "100%", height }}>
      {width > 0 && <ThresholdChart width={width} height={height} />}
    </div>
  );
}

export default ResponsiveThresholdChart;
