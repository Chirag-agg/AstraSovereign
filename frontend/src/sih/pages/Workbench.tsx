import { useEffect, useMemo, useRef, useState } from "react";
import { TopBar, Sidebar } from "../components/layout/AppShell";
import { ChatPanel } from "../components/chat/ChatPanel";
import { RightRail } from "../components/rail/RightRail";
import { KnowledgeBase } from "../components/knowledge/KnowledgeBase";
import { Sandbox } from "../components/sandbox/Sandbox";
import { LiveLogs } from "../components/livelogs/LiveLogs";
import { ModelRouting } from "../components/routing/ModelRouting";
import { Vault } from "../components/vault/Vault";
import { getJob, submitChat, uploadDocument } from "@/lib/api";
import type { Job } from "@/lib/types";
import type { AgentStep, AuditEntry, Scenario, Section, Turn } from "../lib/types";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function activeUserId(): string {
  try {
    return window.localStorage.getItem("sovereign.active-user") || "user-001";
  } catch {
    return "user-001";
  }
}

const TASK_INFO: Record<string, { category: Scenario["category"]; label: string }> = {
  "document-analysis": { category: "document-analysis", label: "Document analysis · OCR · Vision" },
  vision: { category: "document-analysis", label: "Document analysis · OCR · Vision" },
  ocr: { category: "document-analysis", label: "Document analysis · OCR · Vision" },
  coding: { category: "coding", label: "Coding · Sandbox execution" },
  code: { category: "coding", label: "Coding · Sandbox execution" },
  "knowledge-retrieval": { category: "knowledge-retrieval", label: "Knowledge retrieval · RAG" },
  retrieval: { category: "knowledge-retrieval", label: "Knowledge retrieval · RAG" },
  "multimodal-report": { category: "multimodal-report", label: "Report generation" },
  report: { category: "multimodal-report", label: "Report generation" },
  general: { category: "knowledge-retrieval", label: "General reasoning" },
  reasoning: { category: "knowledge-retrieval", label: "General reasoning" },
  default: { category: "knowledge-retrieval", label: "General reasoning" },
};

function taskInfo(taskType?: string | null): string {
  return TASK_INFO[taskType ?? "default"]?.label ?? TASK_INFO.default.label;
}

function short(text: string | null | undefined, limit = 220): string {
  const t = (text ?? "").trim();
  if (!t) return "";
  return t.length > limit ? `${t.slice(0, limit)}…` : t;
}

function toolTitle(tool: string): string {
  switch (tool) {
    case "document_search":
      return "Knowledge retrieval";
    case "document_vision":
      return "OCR + vision analysis";
    case "code_execution":
      return "Code execution (isolated sandbox)";
    case "document_generation":
      return "Word document generation";
    case "list_files":
      return "Workspace file listing";
    case "read_file":
      return "Read file";
    case "write_file":
      return "Write file";
    default:
      return tool;
  }
}

function deliverableTypeFromName(name: string): "docx" | "xlsx" | "pptx" | "code" {
  const n = name.toLowerCase();
  if (n.endsWith(".xlsx")) return "xlsx";
  if (n.endsWith(".pptx")) return "pptx";
  if (n.endsWith(".py") || n.endsWith(".js") || n.endsWith(".ts")) return "code";
  return "docx";
}

