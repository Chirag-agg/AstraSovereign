"use client";

import React from "react";
import { Brain, Code, FileText, Eye, CheckCircle2, AlertTriangle, Layers, ShieldCheck, ArrowRight } from "lucide-react";
import type { Health } from "@/lib/types";

interface ModelsViewProps {
  health?: Health | null;
}

export default function ModelsView({ health }: ModelsViewProps) {
  const models = health?.models || {};
  const visionStatus = health?.multimodal?.vision;
  const defaultModel = health?.default_model || "llama3.1:latest";

  const taskRoutes = [
    {
      taskType: "general",
      label: "General Reasoning",
      description: "Conversational interactions, logical planning, knowledge synthesis, and multi-step agent decisions.",
      model: models.general?.configured || defaultModel,
      available: models.general?.available ?? true,
      enabled: models.general?.enabled ?? true,
      icon: Brain,
      color: "purple",
      capabilities: ["reasoning", "general", "dialogue"],
      rule: "Default route when no specialized coding/document keywords match.",
    },
    {
      taskType: "coding",
      label: "Code Execution & Synthesis",
      description: "Python generation, algorithm debugging, data processing, and isolated Docker sandbox execution.",
      model: models.coding?.configured || "qwen2.5-coder:7b",
      available: models.coding?.available ?? true,
      enabled: models.coding?.enabled ?? true,
      icon: Code,
      color: "sky",
      capabilities: ["coding", "python", "sandbox"],
      rule: "Keyword match on 'code', 'script', 'function', 'docker', 'python', etc.",
    },
    {
      taskType: "document",
      label: "Office Document Deliverables",
      description: "Structured sectioning, Word (.docx) generation, tabular structuring, and report assembly.",
      model: models.document?.configured || models.general?.configured || "qwen2.5:7b",
      available: models.document?.available ?? true,
      enabled: models.document?.enabled ?? true,
      icon: FileText,
      color: "emerald",
      capabilities: ["document", "python-docx", "tables"],
      rule: "Triggered on 'generate document', 'report', 'approval note', or 'write docx'.",
    },
    {
      taskType: "vision",
      label: "Multimodal Vision & OCR",
      description: "Visual document inspection, scanned diagram analysis, and image-based evidence extraction.",
      model: visionStatus?.model || models.vision?.configured || "llava:7b",
      available: visionStatus?.available ?? (models.vision?.available ?? false),
      enabled: visionStatus?.enabled ?? (models.vision?.enabled ?? true),
      icon: Eye,
      color: "amber",
      capabilities: ["vision", "rapidocr", "multimodal"],
      rule: "Invoked when user attaches images or queries scanned diagrams via document_vision.",
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
                Model Registry & Task Router
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Phase 3 Config-Driven
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Deterministic rule-based task routing with zero cloud fallback; models defined in config/models.yaml
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-600 shadow-xs">
              Ollama Host: <strong>{health?.ollama?.url || "http://localhost:11434"}</strong>
            </span>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800">Deterministic Task Router (No Silent Fallbacks)</h3>
              <p className="text-[11px] text-slate-500">
                Tasks are classified into specialized categories. If a required model is missing, the job fails cleanly with explicit error details rather than leaking to external APIs.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full shrink-0 border border-emerald-200">
            Local Only
          </span>
        </div>

        {/* Task Routes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {taskRoutes.map((route) => {
            const Icon = route.icon;
            const isReady = route.enabled && route.available;

            return (
              <div
                key={route.taskType}
                className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-purple-50 text-[#7047eb] rounded-xl shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">{route.label}</h2>
                      <span className="text-[11px] font-mono text-purple-600 font-semibold">
                        task_type: {route.taskType}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      isReady
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : !route.enabled
                        ? "bg-slate-100 text-slate-500 border-slate-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}
                  >
                    {isReady ? "Ready" : !route.enabled ? "Disabled" : "Not Pulled"}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {route.description}
                </p>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 text-xs border border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Target Model:</span>
                    <span className="font-mono font-bold text-slate-800">{route.model}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Routing Rule:</span>
                    <span className="text-[11px] text-slate-600 italic truncate max-w-xs">{route.rule}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1">Capabilities:</span>
                  {route.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-2 py-0.5 rounded-md bg-purple-50 text-[10.5px] font-medium text-purple-700 border border-purple-100"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
