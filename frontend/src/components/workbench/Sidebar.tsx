"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  LayoutDashboard,
  Users2,
  Terminal,
  FileText,
  Archive,
  Library,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CreditCard,
  MessageSquare,
  Plus,
  CheckCircle2,
  Clock,
  Radio,
  XCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  LogOut,
  FolderTree,
  Cpu,
  Users,
  Layers,
  Code,
  GitBranch,
  Activity,
  ScrollText,
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

interface NavSectionItem {
  id: WorkbenchSection;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeColor?: "purple" | "rose" | "emerald" | "zinc";
}

// Documents removed as per requirement; Knowledge Base kept
const NAV_MAIN_ITEMS: NavSectionItem[] = [
  { id: "home", label: "Home", icon: Search },
  { id: "coworking", label: "Coworking Space", icon: Users2 },
  { id: "agent", label: "AI Assistant", icon: Terminal },
  { id: "sandbox", label: "Code Sandbox", icon: Code },
  { id: "jobs", label: "Task History", icon: LayoutDashboard },
  { id: "knowledge", label: "Knowledge Base", icon: Library },
  { id: "outputs", label: "Deliverables", icon: Archive },
  { id: "files", label: "Workspace Files", icon: FolderTree },
  { id: "models", label: "Models & Routing", icon: Layers },
  { id: "tools", label: "Local Tools", icon: Code },
  { id: "workflows", label: "Agent Pipelines", icon: GitBranch },
  { id: "compute", label: "Compute & VRAM", icon: Cpu },
  { id: "monitoring", label: "System Health", icon: Activity },
  { id: "audit", label: "Audit Trail", icon: ScrollText },
  { id: "team", label: "Team & Roles", icon: Users },
  { id: "settings", label: "Security", icon: ShieldCheck },
];

function statusIcon(status: string) {
  switch (status) {
    case "completed":
    case "ready":
      return <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />;
    case "running":
    case "processing":
      return <Radio className="w-3 h-3 text-purple-500 animate-pulse shrink-0" />;
    case "queued":
      return <Clock className="w-3 h-3 text-amber-500 shrink-0" />;
    case "failed":
    case "error":
      return <XCircle className="w-3 h-3 text-rose-500 shrink-0" />;
    default:
      return <AlertCircle className="w-3 h-3 text-zinc-400 shrink-0" />;
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
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-white border-r border-slate-200/80 shadow-xs transition-all duration-300 ease-in-out md:static md:translate-x-0 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${isOpenMobile ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        aria-label="Workspace Navigation"
      >
        {/* Brand & Collapse Header (AstraSovereign) */}
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#7047eb] to-[#9d7cfc] text-white shadow-xs font-bold text-sm shrink-0">
              <span className="tracking-tighter">AS</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col truncate transition-opacity duration-200">
                <span className="text-sm font-extrabold text-zinc-900 tracking-tight leading-tight truncate">
                  AstraSovereign
                </span>
                <span className="text-[10px] font-semibold text-purple-600 tracking-wide uppercase truncate">
                  Sovereign OS
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4 text-purple-600" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs">
          {/* Main Navigation Section */}
          <div className="space-y-1">
            {!collapsed && (
              <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-zinc-400 uppercase select-none">
                Main
              </div>
            )}

            <div className="space-y-0.5">
              {NAV_MAIN_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = currentSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    title={collapsed ? item.label : undefined}
                    onClick={() => {
                      onSelectSection(item.id);
                      onCloseMobile();
                    }}
                    className={`group flex w-full items-center rounded-xl transition-all cursor-pointer text-[15.5px] font-bold ${
                      collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-left"
                    } ${
                      active
                        ? "bg-[#ede9fe] text-[#6d28d9] shadow-xs"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        active ? "text-[#7047eb]" : "text-zinc-400 group-hover:text-zinc-700"
                      }`}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10.5px] font-bold px-1.5 py-0.2 rounded-full ${
                          item.badgeColor === "rose"
                            ? "bg-rose-500 text-white"
                            : "bg-[#7047eb] text-white"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin Console shortcut if Admin User */}
          {isAdmin && (
            <div className="pt-2 border-t border-zinc-100">
              <Link
                href="/admin"
                title={collapsed ? "Admin Console" : undefined}
                className={`group flex w-full items-center rounded-xl transition-all cursor-pointer font-semibold bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 ${
                  collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-left"
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-[#7047eb] shrink-0" />
                {!collapsed && <span className="flex-1 truncate">ADMIN CONSOLE</span>}
              </Link>
            </div>
          )}

          {/* Recent Tasks List (hidden in collapsed mode to keep clean icon bar) */}
          {!collapsed && (
            <div className="space-y-1 pt-1 border-t border-zinc-100">
              <div className="flex items-center justify-between px-2 pb-1 text-[10px] font-bold tracking-wider text-zinc-400 uppercase select-none">
                <span>Recent Tasks</span>
                <span className="text-[9.5px] text-zinc-400">{jobs ? jobs.length : 0}</span>
              </div>

              <div className="space-y-0.5">
                {!jobs || jobs.length === 0 ? (
                  <div className="px-2 py-1 text-[11px] text-zinc-400 italic">No tasks recorded</div>
                ) : (
                  jobs.slice(0, 5).map((job) => {
                    const active = activeJobId === job.job_id;
                    const label = job.message || "Untitled task";

                    return (
                      <button
                        key={job.job_id}
                        type="button"
                        onClick={() => {
                          onSelectJob(job.job_id);
                          onCloseMobile();
                        }}
                        className={`group flex w-full items-start gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                          active
                            ? "bg-purple-50 text-purple-900 font-semibold"
                            : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/70"
                        }`}
                      >
                        <span className="mt-0.5 shrink-0">{statusIcon(job.status)}</span>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-[11.5px] leading-tight">{label}</span>
                          <span className="block text-[9.5px] text-zinc-400 mt-0.5 font-mono truncate">
                            {job.job_id}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: User Profile */}
        <div className="border-t border-slate-200/80 p-2.5 bg-white space-y-2 select-none">
          <div
            title={`${user}@sovereign.local`}
            className={`flex items-center rounded-xl bg-slate-50 hover:bg-violet-50/60 border border-slate-200/70 transition-colors cursor-pointer ${
              collapsed ? "justify-center p-1.5" : "gap-2.5 p-2"
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#7047eb] to-[#a78bfa] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
              {user.startsWith("admin") ? "AD" : "OP"}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1 truncate">
                <span className="block text-xs font-bold text-slate-800 truncate">
                  {user === "user-001"
                    ? "Legal Lead"
                    : user === "user-002"
                    ? "Finance Analyst"
                    : user === "admin-001"
                    ? "Security Officer"
                    : user}
                </span>
                <span className="block text-[10.5px] text-slate-400 truncate">
                  {user}@sovereign.local
                </span>
              </div>
            )}
          </div>

          {!collapsed && (
            <div className="flex items-center justify-between px-1 pt-0.5 text-[10px] text-slate-500 font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Air-Gapped Local
              </span>
              <span className="font-mono text-slate-400">v0.10.0</span>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
