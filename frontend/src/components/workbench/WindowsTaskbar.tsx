"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bot,
  Library,
  Code,
  Archive,
  FolderTree,
  Users2,
  ScrollText,
  ShieldCheck,
  Search,
  CheckCircle2,
  Radio,
  Clock,
  XCircle,
  AlertCircle,
  LogOut,
  Sparkles,
  RefreshCw,
  Sliders,
  Maximize2,
  Minimize2,
  X,
  User,
  Power,
  Layers,
  ChevronUp,
  Settings,
} from "lucide-react";
import type { WorkbenchSection } from "./types";
import type { JobSummary } from "@/lib/types";

interface WindowsTaskbarProps {
  currentSection: WorkbenchSection;
  onSelectSection: (section: WorkbenchSection) => void;
  onNewJob: () => void;
  jobs: JobSummary[] | null;
  activeJobId: string | null;
  onSelectJob: (jobId: string) => void;
  onOpenSystem: () => void;
  onOpenCommandPalette: () => void;
  user: string;
  onUserChange: (user: string) => void;
  devRole: "user" | "admin";
  onDevRoleChange: (role: "user" | "admin") => void;
  onSignOut: () => void;
  running: boolean;
  healthError: string | null;
  wallpaper?: string;
  onWallpaperChange?: (wp: string) => void;
  wallpaperOpacity?: number;
  onWallpaperOpacityChange?: (opacity: number) => void;
}

const APPS: { id: WorkbenchSection; label: string; icon: React.ElementType }[] = [
  { id: "agent", label: "Assistant", icon: Bot },
  { id: "knowledge", label: "Knowledge Vault", icon: Library },
  { id: "sandbox", label: "Code Sandbox", icon: Code },
  { id: "outputs", label: "Deliverables", icon: Archive },
  { id: "files", label: "Files", icon: FolderTree },
  { id: "coworking", label: "Coworking", icon: Users2 },
  { id: "audit", label: "Audit Evidence", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "profile", label: "Profile", icon: User },
];

export const WALLPAPER_PRESETS = [
  { id: "crimson-void", name: "Crimson Void", preview: "from-[#450a0a] to-[#09090b]", bg: "radial-gradient(ellipse at top left, #450a0a 0%, #1c0505 50%, #09090b 100%)" },
  { id: "obsidian-red", name: "Obsidian Matrix", preview: "from-[#18181b] to-[#09090b]", bg: "radial-gradient(circle at 50% 30%, #271010 0%, #111115 65%, #050507 100%)" },
  { id: "carbon-ruby", name: "Carbon Ruby", preview: "from-[#7f1d1d] to-[#09090b]", bg: "linear-gradient(135deg, #180505 0%, #300a0a 45%, #09090b 100%)" },
  { id: "dark-stealth", name: "Stealth Black", preview: "from-[#27272a] to-[#09090b]", bg: "radial-gradient(ellipse at 50% 20%, #18181b 0%, #0f0f12 60%, #050507 100%)" },
];

