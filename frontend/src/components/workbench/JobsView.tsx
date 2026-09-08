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
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Task History
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              View and manage your AI task executions
            </p>
          </div>

          <button
            type="button"
            onClick={onNewJob}
            className="bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl px-4 py-2 font-semibold transition-colors cursor-pointer"
          >
            + New Task
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl">
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 max-w-md bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              className="w-full bg-transparent text-sm text-slate-700 outline-none"
            />
          </div>

          {/* Status Pills */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {["all", "running", "completed", "failed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-lg cursor-pointer transition-colors text-xs font-semibold capitalize ${
                  statusFilter === st
                    ? "bg-white shadow-sm text-slate-800 border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Jobs Table */}
        <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl flex flex-col overflow-hidden relative">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                <th className="py-3 px-5">Task Description</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Job ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500 text-sm">
                    No tasks found.
                  </td>
                </tr>
              ) : (
                filtered.map((job) => (
                  <tr
                    key={job.job_id}
                    onClick={() => setSelectedJob(job)}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-slate-700 max-w-sm truncate">
                      {job.message}
                    </td>
                    <td className="py-3 px-5">
                      {job.status === "running" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Running
                        </span>
                      ) : job.status === "completed" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Completed
                        </span>
                      ) : job.status === "queued" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200/60">
                          <Clock className="w-3 h-3" />
                          Queued
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                          <XCircle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-xs text-slate-400">
                      {job.job_id.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Slide-over Detail Drawer */}
          {selectedJob && (
            <div className="absolute inset-y-0 right-0 z-50 w-80 bg-white border-l border-slate-200/80 shadow-2xl flex flex-col p-5 animate-in slide-in-from-right-full duration-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
                <h2 className="text-base font-bold text-slate-800">Task Details</h2>
                <button
                  type="button"
                  onClick={() => setSelectedJob(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                <div>
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Description
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100">
                    {selectedJob.message}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Status
                    </span>
                    <span className="text-sm text-slate-700 font-medium capitalize">{selectedJob.status}</span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                      Job ID
                    </span>
                    <span className="text-xs font-mono text-slate-500 block truncate" title={selectedJob.job_id}>
                      {selectedJob.job_id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  type="button"
                  onClick={() => onSelectJob(selectedJob.job_id)}
                  className="w-full py-2 bg-[#7047eb] hover:bg-[#5a35d4] text-white rounded-xl text-sm font-semibold cursor-pointer text-center transition-colors shadow-sm"
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
