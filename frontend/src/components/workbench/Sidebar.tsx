"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Plus,
  ChevronLeft,
  ChevronRight,
  Library,
  Code,
  Archive,
  ShieldCheck,
  CheckCircle2,
  Radio,
  Clock,
  XCircle,
  AlertCircle,
  Bot,
  Sparkles,
  Search,
  Users,
  Settings,
  FolderTree,
  User as UserIcon,
} from "lucide-react";
import type { WorkbenchSection } from "./types";
import type { DocumentMeta, JobSummary } from "@/lib/types";

interface SidebarProps {
  currentSection: WorkbenchSection;
  onSelectSection: (section: WorkbenchSection) => void;
  onNewJob: () => void;
  jobs: JobSummary[] | null;
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  documents?: DocumentMeta[] | null;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onSignOut?: () => void;
  user?: string;
}

function statusDot(status: string) {
  switch (status) {
    case "completed":
      return <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Completed" />;
    case "running":
    case "processing":
      return <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" title="Executing" />;
    case "queued":
      return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="Queued" />;
    case "failed":
    case "error":
      return <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Failed" />;
    default:
      return <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />;
  }
}

export default function Sidebar({
  currentSection,
  onSelectSection,
  onNewJob,
  jobs,
  activeJobId,
  onSelectJob,
  documents,
  isOpenMobile,
  onCloseMobile,
  onSignOut,
  user = "user-001",
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isAdmin = user.startsWith("admin");

  return (
    <>
      {/* Mobile backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0b0b0e] border-r border-zinc-800/80 shadow-2xl transition-all duration-300 ease-in-out md:static md:translate-x-0 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"} select-none`}
        aria-label="Chatbot Navigation"
      >
        {/* 1. BRAND & APP HEADER */}
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-zinc-800/80 bg-[#0b0b0e] shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-950 text-red-500 border border-red-600/40 shadow-[0_0_12px_rgba(239,68,68,0.2)] font-bold text-sm shrink-0">
              <Bot className="w-4.5 h-4.5" />
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate">
                <span className="text-sm font-bold text-white tracking-tight leading-tight truncate">
                  Astra Sovereign
                </span>
                <span className="text-[10px] font-semibold text-red-500 tracking-wide uppercase truncate">
                  Air-Gapped OS
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-red-500" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* 2. PRIMARY ACTION: NEW CHAT / NEW TASK */}
        <div className="p-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewJob();
              onSelectSection("agent");
              onCloseMobile();
            }}
            className={`flex w-full items-center rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-[0_2px_10px_rgba(239,68,68,0.2)] ${
              collapsed
                ? "justify-center p-2.5 bg-red-600 text-white hover:bg-red-700"
                : "gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600 justify-start border border-red-500/50"
            }`}
            title="Start New Task"
          >
            <Plus className="w-4 h-4 shrink-0 text-white" />
            {!collapsed && <span>New Task</span>}
          </button>
        </div>

        {/* 3. RECENT CONVERSATIONS (CHAT THREADS) */}
        <div className="flex-1 overflow-y-auto px-2.5 py-1 space-y-1 min-h-0 text-xs">
          {!collapsed && (
            <div className="px-2 pt-1 pb-1.5 flex items-center justify-between text-[10px] font-bold tracking-wider text-zinc-400 uppercase select-none">
              <span>Recent Chats</span>
              <span className="text-[10px] font-mono text-zinc-400">{jobs ? jobs.length : 0}</span>
            </div>
          )}

          {!jobs || jobs.length === 0 ? (
            !collapsed && (
              <div className="px-3 py-6 text-center text-zinc-400 text-xs space-y-1">
                <MessageSquare className="w-5 h-5 mx-auto text-zinc-600 stroke-1" />
                <p className="italic">No chats yet</p>
              </div>
            )
          ) : (
            jobs.map((job) => {
              const active = currentSection === "agent" && activeJobId === job.job_id;
              const label = job.message || "New Conversation";

              return (
                <button
                  key={job.job_id}
                  type="button"
                  onClick={() => {
                    onSelectJob(job.job_id);
                    onSelectSection("agent");
                    onCloseMobile();
                  }}
                  title={label}
                  className={`group flex w-full items-center rounded-xl transition-colors cursor-pointer text-left ${
                    collapsed
                      ? "justify-center p-2.5"
                      : "gap-2 px-2.5 py-2"
                  } ${
                    active
                      ? "bg-red-950/40 text-red-200 font-semibold border border-red-800/60 shadow-[0_0_10px_rgba(239,68,68,0.2)]"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
                  }`}
                >
                  {statusDot(job.status)}
                  {!collapsed && (
                    <div className="min-w-0 flex-1 truncate">
                      <span className="block truncate text-xs font-medium leading-snug">{label}</span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* 4. WORKSPACES & TOOLS (COMPACT FOOTER TABS) */}
        <div className="border-t border-zinc-800/80 p-2.5 bg-[#0b0b0e] space-y-1 shrink-0 text-xs">
          {!collapsed && (
            <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-zinc-400 uppercase select-none">
              Tools &amp; Workspaces
            </div>
          )}

          {/* Knowledge Base */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("knowledge");
              onCloseMobile();
            }}
            className={`flex w-full items-center rounded-xl transition-colors cursor-pointer text-xs font-medium ${
              collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5"
            } ${
              currentSection === "knowledge"
                ? "bg-red-950/40 text-red-300 font-semibold border border-red-900/40"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
            }`}
            title="Knowledge Base (Documents & RAG)"
          >
            <Library className="w-4 h-4 shrink-0 text-zinc-400" />
            {!collapsed && <span className="flex-1 truncate">Knowledge Base</span>}
          </button>

          {/* Code Sandbox */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("sandbox");
              onCloseMobile();
            }}
            className={`flex w-full items-center rounded-xl transition-colors cursor-pointer text-xs font-medium ${
              collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5"
            } ${
              currentSection === "sandbox"
                ? "bg-red-950/40 text-red-300 font-semibold border border-red-900/40"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
            }`}
            title="Code Sandbox (Docker)"
          >
            <Code className="w-4 h-4 shrink-0 text-zinc-400" />
            {!collapsed && <span className="flex-1 truncate">Code Sandbox</span>}
          </button>

          {/* Deliverables */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("outputs");
              onCloseMobile();
            }}
            className={`flex w-full items-center rounded-xl transition-colors cursor-pointer text-xs font-medium ${
              collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5"
            } ${
              currentSection === "outputs"
                ? "bg-red-950/40 text-red-300 font-semibold border border-red-900/40"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200"
            }`}
            title="Deliverables & Artifacts"
          >
            <Archive className="w-4 h-4 shrink-0 text-zinc-400" />
            {!collapsed && <span className="flex-1 truncate">Deliverables</span>}
          </button>

          {/* Settings button */}
          <button
            type="button"
            onClick={() => {
              onSelectSection("settings");
              onCloseMobile();
            }}
            className={`flex w-full items-center rounded-xl transition-all cursor-pointer text-xs font-medium ${
              collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5"
            } ${
              currentSection === "settings"
                ? "bg-red-950/40 text-red-300 font-semibold border border-red-800/50 shadow-xs"
                : "text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-200 hover:translate-x-0.5"
            }`}
            title="System & Theme Settings"
          >
            <Settings className="w-4 h-4 shrink-0 text-zinc-400" />
            {!collapsed && <span className="flex-1 truncate">Settings</span>}
          </button>

          {/* Admin link if role is admin */}
          {isAdmin && (
            <Link
              href="/admin"
              className={`flex w-full items-center rounded-xl transition-colors cursor-pointer text-xs font-semibold bg-red-950/50 text-red-200 border border-red-900/50 ${
                collapsed ? "justify-center p-2" : "gap-2 px-2.5 py-1.5"
              }`}
              title="Admin & Operations Console"
            >
              <ShieldCheck className="w-4 h-4 shrink-0 text-red-500" />
              {!collapsed && <span className="flex-1 truncate">Admin Console</span>}
            </Link>
          )}

          {/* User Profile Card with Employee ID and Avatar */}
          <div className="pt-2 mt-1 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={() => {
                onSelectSection("profile");
                onCloseMobile();
              }}
              className={`w-full flex items-center rounded-xl transition-all cursor-pointer text-left group ${
                collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"
              } ${
                currentSection === "profile"
                  ? "bg-red-950/40 border border-red-700/60 shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                  : "bg-zinc-900/70 hover:bg-zinc-800 border border-zinc-800 hover:border-red-900/50 hover:shadow-xs"
              }`}
              title="View Employee Profile & Sovereign ID"
            >
              <div className="relative w-8 h-8 rounded-xl bg-zinc-950 text-red-500 border border-red-600/40 font-bold text-xs flex items-center justify-center shadow-xs shrink-0 group-hover:scale-105 transition-transform overflow-hidden">
                {/* Employee photo avatar / badge */}
                <span className="font-mono text-[11px] font-extrabold tracking-tight">
                  {user.startsWith("admin") ? "AD" : "OP"}
                </span>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-zinc-900" />
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1 truncate">
                  <div className="flex items-center justify-between gap-1">
                    <span className="block text-xs font-bold text-zinc-200 truncate group-hover:text-red-400 transition-colors">
                      {user === "user-001"
                        ? "Alex Rivera"
                        : user === "user-002"
                        ? "Sarah Chen"
                        : user === "user-003"
                        ? "Marcus Vance"
                        : user === "admin-001"
                        ? "Director Sterling"
                        : user}
                    </span>
                    <span className="text-[9px] font-mono font-bold text-zinc-400 bg-zinc-950 px-1.5 py-0.5 rounded border border-zinc-800 shrink-0">
                      ID: {user}
                    </span>
                  </div>
                  <span className="block text-[10.5px] text-zinc-400 truncate">
                    {user === "user-001"
                      ? "Legal Lead • Clearance L4"
                      : user === "user-002"
                      ? "Finance Analyst • L3"
                      : user === "admin-001"
                      ? "Security Director • L4"
                      : "Department Operator"}
                  </span>
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
