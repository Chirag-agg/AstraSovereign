import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AnimatedNumber } from "@/components/core/animated-number";
import { GeneratingRing } from "@/components/core/generating-ring";
import { NewtonsCradle } from "@/components/core/newtons-cradle";
import { TextEffect } from "@/components/core/text-effect";
import { ThemeToggle } from "@/components/core/theme-toggle";
import { Tilt } from "@/components/core/tilt";
import { UnderlineButton } from "@/components/core/underline-button";

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function flush(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("core motion primitives", () => {
  it("TextEffect renders its text (chars present)", () => {
    const { container } = render(<TextEffect per="char">Animate</TextEffect>);
    expect(container.textContent).toBe("Animate");
  });

  it("AnimatedNumber counts up to the target", async () => {
    vi.useFakeTimers();
    render(<AnimatedNumber value={2082} springOptions={{ duration: 1000 }} />);
    await flush(1100);
    expect(screen.getByText("2,082")).toBeInTheDocument();
  });

  it("Tilt renders children", () => {
    render(<Tilt>card</Tilt>);
    expect(screen.getByText("card")).toBeInTheDocument();
  });

  it("loaders expose status text", () => {
    render(<NewtonsCradle />);
    expect(screen.getByRole("status", { name: "working" })).toBeInTheDocument();
    render(<GeneratingRing />);
    expect(screen.getByRole("status", { name: "Generating" })).toBeInTheDocument();
  });

  it("UnderlineButton triggers onClick", () => {
    const onClick = vi.fn();
    render(<UnderlineButton onClick={onClick}>Go</UnderlineButton>);
    fireEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("ThemeToggle switches between themes", () => {
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "Switch to light theme" });
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Switch to dark theme" })).toBeInTheDocument();
  });
});
