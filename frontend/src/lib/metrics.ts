/**
 * Verified project metrics.
 *
 * Every number in this file was measured against this repository, and every
 * entry carries the command or file it came from. Nothing here is illustrative.
 * If a figure cannot be traced to a source it does not belong on the landing
 * page — the product's whole claim is "proof, not statement", and a decorative
 * statistic sitting next to a real egress counter discredits the counter.
 *
 * Re-measure with `npm run verify:metrics` (scripts/verify-metrics.mjs).
 */

export interface VerifiedMetric {
  /** Short label — Plex Mono uppercase in the UI. */
  label: string;
  /** The measured value, pre-formatted. */
  value: string;
  /** Unit or qualifier shown beside the value. */
  unit?: string;
  /** How this number was obtained. Rendered in the UI, not just a comment. */
  source: string;
  /** Positive framing is the default; `caution` renders in ochre. */
  tone?: "neutral" | "positive" | "caution";
}

/** Measured 2026-09-20 on branch fix/model-routing-and-compute-verification. */
export const MEASURED_AT = "2026-09-27";
export const MEASURED_REF = "master";

export const HEADLINE_METRICS: VerifiedMetric[] = [
  {
    label: "Cloud egress",
    value: "0",
    unit: "bytes",
    source: "NetworkGuard blocks every non-loopback host; /api/sovereignty",
    tone: "positive",
  },
  {
    label: "Backend tests",
    value: "819",
    unit: "functions",
    source: "grep -c 'def test_' backend/tests/*.py — 76 files (2026-09-26; 766 collected)",
    tone: "positive",
  },
  {
    label: "Agent tools",
    value: "12",
    unit: "local only",
    source: "BaseTool subclasses in backend/app/services/tools.py",
  },
  {
    label: "Local models",
    value: "5",
    unit: "capabilities",
    source:
      "config/models.yaml — routed: general, coding, math, document, vision (a 6th, `planner`, is disabled)",
  },
];

export const SYSTEM_METRICS: VerifiedMetric[] = [
  {
    label: "Backend Python",
    value: "20,698",
    unit: "lines",
    source: "wc -l backend/app/**/*.py",
  },
  {
    label: "HTTP routes",
    value: "41",
    unit: "endpoints",
    source: "@router decorators in backend/app/api/*.py",
  },
  {
    label: "Audit event types",
    value: "25",
    unit: "append-only",
    source: "hash-chained SqliteAuditStore, data/astra.db",
  },
  {
    label: "Sandbox hardening",
    value: "8",
    unit: "docker flags",
    source: "--network none, --read-only, --cap-drop ALL, --pids-limit 128, …",
  },
  {
    label: "Pipeline nodes",
    value: "4",
    unit: "typed stages",
    source: "extract → retrieve → compute → draft (backend/app/services/nodes.py)",
  },
  {
    label: "Frontend tests",
    value: "78",
    unit: "cases",
    source: "vitest run — frontend/src/**/*.test.tsx",
  },
];

/**
 * Benchmarks. These are the honest ones — including the score that is not
 * good yet. A panel that finds one number you hid stops believing the rest.
 */
export interface Benchmark {
  name: string;
  value: string;
  detail: string;
  tone: "positive" | "caution";
}

export const BENCHMARKS: Benchmark[] = [
  {
    name: "Job-store write latency",
    value: "0.25 ms",
    detail:
      "Per status update at 200 queued jobs — 0.93× the cost at 1 job. The old full-table rewrite is gone; SQLite WAL, busy_timeout 5000.",
    tone: "positive",
  },
  {
    name: "Table extraction, 4-page scan",
    value: "100 s",
    detail:
      "Docling with the ONNX RapidOCR backend, CPU only, fully offline. Down from 249 s on the torch backend — a 2.5× cut that also removed an external model host.",
    tone: "positive",
  },
  {
    name: "Capability classifier",
    value: "15 / 17",
    detail:
      "Held-out accuracy at threshold 0.55 for the nearest-exemplar router that picks a model per node. Two misses, both between general and document.",
    tone: "positive",
  },
  {
    name: "Job-plan model fill (1B)",
    value: "82% vs 89%",
    detail:
      "bench/plan_eval.py, 40 hand-labelled requests (2026-09-26). On the fields the deterministic plan layer leaves unset, qwen3:1.7b scores 82% against 89% for the regex layer alone: it invents a deliverable for plain chat questions, and the escalation-only merge cannot withdraw a wrong addition. Kept off — PLANNER_ENABLED=false — while the typed JobPlan stays. An 8B reaches 92% but keeps the same wrong-adds.",
    tone: "caution",
  },
  {
    name: "Hard Scenario 01 (API 653)",
    value: "1–6 / 20",
    detail:
      "Not finale-ready, and we publish it anyway. The extract node's model intermittently answers in prose instead of calling submit_findings, so the assessment it should ground never gets built. Terminal-tool narrowing landed 2026-09-20 as a mitigation; the real fixes are a stronger tool-calling extract model or fully deterministic extraction.",
    tone: "caution",
  },
];

