"use client";

import * as React from "react";
import { Group } from "@visx/group";
import { curveMonotoneX } from "@visx/curve";
import { LinePath, Line, Circle } from "@visx/shape";
import { Threshold } from "@visx/threshold";
import { scaleLinear } from "@visx/scale";
import { AxisLeft, AxisBottom } from "@visx/axis";
import { GridRows } from "@visx/grid";
import { TANK_204_COURSES, T_MIN_MM, T_ALERT_MM, type CourseReading } from "@/lib/metrics";

/**
 * Shell-thickness profile, Tank 204.
 *
 * The visx Threshold chart on the project's own benchmark fixture rather than
 * the sample city-temperature set. Every point comes from
 * tests/hard_scenario_01/constants.py, which is the scoring script's source of
 * truth — so the chart and the test suite can never disagree.
 *
 * The shaded band is the margin between the 2026 survey reading and the
 * minimum permissible thickness computed by the API 653 one-foot method as
 * written in SOP-09 Rev 3. Green is margin. Red is a course below the limit,
 * and there are two of them — that is the point of the fixture.
 */

const MARGIN = { top: 26, right: 20, bottom: 40, left: 46 };
const FALLBACK_WIDTH = 720;

const course = (d: CourseReading) => d.course;
const reading = (d: CourseReading) => d.current_mm;
const limit = () => T_MIN_MM;

export interface ThresholdChartProps {
  width: number;
  height: number;
}

export function ThresholdChart({ width, height }: ThresholdChartProps) {
  const uid = React.useId().replace(/:/g, "");
  if (width < 60 || height < 60) return null;

  const xMax = width - MARGIN.left - MARGIN.right;
  const yMax = height - MARGIN.top - MARGIN.bottom;

  const xScale = scaleLinear<number>({ domain: [1, 6], range: [0, xMax] });
  const yScale = scaleLinear<number>({ domain: [10.2, 14.4], nice: false, range: [yMax, 0] });

  return (
    <svg width={width} height={height} role="img" aria-label="Tank 204 shell thickness against the minimum permissible limit">
      <Group left={MARGIN.left} top={MARGIN.top}>
        <GridRows scale={yScale} width={xMax} height={yMax} stroke="#221f1d" strokeWidth={1} numTicks={5} />

        <AxisBottom
          top={yMax}
          scale={xScale}
          numTicks={6}
          tickFormat={(v) => `C${v}`}
          stroke="#302c29"
          tickStroke="#302c29"
          tickLabelProps={() => ({
            fill: "#8a8380",
            fontSize: 11,
            fontFamily: "var(--mono)",
            textAnchor: "middle",
            dy: "0.4em",
          })}
        />
        <AxisLeft
          scale={yScale}
          numTicks={5}
          stroke="#302c29"
          tickStroke="#302c29"
          tickFormat={(v) => `${Number(v).toFixed(0)}`}
          tickLabelProps={() => ({
            fill: "#8a8380",
            fontSize: 11,
            fontFamily: "var(--mono)",
            textAnchor: "end",
            dx: "-0.3em",
            dy: "0.32em",
          })}
        />

        <Threshold<CourseReading>
          id={`tank204-${uid}`}
          data={TANK_204_COURSES}
          x={(d) => xScale(course(d)) ?? 0}
          y0={() => yScale(limit()) ?? 0}
          y1={(d) => yScale(reading(d)) ?? 0}
          clipAboveTo={0}
          clipBelowTo={yMax}
          curve={curveMonotoneX}
          // visx names these by clip region, not by value: with y0 = the limit
          // and y1 = the reading, the "below" band is the one where the
          // reading sits above the limit. That band is the margin, so it is
          // green; the "above" band is the breach, so it is red. Verified
          // against Courses 2 and 3, which are the two below t_min.
          aboveAreaProps={{ fill: "#e5484d", fillOpacity: 0.26 }}
          belowAreaProps={{ fill: "#a0ca92", fillOpacity: 0.16 }}
        />

        {/* Alert band from SOP-09 Rev 3 — t_min + 1.0 mm. Rev 2 said 2.0 mm,
            and citing the superseded revision is one of the scored failures. */}
        <Line
          from={{ x: 0, y: yScale(T_ALERT_MM) }}
          to={{ x: xMax, y: yScale(T_ALERT_MM) }}
          stroke="#d9a441"
          strokeWidth={1}
          strokeDasharray="2,4"
        />
        <text x={xMax} y={yScale(T_ALERT_MM) - 6} textAnchor="end" fill="#d9a441" fontSize={10} fontFamily="var(--mono)">
          ALERT {T_ALERT_MM.toFixed(2)}
        </text>

        {/* The limit itself. */}
        <Line
          from={{ x: 0, y: yScale(T_MIN_MM) }}
          to={{ x: xMax, y: yScale(T_MIN_MM) }}
          stroke="#e5484d"
          strokeWidth={1.2}
        />
        <text x={xMax} y={yScale(T_MIN_MM) + 13} textAnchor="end" fill="#e5484d" fontSize={10} fontFamily="var(--mono)">
          t_min {T_MIN_MM.toFixed(2)} mm
        </text>

        <LinePath
          data={TANK_204_COURSES}
          curve={curveMonotoneX}
          x={(d) => xScale(course(d)) ?? 0}
          y={(d) => yScale(reading(d)) ?? 0}
          stroke="#eeeeee"
          strokeWidth={1.6}
        />

        {TANK_204_COURSES.map((d) => {
          const failing = d.status === "REPAIR_REQUIRED";
          const refer = d.status === "REFER_TO_ENGINEERING";
          return (
            <Circle
              key={d.course}
              cx={xScale(course(d))}
              cy={yScale(reading(d))}
              r={3.4}
              fill={failing ? "#e5484d" : refer ? "#d9a441" : "#101010"}
              stroke={failing ? "#e5484d" : refer ? "#d9a441" : "#eeeeee"}
              strokeWidth={1.4}
            />
          );
        })}
      </Group>
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
    // ResizeObserver is an optional capability — a server render, a very old
    // browser or a test environment may not have it. Fall back to the element's
    // measured width once rather than refusing to draw.
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
