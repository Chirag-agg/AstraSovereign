"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Magnetic dock.
 *
 * Structure and magnetic maths as supplied; the skin is on the system —
 * 3px radii instead of 2xl pills, hairline borders instead of soft shadows,
 * and a mono tooltip. The icons are the product's own subsystems.
 */

export interface DockItemData {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  badge?: number;
  /** Mono caption under the tooltip label — a model name, a count, a state. */
  meta?: string;
}

export interface MagneticDockProps {
  items: DockItemData[];
  iconSize?: number;
  maxScale?: number;
  magneticDistance?: number;
  showLabels?: boolean;
  position?: "bottom" | "top" | "left" | "right";
  variant?: "glass" | "solid" | "transparent";
  className?: string;
}

interface DockItemProps {
  item: DockItemData;
  mouseX: MotionValue<number>;
  iconSize: number;
  maxScale: number;
  magneticDistance: number;
  showLabels: boolean;
  isVertical: boolean;
}

function DockItem({
  item,
  mouseX,
  iconSize,
  maxScale,
  magneticDistance,
  showLabels,
  isVertical,
}: DockItemProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  const distance = useTransform(mouseX, (val: number) => {
    if (!ref.current) return magneticDistance + 1;
    const rect = ref.current.getBoundingClientRect();
    const center = isVertical ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    return val - center;
  });

  const scale = useTransform(distance, [-magneticDistance, 0, magneticDistance], [1, maxScale, 1]);
  const springConfig = { damping: 22, stiffness: 320, mass: 0.5 };
  const smoothScale = useSpring(scale, springConfig);
  const size = useTransform(smoothScale, (s) => s * iconSize);
  const lift = useTransform(smoothScale, (s) => (s - 1) * -10);
  const smoothLift = useSpring(lift, springConfig);

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={item.onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={item.label}
      aria-current={item.isActive ? "page" : undefined}
      className="relative flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--signal)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--canvas)]"
      style={{
        width: size,
        height: size,
        y: isVertical ? 0 : smoothLift,
        x: isVertical ? smoothLift : 0,
      }}
      whileTap={{ scale: 0.92 }}
    >
      <motion.span
        className="relative flex h-full w-full items-center justify-center overflow-hidden"
        style={{
          borderRadius: 3,
          background: item.isActive ? "var(--carbon)" : "var(--surface-raised)",
          border: `1px solid ${item.isActive ? "var(--signal)" : isHovered ? "var(--ash)" : "#262220"}`,
          transition: "border-color 160ms cubic-bezier(0.4,0,0.2,1), background-color 160ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <span
          className="flex h-[52%] w-[52%] items-center justify-center"
          style={{ color: item.isActive ? "var(--signal)" : isHovered ? "var(--bone)" : "var(--granite)" }}
        >
          {item.icon}
        </span>
      </motion.span>

      <AnimatePresence>
        {item.badge !== undefined && item.badge > 0 && (
          <motion.span
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center px-1 font-mono"
            style={{
              fontSize: 9,
              borderRadius: 2,
              background: "var(--signal)",
              color: "#101010",
              lineHeight: 1,
            }}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </motion.span>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {item.isActive && (
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            className="absolute -bottom-2 h-px w-4"
            style={{ background: "var(--signal)" }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLabels && isHovered && (
          <motion.span
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            className="pointer-events-none absolute -top-12 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap px-2.5 py-1.5"
            style={{
              background: "var(--carbon)",
              border: "1px solid var(--ash)",
              borderRadius: 3,
            }}
          >
            <span className="block font-mono uppercase" style={{ fontSize: 11, letterSpacing: "-0.02em", color: "var(--bone)" }}>
              {item.label}
            </span>
            {item.meta && (
              <span className="block font-mono" style={{ fontSize: 10, color: "var(--granite)" }}>
                {item.meta}
              </span>
            )}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

export function MagneticDock({
  items,
  iconSize = 46,
  maxScale = 1.55,
  magneticDistance = 140,
  showLabels = true,
  position = "bottom",
  variant = "glass",
  className,
}: MagneticDockProps) {
  const mousePosition = useMotionValue(Infinity);
  const isVertical = position === "left" || position === "right";

  const handleMouseMove = React.useCallback(
    (event: React.MouseEvent) => {
      mousePosition.set(isVertical ? event.clientY : event.clientX);
    },
    [mousePosition, isVertical],
  );

  const variantStyle: React.CSSProperties =
    variant === "transparent"
      ? { background: "transparent", border: "none" }
      : variant === "solid"
        ? { background: "var(--carbon)", border: "1px solid var(--ash)" }
        : {
            background: "color-mix(in srgb, var(--carbon) 78%, transparent)",
            border: "1px solid var(--ash)",
            backdropFilter: "blur(14px) saturate(140%)",
          };

  return (
    <motion.nav
      onMouseMove={handleMouseMove}
      onMouseLeave={() => mousePosition.set(Infinity)}
      aria-label="Subsystems"
      className={cn("inline-flex items-end gap-1.5 p-1.5", isVertical ? "flex-col" : "flex-row", className)}
      style={{ ...variantStyle, borderRadius: 4 }}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {items.map((item) => (
        <DockItem
          key={item.id}
          item={item}
          mouseX={mousePosition}
          iconSize={iconSize}
          maxScale={maxScale}
          magneticDistance={magneticDistance}
          showLabels={showLabels}
          isVertical={isVertical}
        />
      ))}
    </motion.nav>
  );
}

/* ------------------------------------------------------------------ icons
   Drawn for this product: the subsystems the dock actually switches between.
   Stroke-only, 24-grid, 1.6 weight so they sit with Plex Mono. */

function Ico({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      {children}
    </svg>
  );
}

export const DockIconDesk = () => (
  <Ico>
    <path d="M3 7h18" /><path d="M5 7v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7" /><path d="M9 4h6v3H9z" /><path d="M9 12h6" />
  </Ico>
);
export const DockIconDocuments = () => (
  <Ico>
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /><path d="M14 3v5h5" /><path d="M9 13h6" /><path d="M9 17h4" />
  </Ico>
);
export const DockIconRouter = () => (
  <Ico>
    <circle cx="12" cy="12" r="2.4" /><path d="M12 3v6.6" /><path d="M12 14.4V21" /><path d="M4.5 7.5l4.1 3" /><path d="M19.5 7.5l-4.1 3" /><path d="M4.5 16.5l4.1-3" /><path d="M19.5 16.5l-4.1-3" />
  </Ico>
);
export const DockIconSandbox = () => (
  <Ico>
    <rect x="3" y="4" width="18" height="16" rx="1" /><path d="M7 9l2.5 2.5L7 14" /><path d="M12.5 15h4" />
  </Ico>
);
export const DockIconVision = () => (
  <Ico>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.6" />
  </Ico>
);
export const DockIconDeliverables = () => (
  <Ico>
    <path d="M4 5h16v5H4z" /><path d="M5 10v9h14v-9" /><path d="M10 14h4" />
  </Ico>
);
export const DockIconAudit = () => (
  <Ico>
    <path d="M5 4h9l5 5v11H5z" /><path d="M14 4v5h5" /><path d="M8 12.5h4" /><path d="M8 16h7" /><circle cx="16.5" cy="16" r="1" />
  </Ico>
);
export const DockIconShield = () => (
  <Ico>
    <path d="M12 3l7.5 3v6c0 4.6-3.1 8-7.5 9-4.4-1-7.5-4.4-7.5-9V6z" /><path d="M9 12l2.2 2.2L15.5 10" />
  </Ico>
);

export default MagneticDock;