/**
 * Tank 204 shell-thickness survey — the fixture behind Hard Scenario 01.
 * Values are computed in tests/hard_scenario_01/constants.py by the API 653
 * one-foot method as written in SOP-09 Rev 3; `expectedResults()` there is the
 * single source of truth and this array mirrors its output exactly.
 */
export interface CourseReading {
  course: number;
  /** 2026 survey reading, mm. Course 5 is the handwritten correction. */
  current_mm: number;
  /** 2021 baseline, mm. Course 5's page was marked not accessible. */
  previous_mm: number | null;
  rate_mm_yr: number | null;
  status: "OK" | "ALERT" | "REPAIR_REQUIRED" | "REFER_TO_ENGINEERING";
}

/** Minimum permissible thickness, mm. 4.9·D·(H−0.3)·G / (S·E). */
export const T_MIN_MM = 11.36;
/** Alert band: t_min + the 1.0 mm margin in SOP-09 Rev 3 (Rev 2 said 2.0). */
export const T_ALERT_MM = 12.36;

export const TANK_204_COURSES: CourseReading[] = [
  { course: 1, current_mm: 13.4, previous_mm: 14.1, rate_mm_yr: 0.13, status: "OK" },
  { course: 2, current_mm: 10.9, previous_mm: 11.9, rate_mm_yr: 0.19, status: "REPAIR_REQUIRED" },
  { course: 3, current_mm: 11.2, previous_mm: 12.2, rate_mm_yr: 0.19, status: "REPAIR_REQUIRED" },
  { course: 4, current_mm: 12.8, previous_mm: 13.6, rate_mm_yr: 0.15, status: "OK" },
  { course: 5, current_mm: 11.6, previous_mm: null, rate_mm_yr: null, status: "REFER_TO_ENGINEERING" },
  { course: 6, current_mm: 11.56, previous_mm: 12.4, rate_mm_yr: 0.16, status: "ALERT" },
];

/** The five capabilities the router can resolve, from config/models.yaml. */
export const MODEL_ROSTER = [
  { capability: "general", model: "gpt-oss:20b", vram_mb: 3584 },
  { capability: "coding", model: "devstral:24b", vram_mb: 4096 },
  { capability: "math", model: "deepseek-r1:14b", vram_mb: 4096 },
  { capability: "document", model: "qwen3-vl:latest", vram_mb: 3584 },
  { capability: "vision", model: "qwen3-vl:latest", vram_mb: 3584 },
] as const;

/**
 * The embedding model. Not a routed capability — it is not in models.yaml and
 * the scheduler declares no GPU reservation for it — but it is the model that
 * decides between the other five: SemanticCapabilityClassifier embeds each
 * task and picks the nearest capability, and document_search runs on it too.
 */
export const EMBEDDING_MODEL = {
  capability: "embed",
  model: "nomic-embed-text",
  source: "backend/app/config.py — embedding_model",
} as const;

/** The agent's complete tool surface. Every one runs on this machine. */
export const TOOL_SURFACE = [
  "list_files",
  "read_file",
  "write_file",
  "code_execution",
  "submit_findings",
  "document_search",
  "read_document",
  "document_exact_search",
  "pid_diagram_qa",
  "document_vision",
  "document_generation",
  "presentation_generation",
] as const;
