import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Markdown from "./Markdown";

describe("Markdown inline emphasis", () => {
  it("renders *word* as italic", () => {
    const { container } = render(<Markdown text="Course 6 is *alert* now." />);
    expect(container.querySelector("em")?.textContent).toBe("alert");
  });

  it("leaves arithmetic alone", () => {
    const { container } = render(<Markdown text="Area is 5 * 3 * 2 = 30." />);
    expect(container.querySelector("em")).toBeNull();
    expect(screen.getByText(/5 \* 3 \* 2 = 30/)).toBeInTheDocument();
  });

  it("still renders bold", () => {
    const { container } = render(<Markdown text="**Tank 204** is held." />);
    expect(container.querySelector("strong")?.textContent).toBe("Tank 204");
  });
});
