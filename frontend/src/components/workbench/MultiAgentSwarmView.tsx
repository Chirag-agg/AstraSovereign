"use client";

import React, { useState } from "react";
import {
  Users,
  Bot,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Shield,
  Cpu,
  Sparkles,
  Send,
  Loader2,
  X,
  FileCode,
  FileText,
  AlertCircle,
  Eye,
  RotateCw,
  Check,
  ChevronRight,
  Layers,
  Terminal,
  Server,
  Zap,
  UserCheck,
  UserPlus,
} from "lucide-react";

export interface SwarmAgent {
  id: string;
  name: string;
  model: string;
  role: string;
  department: string;
  clearance: string;
  status: "idle" | "running" | "completed" | "error";
  progress: number;
  currentStep: string;
  tokensPerSec: number;
  vramUsed: string;
  assignedTask?: string;
  outputArtifact?: {
    name: string;
    type: "pdf" | "py" | "xlsx" | "json";
    summary: string;
  };
}

const INITIAL_SWARM_AGENTS: SwarmAgent[] = [
  {
    id: "agent-1",
    name: "Agent Alpha: Security & ITAR Sentinel",
    model: "Qwen 2.5 Coder 14B",
    role: "Defense Contract Risk & Export-Control Scanning",
    department: "Legal & Compliance",
    clearance: "L4: Sovereign Officer",
    status: "idle",
    progress: 0,
    currentStep: "Standing by for compliance audit task...",
    tokensPerSec: 42.1,
    vramUsed: "4.8 GB",
  },
  {
    id: "agent-2",
    name: "Agent Beta: Docker Sandbox Architect",
    model: "Llama 3.3 70B (NVLink)",
    role: "Python Code Security & Network Egress Verifier",
    department: "AI & Engineering",
    clearance: "L3: Dept Lead",
    status: "idle",
    progress: 0,
    currentStep: "Standing by for sandbox execution task...",
    tokensPerSec: 36.4,
    vramUsed: "7.2 GB",
  },
  {
    id: "agent-3",
    name: "Agent Gamma: RapidOCR Extraction Operator",
    model: "RapidOCR v2 Vision",
    role: "Scanned Waybill & PDF Tabular Extraction",
    department: "Operations & Supply",
    clearance: "L2: Reviewer",
    status: "idle",
    progress: 0,
    currentStep: "Standing by for vision OCR task...",
    tokensPerSec: 54.0,
    vramUsed: "2.1 GB",
  },
  {
    id: "agent-4",
    name: "Agent Delta: Executive Deliverable Drafter",
    model: "Document Engine",
    role: "Tamper-Proof Ledger Signed PDF Generation",
    department: "Directorate",
    clearance: "L3: Dept Lead",
    status: "idle",
    progress: 0,
    currentStep: "Standing by for document generation task...",
    tokensPerSec: 61.2,
    vramUsed: "1.5 GB",
  },
];

interface MultiAgentSwarmViewProps {
  onOpenDocumentPreview?: (docType: string) => void;
}

