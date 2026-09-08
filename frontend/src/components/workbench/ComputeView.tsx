"use client";

import React from "react";
import { Server, Cpu, HardDrive, Zap, Layers, Clock, CheckCircle2, Radio } from "lucide-react";
import type { Health } from "@/lib/types";

interface ComputeViewProps {
  health?: Health | null;
}

export default function ComputeView({ health }: ComputeViewProps) {
  const scheduler = health?.scheduler;
  const worker = health?.worker;
  const queueSize = health?.queue_size ?? scheduler?.queued_jobs ?? 0;
  const runningJobs = scheduler?.running_jobs ?? (worker?.state === "running" ? 1 : 0);

  const cpuAllocated = scheduler?.allocated?.cpu_cores ?? 0;
  const memAllocated = scheduler?.allocated?.memory_mb ?? 0;
  const gpuAllocations = scheduler?.allocated?.gpu || {};

  // Extract GPU stats or fallback
  const gpuEntries = Object.entries(gpuAllocations);
  const primaryGpu = gpuEntries[0] ? gpuEntries[0][1] : { allocated_vram_mb: 0, capacity_vram_mb: 16384 };
  const primaryGpuName = gpuEntries[0] ? gpuEntries[0][0] : "GPU-0 (Default)";

  const gpuVramPercent = primaryGpu.capacity_vram_mb > 0
    ? Math.min(100, Math.round((primaryGpu.allocated_vram_mb / primaryGpu.capacity_vram_mb) * 100))
    : 0;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Compute & Resource Scheduler
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Phase 6 VRAM-Aware
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Real-time hardware accounting, deterministic FIFO scheduling, and dynamic GPU allocation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
              <Radio className={`w-3.5 h-3.5 ${worker?.state === "running" ? "text-purple-600 animate-pulse" : "text-emerald-500"}`} />
              <span>Worker: <strong className="capitalize">{worker?.state || "idle"}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Executions</span>
              <div className="p-2 bg-purple-50 text-[#7047eb] rounded-xl">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{runningJobs}</div>
            <p className="text-[11px] text-slate-500 mt-1">Single-worker FIFO execution</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Queued Waiters</span>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{queueSize}</div>
            <p className="text-[11px] text-amber-600 font-medium mt-1">Zero starvation policy</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Allocated CPU Cores</span>
              <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{cpuAllocated} <span className="text-xs text-slate-500 font-normal">cores</span></div>
            <p className="text-[11px] text-sky-600 font-medium mt-1">Released in finally block</p>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Allocated RAM</span>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <HardDrive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{memAllocated} <span className="text-xs text-slate-500 font-normal">MB</span></div>
            <p className="text-[11px] text-emerald-600 font-medium mt-1">Bound to active task</p>
          </div>
        </div>

        {/* Hardware Meters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* GPU Hardware Section */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-[#7047eb] rounded-xl">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Hardware Accelerator (GPU)</h3>
                  <p className="text-[11px] text-slate-500">{primaryGpuName}</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                {primaryGpu.allocated_vram_mb > 0 ? "Allocated" : "Idle Capacity"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">VRAM Allocation</span>
                <span className="font-mono font-bold text-slate-900">
                  {primaryGpu.allocated_vram_mb} MB / {primaryGpu.capacity_vram_mb} MB ({gpuVramPercent}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#7047eb] to-[#9d7cfc] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(4, gpuVramPercent)}%` }}
                />
              </div>

              <div className="pt-3 border-t border-slate-50 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400">Total VRAM: </span>
                  <span className="font-semibold text-slate-700">{(primaryGpu.capacity_vram_mb / 1024).toFixed(1)} GB</span>
                </div>
                <div>
                  <span className="text-slate-400">Model Policy: </span>
                  <span className="font-semibold text-slate-700">Config-Declared</span>
                </div>
              </div>
            </div>
          </div>

          {/* System Host CPU & Memory */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Host CPU & Memory Scheduler</h3>
                  <p className="text-[11px] text-slate-500">ResourceProvider (Local Discovery)</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                Managed
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-600 font-medium">CPU Core Allocation</span>
                  <span className="font-mono font-bold text-slate-900">{cpuAllocated} Cores Active</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-sky-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${cpuAllocated > 0 ? 35 : 5}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-slate-600 font-medium">Host Memory Allocation</span>
                  <span className="font-mono font-bold text-slate-900">{memAllocated} MB Active</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${memAllocated > 0 ? 25 : 5}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-50 text-[11px] text-slate-500">
                Clean release on job completion, cancellation, or failure ensures zero VRAM or process leaks.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
