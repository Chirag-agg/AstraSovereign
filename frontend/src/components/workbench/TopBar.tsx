"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
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
  X,
  Code,
  FolderTree,
  Cpu,
  Activity,
  ScrollText,
  User,
} from "lucide-react";
import type { WorkbenchSection } from "./types";

interface CustomTabItem {
  id: string;
  label: string;
  targetSection: WorkbenchSection;
  iconName?: string;
}

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

const SECTION_OPTIONS: { id: WorkbenchSection; label: string }[] = [
  { id: "coworking", label: "Coworking Space" },
  { id: "sandbox", label: "Code Sandbox (Docker)" },
  { id: "workflows", label: "Agent Pipelines" },
  { id: "models", label: "Model Registry" },
  { id: "tools", label: "Local Tools" },
  { id: "compute", label: "Compute & VRAM" },
  { id: "monitoring", label: "System Health" },
  { id: "audit", label: "Audit Evidence" },
  { id: "team", label: "Team & Access Control" },
  { id: "files", label: "Workspace Files" },
  { id: "knowledge", label: "Knowledge Vault" },
];

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
  const [customTabs, setCustomTabs] = useState<CustomTabItem[]>([]);
  const [isAddTabModalOpen, setIsAddTabModalOpen] = useState(false);
  const [newTabLabel, setNewTabLabel] = useState("");
  const [newTabTarget, setNewTabTarget] = useState<WorkbenchSection>("coworking");
  const [userList, setUserList] = useState<{ id: string; label: string; isAdmin?: boolean }[]>([
    { id: "admin-001", label: "Security Officer & Admin (admin-001)", isAdmin: true },
    { id: "user-001", label: "Legal Lead (user-001)" },
    { id: "user-002", label: "Finance Analyst (user-002)" },
    { id: "user-003", label: "Compliance Lead (user-003)" },
    { id: "user-004", label: "Supply Ops (user-004)" },
    { id: "user-005", label: "AI Lead (user-005)" },
  ]);

  // Sync custom employees and administrators dynamically
  useEffect(() => {
    const syncUsers = () => {
      try {
        const custom = window.localStorage.getItem("sovereign.custom-employees");
        if (custom) {
          const parsed = JSON.parse(custom);
          const customEntries = Object.values(parsed) as { userId?: string; name?: string; isAdmin?: boolean }[];
          const baseMap = new Map<string, { id: string; label: string; isAdmin?: boolean }>();

          baseMap.set("admin-001", { id: "admin-001", label: "Security Officer & Admin (admin-001)", isAdmin: true });
          baseMap.set("user-001", { id: "user-001", label: "Legal Lead (user-001)" });
          baseMap.set("user-002", { id: "user-002", label: "Finance Analyst (user-002)" });
          baseMap.set("user-003", { id: "user-003", label: "Compliance Lead (user-003)" });
          baseMap.set("user-004", { id: "user-004", label: "Supply Ops (user-004)" });
          baseMap.set("user-005", { id: "user-005", label: "AI Lead (user-005)" });

          for (const emp of customEntries) {
            if (emp && emp.userId) {
              baseMap.set(emp.userId, {
                id: emp.userId,
                label: `${emp.name || emp.userId} (${emp.userId})${emp.isAdmin ? " [ADMIN]" : ""}`,
                isAdmin: !!emp.isAdmin,
              });
            }
          }
          setUserList(Array.from(baseMap.values()));
        }
      } catch {
        // ignore
      }
    };
    syncUsers();
    window.addEventListener("sovereign:employees-updated", syncUsers);
    window.addEventListener("storage", syncUsers);
    return () => {
      window.removeEventListener("sovereign:employees-updated", syncUsers);
      window.removeEventListener("storage", syncUsers);
    };
  }, []);

  // Close modal on Escape key
  useEffect(() => {
    if (!isAddTabModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsAddTabModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddTabModalOpen]);

  // Load custom tabs from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sovereign.custom-tabs");
      if (saved) {
        setCustomTabs(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveCustomTabs = (tabs: CustomTabItem[]) => {
    setCustomTabs(tabs);
    try {
      window.localStorage.setItem("sovereign.custom-tabs", JSON.stringify(tabs));
    } catch {
      // ignore
    }
  };

  const handleAddCustomTab = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanLabel = newTabLabel.trim();
    if (!cleanLabel) return;

    const newTab: CustomTabItem = {
      id: `custom-tab-${Date.now()}`,
      label: cleanLabel,
      targetSection: newTabTarget,
    };

    const updated = [...customTabs, newTab];
    saveCustomTabs(updated);
    onSelectSection(newTabTarget);
    setIsAddTabModalOpen(false);
    setNewTabLabel("");
  };

  const handleRemoveCustomTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTabs.filter((t) => t.id !== tabId);
    saveCustomTabs(updated);
  };

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
    { id: "agent", label: "AI Assistant" },
    { id: "coworking", label: "Coworking" },
    { id: "sandbox", label: "Sandbox" },
    { id: "knowledge", label: "Knowledge Base" },
    { id: "outputs", label: "Deliverables" },
    { id: "jobs", label: "Task History" },
    { id: "settings", label: "Security" },
  ];

  const isUserAdmin = devRole === "admin" || user.startsWith("admin") || userList.find((u) => u.id === user)?.isAdmin;

  return (
    <header className="flex flex-col shrink-0 border-b border-zinc-800/80 bg-[#0d0d12]/95 backdrop-blur-md select-none relative z-30">
      {/* Top Row: Greeting, Global Search Pill, AI Assistant & Quick Actions */}
      <div className="flex h-14 items-center justify-between px-4 sm:px-6 gap-3">
        {/* Left: Mobile Toggle & AstraSovereign Greeting */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileNav}
            className="menu-btn sidebar-toggle flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors md:hidden shrink-0"
            aria-label="Open sidebar"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 truncate">
            <span className="text-[13.5px] font-semibold text-zinc-300 tracking-tight truncate">
              {timeString || "12:00 PM"}
            </span>
          </div>
        </div>

        {/* Center: Search pill with shortcut */}
        <div className="flex-1 max-w-md hidden md:flex items-center justify-center">
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-4 py-1.5 rounded-full border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-850 text-zinc-400 text-xs transition-all shadow-2xs hover:border-red-900/60 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span>Search workbench or ask assistant...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-950 border border-zinc-800 rounded-md shadow-2xs">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Quick actions, role & identity switcher */}
        <div className="flex items-center gap-2.5">
          {/* Quick System Air-Gap Status Button */}
          <button
            type="button"
            onClick={onOpenSystem}
            aria-label="Local"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-900/60 bg-emerald-950/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-950/50 transition-colors cursor-pointer shadow-2xs"
            title="Local Air-Gap Sovereignty Status"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Air-Gap Protected</span>
          </button>

          {/* Dedicated Operations Admin Console link for Administrators */}
          {isUserAdmin && (
            <Link
              href="/admin"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-red-900/50 bg-red-950/40 hover:bg-red-900/40 text-red-300 text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
              title="Open Operations Console"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
              <span>Admin Console</span>
            </Link>
          )}

          {/* User Account Switcher - dynamically populated */}
          <select
            aria-label="Active department user"
            value={user}
            onChange={(e) => {
              const selectedId = e.target.value;
              onUserChange(selectedId);
              const selected = userList.find((u) => u.id === selectedId);
              if (selected?.isAdmin) {
                onDevRoleChange("admin");
              }
            }}
            className="user-select hidden sm:block rounded-xl border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer focus:outline-none focus:border-red-600"
          >
            {userList.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={onSignOut}
            aria-label="Sign out"
            className="menu-btn flex items-center gap-1 rounded-xl border border-zinc-800 hover:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>

          {/* Windows 11 Window Controls */}
          <div className="hidden sm:flex items-center ml-1 pl-2 border-l border-zinc-800 gap-0.5">
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Minimize"
              onClick={() => onSelectSection("home")}
            >
              <span className="block w-3 h-0.5 bg-current rounded-full" />
            </button>
            <button
              type="button"
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Maximize / Restore"
            >
              <span className="block w-2.5 h-2.5 border border-current rounded-xs" />
            </button>
            <button
              type="button"
              onClick={onNewJob}
              className="p-1.5 rounded-lg hover:bg-red-600 hover:text-white text-zinc-400 transition-colors cursor-pointer"
              title="Close / New Task"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Sub-row: Navigation Tabs & Worker Custom Tabs (hidden in AI Chatbot mode for a clean single-row header) */}
      {currentSection !== "agent" && (
        <div className="flex items-center gap-1 px-4 sm:px-6 overflow-x-auto border-t border-zinc-800/60 py-1.5 scrollbar-none bg-[#0a0a0d]">
        <div className="flex items-center gap-1 text-xs font-medium text-zinc-400 shrink-0">
          <span className="flex items-center gap-1 font-bold text-zinc-200 pr-2 border-r border-zinc-800">
            AstraSovereign <ChevronDown className="w-3 h-3 text-zinc-500" />
          </span>

          {/* Standard Navigation Tabs */}
          {TABS.map((tab) => {
            const isActive = currentSection === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectSection(tab.id)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                  isActive
                    ? "bg-red-950/60 text-red-300 font-bold border border-red-800/50 shadow-[0_0_8px_rgba(239,68,68,0.2)]"
                    : "text-zinc-400 hover:bg-zinc-850 hover:text-zinc-200"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}

          {/* Worker Custom Tabs */}
          {customTabs.map((ct) => {
            const isActive = currentSection === ct.targetSection;
            return (
              <div
                key={ct.id}
                onClick={() => onSelectSection(ct.targetSection)}
                className={`group flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs transition-all cursor-pointer border ${
                  isActive
                    ? "bg-red-950/50 text-red-200 font-bold border-red-700/60"
                    : "bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 border-zinc-800"
                }`}
              >
                <Sparkles className="w-3 h-3 text-red-400 shrink-0" />
                <span>{ct.label}</span>
                <button
                  type="button"
                  onClick={(e) => handleRemoveCustomTab(ct.id, e)}
                  className="w-3.5 h-3.5 rounded-full hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors ml-0.5"
                  title="Remove custom tab"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            );
          })}

          {/* + Button: Allows workers to add custom tabs customized to their needs */}
          <button
            type="button"
            onClick={() => setIsAddTabModalOpen(true)}
            className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors ml-1 border border-zinc-800 hover:border-red-800 cursor-pointer"
            title="Add customizable workbench tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      )}

      {/* Modal: Add Worker Custom Tab (Properly centered & framed, never clipped) */}
      {isAddTabModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-16 sm:pt-24 bg-black/70 backdrop-blur-xs p-4 animate-fade-in"
          onClick={() => setIsAddTabModalOpen(false)}
        >
          <div
            className="bg-[#111115] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-800 space-y-4 max-h-[85vh] overflow-y-auto text-zinc-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-red-950/50 border border-red-800/60 flex items-center justify-center text-red-500">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Add Workspace Tab</h3>
                  <p className="text-xs text-zinc-400">Pin your favorite feature or tool to the top bar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTabModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Feature Presets */}
            <div>
              <label className="block font-semibold text-zinc-300 mb-2">Choose Feature to Add</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { label: "Code Sandbox", target: "sandbox", icon: Code, desc: "Docker runner" },
                  { label: "Coworking Space", target: "coworking", icon: Users2, desc: "Team clearance" },
                  { label: "Audit Evidence", target: "audit", icon: ScrollText, desc: "Compliance log" },
                  { label: "Compute Telemetry", target: "compute", icon: Cpu, desc: "VRAM & GPU" },
                  { label: "AI Assistant", target: "agent", icon: Bot, desc: "Technical agent" },
                  { label: "Knowledge Vault", target: "knowledge", icon: BookOpen, desc: "Doc embeddings" },
                  { label: "Deliverables", target: "outputs", icon: FileCheck, desc: "Signed outputs" },
                  { label: "Team & Roles", target: "team", icon: ShieldCheck, desc: "Access control" },
                  { label: "System Health", target: "monitoring", icon: Activity, desc: "Health diagnostics" },
                ].map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = newTabTarget === preset.target;
                  return (
                    <button
                      key={preset.target}
                      type="button"
                      onClick={() => {
                        setNewTabTarget(preset.target as WorkbenchSection);
                        setNewTabLabel(preset.label);
                      }}
                      className={`flex flex-col items-start p-2.5 rounded-2xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "border-red-600 bg-red-950/40 ring-1 ring-red-500 shadow-2xs text-white"
                          : "border-zinc-800 hover:border-red-900/50 hover:bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-red-400" : "text-zinc-500"}`} />
                        <span className="truncate">{preset.label}</span>
                      </div>
                      <span className="text-[10.5px] text-zinc-500 mt-0.5">{preset.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Tab Form */}
            <form onSubmit={handleAddCustomTab} className="space-y-3.5 text-xs pt-2 border-t border-zinc-800">
              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Tab Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Sandbox, Audit Log, AI Lead..."
                  value={newTabLabel}
                  onChange={(e) => setNewTabLabel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-red-500 text-xs text-zinc-100 bg-zinc-950"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-300 mb-1">Target Section</label>
                <select
                  value={newTabTarget}
                  onChange={(e) => setNewTabTarget(e.target.value as WorkbenchSection)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-red-500 text-xs cursor-pointer bg-zinc-950 text-zinc-200"
                >
                  {SECTION_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddTabModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-800 hover:bg-zinc-800 text-zinc-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Pin Tab to Top Bar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
