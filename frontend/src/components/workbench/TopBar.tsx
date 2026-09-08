"use client";

import React, { useEffect, useState } from "react";
import {
  Menu,
  Search,
  Plus,
  FileSearch,
  BookOpen,
  Bot,
  FileCheck,
  Shield,
  LogOut,
  Bell,
  Sparkles,
  ChevronDown,
  Layers,
  LayoutDashboard,
  Users2,
  ShieldCheck,
} from "lucide-react";
import type { WorkbenchSection } from "./types";

interface TopBarProps {
  onOpenMobileNav: () => void;
  onOpenCommandPalette: () => void;
  onSelectSection: (section: WorkbenchSection) => void;
  onNewJob: () => void;
  onOpenSystem: () => void;
  user: string;
  onUserChange: (user: string) => void;
  devRole: "user" | "admin";
  onDevRoleChange: (role: "user" | "admin") => void;
  onSignOut: () => void;
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
  currentSection?: WorkbenchSection;
}

export default function TopBar({
  onOpenMobileNav,
  onOpenCommandPalette,
  onSelectSection,
  onNewJob,
  onOpenSystem,
  user,
  onUserChange,
  devRole,
  onDevRoleChange,
  onSignOut,
  theme,
  onToggleTheme,
  currentSection = "coworking",
}: TopBarProps) {
  const [timeString, setTimeString] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
      setTimeString(`${time}`);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  const TABS: { id: WorkbenchSection; label: string; icon?: React.ElementType }[] = [
    { id: "home", label: "Home" },
    { id: "coworking", label: "Coworking" },
    { id: "agent", label: "AI Assistant" },
    { id: "jobs", label: "Task History" },
    { id: "documents", label: "Documents" },
    { id: "outputs", label: "Deliverables" },
    { id: "files", label: "Files" },
    { id: "models", label: "Models" },
    { id: "tools", label: "Tools" },
    { id: "workflows", label: "Pipelines" },
    { id: "compute", label: "Compute" },
    { id: "sandbox", label: "Sandbox" },
    { id: "monitoring", label: "Health" },
    { id: "audit", label: "Audit" },
    { id: "settings", label: "Security" },
  ];

  return (
    <header className="flex flex-col shrink-0 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md select-none">
      {/* Top Row: Greeting, Global Search Pill, AI Assistant & Quick Actions */}
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 gap-3">
        {/* Left: Mobile Toggle & Insight Scope Greeting */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="menu-btn sidebar-toggle flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors md:hidden shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 truncate">
            <span className="text-[13px] font-extrabold text-zinc-900 tracking-tight hidden sm:inline">
              AstraSovereign
            </span>
            <span className="text-zinc-300 hidden sm:inline">•</span>
            <span className="text-[13px] font-semibold text-zinc-600 tracking-tight truncate">
              {timeString || "12:00 PM"}
            </span>
          </div>
        </div>

        {/* Center: Search pill with shortcut (Matching Reference Image) */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-full bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-400 hover:text-zinc-600 transition-all text-xs group cursor-pointer shadow-xs"
            title="Open Command Palette (Ctrl+K)"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400 group-hover:text-purple-600 transition-colors" />
              <span>Search tasks, documents, models...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200 text-[10px] font-mono text-zinc-500 shadow-xs">
              ⌘ K
            </kbd>
          </button>
        </div>

        {/* Right: AI Assistant Button + Actions + Role/User */}
        <div className="flex items-center gap-2 shrink-0">
          {/* AI Assistant Button (Purple Pill Matching Reference Image) */}
          <button
            type="button"
            onClick={() => onSelectSection("agent")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#7047eb] hover:bg-[#5f36dd] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>AI Assistant</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </button>

          {/* Local Air-Gapped Status Button */}
          <button
            type="button"
            onClick={onOpenSystem}
            className="menu-btn flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-emerald-50/70 hover:bg-emerald-100/80 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition-colors cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            <span>Local</span>
          </button>

          {/* Active User Dropdown */}
          <select
            aria-label="Active user"
            value={user}
            onChange={(e) => onUserChange(e.target.value)}
            className="user-select rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-800 transition-colors cursor-pointer focus:outline-none focus:border-purple-500"
          >
            <option value="user-001">Legal Lead (user-001)</option>
            <option value="user-002">Finance Analyst (user-002)</option>
            <option value="admin-001">Security Officer (admin-001)</option>
          </select>

          {/* Dev Role Switcher */}
          <select
            aria-label="Development role"
            title="Development role"
            value={devRole}
            onChange={(e) => onDevRoleChange(e.target.value as "user" | "admin")}
            className="user-select hidden lg:block rounded-xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-mono text-zinc-600 transition-colors cursor-pointer focus:outline-none"
          >
            <option value="user">role: user</option>
            <option value="admin">role: admin</option>
          </select>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="menu-btn flex items-center gap-1 rounded-xl border border-zinc-200 hover:bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>

      {/* Sub-row: Navigation Tabs (Matching Reference Image Tabs) */}
      <div className="flex items-center gap-1 px-4 sm:px-6 overflow-x-auto border-t border-zinc-100 py-1.5 scrollbar-none">
        <div className="flex items-center gap-1 text-xs font-medium text-zinc-600 shrink-0">
          <span className="flex items-center gap-1 font-bold text-zinc-800 pr-2 border-r border-zinc-200">
            Sovereign OS <ChevronDown className="w-3 h-3 text-zinc-400" />
          </span>

          {TABS.map((tab) => {
            const isActive = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSection(tab.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#ede9fe] text-[#6d28d9] font-bold"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onNewJob}
            className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-400 hover:text-purple-600 hover:bg-purple-50 transition-colors ml-1"
            title="Create new task / job"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