export default function WindowsTaskbar({
  currentSection,
  onSelectSection,
  onNewJob,
  jobs,
  activeJobId,
  onSelectJob,
  onOpenSystem,
  onOpenCommandPalette,
  user,
  onUserChange,
  devRole,
  onDevRoleChange,
  onSignOut,
  running,
  healthError,
  wallpaper = "slate-mesh",
  onWallpaperChange,
  wallpaperOpacity = 18,
  onWallpaperOpacityChange,
}: WindowsTaskbarProps) {
  const [startMenuOpen, setStartMenuOpen] = useState(false);
  const [timeString, setTimeString] = useState("");
  const [dateString, setDateString] = useState("");
  const startMenuRef = useRef<HTMLDivElement>(null);

  // Live Digital Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
      );
      setDateString(
        now.toLocaleDateString([], { month: "numeric", day: "numeric", year: "numeric" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  // Close start menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startMenuRef.current && !startMenuRef.current.contains(e.target as Node)) {
        setStartMenuOpen(false);
      }
    };
    if (startMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [startMenuOpen]);

  const isAdmin = devRole === "admin" || user.startsWith("admin");

  return (
    <>
      {/* 1. WINDOWS STYLE START MENU */}
      {startMenuOpen && (
        <div
          ref={startMenuRef}
          className="fixed bottom-14 left-2 sm:left-4 z-50 w-[96vw] max-w-md sm:max-w-lg bg-[#0d0d12]/95 backdrop-blur-2xl rounded-2xl border border-zinc-800 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] p-5 flex flex-col space-y-4 animate-in slide-in-from-bottom-5 duration-200 select-none text-zinc-200"
        >
          {/* Start Menu Search Bar */}
          <button
            type="button"
            onClick={() => {
              setStartMenuOpen(false);
              onOpenCommandPalette();
            }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 text-xs transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <span>Search apps, knowledge, commands...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-zinc-950 rounded border border-zinc-800 text-zinc-400">
              Ctrl K
            </kbd>
          </button>

          {/* Pinned Applications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-zinc-400 px-1">
              <span>Pinned Modules</span>
              <button
                type="button"
                onClick={() => {
                  onNewJob();
                  onSelectSection("agent");
                  setStartMenuOpen(false);
                }}
                className="text-red-400 hover:text-red-300 font-semibold lowercase transition-colors cursor-pointer text-xs"
              >
                + new task
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {APPS.map((app) => {
                const Icon = app.icon;
                const isActive = currentSection === app.id;
                return (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => {
                      onSelectSection(app.id);
                      setStartMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      isActive
                        ? "bg-red-950/40 text-red-300 border border-red-800/60 shadow-xs"
                        : "hover:bg-zinc-850 text-zinc-300 border border-transparent"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-xs ${
                        isActive
                          ? "bg-gradient-to-br from-red-600 to-red-700 text-white shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                          : "bg-zinc-850 text-zinc-300 border border-zinc-800"
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="text-[11px] font-medium truncate max-w-full">
                      {app.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Wallpaper Customizer */}
          {onWallpaperChange && (
            <div className="space-y-2 pt-2 border-t border-zinc-800">
              <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-zinc-400 px-1">
                <span className="flex items-center gap-1.5">
                  <Sliders className="w-3 h-3 text-red-400" />
                  <span>Desktop Backdrop</span>
                </span>
                {onWallpaperOpacityChange && (
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                    <span>fade: {wallpaperOpacity}%</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {WALLPAPER_PRESETS.map((wp) => {
                  const isSelected = wallpaper === wp.id;
                  return (
                    <button
                      key={wp.id}
                      type="button"
                      onClick={() => onWallpaperChange(wp.id)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all text-center border cursor-pointer truncate ${
                        isSelected
                          ? "bg-red-950/60 border-red-600 text-red-200 shadow-xs"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
                      }`}
                      title={wp.name}
                    >
                      {wp.name}
                    </button>
                  );
                })}
              </div>
              {onWallpaperOpacityChange && (
                <div className="px-1 pt-1 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono">Intensity</span>
                  <input
                    type="range"
                    min="5"
                    max="45"
                    value={wallpaperOpacity}
                    onChange={(e) => onWallpaperOpacityChange(Number(e.target.value))}
                    className="flex-1 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                </div>
              )}
            </div>
          )}

          {/* Recent Tasks in Start Menu */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase text-zinc-400 px-1">
              <span>Recent Tasks</span>
              <span className="text-[10px] font-mono">{jobs ? jobs.length : 0}</span>
            </div>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {!jobs || jobs.length === 0 ? (
                <div className="p-3 text-center text-xs text-zinc-500 italic">
                  No previous tasks recorded.
                </div>
              ) : (
                jobs.slice(0, 4).map((job) => {
                  const active = activeJobId === job.job_id;
                  return (
                    <button
                      key={job.job_id}
                      type="button"
                      onClick={() => {
                        onSelectJob(job.job_id);
                        onSelectSection("agent");
                        setStartMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        active
                          ? "bg-red-950/60 text-red-300 border border-red-800/60 font-semibold"
                          : "text-zinc-300 hover:bg-zinc-850"
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <div className="min-w-0 flex-1 truncate">
                        <span className="block truncate text-xs font-medium">
                          {job.message || "Untitled Task"}
                        </span>
                        <span className="block text-[10px] text-zinc-500 font-mono truncate">
                          {job.job_id}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer User Info & Power */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                onSelectSection("profile");
                setStartMenuOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer group text-left"
            >
              <div className="w-8 h-8 rounded-xl bg-zinc-950 border border-red-600/40 text-red-400 flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-white block group-hover:text-red-400 transition-colors">
                  {user === "user-001" ? "Alex Rivera" : user === "user-002" ? "Sarah Chen" : user}
                </span>
                <span className="text-[10px] font-mono text-zinc-400 block">
                  EMP ID: {user}
                </span>
              </div>
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  onSelectSection("settings");
                  setStartMenuOpen(false);
                }}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                title="System & Theme Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setStartMenuOpen(false);
                }}
                className="p-2 rounded-xl text-red-400 hover:text-white hover:bg-red-600 transition-colors cursor-pointer"
                title="Sign Out of Sovereign Session"
              >
                <Power className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. DOCKED WINDOWS DESKTOP TASKBAR (Black & Red Translucent) */}
      <footer className="shrink-0 h-11 w-full bg-[#0a0a0c]/90 backdrop-blur-xl border-t border-red-950/30 px-2 sm:px-4 flex items-center justify-between text-zinc-300 select-none z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
        {/* Left Area: Windows Start Button + Quick Search */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Windows / Sovereign Start Icon Button */}
          <button
            type="button"
            onClick={() => setStartMenuOpen(!startMenuOpen)}
            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all cursor-pointer ${
              startMenuOpen
                ? "bg-red-950/60 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)] border border-red-800/60"
                : "hover:bg-zinc-850 text-zinc-300 hover:text-white active:scale-95"
            }`}
            title="Astra Sovereign Start Menu"
          >
            <div className="grid grid-cols-2 gap-0.5 w-4 h-4">
              <span className="rounded-xs bg-red-500" />
              <span className="rounded-xs bg-red-600" />
              <span className="rounded-xs bg-rose-500" />
              <span className="rounded-xs bg-red-700" />
            </div>
          </button>

          {/* Quick Search Pill */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs transition-colors cursor-pointer shadow-xs"
            title="Search Workspace (Ctrl K)"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden md:inline">Search</span>
          </button>

          {/* Taskbar App Icons */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {APPS.slice(0, 5).map((app) => {
              const Icon = app.icon;
              const isActive = currentSection === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => onSelectSection(app.id)}
                  className={`group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all cursor-pointer ${
                    isActive
                      ? "bg-zinc-900 text-red-400 shadow-xs border border-red-950/60"
                      : "hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 active:scale-95"
                  }`}
                  title={app.label}
                >
                  <Icon className="w-4 h-4" />
                  {/* Active App Indicator Pill */}
                  {isActive && (
                    <span className="absolute bottom-0.5 w-3 h-0.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Area: System Tray (Air-gap, Clock, User) */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Air-Gap Sovereignty Status Button */}
          <button
            type="button"
            onClick={onOpenSystem}
            aria-label="Taskbar Air-Gap Status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-900/60 bg-emerald-950/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-950/50 transition-colors cursor-pointer"
            title="Local Air-Gap Sovereignty Status"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden lg:inline text-[11px]">Air-Gapped</span>
          </button>

          {/* Active Job State Indicator on Taskbar */}
          {running && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[11px]">Executing</span>
            </div>
          )}

          {/* User Role Switcher Dropdown */}
          <select
            aria-label="Taskbar department user"
            value={user}
            onChange={(e) => {
              const selectedId = e.target.value;
              onUserChange(selectedId);
              if (selectedId.startsWith("admin")) {
                onDevRoleChange("admin");
              }
            }}
            className="hidden sm:block rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer focus:outline-none focus:border-red-600"
          >
            <option value="user-001">Legal Lead (user-001)</option>
            <option value="user-002">Finance Analyst (user-002)</option>
            <option value="user-003">Compliance Lead (user-003)</option>
            <option value="user-004">Supply Ops (user-004)</option>
            <option value="user-005">AI Lead (user-005)</option>
            <option value="admin-001">Admin Officer (admin-001)</option>
          </select>

          {/* Quick Profile Badge Button */}
          <button
            type="button"
            onClick={() => onSelectSection("profile")}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 transition-all cursor-pointer group"
            title={`Employee Profile • ID: ${user}`}
          >
            <div className="w-5 h-5 rounded-md bg-zinc-950 border border-zinc-800 text-red-500 text-[10px] font-bold flex items-center justify-center group-hover:border-red-600">
              <User className="w-3 h-3" />
            </div>
            <span className="hidden xl:inline text-[11px] font-mono text-zinc-300">
              {user}
            </span>
          </button>

          {/* Settings Shortcut Button in Tray */}
          <button
            type="button"
            onClick={() => onSelectSection("settings")}
            className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Theme & Model Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Live Clock / Date Box */}
          <div
            onClick={onOpenSystem}
            className="flex flex-col items-end justify-center px-2 py-0.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer text-zinc-300"
            title="System Time & Date"
          >
            <span className="text-xs font-bold leading-tight text-white">{timeString || "12:00 PM"}</span>
            <span className="text-[10px] text-zinc-400 leading-none">{dateString || "Today"}</span>
          </div>

          {/* Desktop Peek Line at the very end */}
          <div
            onClick={onNewJob}
            className="w-1 h-6 rounded-full bg-zinc-800 hover:bg-red-500 transition-colors cursor-pointer ml-1 shadow-[0_0_4px_rgba(239,68,68,0.5)]"
            title="Desktop Peek / Reset Workspace"
          />
        </div>
      </footer>
    </>
  );
}
