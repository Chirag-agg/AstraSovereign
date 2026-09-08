"use client";

import React from "react";
import { Server, Cpu, HardDrive } from "lucide-react";

export default function ComputeView() {
  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              System Resources
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Local compute infrastructure status
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-xl p-4 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
          <p className="text-sm text-slate-700">
            Resource allocation is managed automatically by the system. Tasks are scheduled based on available CPU, memory, and GPU capacity.
          </p>
        </div>

        {/* Clean generic status card */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">Automated Resource Scheduling</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Processing Power</h3>
                <p className="text-xs text-slate-600 mt-1">CPU workloads are distributed across available cores to ensure system responsiveness.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                <HardDrive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Memory Management</h3>
                <p className="text-xs text-slate-600 mt-1">System RAM is automatically allocated to active processes and freed when not needed.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Hardware Acceleration</h3>
                <p className="text-xs text-slate-600 mt-1">GPU resources are dynamically assigned to AI inference tasks for optimal performance.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
