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
import { AstraMark, AstraWordmark } from "@/components/brand/AstraMark";

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

/**
 * Navigation, grouped.
 *
 * This was a flat list of sixteen items, most of them naming a subsystem
 * rather than a job: Compute & VRAM, Agent Pipelines, Models & Routing,
 * Local Tools. An approvals clerk has no way to guess which of those does
 * the thing they came to do.
 *
 * Now: seven items in office language up top, and everything operational
 * folded into one group that starts closed. Nothing was deleted — the views
 * and their section ids are unchanged — it is only a question of what a
 * first-time user has to read before they can start.
 */
interface NavGroupDef {
  key: string;
  label: string;
  items: NavSectionItem[];
  /** Operational groups start closed. */
  defaultOpen: boolean;
}

const NAV_GROUPS: NavGroupDef[] = [
  {
    key: "work",
    label: "Work",
    defaultOpen: true,
    items: [
      { id: "home", label: "Home", icon: Search },
      { id: "agent", label: "Assistant", icon: Terminal },
      { id: "jobs", label: "My work", icon: LayoutDashboard },
      { id: "coworking", label: "Team", icon: Users2 },
    ],
  },
  {
    key: "files",
    label: "Files",
    defaultOpen: true,
    items: [
      { id: "knowledge", label: "Documents", icon: Library },
      { id: "outputs", label: "Finished files", icon: Archive },
      { id: "files", label: "Workspace", icon: FolderTree },
    ],
  },
  {
    key: "ops",
    label: "Operations",
    defaultOpen: false,
    items: [
      { id: "models", label: "Models", icon: Layers },
      { id: "workflows", label: "Pipelines", icon: GitBranch },
      { id: "tools", label: "Tools", icon: Code },
      { id: "sandbox", label: "Sandbox", icon: Code },
      { id: "compute", label: "Compute", icon: Cpu },
      { id: "monitoring", label: "Health", icon: Activity },
      { id: "audit", label: "Audit", icon: ScrollText },
      { id: "team", label: "People", icon: Users },
      { id: "settings", label: "Security", icon: ShieldCheck },
    ],
  },
];

const NAV_MAIN_ITEMS: NavSectionItem[] = NAV_GROUPS.flatMap((group) => group.items);


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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
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
        <div
          className="flex h-14 items-center justify-between px-3.5"
          style={{ borderBottom: "1px solid var(--carbon)", background: "var(--surface-panel)" }}
        >
          <div className="flex items-center overflow-hidden">
            {collapsed ? (
              <AstraMark size={27} handles={false} />
            ) : (
              <AstraWordmark size={21} tagline />
            )}
          </div>

          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-[3px] transition-colors cursor-pointer shrink-0"
            style={{ color: "var(--granite)", background: "transparent", border: "1px solid var(--carbon)" }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4 text-xs">
          {/* Main Navigation Section */}
          <div className="space-y-1">
            {/* The groups below carry their own headings now, so a "Main"
                label above them was a header for a header. */}

            <div className="space-y-0.5">
              {NAV_GROUPS.map((group) => {
                const open = openGroups[group.key] ?? group.defaultOpen;
                const groupHasActive = group.items.some((item) => item.id === currentSection);
                return (
                  <div key={group.key} className="mb-1">
                    {!collapsed && (
                      <button
                        type="button"
                        onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
                        aria-expanded={open}
                        className="flex w-full items-center gap-1.5 px-3 pb-1 pt-3 font-mono uppercase transition-colors"
                        style={{ fontSize: 10, letterSpacing: "0.12em", color: groupHasActive ? "var(--stone)" : "var(--graphite)", background: "none", border: 0, cursor: "pointer" }}
                      >
                        <ChevronRight
                          className="h-3 w-3 transition-transform"
                          style={{ transform: open ? "rotate(90deg)" : "none" }}
                        />
                        <span className="flex-1 text-left">{group.label}</span>
                        {!open && groupHasActive && (
                          <span style={{ width: 5, height: 5, borderRadius: 99, background: "var(--signal)" }} />
                        )}
                      </button>
                    )}
                    {(open || collapsed) &&
                      group.items.map((item) => {
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
                            className={`group relative flex w-full items-center transition-all cursor-pointer ${
                              collapsed ? "justify-center p-2.5" : "gap-2.5 py-2 pl-3 pr-3 text-left"
                            }`}
                            style={{
                              borderRadius: 4,
                              color: active ? "var(--bone)" : "var(--granite)",
                              // A warm tint of the canvas, so the active plate stays a
                              // tint in either theme instead of a dark block on paper.
                              background: active
                                ? "color-mix(in srgb, var(--signal) 9%, var(--canvas))"
                                : "transparent",
                              fontSize: 14,
                            }}
                          >
                            {active && !collapsed && (
                              <span
                                aria-hidden="true"
                                style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, background: "var(--signal)" }}
                              />
                            )}
                            <Icon className="h-4 w-4 shrink-0" style={{ color: active ? "var(--signal)" : "var(--graphite)" }} />
                            {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                            {!collapsed && item.badge !== undefined && (
                              <span
                                className="font-mono"
                                style={{ fontSize: 10, padding: "1px 5px", borderRadius: 2, background: "var(--signal)", color: "#101010" }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
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
                <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0" />
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
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--brand-300)] text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
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
