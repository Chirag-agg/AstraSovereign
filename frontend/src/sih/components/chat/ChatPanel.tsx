import { useEffect, useRef, useState } from "react";
import {
  Send,
  Paperclip,
  ListChecks,
  Wrench,
  Brain,
  CheckCircle2,
  XCircle,
  X,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import type { AgentStep, Turn } from "../../lib/types";
import { MODELS, KB_DOCS } from "../../lib/data";
import { CodeBlock } from "../common/CodeBlock";
import { CitationRow } from "../common/CitationRow";
import { ScanPreview } from "../common/ScanPreview";
import { DeliverableCard } from "./DeliverableCard";
import { BrandMark } from "../common/Logo";
import Markdown from "@/components/Markdown";

interface PendingFile {
  name: string;
  folder?: string;
  file?: File;
}

const STEP_META: Record<AgentStep["kind"], { icon: typeof ListChecks }> = {
  plan: { icon: ListChecks },
  "tool-call": { icon: Wrench },
  "tool-result": { icon: Wrench },
  model: { icon: Brain },
  approval: { icon: UserCheck },
  deliverable: { icon: UserCheck },
};

function StepRow({ step }: { step: AgentStep }) {
  const Icon = STEP_META[step.kind].icon;
  const model = step.modelId ? MODELS.find((m) => m.id === step.modelId) : undefined;
  const modelName = model?.name ?? step.modelName;

  return (
    <div className="flex gap-3 py-2.5 animate-fade-in">
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
        style={{ background: "var(--bg-sunken)", color: "var(--text-tertiary)" }}
      >
        <Icon size={11} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>{step.title}</p>
          {modelName && (
            <span className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>{modelName}</span>
          )}
        </div>
        {step.detail && (
          <p className="mt-0.5 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.detail}</p>
        )}
        {step.showScan && <ScanPreview label="Scanned original" align="left" />}
        {step.code && (
          <div className="mt-2"><CodeBlock code={step.code} lang={step.codeLang ?? "python"} compact /></div>
        )}
        {step.output && (
          <pre
            className="mono mt-2 whitespace-pre-wrap rounded-md border px-3 py-2 text-[11.5px] leading-relaxed"
            style={{ background: "var(--bg-sunken)", borderColor: "var(--border-subtle)", color: "var(--text-secondary)" }}
          >
            {step.output}
          </pre>
        )}
        {step.citations && <CitationRow citations={step.citations} />}
      </div>
    </div>
  );
}

function AgentTrail({ steps, running, meta }: { steps: AgentStep[]; running: boolean; meta: string }) {
  const [open, setOpen] = useState(running);
  const wasRunning = useRef(running);

  useEffect(() => {
    if (wasRunning.current && !running) {
      const t = setTimeout(() => setOpen(false), 900);
      wasRunning.current = running;
      return () => clearTimeout(t);
    }
    wasRunning.current = running;
  }, [running]);

  if (steps.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border" style={{ borderColor: "var(--border-subtle)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
      >
        <ChevronRight
          size={13}
          className="shrink-0 transition-transform"
          style={{ color: "var(--text-tertiary)", transform: open ? "rotate(90deg)" : "none" }}
        />
        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {running ? "Working" : "Agent steps"}
        </span>
        <span className="text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{meta}</span>
        {running && <span className="caret text-[12px]" style={{ color: "var(--text-tertiary)" }}>▍</span>}
      </button>
      {open && (
        <div className="divide-y px-3 pb-2" style={{ borderColor: "var(--border-subtle)" }}>
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalBar({ approval, detail, onApprove, onReject }: {
  approval: "pending" | "approved" | "rejected";
  detail?: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (approval === "approved") {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--safe-600)" }}>
        <CheckCircle2 size={14} /> Approved and exported
      </p>
    );
  }
  if (approval === "rejected") {
    return (
      <p className="mb-3 flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--alert-600)" }}>
        <XCircle size={14} /> Rejected, sent back to the agent
      </p>
    );
  }
  return (
    <div
      className="mb-3 rounded-lg border p-3.5"
      style={{ borderColor: "var(--copper-300)", background: "var(--copper-100)" }}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium" style={{ color: "var(--copper-700)" }}>
        <UserCheck size={14} />
        Needs your review before it can be exported
      </p>
      {detail && (
        <p className="mt-1 text-[12.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{detail}</p>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onApprove}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors"
          style={{ background: "var(--safe-600)" }}
        >
          <CheckCircle2 size={13} />
          Approve and export
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors"
          style={{ borderColor: "var(--border-default)", color: "var(--alert-600)" }}
        >
          <XCircle size={13} />
          Reject, send back
        </button>
      </div>
    </div>
  );
}

function TurnBlock({ turn, onApprove, onReject, onDownloadArtifact }: {
  turn: Turn;
  onApprove?: () => void;
  onReject?: () => void;
  onDownloadArtifact?: (jobId: string, artifactId: string, filename: string) => Promise<void>;
}) {
  const { scenario, revealCount, approval } = turn;
  const visibleSteps = scenario.steps.slice(0, revealCount);
  const allRevealed = revealCount >= scenario.steps.length;
  const running = !allRevealed;

  const approvalStep = visibleSteps.find((s) => s.kind === "approval");
  const trailSteps = visibleSteps.filter((s) => s.kind !== "approval");
  const lastModelStep = [...visibleSteps].reverse().find((s) => s.kind === "model");
  const allCitations = visibleSteps.flatMap((s) => s.citations ?? []);

  const modelUsed = scenario.routedModelId ? MODELS.find((m) => m.id === scenario.routedModelId) : undefined;
  const modelName = modelUsed?.name ?? scenario.routedModelName;
  const trailMeta = `${trailSteps.length} steps${modelName ? ` · ${modelName}` : ""}`;

  const showDeliverable = scenario.deliverable && allRevealed && approval !== "rejected";
  const showAnswer = !scenario.deliverable && allRevealed && lastModelStep?.detail;
  const locked = approval === "pending" || scenario.artifactStatus === "creating";

  const deliverableDownload = scenario.deliverable && scenario.artifactId && scenario.artifactJobId
    ? async () => {
        if (onDownloadArtifact) {
          await onDownloadArtifact(scenario.artifactJobId!, scenario.artifactId!, scenario.deliverable!.name);
        }
      }
    : undefined;

  return (
    <div id={turn.id} className="flex scroll-mt-4 flex-col gap-5 border-b py-7 first:pt-0" style={{ borderColor: "var(--border-subtle)" }}>
      <div className="flex flex-col items-end">
        <span className="mb-1 text-[11px]" style={{ color: "var(--text-tertiary)" }}>{turn.time}</span>
        <div
          className="max-w-[75%] rounded-2xl rounded-tr-sm px-4 py-2.5"
          style={{ background: "var(--bg-sunken)" }}
        >
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
            {scenario.prompt}
          </p>
        </div>
        {scenario.attachedFiles.length > 0 && (
          <div className="mt-2 flex max-w-[75%] flex-wrap justify-end gap-1.5">
            {scenario.attachedFiles.map((fid) => {
              const doc = KB_DOCS.find((d) => d.id === fid);
              if (!doc) return null;
              return (
                <span
                  key={fid}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <Paperclip size={10} />
                  {doc.name}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <BrandMark size={16} />
          <span className="text-[12.5px] font-medium" style={{ color: "var(--text-primary)" }}>Agent</span>
        </div>

        <div className="pl-[26px]">
          <AgentTrail steps={trailSteps} running={running} meta={trailMeta} />

          {scenario.error && (
            <div
              className="mb-3 rounded-lg border px-3.5 py-2.5 text-[12.5px] leading-relaxed"
              style={{ borderColor: "var(--alert-100)", background: "var(--alert-100)", color: "var(--alert-600)" }}
              role="alert"
            >
              {scenario.error}
            </div>
          )}

          {approvalStep && (
            <ApprovalBar
              approval={approval === "none" ? "pending" : approval}
              detail={approvalStep.detail}
              onApprove={() => onApprove?.()}
              onReject={() => onReject?.()}
            />
          )}

          {showAnswer && (
            <div>
              <div className="md" style={{ fontSize: 14, color: "var(--text-primary)" }}>
                <Markdown text={lastModelStep!.detail ?? ""} />
              </div>
              {allCitations.length > 0 && <CitationRow citations={allCitations} />}
            </div>
          )}

          {showDeliverable && scenario.deliverable && (
            <div className="flex flex-col gap-2.5">
              <DeliverableCard
                deliverable={scenario.deliverable}
                locked={locked}
                citations={allCitations}
                onDownload={deliverableDownload}
              />
              {scenario.extraDeliverable && (
                <DeliverableCard deliverable={scenario.extraDeliverable} locked={locked} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const SAMPLE_PROMPTS = [
  {
    id: "run-code",
    label: "Write and run code in the sandbox",
    prompt: "Write a Python function that computes a simple pressure drop for a pipe and run it with a small worked example.",
  },
  {
    id: "ask-procedure",
    label: "Ask about a procedure",
    prompt: "Search the knowledge base and summarise what our inspection SOPs say about tank shell thickness limits.",
  },
  {
    id: "draft-doc",
    label: "Draft a document",
    prompt: "Draft a short approval note summarising an inspection finding and leave the sign off fields blank.",
  },
  {
    id: "explain",
    label: "Explain a concept",
    prompt: "Explain how a flare knockout drum is sized and what the key governing equation is.",
  },
];

export function ChatPanel({
  turns,
  onSend,
  onApprove,
  onReject,
  onDownloadArtifact,
}: {
  turns: Turn[];
  onSend: (prompt: string, files: PendingFile[]) => void;
  onApprove?: (turnId: string) => void;
  onReject?: (turnId: string) => void;
  onDownloadArtifact?: (jobId: string, artifactId: string, filename: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const revealSignature = turns.map((t) => t.revealCount).join(",");
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, revealSignature]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, pendingFiles);
    setValue("");
    setPendingFiles([]);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6">
        <div className="mx-auto max-w-3xl">
          {turns.length === 0 ? (
            <EmptyState onPick={(p) => submit(p)} />
          ) : (
            turns.map((t) => (
              <TurnBlock
                key={t.id}
                turn={t}
                onApprove={() => onApprove?.(t.id)}
                onReject={() => onReject?.(t.id)}
                onDownloadArtifact={onDownloadArtifact}
              />
            ))
          )}
        </div>
      </div>

      <div className="border-t px-6 py-4" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="mx-auto max-w-3xl">
          {turns.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => submit(p.prompt)}
                  className="rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {pendingFiles.map((f, i) => (
                <span
                  key={f.name + i}
                  className="flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]"
                  style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                >
                  <Paperclip size={10} />
                  {f.name}
                  <button onClick={() => setPendingFiles((p) => p.filter((_, idx) => idx !== i))}>
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div
            className="flex items-end gap-2 rounded-xl border px-3 py-2.5"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
          >
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Upload a file to the knowledge base"
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors"
              style={{ color: "var(--text-tertiary)" }}
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                setPendingFiles((p) => [...p, ...files.map((f) => ({ name: f.name, file: f }))]);
                e.target.value = "";
              }}
            />

            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit(value);
                }
              }}
              placeholder="Ask the agent to draft, analyze, retrieve, or write and run code"
              rows={1}
              className="max-h-32 flex-1 resize-none bg-transparent py-1 text-[13.5px] outline-none"
              style={{ color: "var(--text-primary)" }}
            />

            <button
              onClick={() => submit(value)}
              disabled={!value.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white transition-colors disabled:opacity-40"
              style={{ background: "var(--accent-solid)" }}
            >
              <Send size={14} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            Every request stays inside the plant network. Nothing here is sent to an external model.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
          Where should we start
        </h2>
        <p className="mx-auto mt-1.5 max-w-md text-[13.5px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Describe any task in plain language. The workbench classifies it, routes it to the right local model,
          and shows every step it takes — retrieval, OCR, code in the sandbox or document generation.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-cols-2">
        {SAMPLE_PROMPTS.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.prompt)}
            className="rounded-lg border p-3.5 text-left transition-colors"
            style={{ borderColor: "var(--border-default)", background: "var(--bg-surface)" }}
          >
            <p className="text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{p.label}</p>
            <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>{p.prompt}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
