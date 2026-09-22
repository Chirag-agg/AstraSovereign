import React from "react";
import { render, screen, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BootGate from "./boot-gate";

describe("BootGate", () => {
  // `npm run dev` runs every effect twice under Strict Mode. An earlier
  // version stored an "already seen" flag on the first run and tore the gate
  // down on the second, so in development it flashed and vanished.
  it("stays up under Strict Mode's double effect run", async () => {
    render(
      <React.StrictMode>
        <BootGate />
      </React.StrictMode>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByRole("button", { name: "Enter AstraSovereign" })).toBeInTheDocument();
  });

  it("appears again on a second load in the same tab", async () => {
    const first = render(<BootGate />);
    first.unmount();
    render(<BootGate />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByRole("button", { name: "Enter AstraSovereign" })).toBeInTheDocument();
  });
});
