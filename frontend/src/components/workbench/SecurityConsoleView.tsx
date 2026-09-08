"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Server,
  RefreshCw,
  Terminal,
} from "lucide-react";

export default function SecurityConsoleView() {
  const [verifying, setVerifying] = useState(false);

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => setVerifying(false), 600);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Security & Privacy
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Air-gap compliance and data sovereignty status
            </p>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${verifying ? "animate-spin" : ""}`} />
            <span>Verify Status</span>
          </button>
        </div>

        {/* Security Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Server className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Network Policy</h2>
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
            </div>
            <p className="text-sm text-slate-600">
              All processing is local. There are no external connections, ensuring complete data privacy.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Lock className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Data Isolation</h2>
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
            </div>
            <p className="text-sm text-slate-600">
              Per-user workspace isolation guarantees that data is not shared between different users or contexts.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Audit Logging</h2>
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
            </div>
            <p className="text-sm text-slate-600">
              All actions are securely logged for compliance and monitoring purposes.
            </p>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <Terminal className="w-5 h-5" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Code Sandbox</h2>
              <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">Active</span>
            </div>
            <p className="text-sm text-slate-600">
              Generated code runs in isolated containers to prevent unintended system access or modifications.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