function scenarioFromJob(job: Job, error?: string): Scenario {
  const steps: AgentStep[] = [];
  const modelName = job.model || undefined;
  const taskLabel = taskInfo(job.task_type);

  const push = (s: Omit<AgentStep, "id">) => {
    steps.push({ ...s, id: `s${steps.length}` });
  };

  for (const entry of job.execution_trace ?? []) {
    switch (entry.type) {
      case "agent_started": {
        push({
          kind: "model",
          title: "Agent session started",
          modelName: (entry.model as string) || modelName,
          detail: `Task type: ${entry.task_type || job.task_type || "general"}.`,
          status: "done",
        });
        break;
      }
      case "plan": {
        const description = (entry.description as string) || "";
        const meaningful =
          description &&
          !description.toLowerCase().startsWith("call tool") &&
          !description.toLowerCase().startsWith("produce the final");
        if (meaningful) {
          push({ kind: "plan", title: "Plan", detail: short(description, 320), status: "done" });
        }
        break;
      }
      case "tool_call": {
        const tool = (entry.tool as string) || "tool";
        push({ kind: "tool-call", title: toolTitle(tool), detail: `Executing ${tool} locally.`, status: "done" });
        break;
      }
      case "tool_result": {
        const tool = (entry.tool as string) || "tool";
        const ok = entry.ok !== false;
        const summary = short(entry.result_summary, 300) || (ok ? "Completed." : "Failed.");
        push({
          kind: "tool-result",
          title: ok ? `${toolTitle(tool)} — completed` : `${toolTitle(tool)} — failed`,
          detail: summary,
          output: ok ? undefined : `✕ ${summary}`,
          status: "done",
        });
        break;
      }
      case "stage_started": {
        push({
          kind: "model",
          title: `Stage ${entry.label}`,
          modelName: (entry.model as string) || modelName,
          detail: entry.capability
            ? `Capability: ${String(entry.capability)}${Number(entry.attempt) > 1 ? ` · attempt ${entry.attempt}` : ""}`
            : undefined,
          status: "done",
        });
        break;
      }
      case "stage_completed": {
        push({
          kind: "tool-result",
          title: `${entry.label} — completed`,
          detail: short(entry.output_summary as string, 300) || "ok",
          status: "done",
        });
        break;
      }
      case "stage_retry": {
        push({ kind: "plan", title: `${entry.label} — retry`, detail: `Attempt ${entry.attempt}`, status: "done" });
        break;
      }
      case "pipeline_completed": {
        push({
          kind: "model",
          title: "Multi-model pipeline finished",
          detail: Array.isArray(entry.stages) ? (entry.stages as string[]).join("\n") : undefined,
          status: "done",
        });
        break;
      }
      default:
        break;
    }
  }

  const artifact = job.artifacts?.[0];
  let deliverable: Scenario["deliverable"];
  if (job.status === "completed" && artifact) {
    deliverable = {
      type: deliverableTypeFromName(artifact.filename),
      name: artifact.filename,
      summary: "Generated locally on this machine.",
    };
  }

  if (job.status === "completed" && job.response) {
    push({
      kind: "model",
      title: "Completed",
      modelName,
      detail: job.response,
      status: "done",
    });
  }

  return {
    id: job.job_id,
    label: short(job.message, 46) || "Untitled task",
    prompt: job.message,
    category: TASK_INFO[job.task_type ?? "default"]?.category ?? TASK_INFO.default.category,
    categoryLabel: taskLabel,
    routedModelName: modelName,
    attachedFiles: [],
    steps,
    deliverable,
    audit: [],
    error: job.status === "failed" ? short(job.error, 400) || "The agent could not complete the task." : error,
    artifactId: artifact?.artifact_id,
    artifactJobId: artifact?.job_id,
    artifactStatus: artifact?.status,
  };
}

function auditFromEvents(job: Job): AuditEntry[] {
  return (job.execution_trace ?? [])
    .filter((e) => e.type === "tool_call" || e.type === "tool_result")
    .map((e, i) => ({
      id: `${job.job_id}-${e.step}-${i}`,
      time: nowLabel(),
      actor: e.type === "tool_call" ? "router" : "tool",
      category: (e.type === "tool_call" ? "routing" : "tool") as AuditEntry["category"],
      message: e.type === "tool_call" ? `Routed and executing ${e.tool ?? "tool"}` : (e.result_summary as string) || "Tool completed",
    }));
}

