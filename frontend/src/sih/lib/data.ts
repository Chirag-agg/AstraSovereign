import type {
  LocalModel,
  KbDoc,
  Scenario,
  AuditEntry,
} from "./types";

export const MODELS: LocalModel[] = [
  {
    id: "qwen3-32b",
    name: "Qwen3 32B",
    family: "Qwen3",
    version: "2025.09",
    license: "Apache 2.0",
    params: "32B",
    quantization: "AWQ 4-bit",
    contextWindow: "131,072 tok",
    vram: "24 GB",
    capabilities: ["coding", "reasoning"],
    status: "healthy",
    latencyMs: 340,
    notes: "Agentic tool use, coding, spreadsheet and calculation tasks",
  },
  {
    id: "deepseek-r1-70b",
    name: "DeepSeek-R1 Distill 70B",
    family: "DeepSeek-R1",
    version: "R1-0528",
    license: "MIT",
    params: "70B",
    quantization: "GGUF Q5_K_M",
    contextWindow: "65,536 tok",
    vram: "48 GB",
    capabilities: ["reasoning"],
    status: "healthy",
    latencyMs: 640,
    notes: "Long chain of thought for engineering calculations",
  },
  {
    id: "llama-3.3-70b",
    name: "Llama 3.3 70B Instruct",
    family: "Llama 3.3",
    version: "3.3",
    license: "Custom",
    params: "70B",
    quantization: "AWQ 4-bit",
    contextWindow: "128,000 tok",
    vram: "48 GB",
    capabilities: ["reasoning"],
    status: "healthy",
    latencyMs: 410,
    notes: "Document synthesis, drafting, retrieval augmented answers",
  },
  {
    id: "gemma3-27b-vision",
    name: "Gemma 3 27B Vision",
    family: "Gemma 3",
    version: "3.0",
    license: "Gemma",
    params: "27B",
    quantization: "AWQ 4-bit",
    contextWindow: "32,768 tok",
    vram: "20 GB",
    capabilities: ["vision", "ocr", "reasoning"],
    status: "healthy",
    latencyMs: 280,
    notes: "Scanned document OCR, drawings, photographs, handwriting",
  },
  {
    id: "bge-m3-embed",
    name: "BGE-M3",
    family: "BAAI",
    version: "1.0",
    license: "MIT",
    params: "0.5B",
    quantization: "FP16",
    contextWindow: "8,192 tok",
    vram: "2 GB",
    capabilities: ["embedding"],
    status: "healthy",
    latencyMs: 40,
    notes: "Knowledge base chunk embedding",
  },
  {
    id: "bge-reranker-v2",
    name: "BGE Reranker v2",
    family: "BAAI",
    version: "2.0",
    license: "MIT",
    params: "0.3B",
    quantization: "FP16",
    contextWindow: "8,192 tok",
    vram: "1 GB",
    capabilities: ["reranking"],
    status: "healthy",
    latencyMs: 25,
    notes: "Re-ranks retrieved passages before context assembly",
  },
];

export const KB_DOCS: KbDoc[] = [
  {
    id: "sop-09",
    name: "SOP-09 Tank Inspection Thickness Limits.pdf",
    folder: "SOPs & Manuals",
    kind: "pdf",
    pages: 34,
    size: "2.1 MB",
    updated: "2025-11-02",
    classification: "Internal",
    description: "Minimum retirement thickness tables for atmospheric storage tanks.",
  },
  {
    id: "sop-14",
    name: "SOP-14 Confined Space Entry.pdf",
    folder: "SOPs & Manuals",
    kind: "pdf",
    pages: 21,
    size: "1.4 MB",
    updated: "2026-01-18",
    classification: "Internal",
    description: "Authorization chain and gas testing procedure for confined space entry.",
  },
  {
    id: "insp-tk204",
    name: "INSP-2026-0417 TK-204 Scanned Report.pdf",
    folder: "Inspection Reports",
    kind: "pdf-scanned",
    pages: 6,
    size: "8.7 MB",
    updated: "2026-04-17",
    classification: "Confidential",
    description: "Field inspector scanned notes and shell thickness readings for Tank 204.",
  },
  {
    id: "pid-cdu2",
    name: "PID CDU-2 Rev C.png",
    folder: "Engineering Drawings",
    kind: "image",
    size: "5.3 MB",
    updated: "2025-08-30",
    classification: "Restricted",
    description: "Piping and instrument diagram for Crude Distillation Unit 2.",
  },
  {
    id: "hse-q2",
    name: "HSE Incident Log Q2.xlsx",
    folder: "HSE Records",
    kind: "xlsx",
    size: "412 KB",
    updated: "2026-07-05",
    classification: "Confidential",
    description: "Logged near miss, first aid and reportable incidents for Q2.",
  },
  {
    id: "vendor-turbine",
    name: "Vendor Correspondence Turbine Overhaul.pdf",
    folder: "Correspondence",
    kind: "pdf",
    pages: 12,
    size: "980 KB",
    updated: "2026-05-22",
    classification: "Restricted",
    description: "Commercial correspondence with OEM on turbine overhaul scope.",
  },
];

