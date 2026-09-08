import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChainOfThought, ChainOfThoughtContent, ChainOfThoughtItem, ChainOfThoughtStep, ChainOfThoughtTrigger } from "@/components/prompt-kit/chain-of-thought";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/prompt-kit/reasoning";
import { Steps, StepsContent, StepsItem, StepsTrigger } from "@/components/prompt-kit/steps";
import { TextShimmer } from "@/components/prompt-kit/text-shimmer";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";
import { Tool } from "@/components/prompt-kit/tool";

describe("prompt-kit primitives", () => {
  it("TextShimmer renders its text", () => {
    render(<TextShimmer>Working…</TextShimmer>);
    expect(screen.getByText("Working…")).toBeInTheDocument();
  });

  it("ThinkingBar shows text and stops on the stop button", () => {
    const onStop = vi.fn();
    render(<ThinkingBar text="Thinking" stopLabel="Stop" onStop={onStop} />);
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalled();
  });

  it("Reasoning toggles its content", () => {
    render(
      <Reasoning>
        <ReasoningTrigger>Show AI reasoning</ReasoningTrigger>
        <ReasoningContent>
          <p>Secret-free reasoning detail</p>
        </ReasoningContent>
      </Reasoning>,
    );
    expect(screen.queryByText(/reasoning detail/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show AI reasoning/i }));
    expect(screen.getByText(/reasoning detail/i)).toBeInTheDocument();
  });

  it("ChainOfThought shows step items", () => {
    render(
      <ChainOfThought>
        <ChainOfThoughtStep>
          <ChainOfThoughtTrigger>Plan the task</ChainOfThoughtTrigger>
          <ChainOfThoughtContent>
            <ChainOfThoughtItem>Search first</ChainOfThoughtItem>
          </ChainOfThoughtContent>
        </ChainOfThoughtStep>
      </ChainOfThought>,
    );
    expect(screen.getByText("Plan the task")).toBeInTheDocument();
    expect(screen.getByText("Search first")).toBeInTheDocument();
  });

  it("Steps toggle content items", () => {
    render(
      <Steps>
        <StepsTrigger>Agent run: summarize</StepsTrigger>
        <StepsContent>
          <StepsItem>Searching files</StepsItem>
          <StepsItem state="active">Parsing markdown</StepsItem>
        </StepsContent>
      </Steps>,
    );
    expect(screen.queryByText("Searching files")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Agent run: summarize/i }));
    expect(screen.getByText("Searching files")).toBeInTheDocument();
    expect(screen.getByText("Parsing markdown")).toBeInTheDocument();
  });

  it("Tool renders running and error states", () => {
    const { rerender } = render(
      <Tool toolPart={{ type: "document_search", state: "input-available", input: { query: "pump" } }} />,
    );
    expect(screen.getByText("document_search")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
    rerender(
      <Tool toolPart={{ type: "email_send", state: "output-error", errorText: "SMTP down" }} />,
    );
    expect(screen.getByText("SMTP down")).toBeInTheDocument();
    expect(screen.getByText("error")).toBeInTheDocument();
  });
});
