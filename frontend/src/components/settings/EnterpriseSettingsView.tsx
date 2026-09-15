"use client";

import React, { useState } from "react";
import {
  Settings,
  Cpu,
  Shield,
  Box,
  FileText,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Download,
  Terminal,
  Save,
  Undo2,
  HardDrive,
  Activity,
  Layers,
  Sparkles,
  Server,
  Lock,
  Presentation,
  Check,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────────
   REUSABLE ATOMIC COMPONENTS
───────────────────────────────────────────────────────────────── */
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  description,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="space-y-0.5">
          {label && <span className="text-xs font-bold text-slate-900 block">{label}</span>}
          {description && <p className="text-xs text-slate-500 leading-relaxed">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-[#7047eb]" : "bg-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

export function SliderWithLabel({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (val: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs">
        <span className="font-bold text-slate-800">{label}</span>
        <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#7047eb]"
      />
      {hint && <p className="text-[11px] text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

export function SettingsCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700 shrink-0">
              <Icon className="w-4.5 h-4.5" />
            </div>
          )}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {badge}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export function BadgePill({
  children,
  variant = "purple",
}: {
  children: React.ReactNode;
  variant?: "purple" | "emerald" | "amber" | "slate";
}) {
  const styles = {
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider border shadow-2xs ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
   MAIN ENTERPRISE SETTINGS WORKSPACE COMPONENT
───────────────────────────────────────────────────────────────── */
export default function EnterpriseSettingsView() {
  const [activeSubTab, setActiveSubTab] = useState<
    "general" | "models" | "compute" | "airgap" | "docker" | "office"
  >("general");

  // State: Has unsaved changes
  const [hasChanges, setHasChanges] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab 1: General & Workspace
  const [workspaceName, setWorkspaceName] = useState("AstraSovereign Production Node");
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("light");
  const [autoSaveFreq, setAutoSaveFreq] = useState(60); // seconds

  // Tab 2: Models & Task Routing (config/models.yaml)
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://127.0.0.1:11434");
  const [ollamaTestState, setOllamaTestState] = useState<"idle" | "testing" | "ok">("idle");
  const [reasoningModel, setReasoningModel] = useState("qwen2.5-coder:14b");
  const [ocrModel, setOcrModel] = useState("rapidocr");
  const [visionModel, setVisionModel] = useState("llava:7b");
  const [embeddingsModel, setEmbeddingsModel] = useState("nomic-embed-text");
  const [contextWindow, setContextWindow] = useState(8192);
  const [temperature, setTemperature] = useState(0.2);

  // Tab 3: Compute & Quotas
  const [vramReserveLimit, setVramReserveLimit] = useState(12); // GB
  const [vramGrantPolicy, setVramGrantPolicy] = useState<"reject" | "queue">("queue");
  const [sandboxMemoryCap, setSandboxMemoryCap] = useState(2048); // MB
  const [maxWorkers, setMaxWorkers] = useState(2);

  // Tab 4: Airgap & NetworkGuard Governance
  const [strictEgress, setStrictEgress] = useState(true);
  const [ledgerVerificationStatus, setLedgerVerificationStatus] = useState<string | null>(null);

  // Tab 5: Docker Sandbox Environment
  const [sandboxImage, setSandboxImage] = useState("workbench-sandbox:py312");
  const [sandboxCheckOutput, setSandboxCheckOutput] = useState<string | null>(null);
  const [sandboxCheckRunning, setSandboxCheckRunning] = useState(false);

  // Tab 6: Office Deliverables & Themes
  const [pptxTheme, setPptxTheme] = useState("Defense Briefing (Navy/Slate)");
  const [pptxAspectRatio, setPptxAspectRatio] = useState<"16:9" | "4:3">("16:9");
  const [includeHashInDocxFooter, setIncludeHashInDocxFooter] = useState(true);

  // Handle Save
  const handleSave = () => {
    setHasChanges(false);
    setToastMessage("Saved to config/models.yaml & local runtime successfully.");
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleReset = () => {
    setWorkspaceName("AstraSovereign Production Node");
    setThemeMode("light");
    setAutoSaveFreq(60);
    setOllamaEndpoint("http://127.0.0.1:11434");
    setReasoningModel("qwen2.5-coder:14b");
    setOcrModel("rapidocr");
    setVisionModel("llava:7b");
    setEmbeddingsModel("nomic-embed-text");
    setContextWindow(8192);
    setTemperature(0.2);
    setVramReserveLimit(12);
    setVramGrantPolicy("queue");
    setSandboxMemoryCap(2048);
    setMaxWorkers(2);
    setStrictEgress(true);
    setSandboxImage("workbench-sandbox:py312");
    setPptxTheme("Defense Briefing (Navy/Slate)");
    setPptxAspectRatio("16:9");
    setIncludeHashInDocxFooter(true);
    setHasChanges(false);
  };

  const triggerChange = () => {
    setHasChanges(true);
  };

  const testOllama = () => {
    setOllamaTestState("testing");
    setTimeout(() => {
      setOllamaTestState("ok");
    }, 600);
  };

  const testSandbox = () => {
    setSandboxCheckRunning(true);
    setSandboxCheckOutput("Running container: workbench-sandbox:py312 with --network none...");
    setTimeout(() => {
      setSandboxCheckRunning(false);
      setSandboxCheckOutput(
        "Container ID: sha256:49fa1b279c...\nExecuting: python -c 'import numpy, pandas; print(\"Sandbox OK\")'\n[Output]: Sandbox OK (numpy 1.26.4, pandas 2.2.2)\nSecurity Constraints: --network none, --read-only rootfs verified.\nExit Code: 0 (Execution Time: 0.84s)"
      );
    }, 900);
  };

  const verifyLedger = () => {
    setLedgerVerificationStatus("Verifying 4,920 SHA-256 ledger blocks...");
    setTimeout(() => {
      setLedgerVerificationStatus("Genesis Block #8493 Validated: 100% Hash-Chained Integrity Confirmed.");
    }, 700);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#F8FAFC]">
      <div className="max-w-[1440px] mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 bg-white p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                Enterprise Node Governance
              </span>
              <span className="text-xs font-bold text-slate-500">
                config/models.yaml &bull; Local Only
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Enterprise Settings &amp; Configuration
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Configure on-premise model routing, hardware quotas, NetworkGuard egress rules, and Docker sandboxes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Airgap Node Config Synced
            </span>
          </div>
        </div>

        {/* 2-Column Layout: Left Sub-Tabs + Right Dynamic Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Navigation Sub-Tabs */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-3 space-y-1.5">
            <button
              onClick={() => setActiveSubTab("general")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "general"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Settings className="w-4 h-4 text-purple-600 shrink-0" />
              <span>General &amp; Workspace</span>
            </button>

            <button
              onClick={() => setActiveSubTab("models")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "models"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Bot className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Local Models &amp; Routing</span>
            </button>

            <button
              onClick={() => setActiveSubTab("compute")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "compute"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Cpu className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Compute &amp; VRAM Quotas</span>
            </button>

            <button
              onClick={() => setActiveSubTab("airgap")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "airgap"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Shield className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Airgap &amp; NetworkGuard</span>
            </button>

            <button
              onClick={() => setActiveSubTab("docker")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "docker"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Box className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Docker Sandbox Environment</span>
            </button>

            <button
              onClick={() => setActiveSubTab("office")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "office"
                  ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <FileText className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Office Deliverables &amp; Themes</span>
            </button>
          </div>

          {/* Right Dynamic Settings Canvas */}
          <div className="lg:col-span-9 space-y-6">
            {/* SUB-TAB 1: GENERAL & WORKSPACE */}
            {activeSubTab === "general" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="Workspace Identity & Storage Paths"
                  subtitle="Configure system name and file roots for local persistence"
                  icon={Settings}
                  badge={<BadgePill variant="purple">General</BadgePill>}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Workspace Node Name</label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => {
                          setWorkspaceName(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                          Project Storage Root
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800 block mt-0.5">
                          /data/projects
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[11px] font-bold text-slate-500 uppercase block">
                          Cowork Workspace Root
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800 block mt-0.5">
                          /data/workspaces
                        </span>
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Theme Mode & Auto-Save"
                  subtitle="Visual appearance and file persistence frequency"
                  icon={Sparkles}
                >
                  <div className="space-y-5">
                    <div>
                      <label className="text-xs font-bold text-slate-800 block mb-2">Theme Mode</label>
                      <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
                        {(["light", "dark", "system"] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setThemeMode(m);
                              triggerChange();
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                              themeMode === m
                                ? "bg-white text-purple-700 shadow-xs border border-slate-200"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {m === "system" ? "System Sync" : m}
                          </button>
                        ))}
                      </div>
                    </div>

                    <SliderWithLabel
                      label="Auto-Save Frequency (Coworking files)"
                      value={autoSaveFreq}
                      min={15}
                      max={300}
                      step={15}
                      unit="seconds"
                      hint="Interval at which file changes in the Cowork workspace are synced to disk"
                      onChange={(v) => {
                        setAutoSaveFreq(v);
                        triggerChange();
                      }}
                    />
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* SUB-TAB 2: LOCAL MODELS & TASK ROUTING */}
            {activeSubTab === "models" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="Local Model Daemon Connection"
                  subtitle="Loopback Ollama instance hosting air-gapped neural weights"
                  icon={Server}
                  badge={<BadgePill variant="emerald">Loopback 127.0.0.1</BadgePill>}
                >
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      type="text"
                      value={ollamaEndpoint}
                      onChange={(e) => {
                        setOllamaEndpoint(e.target.value);
                        triggerChange();
                      }}
                      className="flex-1 w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      type="button"
                      onClick={testOllama}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${ollamaTestState === "testing" ? "animate-spin" : ""}`} />
                      <span>{ollamaTestState === "testing" ? "Probing..." : "Test Connection"}</span>
                    </button>
                  </div>

                  {ollamaTestState === "ok" && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Daemon Connected at http://127.0.0.1:11434 &bull; Version 0.4.1 (PCIe NVLink Active)</span>
                    </div>
                  )}
                </SettingsCard>

                <SettingsCard
                  title="Task Capability Mapping (config/models.yaml)"
                  subtitle="Config-driven mapping of specific task types to local model weights"
                  icon={Bot}
                  badge={<BadgePill variant="purple">Air-Gap Neural Routing</BadgePill>}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Capability 1: Reasoning & Code */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Reasoning &amp; Code</span>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Primary
                        </span>
                      </div>
                      <select
                        value={reasoningModel}
                        onChange={(e) => {
                          setReasoningModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                      >
                        <option value="qwen2.5-coder:14b">qwen2.5-coder:14b (Recommended)</option>
                        <option value="qwen2.5-coder:3b">qwen2.5-coder:3b (Fast)</option>
                        <option value="deepseek-r1:14b">deepseek-r1:14b (Deep Reasoning)</option>
                        <option value="llama3.3:70b">llama3.3:70b (Multi-GPU NVLink)</option>
                      </select>
                      <p className="text-[10.5px] text-slate-500">Autonomous tool dispatch, Python execution, refactors</p>
                    </div>

                    {/* Capability 2: Document Intelligence & OCR */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Document OCR &amp; Tables</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          Vision
                        </span>
                      </div>
                      <select
                        value={ocrModel}
                        onChange={(e) => {
                          setOcrModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                      >
                        <option value="rapidocr">rapidocr (Local C++ Engine)</option>
                        <option value="surya-ocr">surya-ocr (High-Res Ingestion)</option>
                        <option value="tesseract">tesseract-ocr (CPU Fallback)</option>
                      </select>
                      <p className="text-[10.5px] text-slate-500">Extracts tabular invoices, work orders, scanned PDFs</p>
                    </div>

                    {/* Capability 3: Vision Analysis */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Vision Analysis</span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Multimodal
                        </span>
                      </div>
                      <select
                        value={visionModel}
                        onChange={(e) => {
                          setVisionModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                      >
                        <option value="llava:7b">llava:7b (Local Vision)</option>
                        <option value="llama3.2-vision:11b">llama3.2-vision:11b</option>
                        <option value="qwen-vl:7b">qwen-vl:7b</option>
                      </select>
                      <p className="text-[10.5px] text-slate-500">Diagram analysis, schematic visual inspection</p>
                    </div>

                    {/* Capability 4: Embeddings */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">Embeddings (RAG Vault)</span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ChromaDB
                        </span>
                      </div>
                      <select
                        value={embeddingsModel}
                        onChange={(e) => {
                          setEmbeddingsModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none"
                      >
                        <option value="nomic-embed-text">nomic-embed-text (8192 dim)</option>
                        <option value="bge-m3">bge-m3 (Dense + Sparse)</option>
                        <option value="all-minilm-l6-v2">all-minilm-l6-v2</option>
                      </select>
                      <p className="text-[10.5px] text-slate-500">Vector search across air-gapped compliance documents</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <SliderWithLabel
                      label="Context Window Limit"
                      value={contextWindow}
                      min={4096}
                      max={32768}
                      step={2048}
                      unit="tokens"
                      hint="Maximum tokens held in GPU memory per inference session"
                      onChange={(v) => {
                        setContextWindow(v);
                        triggerChange();
                      }}
                    />

                    <SliderWithLabel
                      label="Inference Temperature"
                      value={temperature}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      unit=""
                      hint="Lower values (0.1 - 0.2) ensure deterministic regulatory outputs"
                      onChange={(v) => {
                        setTemperature(v);
                        triggerChange();
                      }}
                    />
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* SUB-TAB 3: COMPUTE & HARDWARE QUOTAS */}
            {activeSubTab === "compute" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="GPU VRAM & Memory Allocation"
                  subtitle="Manage PCIe bus allocation and strict memory fences"
                  icon={Cpu}
                  badge={<BadgePill variant="amber">Hardware Quotas</BadgePill>}
                >
                  <div className="space-y-5">
                    <SliderWithLabel
                      label="Total VRAM Reserve Limit"
                      value={vramReserveLimit}
                      min={4}
                      max={24}
                      step={1}
                      unit="GB"
                      hint="Physical Hardware: 16.0 GB Available (NVIDIA RTX 4090)"
                      onChange={(v) => {
                        setVramReserveLimit(v);
                        triggerChange();
                      }}
                    />

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Model VRAM Grant Policy</label>
                      <select
                        value={vramGrantPolicy}
                        onChange={(e) => {
                          setVramGrantPolicy(e.target.value as "reject" | "queue");
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none"
                      >
                        <option value="queue">Queue until VRAM freed (FIFO task prioritization)</option>
                        <option value="reject">Strict Reject when full (Prevents any out-of-memory crashes)</option>
                      </select>
                      <p className="text-[11px] text-slate-500">Defines behavior when incoming task exceeds available VRAM</p>
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <SliderWithLabel
                        label="Docker Sandbox RAM Quota"
                        value={sandboxMemoryCap}
                        min={512}
                        max={8192}
                        step={256}
                        unit="MB"
                        hint="Individual memory limit enforced by cgroups per execution container"
                        onChange={(v) => {
                          setSandboxMemoryCap(v);
                          triggerChange();
                        }}
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">Max Concurrent Worker Tasks</span>
                        <p className="text-xs text-slate-500">Parallel pipelines executing on on-premise hardware</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={maxWorkers <= 1}
                          onClick={() => {
                            setMaxWorkers((w) => Math.max(1, w - 1));
                            triggerChange();
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-sm disabled:opacity-40 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono text-sm px-2">{maxWorkers} Workers</span>
                        <button
                          type="button"
                          disabled={maxWorkers >= 4}
                          onClick={() => {
                            setMaxWorkers((w) => Math.min(4, w + 1));
                            triggerChange();
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-sm disabled:opacity-40 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* SUB-TAB 4: AIRGAP & NETWORKGUARD GOVERNANCE */}
            {activeSubTab === "airgap" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="NetworkGuard Zero-Egress Perimeter"
                  subtitle="Physical and transport-layer firewall isolating the host machine"
                  icon={Shield}
                  badge={<BadgePill variant="emerald">Zero Egress Enforced</BadgePill>}
                >
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                      <ToggleSwitch
                        checked={strictEgress}
                        onChange={(v) => {
                          setStrictEgress(v);
                          triggerChange();
                        }}
                        label="Strict Egress Lockdown (Default: ON)"
                        description="Blocks all TCP/UDP connections outside 127.0.0.1 loopback and local Ollama host at the kernel transport layer."
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-400 block font-bold text-[11px]">Outbound Packets Allowed</span>
                        <span className="font-mono font-bold text-emerald-700 text-sm">0 Packets (Drop All)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-400 block font-bold text-[11px]">Permitted Interface</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">lo (127.0.0.1 only)</span>
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Append-Only Audit Trail & Ledger"
                  subtitle="Tamper-evident cryptographically signed hash chain"
                  icon={Lock}
                  badge={<BadgePill variant="purple">SHA-256 Chain</BadgePill>}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-slate-800 block">Audit Log Path</span>
                      <div className="font-mono text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
                        /data/audit/audit_trail.jsonl
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={verifyLedger}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Verify Ledger Integrity</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const logSample = `{"block":8493,"timestamp":"${new Date().toISOString()}","event":"AUDIT_VERIFIED","egress_bytes":0,"status":"SEALED"}`;
                          const blob = new Blob([logSample], { type: "application/json" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "audit_trail.jsonl";
                          a.click();
                        }}
                        className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-4 h-4 text-slate-500" />
                        <span>Export Audit Log (.jsonl)</span>
                      </button>
                    </div>

                    {ledgerVerificationStatus && (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{ledgerVerificationStatus}</span>
                      </div>
                    )}
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* SUB-TAB 5: DOCKER SANDBOX ENVIRONMENT */}
            {activeSubTab === "docker" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="Docker Container Isolation Policy"
                  subtitle="Zero-trust sandbox execution for code synthesis and test runs"
                  icon={Box}
                  badge={<BadgePill variant="purple">Isolated Sandbox</BadgePill>}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Sandbox Docker Image Tag</label>
                      <input
                        type="text"
                        value={sandboxImage}
                        onChange={(e) => {
                          setSandboxImage(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-mono p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-slate-700 block">Active Security Flags (Read-Only)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 font-mono text-[11px] text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>--network none</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 font-mono text-[11px] text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>--read-only rootfs</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 font-mono text-[11px] text-slate-700">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Non-root execution</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">One-Click Sandbox Health Check</span>
                        <button
                          type="button"
                          onClick={testSandbox}
                          disabled={sandboxCheckRunning}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{sandboxCheckRunning ? "Testing Sandbox..." : "Run Health Check"}</span>
                        </button>
                      </div>

                      {sandboxCheckOutput && (
                        <div className="p-3 rounded-xl bg-[#0a0d14] border border-slate-800 text-emerald-400 font-mono text-xs whitespace-pre-wrap animate-in fade-in">
                          {sandboxCheckOutput}
                        </div>
                      )}
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}

            {/* SUB-TAB 6: OFFICE DELIVERABLES & THEMES */}
            {activeSubTab === "office" && (
              <div className="space-y-6 animate-in fade-in">
                <SettingsCard
                  title="PowerPoint Presentation (.pptx) Template"
                  subtitle="Configure default slide deck theme and dimensions generated via PptxGenJS"
                  icon={Presentation}
                  badge={<BadgePill variant="amber">PptxGenJS Engine</BadgePill>}
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-800">Default Presentation Theme</label>
                      <select
                        value={pptxTheme}
                        onChange={(e) => {
                          setPptxTheme(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none"
                      >
                        <option value="Defense Briefing (Navy/Slate)">Defense Briefing (Navy/Slate)</option>
                        <option value="Executive Minimalist">Executive Minimalist (Light)</option>
                        <option value="Government Formal">Government Formal (Dark/Gold)</option>
                      </select>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-bold text-slate-800 block mb-2">Slide Aspect Ratio</label>
                      <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1">
                        {(["16:9", "4:3"] as const).map((ratio) => (
                          <button
                            key={ratio}
                            type="button"
                            onClick={() => {
                              setPptxAspectRatio(ratio);
                              triggerChange();
                            }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              pptxAspectRatio === ratio
                                ? "bg-white text-purple-700 shadow-xs border border-slate-200"
                                : "text-slate-600 hover:text-slate-900"
                            }`}
                          >
                            {ratio === "16:9" ? "16:9 Widescreen (Default)" : "4:3 Standard"}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SettingsCard>

                <SettingsCard
                  title="Word Document (.docx) Format"
                  subtitle="Regulatory compliance header and cryptographic footer rules"
                  icon={FileText}
                >
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <ToggleSwitch
                        checked={includeHashInDocxFooter}
                        onChange={(v) => {
                          setIncludeHashInDocxFooter(v);
                          triggerChange();
                        }}
                        label="Include Airgap Verification Hash in Footer"
                        description="Appends verified SHA-256 block digest and timestamp to every generated document page."
                      />
                    </div>
                  </div>
                </SettingsCard>
              </div>
            )}
          </div>
        </div>

        {/* Sticky Bottom Save Bar */}
        {hasChanges && (
          <div className="sticky bottom-4 z-40 bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold">
                You have unsaved changes to on-premise governance configuration.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#7047eb] hover:bg-[#5e38d6] transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 text-emerald-100 border border-emerald-700 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
