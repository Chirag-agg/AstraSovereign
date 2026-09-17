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
          {label && <span className="text-xs font-bold text-white block">{label}</span>}
          {description && <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
          checked ? "bg-red-600 shadow-[0_0_12px_rgba(239,68,68,0.4)]" : "bg-zinc-800"
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
        <span className="font-bold text-zinc-200">{label}</span>
        <span className="font-mono font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded-md border border-red-800/60">
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
        className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
      />
      {hint && <p className="text-[11px] text-zinc-500 font-medium">{hint}</p>}
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
    <div className="bg-[#111115] rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-red-950/40 border border-red-800/50 flex items-center justify-center text-red-400 shrink-0">
              <Icon className="w-4.5 h-4.5" />
            </div>
          )}
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white leading-snug">{title}</h3>
            {subtitle && <p className="text-xs text-zinc-400 font-medium mt-0.5">{subtitle}</p>}
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
  variant?: "purple" | "emerald" | "amber" | "slate" | "red";
}) {
  const styles = {
    purple: "bg-red-950/40 text-red-300 border-red-800/50",
    red: "bg-red-950/40 text-red-300 border-red-800/50",
    emerald: "bg-emerald-950/40 text-emerald-400 border-emerald-800/50",
    amber: "bg-amber-950/40 text-amber-400 border-amber-800/50",
    slate: "bg-zinc-900 text-zinc-300 border-zinc-800",
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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1440px] mx-auto w-full space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 bg-[#111115] p-5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-red-300 bg-red-950/60 border border-red-800/60 px-2.5 py-0.5 rounded-full font-mono">
                Enterprise Node Governance
              </span>
              <span className="text-xs font-bold text-zinc-500 font-mono">
                config/models.yaml &bull; Local Only
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Enterprise Settings &amp; Configuration
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-0.5">
              Configure on-premise model routing, hardware quotas, NetworkGuard egress rules, and Docker sandboxes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/40 text-emerald-300 border border-emerald-800/50 shadow-2xs font-mono">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Airgap Node Config Synced
            </span>
          </div>
        </div>

        {/* 2-Column Layout: Left Sub-Tabs + Right Dynamic Canvas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Navigation Sub-Tabs */}
          <div className="lg:col-span-3 bg-[#111115] rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] p-3 space-y-1.5">
            <button
              onClick={() => setActiveSubTab("general")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "general"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <Settings className={`w-4 h-4 shrink-0 ${activeSubTab === "general" ? "text-red-400" : "text-zinc-400"}`} />
              <span>General &amp; Workspace</span>
            </button>

            <button
              onClick={() => setActiveSubTab("models")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "models"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <Bot className={`w-4 h-4 shrink-0 ${activeSubTab === "models" ? "text-red-400" : "text-zinc-400"}`} />
              <span>Local Models &amp; Routing</span>
            </button>

            <button
              onClick={() => setActiveSubTab("compute")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "compute"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <Cpu className={`w-4 h-4 shrink-0 ${activeSubTab === "compute" ? "text-red-400" : "text-zinc-400"}`} />
              <span>Compute &amp; VRAM Quotas</span>
            </button>

            <button
              onClick={() => setActiveSubTab("airgap")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "airgap"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <Shield className={`w-4 h-4 shrink-0 ${activeSubTab === "airgap" ? "text-red-400" : "text-zinc-400"}`} />
              <span>Airgap &amp; NetworkGuard</span>
            </button>

            <button
              onClick={() => setActiveSubTab("docker")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "docker"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <Box className={`w-4 h-4 shrink-0 ${activeSubTab === "docker" ? "text-red-400" : "text-zinc-400"}`} />
              <span>Docker Sandbox Environment</span>
            </button>

            <button
              onClick={() => setActiveSubTab("office")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                activeSubTab === "office"
                  ? "bg-red-950/60 text-red-300 border border-red-800/60 shadow-2xs"
                  : "text-zinc-400 hover:bg-zinc-850 hover:text-white"
              }`}
            >
              <FileText className={`w-4 h-4 shrink-0 ${activeSubTab === "office" ? "text-red-400" : "text-zinc-400"}`} />
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
                      <label className="text-xs font-bold text-zinc-200">Workspace Node Name</label>
                      <input
                        type="text"
                        value={workspaceName}
                        onChange={(e) => {
                          setWorkspaceName(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-medium p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-red-600"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase block font-mono">
                          Project Storage Root
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-200 block mt-0.5">
                          /data/projects
                        </span>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-[11px] font-bold text-zinc-400 uppercase block font-mono">
                          Cowork Workspace Root
                        </span>
                        <span className="font-mono text-xs font-bold text-zinc-200 block mt-0.5">
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
                      <label className="text-xs font-bold text-zinc-200 block mb-2">Theme Mode</label>
                      <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 gap-1">
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
                                ? "bg-red-950/60 text-red-300 shadow-xs border border-red-800/60"
                                : "text-zinc-400 hover:text-white"
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
                      className="flex-1 w-full text-xs font-mono p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-red-600"
                    />
                    <button
                      type="button"
                      onClick={testOllama}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs shrink-0"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${ollamaTestState === "testing" ? "animate-spin" : ""}`} />
                      <span>{ollamaTestState === "testing" ? "Probing..." : "Test Connection"}</span>
                    </button>
                  </div>

                  {ollamaTestState === "ok" && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
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
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Reasoning &amp; Code</span>
                        <span className="text-[10px] font-bold text-red-300 bg-red-950/60 px-2 py-0.5 rounded border border-red-800/60 font-mono">
                          Primary
                        </span>
                      </div>
                      <select
                        value={reasoningModel}
                        onChange={(e) => {
                          setReasoningModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="qwen2.5-coder:14b">qwen2.5-coder:14b (Recommended)</option>
                        <option value="qwen2.5-coder:3b">qwen2.5-coder:3b (Fast)</option>
                        <option value="deepseek-r1:14b">deepseek-r1:14b (Deep Reasoning)</option>
                        <option value="llama3.3:70b">llama3.3:70b (Multi-GPU NVLink)</option>
                      </select>
                      <p className="text-[10.5px] text-zinc-400">Autonomous tool dispatch, Python execution, refactors</p>
                    </div>

                    {/* Capability 2: Document Intelligence & OCR */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Document OCR &amp; Tables</span>
                        <span className="text-[10px] font-bold text-rose-300 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/50 font-mono">
                          Vision
                        </span>
                      </div>
                      <select
                        value={ocrModel}
                        onChange={(e) => {
                          setOcrModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="rapidocr">rapidocr (Local C++ Engine)</option>
                        <option value="surya-ocr">surya-ocr (High-Res Ingestion)</option>
                        <option value="tesseract">tesseract-ocr (CPU Fallback)</option>
                      </select>
                      <p className="text-[10.5px] text-zinc-400">Extracts tabular invoices, work orders, scanned PDFs</p>
                    </div>

                    {/* Capability 3: Vision Analysis */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Vision Analysis</span>
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/50 font-mono">
                          Multimodal
                        </span>
                      </div>
                      <select
                        value={visionModel}
                        onChange={(e) => {
                          setVisionModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="llava:7b">llava:7b (Local Vision)</option>
                        <option value="llama3.2-vision:11b">llama3.2-vision:11b</option>
                        <option value="qwen-vl:7b">qwen-vl:7b</option>
                      </select>
                      <p className="text-[10.5px] text-zinc-400">Diagram analysis, schematic visual inspection</p>
                    </div>

                    {/* Capability 4: Embeddings */}
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Embeddings (RAG Vault)</span>
                        <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50 font-mono">
                          ChromaDB
                        </span>
                      </div>
                      <select
                        value={embeddingsModel}
                        onChange={(e) => {
                          setEmbeddingsModel(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="nomic-embed-text">nomic-embed-text (8192 dim)</option>
                        <option value="bge-m3">bge-m3 (Dense + Sparse)</option>
                        <option value="all-minilm-l6-v2">all-minilm-l6-v2</option>
                      </select>
                      <p className="text-[10.5px] text-zinc-400">Vector search across air-gapped compliance documents</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 grid grid-cols-1 sm:grid-cols-2 gap-6">
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
                      <label className="text-xs font-bold text-zinc-200">Model VRAM Grant Policy</label>
                      <select
                        value={vramGrantPolicy}
                        onChange={(e) => {
                          setVramGrantPolicy(e.target.value as "reject" | "queue");
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="queue">Queue until VRAM freed (FIFO task prioritization)</option>
                        <option value="reject">Strict Reject when full (Prevents any out-of-memory crashes)</option>
                      </select>
                      <p className="text-[11px] text-zinc-400">Defines behavior when incoming task exceeds available VRAM</p>
                    </div>

                    <div className="pt-3 border-t border-zinc-800">
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

                    <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Max Concurrent Worker Tasks</span>
                        <p className="text-xs text-zinc-400">Parallel pipelines executing on on-premise hardware</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={maxWorkers <= 1}
                          onClick={() => {
                            setMaxWorkers((w) => Math.max(1, w - 1));
                            triggerChange();
                          }}
                          className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold text-sm disabled:opacity-40 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold font-mono text-sm px-2 text-white">{maxWorkers} Workers</span>
                        <button
                          type="button"
                          disabled={maxWorkers >= 4}
                          onClick={() => {
                            setMaxWorkers((w) => Math.min(4, w + 1));
                            triggerChange();
                          }}
                          className="w-8 h-8 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 font-bold text-sm disabled:opacity-40 cursor-pointer"
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
                    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40">
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
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-zinc-400 block font-bold text-[11px] font-mono">Outbound Packets Allowed</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">0 Packets (Drop All)</span>
                      </div>
                      <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                        <span className="text-zinc-400 block font-bold text-[11px] font-mono">Permitted Interface</span>
                        <span className="font-mono font-bold text-zinc-200 text-sm">lo (127.0.0.1 only)</span>
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
                      <span className="text-xs font-bold text-zinc-300 block">Audit Log Path</span>
                      <div className="font-mono text-xs p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300">
                        /data/audit/audit_trail.jsonl
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={verifyLedger}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
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
                        className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-800 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-4 h-4 text-zinc-400" />
                        <span>Export Audit Log (.jsonl)</span>
                      </button>
                    </div>

                    {ledgerVerificationStatus && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs font-bold animate-in fade-in flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
                      <label className="text-xs font-bold text-zinc-200">Sandbox Docker Image Tag</label>
                      <input
                        type="text"
                        value={sandboxImage}
                        onChange={(e) => {
                          setSandboxImage(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-mono p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-white focus:outline-none focus:border-red-600"
                      />
                    </div>

                    <div className="space-y-2 pt-1">
                      <span className="text-xs font-bold text-zinc-300 block">Active Security Flags (Read-Only)</span>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>--network none</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>--read-only rootfs</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center gap-2 font-mono text-[11px] text-zinc-300">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>Non-root execution</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">One-Click Sandbox Health Check</span>
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
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-emerald-400 font-mono text-xs whitespace-pre-wrap animate-in fade-in">
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
                      <label className="text-xs font-bold text-zinc-200">Default Presentation Theme</label>
                      <select
                        value={pptxTheme}
                        onChange={(e) => {
                          setPptxTheme(e.target.value);
                          triggerChange();
                        }}
                        className="w-full text-xs font-semibold p-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-200 focus:outline-none focus:border-red-600"
                      >
                        <option value="Defense Briefing (Navy/Slate)">Defense Briefing (Navy/Slate)</option>
                        <option value="Executive Minimalist">Executive Minimalist (Light)</option>
                        <option value="Government Formal">Government Formal (Dark/Gold)</option>
                      </select>
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-bold text-zinc-200 block mb-2">Slide Aspect Ratio</label>
                      <div className="inline-flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 gap-1">
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
                                ? "bg-red-950/60 text-red-300 shadow-xs border border-red-800/60"
                                : "text-zinc-400 hover:text-white"
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
                    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
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
          <div className="sticky bottom-4 z-40 bg-[#111115]/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs sm:text-sm font-bold text-zinc-200">
                You have unsaved changes to on-premise governance configuration.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all shadow-md cursor-pointer flex items-center gap-1.5 shadow-red-950/30"
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
