"use client";

import React from "react";
import { Brain, Code, FileText, Eye } from "lucide-react";

export default function ModelsView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              AI Models
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Local models available for task processing
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-purple-50 border-l-4 border-[#7047eb] rounded-xl p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
          <p className="text-sm text-slate-700">
            Tasks are automatically routed to the best available model based on their type.
          </p>
        </div>

        {/* Task Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <Brain className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">General Reasoning</h2>
            </div>
            <p className="text-sm text-slate-600">
              Handles general knowledge queries, conversational interactions, and logical problem solving.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <Code className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Code Generation</h2>
            </div>
            <p className="text-sm text-slate-600">
              Optimized for programming tasks, debugging, and generating software components.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Document Analysis</h2>
            </div>
            <p className="text-sm text-slate-600">
              Processes large texts, extracting summaries, structured data, and key information.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <Eye className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Vision & OCR</h2>
            </div>
            <p className="text-sm text-slate-600">
              Analyzes images and extracts text from visual documents.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
