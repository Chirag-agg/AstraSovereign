import "@testing-library/jest-dom/vitest";

if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = function () {};
  (window as any).IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
