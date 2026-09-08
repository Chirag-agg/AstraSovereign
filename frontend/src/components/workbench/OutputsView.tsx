"use client";

import React from "react";
import {
  Archive,
  FileText,
  Download,
} from "lucide-react";
import type { ArtifactSummary } from "@/lib/types";

interface OutputsViewProps {
  artifacts: ArtifactSummary[] | null;
  onDownloadArtifact: (artifact: ArtifactSummary) => void;
}

export default function OutputsView({
  artifacts,
  onDownloadArtifact,
}: OutputsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Deliverables
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Download generated documents and reports
            </p>
          </div>
        </div>

        {/* Deliverables List Table */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden">
          {(!artifacts || artifacts.length === 0) ? (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <Archive className="w-12 h-12 text-slate-300 mb-4" />
              <h3 className="text-base font-bold text-slate-800">No deliverables yet</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-sm">
                Generated documents, reports, and other artifacts will appear here when tasks are completed.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3 px-5">Filename</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {artifacts.map((artifact) => (
                    <tr key={artifact.artifact_id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-[#7047eb]" />
                          <span className="font-medium text-slate-700">{artifact.filename}</span>
                        </div>
                      </td>
                      <td className="py-3 px-5">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-[#7047eb] border border-purple-200/60 uppercase">
                          {artifact.type || "Document"}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <button
                          onClick={() => onDownloadArtifact(artifact)}
                          className="border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl px-4 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