function auditFor(scenarioId: string, entries: Omit<AuditEntry, "id">[]): AuditEntry[] {
  return entries.map((e, i) => ({ ...e, id: `${scenarioId}-a${i}` }));
}

export const SCENARIOS: Scenario[] = [
  {
    id: "inspection-approval-note",
    label: "Draft approval note from scanned inspection report",
    prompt:
      "Read the attached scanned inspection report for Tank 204 and draft a Word approval note summarizing key findings, corrosion readings against SOP limits, and recommended actions. Leave sign off fields blank for the area manager.",
    category: "document-analysis",
    categoryLabel: "Document analysis · OCR · Vision",
    routedModelId: "gemma3-27b-vision",
    attachedFiles: ["insp-tk204", "sop-09"],
    steps: [
      {
        id: "s1",
        kind: "plan",
        title: "Plan",
        detail:
          "Task requires OCR on a scanned PDF, cross reference against SOP-09 thickness limits, then draft a structured approval note. Classified Confidential, export will require human sign off before the file leaves the workbench.",
        status: "done",
        durationMs: 640,
      },
      {
        id: "s2",
        kind: "tool-call",
        title: "file_read · INSP-2026-0417 TK-204 Scanned Report.pdf",
        tool: "file_read",
        detail: "Loading 6 page scanned document from Inspection Reports.",
        status: "done",
        durationMs: 210,
      },
      {
        id: "s3",
        kind: "model",
        title: "OCR and handwriting extraction",
        modelId: "gemma3-27b-vision",
        detail:
          "Extracted inspector notes and the shell thickness table from pages 3 to 5, including handwritten annotations.",
        showScan: true,
        output:
          "Inspector: R. Kamath  |  Date: 2026-04-17  |  Tag: TK-204\nShell course 1: 11.8 mm read (nominal 12.7 mm)\nShell course 2: 10.9 mm read (nominal 12.7 mm)\nShell course 3: 12.1 mm read (nominal 12.7 mm)\nNote (handwritten): \"Localized pitting near course 2 weld seam, north face.\"",
        status: "done",
        durationMs: 1850,
      },
      {
        id: "s4",
        kind: "tool-call",
        title: "knowledge_search · minimum retirement thickness TK-204",
        tool: "knowledge_search",
        detail: "Permission-aware retrieval scoped to documents the current user can access.",
        status: "done",
        durationMs: 260,
      },
      {
        id: "s5",
        kind: "tool-result",
        title: "Retrieved SOP-09, page 12",
        citations: [{ doc: "SOP-09 Tank Inspection Thickness Limits.pdf", page: "12" }],
        output:
          "\"For shell courses of this tank class, minimum retirement thickness is 11.0 mm. Any course reading below nominal by more than 1.5 mm shall trigger an engineering review before the next inspection cycle.\"",
        status: "done",
        durationMs: 90,
      },
      {
        id: "s6",
        kind: "model",
        title: "Reasoning · compare readings against limit",
        modelId: "deepseek-r1-70b",
        detail:
          "Course 2 reading of 10.9 mm is below the 11.0 mm minimum retirement thickness. This is a limit breach, not just a deviation, so the note is flagged high impact.",
        status: "done",
        durationMs: 980,
      },
      {
        id: "s7",
        kind: "model",
        title: "Draft approval note",
        modelId: "llama-3.3-70b",
        detail: "Composing structured Word document with findings, limit comparison and recommended actions.",
        status: "done",
        durationMs: 1400,
      },
      {
        id: "s8",
        kind: "approval",
        title: "Human review required before export",
        detail:
          "Course 2 reading breaches SOP-09 minimum retirement thickness. Policy requires area manager sign off before this deliverable can be exported.",
        status: "pending",
      },
    ],
    deliverable: {
      type: "docx",
      name: "TK-204_Approval_Note_2026-04-17.docx",
      summary: "Approval note drafted, one SOP limit breach flagged for engineering review.",
      sections: [
        {
          heading: "Summary",
          body: "Routine external inspection of Tank 204 on 2026-04-17 by R. Kamath. Shell course 2 thickness reads 10.9 mm against a minimum retirement thickness of 11.0 mm per SOP-09. Localized pitting was noted near the course 2 weld seam, north face.",
        },
        {
          heading: "Findings",
          body: "Course 1: 11.8 mm, within limit. Course 2: 10.9 mm, below the 11.0 mm minimum retirement thickness, limit breach. Course 3: 12.1 mm, within limit.",
        },
        {
          heading: "Recommended action",
          body: "Raise an engineering review for shell course 2 before the next scheduled inspection cycle, per SOP-09 section 4.3. Consider ultrasonic re-verification at the pitted weld seam within 30 days.",
        },
        {
          heading: "Sign off",
          body: "Area Manager: ______________________     Date: ____________\nHSE Reviewer: ______________________     Date: ____________",
        },
      ],
    },
    audit: auditFor("insp", [
      { time: "T+0.0s", actor: "system", category: "system", message: "Session bound to GPU isolation slot gpu-sess-7f2c, VRAM reserved 20 GB" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Task classified as document-analysis with OCR and vision requirements" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Routed to Gemma 3 27B Vision, capability match on ocr and vision" },
      { time: "T+0.4s", actor: "security", category: "security", message: "File classification Confidential, read scope limited to current session" },
      { time: "T+2.3s", actor: "tool", category: "tool", message: "file_read completed on INSP-2026-0417 TK-204 Scanned Report.pdf" },
      { time: "T+4.1s", actor: "security", category: "security", message: "knowledge_search executed with permission filter for user role Engineer" },
      { time: "T+5.1s", actor: "router", category: "routing", message: "Handoff to DeepSeek-R1 70B for numeric comparison against SOP limit" },
      { time: "T+6.5s", actor: "router", category: "routing", message: "Handoff to Llama 3.3 70B for document drafting" },
      { time: "T+8.0s", actor: "approval", category: "approval", message: "High impact flag raised, routed to human-in-the-loop queue" },
      { time: "T+8.0s", actor: "system", category: "system", message: "Temp OCR buffers scheduled for cleanup on session close" },
    ]),
  },
  {
    id: "flare-kod-sizing",
    label: "Size and test a flare knockout drum script",
    prompt:
      "Write a Python script that sizes a vertical flare knockout drum from gas flow rate and droplet size, then test it against the API 521 worked example and show the pass or fail result.",
    category: "coding",
    categoryLabel: "Coding · Sandbox execution",
    routedModelId: "qwen3-32b",
    attachedFiles: [],
    steps: [
      {
        id: "s1",
        kind: "plan",
        title: "Plan",
        detail:
          "Implement Souders-Brown terminal velocity sizing for a vertical KO drum, wrap it in a function, then write a test against the API 521 Appendix worked example values.",
        status: "done",
        durationMs: 420,
      },
      {
        id: "s2",
        kind: "tool-call",
        title: "sandbox_create · python3.11, isolated, no network",
        tool: "code_sandbox",
        detail: "Ephemeral container, package set pinned to numpy only, egress disabled.",
        status: "done",
        durationMs: 310,
      },
      {
        id: "s3",
        kind: "model",
        title: "Write kod_sizing.py",
        modelId: "qwen3-32b",
        code: `import math

def ko_drum_diameter(
    vapor_flow_kg_s: float,
    vapor_density: float,
    liquid_density: float,
    k_souders_brown: float = 0.107,
) -> dict:
    """Vertical flare KO drum sizing via Souders-Brown terminal velocity."""
    v_terminal = k_souders_brown * math.sqrt(
        (liquid_density - vapor_density) / vapor_density
    )
    vol_flow = vapor_flow_kg_s / vapor_density
    area = vol_flow / v_terminal
    diameter = math.sqrt(4 * area / math.pi)
    return {
        "v_terminal_m_s": round(v_terminal, 4),
        "min_diameter_m": round(diameter, 3),
    }`,
        codeLang: "python",
        status: "done",
        durationMs: 1600,
      },
      {
        id: "s4",
        kind: "tool-call",
        title: "test_kod_sizing.py · pytest -q",
        tool: "code_sandbox",
        detail: "Running against the API 521 Appendix D worked example inputs.",
        status: "done",
        durationMs: 540,
        code: `def test_api521_worked_example():
    result = ko_drum_diameter(
        vapor_flow_kg_s=13.6,
        vapor_density=1.94,
        liquid_density=560.0,
    )
    assert 2.6 <= result["min_diameter_m"] <= 2.8`,
        codeLang: "python",
      },
      {
        id: "s5",
        kind: "tool-result",
        title: "pytest result",
        output: "1 passed in 0.09s\nmin_diameter_m = 2.71  (reference range 2.6 to 2.8)",
        status: "done",
        durationMs: 90,
      },
      {
        id: "s6",
        kind: "model",
        title: "Summarize result",
        modelId: "qwen3-32b",
        detail:
          "Script matches the API 521 worked example within tolerance. No sign off gate required, code execution stayed inside the sandbox with no file system writes outside the working directory.",
        status: "done",
        durationMs: 260,
      },
    ],
    deliverable: {
      type: "code",
      name: "kod_sizing.py",
      summary: "Sizing function implemented and verified against the API 521 worked example, test passing.",
      code: `import math

def ko_drum_diameter(
    vapor_flow_kg_s: float,
    vapor_density: float,
    liquid_density: float,
    k_souders_brown: float = 0.107,
) -> dict:
    """Vertical flare KO drum sizing via Souders-Brown terminal velocity."""
    v_terminal = k_souders_brown * math.sqrt(
        (liquid_density - vapor_density) / vapor_density
    )
    vol_flow = vapor_flow_kg_s / vapor_density
    area = vol_flow / v_terminal
    diameter = math.sqrt(4 * area / math.pi)
    return {
        "v_terminal_m_s": round(v_terminal, 4),
        "min_diameter_m": round(diameter, 3),
    }

# test_kod_sizing.py
def test_api521_worked_example():
    result = ko_drum_diameter(
        vapor_flow_kg_s=13.6,
        vapor_density=1.94,
        liquid_density=560.0,
    )
    assert 2.6 <= result["min_diameter_m"] <= 2.8

# pytest -q -> 1 passed in 0.09s, min_diameter_m = 2.71`,
      codeLang: "python",
    },
    audit: auditFor("kod", [
      { time: "T+0.0s", actor: "system", category: "system", message: "Session bound to GPU isolation slot gpu-sess-3a91, VRAM reserved 24 GB" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Task classified as coding, routed to Qwen3 32B" },
      { time: "T+0.5s", actor: "tool", category: "tool", message: "code_sandbox created, network egress disabled, package set numpy only" },
      { time: "T+2.1s", actor: "tool", category: "tool", message: "kod_sizing.py written to sandbox working directory" },
      { time: "T+2.7s", actor: "tool", category: "tool", message: "pytest executed, 1 passed in 0.09s" },
      { time: "T+3.0s", actor: "system", category: "system", message: "Sandbox destroyed on completion, no artifacts persisted outside session" },
    ]),
  },
  {
    id: "confined-space-sop",
    label: "Confined space entry authorization at CDU-2",
    prompt:
      "What does our SOP say about confined space entry authorization at CDU-2? Include exact clause references.",
    category: "knowledge-retrieval",
    categoryLabel: "Knowledge retrieval · RAG",
    routedModelId: "llama-3.3-70b",
    attachedFiles: ["sop-14", "pid-cdu2"],
    steps: [
      {
        id: "s1",
        kind: "plan",
        title: "Plan",
        detail: "Low risk informational query. Retrieve grounded passages and answer with citations, no export or approval gate required.",
        status: "done",
        durationMs: 180,
      },
      {
        id: "s2",
        kind: "tool-call",
        title: "knowledge_search · confined space entry authorization CDU-2",
        tool: "knowledge_search",
        detail: "Embedding via BGE-M3, top 12 chunks reranked with BGE Reranker v2, permission filter applied for role Engineer.",
        status: "done",
        durationMs: 310,
      },
      {
        id: "s3",
        kind: "tool-result",
        title: "Top passages after rerank",
        citations: [
          { doc: "SOP-14 Confined Space Entry.pdf", page: "4" },
          { doc: "SOP-14 Confined Space Entry.pdf", page: "7" },
        ],
        output:
          "Clause 3.2: \"Entry into any vessel, tank or pit classified as a confined space requires a signed Confined Space Entry Permit, countersigned by the Shift Engineer and the Area Safety Officer.\"\nClause 4.1: \"Continuous gas testing for O2, LEL and H2S is mandatory for the duration of entry, logged at 15 minute intervals.\"",
        status: "done",
        durationMs: 100,
      },
      {
        id: "s4",
        kind: "model",
        title: "Compose grounded answer",
        modelId: "llama-3.3-70b",
        detail:
          "At CDU-2, confined space entry requires a signed permit countersigned by the Shift Engineer and Area Safety Officer, per SOP-14 clause 3.2. Continuous O2, LEL and H2S monitoring is mandatory during entry, logged every 15 minutes, per clause 4.1. No CDU-2 specific exception is recorded in the current SOP revision.",
        status: "done",
        durationMs: 720,
      },
    ],
    audit: auditFor("csp", [
      { time: "T+0.0s", actor: "system", category: "system", message: "Session bound to GPU isolation slot gpu-sess-9c44, VRAM reserved 48 GB" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Task classified as knowledge-retrieval, routed to Llama 3.3 70B" },
      { time: "T+0.2s", actor: "security", category: "security", message: "knowledge_search permission filter applied, role Engineer, department Operations" },
      { time: "T+0.6s", actor: "tool", category: "tool", message: "Retrieved and reranked 12 candidate chunks, 2 selected for context assembly" },
      { time: "T+1.3s", actor: "system", category: "system", message: "No export requested, no approval gate triggered" },
    ]),
  },
  {
    id: "hse-board-slides",
    label: "Summarize Q2 HSE incident log into board slides",
    prompt:
      "Summarize the Q2 HSE incident log into a two slide board ready summary with the trend and the top three corrective actions.",
    category: "multimodal-report",
    categoryLabel: "Spreadsheet analysis · PowerPoint generation",
    routedModelId: "qwen3-32b",
    attachedFiles: ["hse-q2"],
    steps: [
      {
        id: "s1",
        kind: "plan",
        title: "Plan",
        detail: "Read the incident log, compute monthly trend and severity mix, draft two slides, then hold for human review before export since this goes to the board.",
        status: "done",
        durationMs: 300,
      },
      {
        id: "s2",
        kind: "tool-call",
        title: "spreadsheet_read · HSE Incident Log Q2.xlsx",
        tool: "spreadsheet_read",
        detail: "Loaded 3 sheets, 214 logged entries across April, May and June.",
        status: "done",
        durationMs: 260,
      },
      {
        id: "s3",
        kind: "tool-call",
        title: "calc · monthly incident rate and severity mix",
        tool: "calculator",
        detail: "Aggregating near miss, first aid and reportable categories by month.",
        status: "done",
        durationMs: 180,
        output: "April: 31 logged, 2 reportable\nMay: 28 logged, 1 reportable\nJune: 22 logged, 0 reportable\nTrend: reportable incidents down 100 percent month over month since April",
      },
      {
        id: "s4",
        kind: "model",
        title: "Identify top corrective actions",
        modelId: "qwen3-32b",
        detail: "Clustering free text root cause notes to find the three most frequent corrective action themes.",
        output: "1. PPE compliance at height work, 9 mentions\n2. Housekeeping in laydown yard, 6 mentions\n3. Permit to work overlap during shift change, 5 mentions",
        status: "done",
        durationMs: 890,
      },
      {
        id: "s5",
        kind: "model",
        title: "Draft board slides",
        modelId: "llama-3.3-70b",
        detail: "Composing two slide PowerPoint with trend chart callouts and corrective action summary.",
        status: "done",
        durationMs: 1100,
      },
      {
        id: "s6",
        kind: "approval",
        title: "Human review required before export",
        detail: "Board facing deliverable. Policy requires HSE Manager review before this file can be exported.",
        status: "pending",
      },
    ],
    deliverable: {
      type: "pptx",
      name: "HSE_Q2_Board_Summary.pptx",
      summary: "Two slide board summary drafted, reportable incidents trending down through the quarter.",
      sections: [
        {
          heading: "Slide 1 · Q2 HSE trend",
          body: "Reportable incidents: April 2, May 1, June 0. Total logged events down 29 percent from April to June. April's count includes the TK-204 shell thickness finding from 2026-04-17, already routed for engineering review. Near miss reporting rate holding steady, indicating reporting culture is intact rather than under reporting.",
        },
        {
          heading: "Slide 2 · Top corrective actions",
          body: "1. PPE compliance at height work. 2. Housekeeping in the laydown yard. 3. Permit to work overlap during shift change. Owners and target dates to be confirmed by HSE Manager before circulation.",
        },
      ],
    },
    extraDeliverable: {
      type: "xlsx",
      name: "HSE_Q2_Summary.xlsx",
      summary: "The monthly incident counts and corrective action tally behind the board summary.",
      rows: [
        ["Month", "Logged events", "Reportable", "Near miss", "First aid"],
        ["April", "31", "2", "18", "11"],
        ["May", "28", "1", "17", "10"],
        ["June", "22", "0", "15", "7"],
        ["", "", "", "", ""],
        ["Corrective action theme", "Mentions", "", "", ""],
        ["PPE compliance at height work", "9", "", "", ""],
        ["Housekeeping in laydown yard", "6", "", "", ""],
        ["Permit to work overlap during shift change", "5", "", "", ""],
      ],
    },
    audit: auditFor("hse", [
      { time: "T+0.0s", actor: "system", category: "system", message: "Session bound to GPU isolation slot gpu-sess-5e10, VRAM reserved 24 GB" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Task classified as multimodal-report, spreadsheet plus drafting" },
      { time: "T+0.1s", actor: "router", category: "routing", message: "Routed to Qwen3 32B for spreadsheet analysis" },
      { time: "T+2.6s", actor: "tool", category: "tool", message: "spreadsheet_read completed, 214 rows parsed across 3 sheets" },
      { time: "T+4.9s", actor: "router", category: "routing", message: "Handoff to Llama 3.3 70B for slide drafting" },
      { time: "T+6.0s", actor: "approval", category: "approval", message: "Board facing output, routed to human-in-the-loop queue for HSE Manager review" },
    ]),
  },
];

export const SESSION_ID = "gpu-sess-7f2c";

export const NETWORK_ALLOWLIST = [
  { addr: "127.0.0.1:8000", label: "Workbench API gateway", kind: "local" as const },
  { addr: "127.0.0.1:11434", label: "Local model runtime", kind: "local" as const },
  { addr: "127.0.0.1:6333", label: "Vector database", kind: "local" as const },
  { addr: "10.20.4.11:445", label: "Site file server (SOPs and manuals)", kind: "lan" as const },
];
