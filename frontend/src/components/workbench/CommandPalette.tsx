"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  LayoutDashboard,
  Layers,
  Terminal,
  Cpu,
  Wrench,
  Workflow,
  Library,
  FileText,
  FolderTree,
  Archive,
  Server,
  Activity,
  ScrollText,
  Settings,
  Plus,
  Shield,
  Users,
  X,
} from "lucide-react";
import type { WorkbenchSection } from "./types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSection: (section: WorkbenchSection) => void;
  onNewJob: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  category: "Navigation" | "Actions";
  icon: React.ElementType;
  action: () => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectSection,
  onNewJob,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) onClose();
      } else if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const COMMANDS: CommandItem[] = [
    {
      id: "action-new-job",
      label: "+ New Agent Job",
      category: "Actions",
      icon: Plus,
      action: () => {
        onNewJob();
        onClose();
      },
    },
    {
      id: "nav-dashboard",
      label: "Go to Command Center (Dashboard)",
      category: "Navigation",
      icon: LayoutDashboard,
      action: () => {
        onSelectSection("dashboard");
        onClose();
      },
    },
    {
      id: "nav-jobs",
      label: "Go to Jobs Operations",
      category: "Navigation",
      icon: Layers,
      action: () => {
        onSelectSection("jobs");
        onClose();
      },
    },
    {
      id: "nav-agent",
      label: "Go to Agent Workspace (AI Studio IDE)",
      category: "Navigation",
      icon: Terminal,
      action: () => {
        onSelectSection("agent");
        onClose();
      },
    },
    {
      id: "nav-models",
      label: "Go to Model Router & Registry",
      category: "Navigation",
      icon: Cpu,
      action: () => {
        onSelectSection("models");
        onClose();
      },
    },
    {
      id: "nav-tools",
      label: "Go to Registered Local Tools",
      category: "Navigation",
      icon: Wrench,
      action: () => {
        onSelectSection("tools");
        onClose();
      },
    },
    {
      id: "nav-workflows",
      label: "Go to Workflow Canvas",
      category: "Navigation",
      icon: Workflow,
      action: () => {
        onSelectSection("workflows");
        onClose();
      },
    },
    {
      id: "nav-knowledge",
      label: "Go to Knowledge Base & Vectors",
      category: "Navigation",
      icon: Library,
      action: () => {
        onSelectSection("knowledge");
        onClose();
      },
    },
    {
      id: "nav-outputs",
      label: "Go to Output Deliverables Center",
      category: "Navigation",
      icon: Archive,
      action: () => {
        onSelectSection("outputs");
        onClose();
      },
    },
    {
      id: "nav-compute",
      label: "Go to Compute & Hardware Telemetry",
      category: "Navigation",
      icon: Server,
      action: () => {
        onSelectSection("compute");
        onClose();
      },
    },
    {
      id: "nav-audit",
      label: "Go to Tamper-Evident Audit Logs",
      category: "Navigation",
      icon: ScrollText,
      action: () => {
        onSelectSection("audit");
        onClose();
      },
    },
    {
      id: "nav-coworking",
      label: "Go to Coworking Space & Authorization",
      category: "Navigation",
      icon: Users,
      action: () => {
        onSelectSection("coworking");
        onClose();
      },
    },
    {
      id: "nav-sandbox",
      label: "Go to Code Execution Sandbox (Docker)",
      category: "Navigation",
      icon: Terminal,
      action: () => {
        onSelectSection("sandbox");
        onClose();
      },
    },
    {
      id: "nav-settings",
      label: "Go to Air-Gap Security Console",
      category: "Navigation",
      icon: Shield,
      action: () => {
        onSelectSection("settings");
        onClose();
      },
    },
  ];

  const filtered = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/30 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden font-sans text-xs flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or jump to workbench section..."
            className="flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 outline-none text-xs"
          />
          <kbd className="px-1.5 py-0.5 rounded-md border border-slate-200 text-[10px] font-mono text-slate-400 bg-slate-50">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-xs">
              No matching commands found.
            </div>
          ) : (
            filtered.map((cmd) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.action}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-blue-50 transition-colors text-slate-700 hover:text-blue-900 cursor-pointer group"
                >
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-[#2563eb] transition-colors" />
                  <span className="flex-1 font-medium">{cmd.label}</span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider group-hover:text-blue-600">
                    {cmd.category}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 flex justify-between bg-slate-50/50">
          <span>Navigate with click</span>
          <span>Command Palette</span>
        </div>
      </div>
    </div>
  );
}
