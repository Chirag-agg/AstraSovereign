"use client";

import React from "react";
import {
  Plus,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  Users,
  GitBranch,
  Wrench
} from "lucide-react";
import type { JobSummary } from "@/lib/types";

interface CommandCenterProps {
  onNewJob: () => void;
  onSelectJob: (jobId: string) => void;
  onNavigate: (section: any) => void;
  jobs: JobSummary[] | null;
}

export default function CommandCenter({
  onNewJob,
  onSelectJob,
  onNavigate,
  jobs,
}: CommandCenterProps) {
  const jobList = jobs || [];
  
  const totalJobs = jobList.length;
  const runningJobs = jobList.filter(j => j.status === "running").length;
  const completedJobs = jobList.filter(j => j.status === "completed").length;
  const failedJobs = jobList.filter(j => j.status === "failed").length;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-zinc-100 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-zinc-400 font-medium mt-1 leading-relaxed">
              System overview and quick actions
            </p>
          </div>
          <button
            type="button"
            onClick={onNewJob}
            className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl px-4 py-2 font-semibold shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all cursor-pointer font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-zinc-500" />
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Total Tasks</span>
            </div>
            <span className="text-3xl font-bold text-zinc-100">{totalJobs}</span>
          </div>
          
          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Running</span>
            </div>
            <span className="text-3xl font-bold text-zinc-100">{runningJobs}</span>
          </div>

          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Completed</span>
            </div>
            <span className="text-3xl font-bold text-zinc-100">{completedJobs}</span>
          </div>

          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              <span className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">Failed</span>
            </div>
            <span className="text-3xl font-bold text-zinc-100">{failedJobs}</span>
          </div>
        </div>

        {/* Two columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tasks */}
          <div className="lg:col-span-2 bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-100">Recent Tasks</h2>
              <button 
                onClick={() => onNavigate("jobs")}
                className="text-sm text-zinc-400 hover:text-red-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto p-0">
              {jobList.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <Activity className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-base font-bold text-zinc-100">No recent tasks</p>
                  <p className="text-sm text-zinc-400 mt-1">Start a new task to see it here.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#18181b]/50">
                      <th className="py-3 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">ID</th>
                      <th className="py-3 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Task</th>
                      <th className="py-3 px-5 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobList.slice(0, 5).map((job) => (
                      <tr 
                        key={job.job_id} 
                        onClick={() => onSelectJob(job.job_id)}
                        className="border-b border-zinc-800 hover:bg-[#18181b]/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-5 font-mono text-sm text-zinc-400 whitespace-nowrap">
                          {job.job_id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-5 text-sm text-zinc-100 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                          {job.message}
                        </td>
                        <td className="py-3 px-5">
                          {job.status === "running" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-400 border border-amber-900/50">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-950/400 animate-pulse" />
                              Running
                            </span>
                          ) : job.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/50">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/40 text-rose-400 border border-rose-900/50">
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <h2 className="text-base font-bold text-zinc-100 mb-4">Quick Navigation</h2>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate("tools")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800 hover:border-red-500/30 hover:bg-red-950/30 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#18181b] text-zinc-400 rounded-lg group-hover:bg-red-950/300/10 group-hover:text-red-400 transition-colors">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Available Tools</p>
                    <p className="text-xs text-zinc-400">View local capabilities</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
              </button>

              <button
                onClick={() => onNavigate("workflows")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800 hover:border-red-500/30 hover:bg-red-950/30 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#18181b] text-zinc-400 rounded-lg group-hover:bg-red-950/300/10 group-hover:text-red-400 transition-colors">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Workflows</p>
                    <p className="text-xs text-zinc-400">Automated pipelines</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
              </button>

              <button
                onClick={() => onNavigate("team")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-zinc-800 hover:border-red-500/30 hover:bg-red-950/30 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#18181b] text-zinc-400 rounded-lg group-hover:bg-red-950/300/10 group-hover:text-red-400 transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">Team</p>
                    <p className="text-xs text-zinc-400">User access control</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
