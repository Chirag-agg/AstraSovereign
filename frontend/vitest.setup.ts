import "@testing-library/jest-dom/vitest";

// jsdom does not implement matchMedia. Components that honour
// prefers-reduced-motion / pointer: fine read it on mount, so give them a
// stable default rather than letting every such test throw.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// jsdom has no ResizeObserver. Width-aware components fall back to a default
// when it is missing, but the observer path is the one worth exercising.
if (typeof globalThis.ResizeObserver === "undefined") {
  class TestResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
}
