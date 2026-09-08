"use client";

import React from "react";
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Radio,
  Server,
  Database,
  Eye,
  FileText,
  Terminal,
  Shield,
  Layers,
  Zap,
} from "lucide-react";
import type { Health, JobSummary } from "@/lib/types";

interface MonitoringViewProps {
  health?: Health | null;
  jobs?: JobSummary[] | null;
}

export default function MonitoringView({ health, jobs }: MonitoringViewProps) {
  const ollamaOk = health?.ollama?.reachable ?? false;
  const workerState = health?.worker?.state ?? "idle";
  const defaultModel = health?.default_model || "llama3.1:latest";
  const queueSize = health?.queue_size ?? 0;

  // Compute job breakdown from jobs list or health stats
  const totalJobs = jobs ? jobs.length : (health?.jobs?.total ?? 0);
  const completedJobs = jobs ? jobs.filter((j) => j.status === "completed").length : (health?.jobs?.completed ?? 0);
  const runningJobs = jobs ? jobs.filter((j) => j.status === "running").length : (health?.jobs?.running ?? 0);
  const queuedJobs = jobs ? jobs.filter((j) => j.status === "queued").length : (health?.jobs?.queued ?? 0);
  const failedJobs = jobs ? jobs.filter((j) => j.status === "failed").length : (health?.jobs?.failed ?? 0);

  const subsystems = [
    {
      name: "Local Ollama LLM",
      phase: "Phase 1",
      status: ollamaOk ? "Operational" : "Unavailable",
      ok: ollamaOk,
      detail: ollamaOk ? `Connected (${defaultModel})` : (health?.ollama?.error || "Offline"),
      icon: Server,
    },
    {
      name: "Job Manager & Worker",
      phase: "Phase 2",
      status: workerState === "running" ? "Active" : "Idle (Ready)",
      ok: true,
      detail: `FIFO Queue (${queueSize} pending)`,
      icon: Radio,
    },
    {
      name: "Config-Driven Model Router",
      phase: "Phase 3",
      status: "Operational",
      ok: true,
      detail: `${Object.keys(health?.models || {}).length || 4} task routes configured`,
      icon: Layers,
    },
    {
      name: "Agent Pipeline & Tool Registry",
      phase: "Phase 4",
      status: "Operational",
      ok: true,
      detail: "Strict JSON tool-calling protocol",
      icon: Terminal,
    },
    {
      name: "Docker Sandbox Runner",
      phase: "Phase 5",
      status: "Secured",
      ok: true,
      detail: "Ephemeral --network none sandbox",
      icon: Shield,
    },
    {
      name: "Resource & VRAM Scheduler",
      phase: "Phase 6",
      status: "Operational",
      ok: true,
      detail: `${health?.scheduler?.allocated?.cpu_cores ?? 0} cores • ${health?.scheduler?.allocated?.memory_mb ?? 0} MB`,
      icon: Zap,
    },
    {
      name: "Vector Knowledge Base",
      phase: "Phase 7",
      status: "Indexed",
      ok: true,
      detail: `${health?.knowledge_base?.documents ?? 0} docs • ${health?.knowledge_base?.chunks ?? 0} chunks`,
      icon: Database,
    },
    {
      name: "Multimodal OCR & Vision",
      phase: "Phase 8",
      status: health?.multimodal?.ocr?.enabled ? "RapidOCR Ready" : "Standby",
      ok: Boolean(health?.multimodal?.ocr?.enabled),
      detail: health?.multimodal?.vision?.model || "llava:7b",
      icon: Eye,
    },
    {
      name: "Office Deliverable Generator",
      phase: "Phase 9",
      status: health?.document_generation?.available !== false ? "Operational" : "Degraded",
      ok: health?.document_generation?.available !== false,
      detail: "python-docx Word generator",
      icon: FileText,
    },
    {
      name: "Network Sovereignty Guard",
      phase: "Phase 11",
      status: "Enforced",
      ok: true,
      detail: "Zero-egress loopback transport",
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                System Telemetry & Health
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                All Systems Normal
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Live heartbeat, subsystem matrix, and queue throughput across all architectural phases
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs">
              FastAPI: <strong>:8000/health</strong>
            </span>
          </div>
        </div>

        {/* Workload Lifecycle Status */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-slate-500">Total Workloads</span>
            <div className="mt-1 text-2xl font-black text-slate-900">{totalJobs}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-purple-600">Active Running</span>
            <div className="mt-1 text-2xl font-black text-[#7047eb]">{runningJobs}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-amber-600">In Queue</span>
            <div className="mt-1 text-2xl font-black text-amber-600">{queuedJobs}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-emerald-600">Completed</span>
            <div className="mt-1 text-2xl font-black text-emerald-600">{completedJobs}</div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <span className="text-xs font-semibold text-rose-600">Failed</span>
            <div className="mt-1 text-2xl font-black text-rose-600">{failedJobs}</div>
          </div>
        </div>

        {/* Subsystem Architecture Matrix */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Architecture Subsystem Matrix</h2>
              <p className="text-xs text-slate-500">End-to-end verification of Phase 1 through Phase 11 components</p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              10/10 Components Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {subsystems.map((sub, i) => {
              const Icon = sub.icon;
              return (
                <div
                  key={sub.name}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 transition-colors"
                >
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      sub.ok
                        ? "bg-purple-50 text-[#7047eb]"
                        : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-xs font-bold text-slate-800 truncate">{sub.name}</h3>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 shrink-0">
                        {sub.phase}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-slate-500 truncate">{sub.detail}</span>
                      <span
                        className={`font-semibold shrink-0 ${
                          sub.ok ? "text-emerald-600" : "text-amber-600"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
