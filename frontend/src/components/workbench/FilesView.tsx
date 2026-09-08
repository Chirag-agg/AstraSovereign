"use client";

import React from "react";
import { FolderOpen, FileText, HardDrive } from "lucide-react";

export default function FilesView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Workspace Files
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Files created and managed within your task workspaces
            </p>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] p-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mb-4">
              <FolderOpen className="w-7 h-7 text-[#7047eb]" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Workspace File Management</h3>
            <p className="text-sm text-slate-500 max-w-md leading-relaxed mb-6">
              Each task creates an isolated workspace where the AI agent can read, write, and manage files securely.
              Files are organized per-user and per-task for complete data isolation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl">
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center mx-auto mb-2">
                  <FolderOpen className="w-4 h-4 text-[#7047eb]" />
                </div>
                <p className="text-xs font-semibold text-purple-800">Isolated Workspaces</p>
                <p className="text-[11px] text-purple-600 mt-1">Per-task file isolation</p>
              </div>

              <div className="bg-emerald-50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center mx-auto mb-2">
                  <HardDrive className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-xs font-semibold text-emerald-800">Local Storage</p>
                <p className="text-[11px] text-emerald-600 mt-1">All files stored on-premise</p>
              </div>

              <div className="bg-sky-50 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                </div>
                <p className="text-xs font-semibold text-sky-800">Secure Access</p>
                <p className="text-[11px] text-sky-600 mt-1">Path traversal protection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
