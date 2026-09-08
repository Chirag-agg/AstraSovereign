"use client";

import React from "react";
import { GitBranch } from "lucide-react";

export default function WorkflowsView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Workflows
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Automated task pipelines and multi-step processes
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-4">
            <GitBranch className="w-8 h-8 text-[#7047eb]" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Workflow Canvas</h2>
          <p className="text-sm text-slate-600 mt-2 max-w-md">
            Define multi-step agents and orchestration pipelines by providing natural language instructions to your AI assistant. Complex multi-tool workflows are negotiated automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
