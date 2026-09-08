"use client";

import React from "react";
import {
  GitBranch,
  ArrowRight,
  Brain,
  Code,
  FileText,
  Eye,
  Calculator,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";

export default function WorkflowsView() {
  const capabilities = [
    {
      id: "reasoning",
      name: "Reasoning & Planning",
      model: "General Model (llama3.1:latest)",
      description: "Generates high-level plan, breaks goals into sequential stages, synthesizes findings.",
      icon: Brain,
      color: "purple",
    },
    {
      id: "coding",
      name: "Code Execution",
      model: "Coding Model (qwen2.5-coder:7b)",
      description: "Synthesizes Python scripts, runs computations in Docker sandbox, validates unit tests.",
      icon: Code,
      color: "sky",
    },
    {
      id: "document",
      name: "Document Synthesis",
      model: "Document Model (qwen2.5:7b)",
      description: "Structures sections, formats tabular data, generates native Office Word (.docx) deliverables.",
      icon: FileText,
      color: "emerald",
    },
    {
      id: "vision",
      name: "Multimodal Inspection",
      model: "Vision Model (llava:7b)",
      description: "Analyzes uploaded equipment photos, blueprints, and scanned PDF inspection reports.",
      icon: Eye,
      color: "amber",
    },
    {
      id: "math",
      name: "Mathematical Reasoning",
      model: "Math Model (qwen2.5-math:7b)",
      description: "Formulates complex equations, quantitative engineering calculations, and financial statistics.",
      icon: Calculator,
      color: "rose",
    },
  ];

  const pipelineStages = [
    {
      number: "1",
      title: "Complexity Gate",
      subtitle: "Deterministic Task Filter",
      detail: "Evaluates if request requires multi-model capabilities or single-model execution. Simple tasks bypass pipeline directly.",
    },
    {
      number: "2",
      title: "Reasoning Planner",
      subtitle: "Allowlist Capability Validation",
      detail: "Reasoning LLM crafts ordered sub-tasks validated strictly against {reasoning, math, coding, document, vision}.",
    },
    {
      number: "3",
      title: "Pipeline Executor",
      subtitle: "Multi-Model Stage Chaining",
      detail: "Each stage runs on a specialized local model with its own allocation (<job_id>:<stage>) and clean context chaining.",
    },
    {
      number: "4",
      title: "Deliverable & Audit",
      subtitle: "Cryptographic Evidence",
      detail: "Generates final artifact (.docx/code), traces all stage transitions, and records non-sensitive audit evidence.",
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
                Multi-Model Agent Pipelines
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Post-Phase 11 Architecture
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Autonomous multi-stage orchestration chaining specialized local models with verified resource containment
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-3 py-1.5 rounded-xl border border-purple-200 shadow-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#7047eb]" />
              <span>Pipeline Engine: Active</span>
            </span>
          </div>
        </div>

        {/* Pipeline Execution Flow */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">4-Stage Pipeline Orchestration Flow</h2>
              <p className="text-xs text-slate-500">How complex industrial and enterprise tasks flow through local models</p>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
              PIPELINE_MAX_STAGES: 4
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
            {pipelineStages.map((stage, idx) => (
              <div
                key={stage.number}
                className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/70 flex flex-col justify-between space-y-3 relative group hover:border-purple-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="w-7 h-7 rounded-full bg-[#7047eb] text-white text-xs font-bold flex items-center justify-center">
                    {stage.number}
                  </span>
                  {idx < 3 && (
                    <ArrowRight className="w-4 h-4 text-slate-300 hidden md:block" />
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-900">{stage.title}</h3>
                  <div className="text-[11px] font-semibold text-purple-600 mt-0.5">{stage.subtitle}</div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{stage.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Server-Side Capability Allowlist */}
        <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">Server-Side Capability Allowlist</h2>
              <p className="text-xs text-slate-500">
                Models are strictly bound to server-side capabilities. The planner cannot invent unverified routes.
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              5 Allowed Capabilities
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {capabilities.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.id}
                  className="p-4 rounded-xl border border-slate-100 hover:border-purple-200 bg-slate-50/50 transition-colors space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-50 text-[#7047eb] rounded-lg shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900">{cap.name}</h3>
                      <span className="text-[10px] font-mono text-purple-600 font-semibold">
                        capability: {cap.id}
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {cap.description}
                  </p>

                  <div className="pt-2 border-t border-slate-100 text-[10.5px] font-mono text-slate-500">
                    Target: <strong className="text-slate-800">{cap.model}</strong>
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
