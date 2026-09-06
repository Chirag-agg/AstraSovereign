"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
const THEME_KEY = "sovereign.theme";

function initialTheme(): Theme {
  return "dark";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.dataset.theme = theme;
}

/** Sun/moon theme toggler (persisted, animated, hydration-safe). */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Restore the persisted theme only after mount (keeps SSR/CSR consistent).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
      }
    } catch {
      // ignore storage access errors
    }
  }, []);

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage access errors
    }
  }, [theme]);

  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      title={theme === "dark" ? "Light theme" : "Dark theme"}
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <span className="sun" aria-hidden="true">
        ☀
      </span>
      <span className="moon" aria-hidden="true">
        ☾
      </span>
    </button>
  );
}

export default ThemeToggle;
