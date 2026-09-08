"use client";

import React from "react";
import {
  Search,
  Image as ImageIcon,
  Code,
  FileText,
  FolderOpen,
  FileCode,
  CheckCircle2,
  Shield,
  Layers,
  Terminal,
  FileEdit,
} from "lucide-react";
import type { Health } from "@/lib/types";

interface ToolsViewProps {
  health?: Health | null;
}

export default function ToolsView({ health }: ToolsViewProps) {
  const ocrEnabled = health?.multimodal?.ocr?.enabled ?? true;
  const docGenEnabled = health?.document_generation?.available !== false;
  const sandboxEnabled = health?.sovereignty?.sandbox_network ? health.sovereignty.sandbox_network !== "UNAVAILABLE" : true;

  const tools = [
    {
      id: "document_search",
      name: "Document Search (Local RAG)",
      phase: "Phase 7",
      description: "Embeds queries via Ollama and executes cosine search over the user's isolated JSON vector store. Returns grounded excerpts with page citations.",
      icon: Search,
      status: "Active",
      available: true,
      containment: "Strictly user-scoped (data/knowledge/<user>/); never searches other users' files.",
      parameters: ["query (string)", "top_k (optional int, default 5)"],
    },
    {
      id: "document_vision",
      name: "Document Vision & OCR",
      phase: "Phase 8",
      description: "Extracts text from scanned PDFs, diagrams, and images via RapidOCR; runs visual questions through local multimodal model (llava:7b).",
      icon: ImageIcon,
      status: ocrEnabled ? "Active" : "Standby",
      available: ocrEnabled,
      containment: "Temporary page images are stored in data/tmp/ and wiped after success/failure.",
      parameters: ["document_id (string)", "question (string)", "pages (optional int[])"],
    },
    {
      id: "code_execution",
      name: "Docker Sandbox Execution",
      phase: "Phase 5",
      description: "Executes Python code inside a short-lived Docker container. Captures stdout/stderr for iterative agent bug-fixing.",
      icon: Code,
      status: sandboxEnabled ? "Active (Secured)" : "Disabled",
      available: sandboxEnabled,
      containment: "--network none • --read-only root • --cap-drop ALL • strict timeout • auto-cleanup.",
      parameters: ["language (string, 'python')", "code (string)", "stdin (optional string)"],
    },
    {
      id: "document_generation",
      name: "Office Word Generator",
      phase: "Phase 9",
      description: "Converts structured JSON (title, headings, paragraphs, bullet points, tables, sources) into verified Office Word (.docx) deliverables.",
      icon: FileText,
      status: docGenEnabled ? "Active" : "Standby",
      available: docGenEnabled,
      containment: "Output written solely to <job>/artifacts/ with path traversal verification.",
      parameters: ["type ('docx')", "filename (string)", "title (string)", "sections (array)"],
    },
    {
      id: "list_files",
      name: "List Workspace Files",
      phase: "Phase 4",
      description: "Discovers existing files in the current job's isolated workspace. Used by the agent to inspect generated files and intermediate assets.",
      icon: FolderOpen,
      status: "Active",
      available: true,
      containment: "resolve_within_workspace rejects traversal (..) and symlink escapes.",
      parameters: ["path (optional string)"],
    },
    {
      id: "read_file",
      name: "Read Workspace File",
      phase: "Phase 4",
      description: "Reads file contents within the active job workspace with output capped at 4,000 characters to prevent prompt bloat.",
      icon: FileCode,
      status: "Active",
      available: true,
      containment: "Restricted strictly to the caller's active job directory.",
      parameters: ["path (string)"],
    },
    {
      id: "write_file",
      name: "Write Workspace File",
      phase: "Phase 4",
      description: "Writes configuration, intermediate scripts, or text data to the active job directory.",
      icon: FileEdit,
      status: "Active",
      available: true,
      containment: "Cannot overwrite or escape outside data/workspaces/<user>/<job>/.",
      parameters: ["path (string)", "content (string)"],
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
                Local Tool Registry
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Phase 4 Deny-By-Default
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Available agent tools validated against strict argument schemas with enforced security bounds
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>7 Verified Tools Available</span>
            </span>
          </div>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 flex flex-col justify-between space-y-4 hover:border-purple-200 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-purple-50 text-[#7047eb] rounded-xl shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-900">{tool.name}</h2>
                        <span className="text-[10px] font-mono text-slate-400 font-medium">
                          {tool.phase} • tool: {tool.id}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                        tool.available
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {tool.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tool.description}
                  </p>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">Security Boundary:</span>
                    <p className="text-[11px] text-slate-600 font-mono mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      {tool.containment}
                    </p>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">Input Schema:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tool.parameters.map((param) => (
                        <span
                          key={param}
                          className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700"
                        >
                          {param}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
