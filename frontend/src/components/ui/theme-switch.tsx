"use client";

import * as React from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "sovereign.theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  // One short crossfade for the whole surface instead of every element
  // transitioning on its own schedule, then the class comes back off so it
  // never interferes with ordinary interaction.
  root.classList.add("theme-changing");
  root.dataset.theme = theme;
  window.setTimeout(() => root.classList.remove("theme-changing"), 300);
}

export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = React.useState<Theme>("dark");

  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage unavailable
    }
    const initial: Theme = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  const change = React.useCallback((next: Theme) => {
    setTheme(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  return [theme, change];
}

/**
 * Theme switch.
 *
 * The disc crosses the track while the two glyphs rotate past each other, so
 * it reads as one object turning over rather than two icons swapping. The
 * whole surface repaints under a single 260ms crossfade.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={["theme-switch", className].filter(Boolean).join(" ")}
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      role="switch"
      aria-checked={theme === "light"}
    >
      <span className="theme-switch__disc">
        <svg className="theme-switch__icon theme-switch__icon--moon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <svg className="theme-switch__icon theme-switch__icon--sun" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      </span>
    </button>
  );
}

export default ThemeSwitch;
