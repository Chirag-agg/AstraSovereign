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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Dashboard
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              System overview and quick actions
            </p>
          </div>
          <button
            type="button"
            onClick={onNewJob}
            className="flex items-center gap-1.5 bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white rounded-xl px-4 py-2 font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Tasks</span>
            </div>
            <span className="text-3xl font-bold text-slate-800">{totalJobs}</span>
          </div>
          
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Running</span>
            </div>
            <span className="text-3xl font-bold text-slate-800">{runningJobs}</span>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Completed</span>
            </div>
            <span className="text-3xl font-bold text-slate-800">{completedJobs}</span>
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-5 h-5 text-rose-500" />
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Failed</span>
            </div>
            <span className="text-3xl font-bold text-slate-800">{failedJobs}</span>
          </div>
        </div>

        {/* Two columns layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Tasks */}
          <div className="lg:col-span-2 bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-800">Recent Tasks</h2>
              <button 
                onClick={() => onNavigate("jobs")}
                className="text-sm text-slate-600 hover:text-[var(--accent)] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              >
                View All <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-x-auto p-0">
              {jobList.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center text-center">
                  <Activity className="w-10 h-10 text-slate-500 mb-3" />
                  <p className="text-base font-bold text-slate-800">No recent tasks</p>
                  <p className="text-sm text-slate-500 mt-1">Start a new task to see it here.</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">ID</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Task</th>
                      <th className="py-3 px-5 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobList.slice(0, 5).map((job) => (
                      <tr 
                        key={job.job_id} 
                        onClick={() => onSelectJob(job.job_id)}
                        className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-5 font-mono text-sm text-slate-600 whitespace-nowrap">
                          {job.job_id.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-5 text-sm text-slate-800 font-medium truncate max-w-[200px] sm:max-w-[300px]">
                          {job.message}
                        </td>
                        <td className="py-3 px-5">
                          {job.status === "running" ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Running
                            </span>
                          ) : job.status === "completed" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
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
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-5">
            <h2 className="text-base font-bold text-slate-800 mb-4">Quick Navigation</h2>
            <div className="space-y-2">
              <button
                onClick={() => onNavigate("tools")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[var(--accent)]/30 hover:bg-purple-50/50 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-colors">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Available Tools</p>
                    <p className="text-xs text-slate-500">View local capabilities</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent)] transition-colors" />
              </button>

              <button
                onClick={() => onNavigate("workflows")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[var(--accent)]/30 hover:bg-purple-50/50 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-colors">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Workflows</p>
                    <p className="text-xs text-slate-500">Automated pipelines</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent)] transition-colors" />
              </button>

              <button
                onClick={() => onNavigate("team")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-[var(--accent)]/30 hover:bg-purple-50/50 transition-colors group cursor-pointer text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 text-slate-600 rounded-lg group-hover:bg-[var(--accent)]/10 group-hover:text-[var(--accent)] transition-colors">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Team</p>
                    <p className="text-xs text-slate-500">User access control</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-[var(--accent)] transition-colors" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
