"use client";

import React from "react";
import { ScrollText } from "lucide-react";

export default function AuditLogsView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Audit Trail
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Track all system actions and events
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-4 bg-slate-50 text-slate-400 rounded-full">
              <ScrollText className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 mb-2">Comprehensive Audit Logging</h2>
              <p className="text-sm text-slate-600 max-w-lg mx-auto">
                All task executions, model calls, and document operations are logged automatically. 
                These logs are securely stored and can be reviewed to ensure system integrity and compliance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