export default function Workbench() {
  const [section, setSection] = useState<Section>("chat");
  const [turns, setTurns] = useState<(Turn & { jobId?: string; liveStatus?: string })[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);
  const sessionDocsRef = useRef<string[]>([]);

  const userId = useMemo(() => activeUserId(), []);

  useEffect(() => {
    if (section !== "chat" || !pendingScroll) return;
    const target = pendingScroll;
    const raf = requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScroll(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [section, pendingScroll]);

  const selectTurn = (turnId: string) => {
    setSection("chat");
    setPendingScroll(turnId);
  };

  const newSession = () => {
    setTurns([]);
    setAuditLog([]);
  };

  const applyJob = (job: Job) => {
    const scenario = scenarioFromJob(job);
    const terminal = TERMINAL.has(job.status);
    setTurns((prev) =>
      prev.map((t) =>
        t.jobId === job.job_id
          ? { ...t, liveStatus: job.status, scenario, revealCount: terminal ? scenario.steps.length : Math.max(scenario.steps.length - 1, 0) }
          : t,
      ),
    );
    if (terminal) {
      setAuditLog((prev) => {
        const known = new Set(prev.map((a) => a.id));
        const fresh = [...auditFromEvents(job), ...prev].filter((a) => !known.has(a.id));
        return [...fresh, ...prev].slice(0, 200);
      });
    }
  };

  const handleSend = async (prompt: string, files: { name: string; file?: File }[]) => {
    const display = prompt.trim();
    if (!display) return;

    try {
      for (const f of files) {
        if (f.file) {
          await uploadDocument(userId, f.file);
          sessionDocsRef.current.push(f.name);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not upload an attachment.";
      const id = `failed-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        {
          id,
          time: nowLabel(),
          scenario: {
            id,
            label: short(display, 46),
            prompt: display,
            category: "knowledge-retrieval",
            categoryLabel: "General reasoning",
            attachedFiles: [],
            steps: [],
            audit: [],
            error: message,
          },
          revealCount: 0,
          approval: "none",
          exported: false,
        },
      ]);
      return;
    }

    // Carry conversation context into follow-up requests: the documents
    // attached this session and the most recent answer, so "summarise this
    // pdf" followed by "summary in 300 words" keeps working.
    const prev = [...turns].reverse().find((t) => t.jobId && TERMINAL.has(t.liveStatus ?? "") && !t.scenario.error);
    const prevFinal = prev?.scenario.steps.filter((s) => s.kind === "model").pop();
    const prevAnswer = prevFinal?.detail ?? undefined;

    const ctxParts: string[] = [];
    if (sessionDocsRef.current.length > 0) {
      ctxParts.push(
        `Document(s) attached to this conversation and stored in the user's knowledge base: ${sessionDocsRef.current.join(", ")}. Use them when relevant.`,
      );
    }
    if (prevAnswer) {
      ctxParts.push(`Earlier in this conversation I answered:\n${prevAnswer.slice(0, 2400)}`);
    }
    const fullPrompt = ctxParts.length > 0 ? `${display}\n\n[Session context]\n${ctxParts.join("\n\n")}` : display;

    try {
      const submit = await submitChat(userId, fullPrompt);
      const id = submit.job_id;
      const queued: (Turn & { jobId: string; liveStatus: string }) = {
        id,
        time: nowLabel(),
        liveStatus: "queued",
        jobId: id,
        scenario: {
          id,
          label: short(display, 46),
          prompt: display,
          category: "knowledge-retrieval",
          categoryLabel: "General reasoning",
          routedModelName: undefined,
          attachedFiles: [],
          steps: [],
          audit: [],
        },
        revealCount: 0,
        approval: "none",
        exported: false,
      };
      setTurns((prev) => [...prev, queued]);
      setAuditLog((prev) => [
        ...prev,
        { id: `${id}-submitted`, time: nowLabel(), actor: "router", category: "routing", message: "Task classified and submitted to the local queue" },
      ]);
      try {
        const job = await getJob(userId, id);
        if (job) applyJob(job);
      } catch {
        // the poller continues
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not reach the backend.";
      const id = `failed-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        {
          id,
          time: nowLabel(),
          scenario: {
            id,
            label: short(display, 46),
            prompt: display,
            category: "knowledge-retrieval",
            categoryLabel: "General reasoning",
            attachedFiles: [],
            steps: [],
            audit: [],
            error: message,
          },
          revealCount: 0,
          approval: "none",
          exported: false,
        },
      ]);
    }
  };

  const downloadArtifact = async (jobId: string, artifactId: string, filename: string) => {
    const { downloadArtifact: fetchArtifact } = await import("@/lib/api");
    const { blob } = await fetchArtifact(userId, jobId, artifactId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const activeTurns = turns.filter((t) => t.jobId && t.liveStatus && !TERMINAL.has(t.liveStatus));
  const activeTurn = turns[turns.length - 1];

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--bg-canvas)" }}>
      <TopBar />
      {activeTurns.map((t) => (
        <JobPoller
          key={t.jobId}
          jobId={t.jobId!}
          userId={userId}
          liveStatus={t.liveStatus!}
          onJob={applyJob}
        />
      ))}
      <div className="flex min-h-0 flex-1">
        <Sidebar section={section} onSection={setSection} turns={turns} onSelectTurn={selectTurn} onNewSession={newSession} />

        {section === "chat" && (
          <>
            <ChatPanel turns={turns} onSend={handleSend} onDownloadArtifact={downloadArtifact} />
            <RightRail auditLog={auditLog} activeTurn={activeTurn} />
          </>
        )}
        {section === "logs" && <LiveLogs turns={turns} auditLog={auditLog} />}
        {section === "routing" && <ModelRouting turns={turns} auditLog={auditLog} />}
        {section === "knowledge" && <KnowledgeBase />}
        {section === "vault" && <Vault />}
        {section === "sandbox" && <Sandbox />}
      </div>
    </div>
  );
}

function JobPoller({
  jobId,
  userId,
  liveStatus,
  onJob,
}: {
  jobId: string;
  userId: string;
  liveStatus: string;
  onJob: (job: Job) => void;
}) {
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const job = await getJob(userId, jobId);
        if (alive) onJob(job);
      } catch {
        // transient backend error; keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1100);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // liveStatus intentionally excluded: keep polling until unmounted at terminal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, userId]);

  return null;
}