export default function MultiAgentSwarmView({ onOpenDocumentPreview }: MultiAgentSwarmViewProps) {
  const [agents, setAgents] = useState<SwarmAgent[]>(INITIAL_SWARM_AGENTS);
  const [taskPrompt, setTaskPrompt] = useState("");
  const [isSwarmRunning, setIsSwarmRunning] = useState(false);

  // Assignment Choice Modal State (User Request: Ask user to assign to existing agent or create new, NO tick checkboxes)
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [createAgentModalOpen, setCreateAgentModalOpen] = useState(false);
  const [directAssignAgentId, setDirectAssignAgentId] = useState<string | null>(null);

  // New Agent Form
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentModel, setNewAgentModel] = useState("Qwen 2.5 Coder 14B");
  const [newAgentRole, setNewAgentRole] = useState("");
  const [newAgentDept, setNewAgentDept] = useState("AI & Engineering");
  const [newAgentClearance, setNewAgentClearance] = useState("L2: Reviewer");

  // Step Simulation helper for a set of target agent IDs
  const runSimulationForAgents = (targetAgentIds: string[], promptText: string) => {
    setIsSwarmRunning(true);
    setAssignModalOpen(false);

    // Initial state
    setAgents((prev) =>
      prev.map((agent) =>
        targetAgentIds.includes(agent.id)
          ? {
              ...agent,
              status: "running",
              assignedTask: promptText,
              progress: 15,
              currentStep: `Ingesting task: "${promptText.slice(0, 40)}..."`,
            }
          : agent
      )
    );

    // Step 1
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((agent) =>
          targetAgentIds.includes(agent.id)
            ? {
                ...agent,
                progress: 45,
                currentStep:
                  agent.id === "agent-1"
                    ? "Cross-referencing 14 vendor agreements against ITAR clauses..."
                    : agent.id === "agent-2"
                    ? "Spawning isolated Docker container with --network none..."
                    : agent.id === "agent-3"
                    ? "Extracting 32 tabular ledger rows from scanned PDF..."
                    : "Formatting formal A4 letterhead with SHA-256 seal...",
              }
            : agent
        )
      );
    }, 1200);

    // Step 2
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((agent) =>
          targetAgentIds.includes(agent.id)
            ? {
                ...agent,
                progress: 80,
                currentStep:
                  agent.id === "agent-1"
                    ? "Verifying loopback interface binding 127.0.0.1 (0 egress)..."
                    : agent.id === "agent-2"
                    ? "Executing test assertions: 12/12 passed with zero memory leaks..."
                    : agent.id === "agent-3"
                    ? "Reconciling numerical variances with SQLite database..."
                    : "Computing cryptographic SHA-256 ledger signature...",
              }
            : agent
        )
      );
    }, 2400);

    // Completion
    setTimeout(() => {
      setAgents((prev) =>
        prev.map((agent) =>
          targetAgentIds.includes(agent.id)
            ? {
                ...agent,
                status: "completed",
                progress: 100,
                currentStep: "Task successfully executed. Deliverable generated.",
                outputArtifact: {
                  name:
                    agent.id === "agent-1"
                      ? "itar_compliance_audit.pdf"
                      : agent.id === "agent-2"
                      ? "sandbox_test_results.py"
                      : agent.id === "agent-3"
                      ? "extracted_ledger_manifest.xlsx"
                      : "executive_brief_signed.pdf",
                  type:
                    agent.id === "agent-1" || agent.id === "agent-4"
                      ? "pdf"
                      : agent.id === "agent-2"
                      ? "py"
                      : "xlsx",
                  summary:
                    agent.id === "agent-1"
                      ? "Verified 0 external egress packets across all 14 vendor agreements."
                      : agent.id === "agent-2"
                      ? "Docker Python 3.11 execution completed with exit code 0."
                      : agent.id === "agent-3"
                      ? "Extracted 100% of tabular records with zero OCR error."
                      : "Cryptographically signed document sealed with on-premise ledger hash.",
                },
              }
            : agent
        )
      );
      setIsSwarmRunning(false);
    }, 3800);
  };

  // Called when user clicks "Dispatch Task"
  const handleInitiateDispatch = () => {
    if (!taskPrompt.trim()) return;
    setAssignModalOpen(true);
  };

  // Called to assign to an existing agent
  const handleAssignToExistingAgent = (agentId: string) => {
    runSimulationForAgents([agentId], taskPrompt);
  };

  // Called to assign to all existing agents (Swarm broadcast)
  const handleAssignToAllAgents = () => {
    runSimulationForAgents(agents.map((a) => a.id), taskPrompt);
  };

  // Direct 1-click assign from agent card
  const handleDirectCardAssign = (agentId: string) => {
    const promptToUse = taskPrompt.trim() || `Run high-priority audit task with ${agents.find((a) => a.id === agentId)?.name}`;
    runSimulationForAgents([agentId], promptToUse);
  };

  // Create new custom AI agent & optionally assign current task immediately
  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentName.trim()) return;

    const newAgent: SwarmAgent = {
      id: `agent-${Date.now().toString().slice(-4)}`,
      name: newAgentName.trim(),
      model: newAgentModel,
      role: newAgentRole || "Custom Automated Task Execution",
      department: newAgentDept,
      clearance: newAgentClearance,
      status: "idle",
      progress: 0,
      currentStep: "Standing by for user tasks...",
      tokensPerSec: 48.5,
      vramUsed: "3.5 GB",
    };

    setAgents((prev) => [...prev, newAgent]);
    setCreateAgentModalOpen(false);

    // If there is an active prompt, run it on this newly created agent
    if (taskPrompt.trim()) {
      runSimulationForAgents([newAgent.id], taskPrompt);
    }

    setNewAgentName("");
    setNewAgentRole("");
  };

  return (
    <div className="space-y-7 animate-in fade-in">
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER & SWARM CONTROL DECK
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  Multi-Agent Multitasking Swarm
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                  {agents.length} Dedicated AI Agents Active
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Assign instructions to existing agents or deploy new specialized workers with zero checkboxes.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCreateAgentModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <UserPlus className="w-4 h-4" />
            <span>Create &amp; Deploy New Agent</span>
          </button>
        </div>

        {/* Multitasking Task Dispatcher */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700 block">
            Objective / Task Prompt to Assign to AI Agents
          </label>
          <div className="relative">
            <textarea
              rows={2}
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && taskPrompt.trim()) {
                  e.preventDefault();
                  handleInitiateDispatch();
                }
              }}
              placeholder="e.g. 'Audit vendor agreements for export compliance, run Python sandbox test suite, and extract invoice tables concurrently'..."
              className="w-full px-4 py-3 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none resize-none"
            />
          </div>

          {/* Quick template chips */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Templates:
              </span>
              {[
                "Full Air-Gap Compliance & Docker Audit",
                "Contract Clause Scan + Tabular Extraction",
                "Python Sandbox Benchmark + Executive PDF",
              ].map((tpl) => (
                <button
                  key={tpl}
                  type="button"
                  onClick={() => setTaskPrompt(tpl)}
                  className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                >
                  {tpl}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleInitiateDispatch}
              disabled={isSwarmRunning || !taskPrompt.trim()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSwarmRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{isSwarmRunning ? "Executing in Swarm..." : "Dispatch Task"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. CONCURRENT AGENTS ROSTER (Clean Cards with Direct Action Buttons)
      ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-slate-900">
            Active Multi-Agent Swarm Roster ({agents.length} Available)
          </h4>
          <span className="text-xs text-slate-400 font-medium">
            Click &quot;Assign Task&quot; on any agent or use the Dispatcher above
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {agents.map((agent) => {
            const isRunning = agent.status === "running";
            const isCompleted = agent.status === "completed";

            return (
              <div
                key={agent.id}
                className={`bg-white rounded-3xl p-6 border transition-all space-y-4 flex flex-col justify-between ${
                  isRunning
                    ? "border-purple-400 ring-2 ring-purple-100 shadow-md"
                    : isCompleted
                    ? "border-emerald-300 shadow-2xs"
                    : "border-slate-200/90 hover:border-purple-200 hover:shadow-xs"
                }`}
              >
                <div className="space-y-3">
                  {/* Agent Header & Status Badge */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-slate-900 leading-tight">
                          {agent.name}
                        </h5>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          {agent.role}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold shrink-0 ${
                        isRunning
                          ? "bg-purple-100 text-purple-800 border border-purple-200 animate-pulse"
                          : isCompleted
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-600 border border-slate-200"
                      }`}
                    >
                      {isRunning ? "In-Flight" : isCompleted ? "Completed" : "Ready"}
                    </span>
                  </div>

                  {/* Active Assigned Task Callout (if any) */}
                  {agent.assignedTask && (
                    <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-xs">
                      <span className="font-bold text-purple-900 block text-[10px] uppercase tracking-wider">
                        Assigned Task:
                      </span>
                      <p className="text-purple-800 font-medium truncate mt-0.5">
                        {agent.assignedTask}
                      </p>
                    </div>
                  )}

                  {/* Specifications & Model */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                    <div>
                      <span className="text-slate-400 block font-medium">Model</span>
                      <span className="font-bold text-slate-800 truncate block">{agent.model}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Clearance</span>
                      <span className="font-bold text-purple-700 block">{agent.clearance.split(":")[0]}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-medium">Throughput</span>
                      <span className="font-bold text-emerald-600 block">{agent.tokensPerSec} t/s</span>
                    </div>
                  </div>

                  {/* Live Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600 text-[11px] truncate max-w-[280px]">
                        {agent.currentStep}
                      </span>
                      <span className="font-mono font-bold text-purple-700 text-xs">
                        {agent.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${agent.progress}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          agent.status === "completed" ? "bg-emerald-500" : "bg-purple-600"
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Direct Action Button on Card (Replaces the checkbox/tick) */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleDirectCardAssign(agent.id)}
                    disabled={isSwarmRunning}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200/80 hover:border-purple-200"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Assign Task to this Agent</span>
                  </button>

                  {agent.outputArtifact && (
                    <button
                      type="button"
                      onClick={() => onOpenDocumentPreview && onOpenDocumentPreview("defense_audit")}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 shadow-xs"
                      title="Preview generated deliverable"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Doc</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: ASSIGN TASK TO EXISTING AGENT OR CREATE NEW
          (User Request: Ask user to assign to existing agent or create new, NO tick option)
      ───────────────────────────────────────────────────────────────── */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-xl w-full shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 font-sans">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    Assign Task to AI Agent
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Choose how you want to execute this objective.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Task Prompt Preview Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
              <span className="font-bold text-slate-500 block text-[10px] uppercase tracking-wider mb-1">
                Task to Dispatch:
              </span>
              <p className="text-slate-800 font-semibold leading-relaxed">
                &ldquo;{taskPrompt}&rdquo;
              </p>
            </div>

            {/* Assignment Choice Options */}
            <div className="space-y-4">
              {/* Option A: Assign to Existing Agent */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  Option 1: Assign to an Existing Agent
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => handleAssignToExistingAgent(agent.id)}
                      className="p-3 rounded-2xl border border-slate-200 hover:border-purple-400 bg-white hover:bg-purple-50/50 text-left transition-all cursor-pointer space-y-1 group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-purple-700">
                          {agent.name.split(":")[0]}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
                          {agent.model.split(" ")[0]}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {agent.role}
                      </p>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAssignToAllAgents}
                  className="w-full py-2.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  <span>Broadcast &amp; Assign to All {agents.length} Agents Concurrently</span>
                </button>
              </div>

              {/* Option B: Create & Deploy New Agent */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-emerald-600" />
                  Option 2: Create &amp; Deploy New Specialized Agent
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setAssignModalOpen(false);
                    setCreateAgentModalOpen(true);
                  }}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New AI Agent &amp; Assign this Task</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: DEPLOY NEW CUSTOM AI AGENT
      ───────────────────────────────────────────────────────────────── */}
      {createAgentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 font-sans">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-5 h-5 text-purple-600" />
                  <span>Deploy New AI Agent to Swarm</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  Register a specialized worker model for concurrent multitasking.
                </p>
              </div>
              <button
                onClick={() => setCreateAgentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Agent Name</label>
                <input
                  type="text"
                  required
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g. Agent Epsilon: Contract Clause Validator"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Local Model Engine</label>
                <select
                  value={newAgentModel}
                  onChange={(e) => setNewAgentModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium cursor-pointer"
                >
                  <option value="Qwen 2.5 Coder 14B">Qwen 2.5 Coder 14B</option>
                  <option value="Llama 3.3 70B (NVLink)">Llama 3.3 70B (NVLink)</option>
                  <option value="RapidOCR v2 Vision">RapidOCR v2 Vision</option>
                  <option value="DeepSeek R1 Distill 14B">DeepSeek R1 Distill 14B</option>
                  <option value="Document Engine">Document Engine</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Specialized Role / Function</label>
                <input
                  type="text"
                  value={newAgentRole}
                  onChange={(e) => setNewAgentRole(e.target.value)}
                  placeholder="e.g. Code refactoring and unit test generation"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Department</label>
                  <select
                    value={newAgentDept}
                    onChange={(e) => setNewAgentDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="AI & Engineering">AI & Engineering</option>
                    <option value="Legal & Compliance">Legal & Compliance</option>
                    <option value="Finance & Accounting">Finance & Accounting</option>
                    <option value="Operations & Supply">Operations & Supply</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Clearance Level</label>
                  <select
                    value={newAgentClearance}
                    onChange={(e) => setNewAgentClearance(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-medium cursor-pointer"
                  >
                    <option value="L1: Contributor">L1: Contributor</option>
                    <option value="L2: Reviewer">L2: Reviewer</option>
                    <option value="L3: Dept Lead">L3: Dept Lead</option>
                    <option value="L4: Sovereign Officer">L4: Sovereign Officer</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateAgentModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-500 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-sm cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Deploy to Swarm</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
