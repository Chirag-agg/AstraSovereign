"use client";

import React from "react";
import { Search, Image as ImageIcon, Code, FileText, FolderOpen } from "lucide-react";

const AVAILABLE_TOOLS = [
  {
    id: "doc-search",
    name: "Document Search",
    description: "Search your uploaded documents using AI",
    icon: Search,
  },
  {
    id: "doc-vision",
    name: "Document Vision",
    description: "Extract text from images and scanned PDFs",
    icon: ImageIcon,
  },
  {
    id: "code-exec",
    name: "Code Execution",
    description: "Run Python code in a secure sandbox",
    icon: Code,
  },
  {
    id: "doc-gen",
    name: "Document Generation",
    description: "Create Word documents automatically",
    icon: FileText,
  },
  {
    id: "file-mgr",
    name: "File Management",
    description: "Read and write workspace files",
    icon: FolderOpen,
  },
];

export default function ToolsView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Available Tools
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Local tools for AI-assisted tasks
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {AVAILABLE_TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.id}
                className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex items-start gap-4 hover:border-[#7047eb]/30 transition-colors"
              >
                <div className="p-3 bg-purple-50 text-[#7047eb] rounded-xl shrink-0">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">{tool.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{tool.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
