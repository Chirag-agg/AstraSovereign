"use client";

import React, { useState } from "react";
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  FileText,
  Loader2,
} from "lucide-react";
import type { JobSummary } from "@/lib/types";

interface JobsViewProps {
  jobs: JobSummary[] | null;
  onSelectJob: (jobId: string) => void;
  onNewJob: () => void;
}

export default function JobsView({ jobs, onSelectJob, onNewJob }: JobsViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);

  const displayJobs = jobs || [];

  const filtered = displayJobs.filter((job) => {
    const matchesSearch =
      job.job_id.toLowerCase().includes(search.toLowerCase()) ||
      job.message.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#09090b]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
              Task History
            </h1>
            <p className="text-sm text-zinc-400 font-medium mt-1 leading-relaxed">
              View and manage your AI task executions
            </p>
          </div>

          <button
            type="button"
            onClick={onNewJob}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl px-4 py-2 font-semibold transition-colors cursor-pointer shadow-sm shadow-red-900/20"
          >
            + New Task
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md bg-[#18181b] border border-zinc-800 px-3 py-1.5 rounded-xl">
            <Search className="w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-transparent text-sm text-zinc-200 outline-none"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-[#18181b] p-1 rounded-xl border border-zinc-800">
            {["all", "running", "completed", "failed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg cursor-pointer transition-colors text-xs font-semibold capitalize ${
                  statusFilter === st
                    ? "bg-[#111115] shadow-sm text-zinc-100 border border-zinc-800/50"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-[#27272a]"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-[#111115] border border-zinc-800 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden relative">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-[#18181b]/30">
                <th className="py-3 px-5">Task Description</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Job ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-zinc-400 text-sm">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                filtered.map((job) => (
                  <tr
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    className="hover:bg-[#18181b]/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-zinc-200 max-w-sm truncate">
                      {job.message}
                    </td>
                    <td className="py-3 px-5">
                      {job.status === "running" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-950/40 text-amber-400 border border-amber-900/50/60">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Running
                        </span>
                      ) : job.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950/40 text-emerald-400 border border-emerald-900/50/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : job.status === "queued" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-zinc-400 border border-zinc-800/60">
                          <Clock className="w-3 h-3" />
                          Queued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950/40 text-rose-400 border border-rose-900/50/60">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-zinc-500">
                      {job.job_id.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Slide-over Detail Drawer */}
          {selectedJob && (
            <div className="absolute inset-y-0 right-0 z-50 w-80 bg-[#111115] border-l border-zinc-800 shadow-2xl flex flex-col p-5 animate-in slide-in-from-right-full duration-200">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4">
                <h2 className="text-base font-bold text-zinc-100">Task Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-400 hover:bg-[#27272a] cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div>
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                    Description
                  </span>
                  <p className="text-sm text-zinc-200 leading-relaxed bg-[#18181b] p-3 rounded-xl border border-zinc-800">
                    {selectedJob.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                      Status
                    </span>
                    <span className="text-sm text-zinc-200 font-medium capitalize">{selectedJob.status}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
                      Job ID
                    </span>
                    <span className="text-xs font-mono text-zinc-400 block truncate" title={selectedJob.job_id}>
                      {selectedJob.job_id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-800 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectJob(selectedJob.job_id)}
                  className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold cursor-pointer text-center transition-colors shadow-sm shadow-red-900/20"
                >
                  Open in Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
