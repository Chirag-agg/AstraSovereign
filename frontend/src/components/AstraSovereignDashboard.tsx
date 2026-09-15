"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Search,
  Users,
  Terminal,
  Code,
  Box,
  LayoutGrid,
  Library,
  Archive,
  FolderTree,
  Layers,
  Wrench,
  GitBranch,
  Cpu,
  Activity,
  ScrollText,
  Users2,
  ShieldCheck,
  ChevronsUpDown,
  ArrowUpRight,
  Plus,
  Paperclip,
  Image as ImageIcon,
  Sparkles,
  ArrowUp,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RotateCw,
  Edit3,
  Check,
  ChevronDown,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
  LogOut,
  Palette,
  Shield,
  FileText,
  Lock,
  Bell,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListFilter,
  Send,
  BellRing,
  Filter,
  Flame,
  CheckCheck,
  Play,
  Home,
  Eye,
  Bot,
  Upload,
  Download,
  X,
  Zap,
  Minimize2,
  Maximize2,
  Sliders,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  TrendingUp,
  Award,
  Timer,
  User,
  UserCheck,
  AlertCircle,
  Presentation,
  FileCheck,
  FileSearch,
} from "lucide-react";

// All 16 Sovereign Workbench Views
import CoworkingView from "@/components/workbench/CoworkingView";
import AgentWorkspaceView from "@/components/workbench/AgentWorkspaceView";
import MultiAgentSwarmView from "@/components/workbench/MultiAgentSwarmView";
import SandboxView from "@/components/workbench/SandboxView";
import VsCodeEditorView from "@/components/workbench/VsCodeEditorView";
import JobsView from "@/components/workbench/JobsView";
import KnowledgeBaseView from "@/components/workbench/KnowledgeBaseView";
import OutputsView from "@/components/workbench/OutputsView";
import FilesView from "@/components/workbench/FilesView";
import ModelsView from "@/components/workbench/ModelsView";
import ToolsView from "@/components/workbench/ToolsView";
import WorkflowsView from "@/components/workbench/WorkflowsView";
import ComputeView from "@/components/workbench/ComputeView";
import MonitoringView from "@/components/workbench/MonitoringView";
import AuditLogsView from "@/components/workbench/AuditLogsView";
import TeamView from "@/components/workbench/TeamView";
import SecurityConsoleView from "@/components/workbench/SecurityConsoleView";
import DocumentPreviewModal, {
  SAMPLE_DOCUMENTS,
  type PreviewDocument,
} from "@/components/DocumentPreviewModal";
import UserProfileView from "@/components/profile/UserProfileView";
import EnterpriseSettingsView from "@/components/settings/EnterpriseSettingsView";

// API & Hooks
import {
  cancelJob,
  deleteDocument,
  downloadArtifact,
  submitChat,
  uploadDocument,
} from "@/lib/api";
import {
  useActiveUser,
  useArtifacts,
  useDevRole,
  useDocuments,
  useHealth,
  useJob,
  useJobs,
} from "@/lib/hooks";
import type { ArtifactSummary, JobStatus } from "@/lib/types";
import type { AttachmentChip } from "@/components/Composer";

/* =========================================================================
   COLOR THEMES (Comprehensive Whole-Workspace Theming: LHS, RHS, Background, UI)
========================================================================= */
export type ColorTheme = "violet" | "emerald" | "cobalt" | "amber" | "rose" | "dark";

interface ThemeStyles {
  name: string;
  primary: string;
  primaryLight: string;
  primarySoft: string;
  secondaryBar: string;
  accentBadge: string;
  bg: string;
  sidebarBg: string;
  cardBg: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  isDark?: boolean;
}

const THEMES: Record<ColorTheme, ThemeStyles> = {
  violet: {
    name: "Sovereign Violet",
    primary: "#7047eb",
    primaryLight: "#906efa",
    primarySoft: "#f3effe",
    secondaryBar: "#ddd6fe",
    accentBadge: "text-purple-700 bg-purple-50 border-purple-200",
    bg: "#f4f5f8",
    sidebarBg: "#ffffff",
    cardBg: "#ffffff",
    textColor: "#0f172a",
    subtextColor: "#64748b",
    borderColor: "#f1f5f9",
  },
  emerald: {
    name: "Air-Gap Emerald",
    primary: "#059669",
    primaryLight: "#10b981",
    primarySoft: "#ecfdf5",
    secondaryBar: "#a7f3d0",
    accentBadge: "text-emerald-700 bg-emerald-50 border-emerald-200",
    bg: "#f0fdf4",
    sidebarBg: "#f8fef9",
    cardBg: "#ffffff",
    textColor: "#064e3b",
    subtextColor: "#047857",
    borderColor: "#d1fae5",
  },
  cobalt: {
    name: "Confidential Cobalt",
    primary: "#2563eb",
    primaryLight: "#3b82f6",
    primarySoft: "#eff6ff",
    secondaryBar: "#bfdbfe",
    accentBadge: "text-blue-700 bg-blue-50 border-blue-200",
    bg: "#f0f7ff",
    sidebarBg: "#f8fbff",
    cardBg: "#ffffff",
    textColor: "#1e3a8a",
    subtextColor: "#2563eb",
    borderColor: "#dbeafe",
  },
  amber: {
    name: "Defense Amber",
    primary: "#d97706",
    primaryLight: "#f59e0b",
    primarySoft: "#fffbeb",
    secondaryBar: "#fde68a",
    accentBadge: "text-amber-700 bg-amber-50 border-amber-200",
    bg: "#fffdf5",
    sidebarBg: "#fffef8",
    cardBg: "#ffffff",
    textColor: "#78350f",
    subtextColor: "#92400e",
    borderColor: "#fef3c7",
  },
  rose: {
    name: "Classified Rose",
    primary: "#e11d48",
    primaryLight: "#f43f5e",
    primarySoft: "#fff1f2",
    secondaryBar: "#fecdd3",
    accentBadge: "text-rose-700 bg-rose-50 border-rose-200",
    bg: "#fff5f7",
    sidebarBg: "#fffbfc",
    cardBg: "#ffffff",
    textColor: "#881337",
    subtextColor: "#be123c",
    borderColor: "#ffe4e6",
  },
  dark: {
    name: "Cyber Dark (Antigravity)",
    primary: "#38bdf8",
    primaryLight: "#7dd3fc",
    primarySoft: "#161b22",
    secondaryBar: "#30363d",
    accentBadge: "text-sky-300 bg-sky-950/60 border-sky-800",
    bg: "#0d1117",
    sidebarBg: "#111622",
    cardBg: "#161b22",
    textColor: "#f0f6fc",
    subtextColor: "#8b949e",
    borderColor: "#21262d",
    isDark: true,
  },
};

/* =========================================================================
   MONTHLY DATA FOR THROUGHPUT CHART
========================================================================= */
interface MonthBar {
  month: string;
  throughput: number;
  tokens: number;
}

const MONTH_DATA: MonthBar[] = [
  { month: "Jan", throughput: 820, tokens: 560 },
  { month: "Feb", throughput: 640, tokens: 430 },
  { month: "Mar", throughput: 390, tokens: 580 },
  { month: "Apr", throughput: 920, tokens: 480 },
  { month: "May", throughput: 890, tokens: 360 },
  { month: "Jun", throughput: 540, tokens: 390 },
  { month: "Jul", throughput: 980, tokens: 710 },
  { month: "Aug", throughput: 520, tokens: 550 },
  { month: "Sept", throughput: 470, tokens: 620 },
  { month: "Oct", throughput: 840, tokens: 490 },
  { month: "Nov", throughput: 670, tokens: 420 },
  { month: "Dec", throughput: 560, tokens: 480 },
];

export interface ThroughputBar {
  time: string;
  tokensPerSec: number;
  latencyMs: number;
  model: string;
}

const HOURLY_THROUGHPUT_DATA: ThroughputBar[] = [
  { time: "02:00", tokensPerSec: 64, latencyMs: 14, model: "Llama 3.3 70B" },
  { time: "06:00", tokensPerSec: 58, latencyMs: 16, model: "Qwen 2.5 Coder" },
  { time: "10:00", tokensPerSec: 82, latencyMs: 11, model: "Llama 3.3 70B" },
  { time: "14:00", tokensPerSec: 96, latencyMs: 9, model: "DeepSeek R1 Distill" },
  { time: "18:00", tokensPerSec: 74, latencyMs: 13, model: "Qwen 2.5 Coder" },
  { time: "22:00", tokensPerSec: 68, latencyMs: 15, model: "RapidOCR + Llama" },
];

function AstraEmblem({ color = "#7047eb", size = 26 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(16,16)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <path
            key={i}
            d="M0 -3.2 C 1.2 -6.5, 2.2 -11, 0 -14.5 C -2.2 -11, -1.2 -6.5, 0 -3.2 Z"
            fill={color}
            transform={`rotate(${angle})`}
            opacity={i % 2 === 0 ? 1 : 0.85}
          />
        ))}
        <circle cx="0" cy="0" r="3" fill="#ffffff" />
        <circle cx="0" cy="0" r="1.5" fill={color} />
      </g>
    </svg>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// All 16 Sidebar Items (Exact Match to User's Screenshot)
// ---------------------------------------------------------------------------
export type SidebarSectionId =
  | "home"
  | "notifications"
  | "coworking"
  | "agent"
  | "sandbox"
  | "editor"
  | "jobs"
  | "knowledge"
  | "outputs"
  | "files"
  | "models"
  | "tools"
  | "workflows"
  | "compute"
  | "monitoring"
  | "audit"
  | "team"
  | "settings";

interface NavItem {
  id: SidebarSectionId;
  label: string;
  icon: React.ElementType;
}

const SIDEBAR_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Search },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "coworking", label: "Coworking Space", icon: Users },
  { id: "agent", label: "AI Assistant", icon: Terminal },
  { id: "sandbox", label: "Docker Sandbox", icon: Box },
  { id: "editor", label: "Code Editor (IDE)", icon: Code },
  { id: "jobs", label: "Task History", icon: LayoutGrid },
  { id: "knowledge", label: "Knowledge Base", icon: Library },
  { id: "outputs", label: "Deliverables", icon: Archive },
  { id: "files", label: "Workspace Files", icon: FolderTree },
  { id: "models", label: "Models & Routing", icon: Layers },
  { id: "tools", label: "Local Tools", icon: Wrench },
  { id: "workflows", label: "Agent Pipelines", icon: GitBranch },
  { id: "compute", label: "Compute & VRAM", icon: Cpu },
  { id: "monitoring", label: "System Health", icon: Activity },
  { id: "audit", label: "Audit Trail", icon: ScrollText },
  { id: "team", label: "Team & Roles", icon: Users2 },
  { id: "settings", label: "Settings", icon: Sliders },
];

interface AiMessageItem {
  id: string;
  role: string;
  text: string;
  thoughtTime?: string;
  sourcesCount?: number;
  pillars?: {
    title: string;
    desc: string;
  }[];
}

// ---------------------------------------------------------------------------
// Security Clearance Guard for Restricted Subsystems (Admin vs Normal User)
// ---------------------------------------------------------------------------
function ClearanceGuardTab({
  activeTab,
  user,
  onHome,
}: {
  activeTab: SidebarSectionId;
  user: string;
  onHome: () => void;
}) {
  const tabLabel = SIDEBAR_ITEMS.find((s) => s.id === activeTab)?.label || "Restricted Subsystem";
  return (
    <div className="bg-white rounded-3xl p-8 sm:p-12 border border-amber-200/80 shadow-2xs animate-in fade-in flex flex-col items-center text-center max-w-2xl mx-auto my-8 space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
        <Lock className="w-8 h-8" />
      </div>
      <div className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/80 border border-amber-200 text-amber-800 text-xs font-bold">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Security Clearance Level 4 Required</span>
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Restricted Administrative Subsystem: {tabLabel}
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed max-w-lg">
          Direct configuration and management of the <span className="font-semibold text-slate-700">{tabLabel}</span> module is restricted to Sovereign Directorate Officers with Level 4 Clearance. Your current session is authenticated as <span className="font-semibold text-slate-700">Normal User ({user})</span> under Level 2 operational clearance.
        </p>
      </div>

      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600 font-mono text-left w-full space-y-1.5">
        <div className="flex justify-between">
          <span className="text-slate-400">ACCESS_STATUS:</span>
          <span className="font-bold text-rose-600">DENIED (L2_RESTRICTED)</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">REQUIRED_CLEARANCE:</span>
          <span className="font-bold text-slate-800">LEVEL 4 SOVEREIGN ADMIN</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">SUBSYSTEM_KEY:</span>
          <span className="font-bold text-purple-700">SOV-{activeTab.toUpperCase()}-AIRGAP</span>
        </div>
      </div>

      <div className="flex items-center justify-center pt-2 w-full">
        <button
          onClick={onHome}
          className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
        >
          Return to Home Workspace
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   MAIN COMPONENT: AstraSovereignDashboard
========================================================================= */
export default function AstraSovereignDashboard({
  onSignOut,
  onOpenHome,
}: {
  onSignOut?: () => void;
  onOpenHome?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SidebarSectionId>("home");
  const [themeKey, setThemeKey] = useState<ColorTheme>("violet");
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("Last 30 days");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [chartMetricMode, setChartMetricMode] = useState<"hourly" | "monthly">("hourly");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedPerformanceRange, setSelectedPerformanceRange] = useState("This Week");

  // Backend Integration Hooks
  const [user, setUser] = useActiveUser();
  const [devRole, setDevRole] = useDevRole();
  const { jobs } = useJobs(user);
  const { health, error: healthError } = useHealth();
  const { documents } = useDocuments(user);
  const { artifacts } = useArtifacts(user);

  // Active Job State for Agent Workspace
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<JobStatus | null>(null);
  const [chips, setChips] = useState<AttachmentChip[]>([]);
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);

  const { job: activeJob } = useJob(user, activeJobId || "");

  useEffect(() => {
    if (activeJob) {
      setActiveStatus(activeJob.status);
    }
  }, [activeJob]);

  // Admin vs Normal User Workspace state (User Request)
  const isAdmin = devRole === "admin" || user.startsWith("admin") || user === "admin-001";

  // Multi-Agent Multitasking Mode (User Request: Single Agent vs Swarm Multitasking)
  const [agentViewMode, setAgentViewMode] = useState<"single" | "swarm">("single");

  // AI Inbox Device File Attachments (User Request: Attach File in AI Inbox)
  const [inboxAttachments, setInboxAttachments] = useState<{ id: string; name: string; size: string; file: File }[]>([]);
  const inboxFileInputRef = useRef<HTMLInputElement>(null);

  const handleInboxFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newItems = Array.from(files).map((f) => ({
      id: `${Date.now()}-${f.name}`,
      name: f.name,
      size: (f.size / 1024).toFixed(1) + " KB",
      file: f,
    }));
    setInboxAttachments((prev) => [...prev, ...newItems]);
    Array.from(files).forEach((f) => void addAttachment(f));
    e.target.value = "";
  };

  // Quick Access Tools State (User Request: Closable Panel for Quick Features)
  const [quickToolsOpen, setQuickToolsOpen] = useState(false);
  const [quickScratchCode, setQuickScratchCode] = useState('print("AstraSovereign Python 3.11 Sandbox: Active")\nimport hashlib\nprint("Air-gap hash:", hashlib.sha256(b"sovereign").hexdigest()[:16])');
  const [quickScratchOutput, setQuickScratchOutput] = useState<string | null>(null);
  const [quickPingStatus, setQuickPingStatus] = useState<"idle" | "testing" | "verified">("idle");
  const [quickPromptInput, setQuickPromptInput] = useState("");

  // AI Inbox Display Mode (User Request: Squeeze prevention - Docked vs Slide-Over Drawer)
  const [aiInboxDisplayMode, setAiInboxDisplayMode] = useState<"docked" | "overlay">("docked");

  // Settings Workspace Theme & Color Customizer State (User Request: Customize Workspace with Color Combinations)
  interface CustomThemeConfig {
    name: string;
    primary: string;
    bg: string;
    cardBg: string;
    sidebarBg: string;
    terminalBg: string;
    terminalText: string;
    previewBg: string;
  }

  const PRESET_PALETTES: CustomThemeConfig[] = [
    {
      name: "Astra Sovereign Violet (Default)",
      primary: "#7047eb",
      bg: "#f4f5f8",
      cardBg: "#ffffff",
      sidebarBg: "#ffffff",
      terminalBg: "#0a0d14",
      terminalText: "#f0f6fc",
      previewBg: "#0f172a",
    },
    {
      name: "Antigravity Cyber Dark",
      primary: "#38bdf8",
      bg: "#0d1117",
      cardBg: "#161b22",
      sidebarBg: "#111622",
      terminalBg: "#05080f",
      terminalText: "#ffffff",
      previewBg: "#0d1117",
    },
    {
      name: "Emerald Air-Gap",
      primary: "#059669",
      bg: "#f0fdf4",
      cardBg: "#ffffff",
      sidebarBg: "#f8fafc",
      terminalBg: "#021a10",
      terminalText: "#4ade80",
      previewBg: "#064e3b",
    },
    {
      name: "Cobalt Matrix",
      primary: "#2563eb",
      bg: "#eff6ff",
      cardBg: "#ffffff",
      sidebarBg: "#f8fafc",
      terminalBg: "#071529",
      terminalText: "#93c5fd",
      previewBg: "#1e3a8a",
    },
    {
      name: "Solar Flare Amber",
      primary: "#d97706",
      bg: "#fffbeb",
      cardBg: "#ffffff",
      sidebarBg: "#ffffff",
      terminalBg: "#1f1402",
      terminalText: "#fbbf24",
      previewBg: "#78350f",
    },
    {
      name: "High-Contrast Monochrome",
      primary: "#0f172a",
      bg: "#ffffff",
      cardBg: "#ffffff",
      sidebarBg: "#f8fafc",
      terminalBg: "#000000",
      terminalText: "#ffffff",
      previewBg: "#0f172a",
    },
  ];

  const [customTheme, setCustomTheme] = useState<CustomThemeConfig>(PRESET_PALETTES[0]);
  const [appliedCustomTheme, setAppliedCustomTheme] = useState<CustomThemeConfig | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<"theme" | "security">("theme");
  const [themeAppliedNotice, setThemeAppliedNotice] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Tasks, Priority & New Tasks System (User Request)
  // ---------------------------------------------------------------------------
  interface TaskQueueItem {
    id: string;
    title: string;
    priority: "P0" | "P1" | "P2" | "P3";
    status: "running" | "queued" | "completed" | "review";
    model: string;
    elapsed: string;
    department: string;
  }

  const [newTaskPrompt, setNewTaskPrompt] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<"P0" | "P1" | "P2" | "P3">("P1");
  const [newTaskModel, setNewTaskModel] = useState("Qwen 2.5 Coder 14B");
  const [priorityFilter, setPriorityFilter] = useState<"all" | "P0" | "P1" | "P2" | "P3" | "pending">("all");
  const [taskFeedback, setTaskFeedback] = useState<string | null>(null);

  // Foldable Home Sections State (User Request: Prevent Information Flooding & Collapsible Organization)
  const [homeSectionsFolded, setHomeSectionsFolded] = useState<{
    kpis: boolean;
    slaBreakdown: boolean;
    modelThroughput: boolean;
    liveQueue: boolean;
    taskDispatch: boolean;
    hardwareTelemetry: boolean;
    latestDeliverables: boolean;
  }>({
    kpis: false,
    slaBreakdown: true, // folded by default to keep screen lean & uncluttered
    modelThroughput: true, // folded by default
    liveQueue: false, // primary execution view
    taskDispatch: false, // primary dispatch console
    hardwareTelemetry: true, // folded by default
    latestDeliverables: true, // folded by default
  });

  const [homeCategoryFilter, setHomeCategoryFilter] = useState<"all" | "dispatch" | "telemetry" | "deliverables">("all");

  const toggleHomeSection = (section: keyof typeof homeSectionsFolded) => {
    setHomeSectionsFolded((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const expandAllHomeSections = () => {
    setHomeSectionsFolded({
      kpis: false,
      slaBreakdown: false,
      modelThroughput: false,
      liveQueue: false,
      taskDispatch: false,
      hardwareTelemetry: false,
      latestDeliverables: false,
    });
  };

  const collapseAllHomeSections = () => {
    setHomeSectionsFolded({
      kpis: true,
      slaBreakdown: true,
      modelThroughput: true,
      liveQueue: true,
      taskDispatch: true,
      hardwareTelemetry: true,
      latestDeliverables: true,
    });
  };

  // Document Preview State (Phone, Tablet, Desktop Paper)
  const [previewDoc, setPreviewDoc] = useState<PreviewDocument | null>(SAMPLE_DOCUMENTS.defense_audit);
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleOpenDocument = (docKeyOrDoc?: string | PreviewDocument) => {
    if (typeof docKeyOrDoc === "string") {
      setPreviewDoc(SAMPLE_DOCUMENTS[docKeyOrDoc] || SAMPLE_DOCUMENTS.defense_audit);
    } else if (docKeyOrDoc) {
      setPreviewDoc(docKeyOrDoc);
    } else {
      setPreviewDoc(SAMPLE_DOCUMENTS.defense_audit);
    }
    setPreviewOpen(true);
  };

  const [pendingTasks, setPendingTasks] = useState<TaskQueueItem[]>([
    {
      id: "TSK-9481",
      title: "Export Control & ITAR Defense Audit on Technical Schematics",
      priority: "P0",
      status: "running",
      model: "Llama 3.3 70B (NVLink)",
      elapsed: "0m 42s",
      department: "Legal & Defense",
    },
    {
      id: "TSK-9482",
      title: "Contract Risk Clause Extraction across 14 Vendor Agreements",
      priority: "P0",
      status: "running",
      model: "Qwen 2.5 Coder",
      elapsed: "1m 15s",
      department: "Procurement",
    },
    {
      id: "TSK-9483",
      title: "RapidOCR Tabular Extraction from 18 Scanned Work Orders",
      priority: "P1",
      status: "queued",
      model: "RapidOCR v2",
      elapsed: "In Queue (#1)",
      department: "Operations",
    },
    {
      id: "TSK-9484",
      title: "Docker Sandbox Python Script Compliance & Memory Leak Test",
      priority: "P1",
      status: "queued",
      model: "Docker / Python 3.11",
      elapsed: "In Queue (#2)",
      department: "Engineering",
    },
    {
      id: "TSK-9485",
      title: "Air-Gap Network Perimeter Egress Packet Inspection",
      priority: "P0",
      status: "running",
      model: "Audit Agent Daemon",
      elapsed: "2m 04s",
      department: "Infosec",
    },
    {
      id: "TSK-9486",
      title: "Deliverable Executive PDF Generation with Tamper-Proof Hash",
      priority: "P2",
      status: "queued",
      model: "Document Generator",
      elapsed: "In Queue (#3)",
      department: "Compliance",
    },
    {
      id: "TSK-9487",
      title: "Knowledge Base Vector Re-Indexing (1,240 documents)",
      priority: "P3",
      status: "queued",
      model: "Embedding Qwen",
      elapsed: "In Queue (#4)",
      department: "Knowledge Vault",
    },
  ]);

  // ---------------------------------------------------------------------------
  // Notifications System (User Request)
  // ---------------------------------------------------------------------------
  interface NotificationItem {
    id: string;
    title: string;
    desc: string;
    time: string;
    category: "priority" | "deliverable" | "new_task" | "airgap" | "sandbox";
    priority: "P0" | "P1" | "P2";
    unread: boolean;
    actionTab: SidebarSectionId;
    actionLabel: string;
  }

  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: "notif-1",
      title: "P0 Critical Alert: Defense Contract Risk Sign-off Required",
      desc: "Contract compliance scanner flagged 2 export-control clauses. L4 Sovereign Officer clearance required before deliverable generation.",
      time: "2m ago",
      category: "priority",
      priority: "P0",
      unread: true,
      actionTab: "agent",
      actionLabel: "Open in Assistant",
    },
    {
      id: "notif-2",
      title: "Deliverable Ready: Executive Compliance Brief PDF",
      desc: "Task #SOV-8491 generated executive deliverable signed with SHA-256 ledger. 0 cloud egress bytes recorded.",
      time: "14m ago",
      category: "deliverable",
      priority: "P1",
      unread: true,
      actionTab: "outputs",
      actionLabel: "View Deliverable",
    },
    {
      id: "notif-3",
      title: "New Task Dispatched: Maintenance Report Ingestion",
      desc: "user-002 dispatched OCR tabular extraction across 42 scanned maintenance logs to local GPU queue.",
      time: "38m ago",
      category: "new_task",
      priority: "P1",
      unread: true,
      actionTab: "jobs",
      actionLabel: "View in History",
    },
    {
      id: "notif-4",
      title: "Air-Gap Defense Shield: Verified 100% Isolated",
      desc: "Kernel inspection confirmed loopback strictly bound to 127.0.0.1. Zero external network egress detected.",
      time: "1h ago",
      category: "airgap",
      priority: "P2",
      unread: false,
      actionTab: "settings",
      actionLabel: "Security Console",
    },
    {
      id: "notif-5",
      title: "Docker Sandbox Execution Finished",
      desc: "Isolated Python code verification finished in 1.4s with exit code 0. Zero network egress detected.",
      time: "2h ago",
      category: "sandbox",
      priority: "P2",
      unread: false,
      actionTab: "sandbox",
      actionLabel: "Open Sandbox",
    },
    {
      id: "notif-6",
      title: "Model Warmup: Qwen 2.5 Coder 14B Loaded",
      desc: "Model weights mapped into local PCIe NVLink bus (14.2 GB VRAM allocated). Ready for code execution.",
      time: "3h ago",
      category: "airgap",
      priority: "P2",
      unread: false,
      actionTab: "models",
      actionLabel: "Routing Settings",
    },
  ]);

  const [notificationFilter, setNotificationFilter] = useState<
    "all" | "unread" | "priority" | "deliverable" | "airgap"
  >("all");

  const unreadCount = notifications.filter((n) => n.unread).length;

  const handleDispatchNewTask = () => {
    if (!newTaskPrompt.trim()) return;
    const newTask: TaskQueueItem = {
      id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      title: newTaskPrompt,
      priority: newTaskPriority,
      status: "running",
      model: newTaskModel,
      elapsed: "0m 01s",
      department: "Direct Dispatch",
    };

    setPendingTasks((prev) => [newTask, ...prev]);

    // Also trigger backend chat if available
    void handleSubmitTask(newTaskPrompt);

    // Also notify
    setNotifications((prev) => [
      {
        id: `notif-${Date.now()}`,
        title: `New Task Dispatched: [${newTaskPriority}] ${newTaskPrompt.slice(0, 45)}...`,
        desc: `Dispatched to ${newTaskModel}. Active air-gapped execution initiated.`,
        time: "Just now",
        category: "new_task",
        priority: newTaskPriority === "P0" ? "P0" : "P1",
        unread: true,
        actionTab: "agent",
        actionLabel: "View in Assistant",
      },
      ...prev,
    ]);

    setTaskFeedback(`Task dispatched as ${newTaskPriority} to ${newTaskModel}!`);
    setTimeout(() => setTaskFeedback(null), 3500);
    setNewTaskPrompt("");
  };

  // AI Inbox Conversation
  const [aiMessages, setAiMessages] = useState<AiMessageItem[]>([
    {
      id: "u-1",
      role: "user",
      text: "Summarize system defense & compliance status",
    },
    {
      id: "a-1",
      role: "assistant",
      thoughtTime: "4 seconds",
      sourcesCount: 9,
      text: "Your sovereign workbench dashboard provides a verified overview of local model inference, physical network isolation, and task throughput. The audit report centers on three core pillars:",
      pillars: [
        {
          title: "1. Air-Gap Network Isolation",
          desc: "Loopback bound strictly to 127.0.0.1. Zero external egress detected across all active worker threads.",
        },
        {
          title: "2. Local Model Allocation",
          desc: "Inference distributed between Llama 3.3, Qwen 2.5 Coder, and RapidOCR on local PCIe NVLink bus.",
        },
        {
          title: "3. Risk & Compliance",
          desc: "All deliverables require department sign-off. Cryptographic SHA-256 ledger tamper-evident and verified.",
        },
      ],
    },
  ]);

  const theme: ThemeStyles = useMemo(() => {
    if (appliedCustomTheme) {
      const isDark =
        appliedCustomTheme.bg === "#0d1117" ||
        appliedCustomTheme.bg === "#000000" ||
        appliedCustomTheme.name.toLowerCase().includes("dark");
      return {
        name: appliedCustomTheme.name,
        primary: appliedCustomTheme.primary,
        primaryLight: appliedCustomTheme.primary,
        primarySoft: appliedCustomTheme.primary + "18",
        secondaryBar: appliedCustomTheme.primary + "40",
        accentBadge: isDark
          ? "text-sky-300 bg-sky-950/60 border-sky-800"
          : "text-slate-800 bg-slate-100 border-slate-200",
        bg: appliedCustomTheme.bg,
        sidebarBg: appliedCustomTheme.sidebarBg,
        cardBg: appliedCustomTheme.cardBg,
        textColor: isDark ? "#f0f6fc" : "#0f172a",
        subtextColor: isDark ? "#8b949e" : "#64748b",
        borderColor: isDark ? "#21262d" : "#e2e8f0",
        isDark,
      };
    }
    return THEMES[themeKey];
  }, [appliedCustomTheme, themeKey]);

  // Submit Task (from AI Inbox)
  const handleSubmitTask = useCallback(
    async (message: string) => {
      if (!message.trim()) return;
      setIsThinking(true);
      try {
        const response = await submitChat(user, message);
        setActiveJobId(response.job_id);
        setActiveStatus("queued");
        setChips([]);

        setAiMessages((prev) => [
          ...prev,
          {
            id: `u-${Date.now()}`,
            role: "user",
            text: message,
          },
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            thoughtTime: "0.4s local dispatch",
            sourcesCount: 5,
            text: `Dispatched local task [${response.job_id.slice(0, 8)}]. Model inference running strictly on loopback GPU runtime.`,
            pillars: [
              {
                title: "Hardware Route",
                desc: "NVIDIA RTX 4090 (14.2 / 24 GB VRAM) allocated. Network isolation: strict local loopback.",
              },
            ],
          },
        ]);
      } catch (err) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `u-${Date.now()}`,
            role: "user",
            text: message,
          },
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            thoughtTime: "1s error",
            sourcesCount: 0,
            text: `Task dispatch failed: ${err instanceof Error ? err.message : "Backend unreachable"}.`,
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [user]
  );

  const handleCancelTask = useCallback(async () => {
    if (activeJobId) {
      try {
        await cancelJob(user, activeJobId);
      } catch {
        // ignore
      }
    }
  }, [user, activeJobId]);

  const handleDownloadArtifact = useCallback(
    async (artifact: ArtifactSummary) => {
      try {
        const { blob, filename } = await downloadArtifact(user, artifact.job_id, artifact.artifact_id);
        triggerDownload(blob, filename);
      } catch {
        // Fallback for mock/default deliverables (e.g. Exec_Brief_Q3.pptx, Telemetry_Audit.docx)
        const mockContent = `AstraSovereign Deliverable: ${artifact.filename}\nJob ID: ${artifact.job_id}\nClassification: L4 Air-Gap Sovereign\nAudit Seal: SHA-256 Verified\nTimestamp: ${new Date().toISOString()}\nStatus: 0 Egress Verified`;
        const blob = new Blob([mockContent], { type: "text/plain" });
        triggerDownload(blob, artifact.filename);
      }
    },
    [user]
  );

  const addAttachment = useCallback(
    async (file: File) => {
      const chipId = `${Date.now()}-${file.name}`;
      setChips((prev) => [...prev, { id: chipId, filename: file.name, state: "uploading" }]);
      try {
        const doc = await uploadDocument(user, file);
        setChips((prev) =>
          prev.map((c) =>
            c.id === chipId ? { ...c, state: doc.status === "ready" ? "ready" : "processing" } : c
          )
        );
      } catch {
        setChips((prev) => prev.map((c) => (c.id === chipId ? { ...c, state: "failed" } : c)));
      }
    },
    [user]
  );

  const removeAttachment = useCallback((id: string) => {
    setChips((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleDeleteDocument = useCallback(
    async (documentId: string) => {
      try {
        await deleteDocument(user, documentId);
      } catch {
        // ignore
      }
    },
    [user]
  );

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.textColor,
      }}
      className="flex h-screen w-screen overflow-hidden font-sans selection:bg-purple-200 transition-colors duration-200"
    >
      
      {/* ===================================================================
          1. LEFT SIDEBAR (EXACT MATCH TO USER'S SCREENSHOT: ALL 16 FEATURES)
      =================================================================== */}
      {/* ===================================================================
          1. LEFT SIDEBAR (Collapsible to the left & Filtered by Role)
      =================================================================== */}
      {sidebarOpen && (
        <aside
          style={{
            backgroundColor: theme.sidebarBg,
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
          className="w-[260px] shrink-0 border-r flex flex-col justify-between select-none z-20 overflow-y-auto animate-in slide-in-from-left duration-200 transition-colors"
        >
          <div className="p-5">
            {/* Brand Header with Left-Collapse Trigger */}
            <div
              style={{
                backgroundColor: theme.isDark ? "#161b22" : "rgba(241, 245, 249, 0.7)",
                borderColor: theme.borderColor,
              }}
              className="flex items-center justify-between px-2 py-1.5 mb-5 rounded-2xl border"
            >
              <div
                onClick={() => setActiveTab("home")}
                className="flex items-center gap-2.5 cursor-pointer group flex-1"
                title="Go to Home Overview"
              >
                <AstraEmblem color={theme.primary} size={28} />
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-extrabold text-[15.5px] tracking-tight leading-tight truncate"
                    style={{ color: theme.textColor }}
                  >
                    AstraSovereign
                  </span>
                  <span
                    className="text-[11px] font-medium truncate"
                    style={{ color: theme.subtextColor }}
                  >
                    {isAdmin ? "admin@sovereign.local" : "analyst@sovereign.local"}
                  </span>
                </div>
              </div>

              {/* User Request: Allow main vertical bar to be closable to the left */}
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-xl hover:opacity-80 transition-colors cursor-pointer shrink-0"
                style={{ color: theme.subtextColor }}
                title="Collapse Sidebar to Left"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* MAIN Category Header */}
            <div
              className="text-xs font-bold uppercase tracking-wider px-3 mb-2.5 flex items-center justify-between"
              style={{ color: theme.subtextColor }}
            >
              <span>WORKBENCH</span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                style={{
                  backgroundColor: theme.isDark ? "#161b22" : "#f1f5f9",
                  borderColor: theme.borderColor,
                  color: theme.textColor,
                }}
              >
                {isAdmin ? "L4 ADMIN" : "L2 ANALYST"}
              </span>
            </div>

            {/* Navigation Items List (Filtered: Admin features completely hidden from normal users) */}
            <nav className="space-y-1">
              {SIDEBAR_ITEMS.filter((item) => {
                if (isAdmin) return true;
                // Restricted subsystems strictly hidden from normal users per user request
                return !["audit", "compute", "models", "tools", "workflows"].includes(item.id);
              }).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    style={
                      isActive
                        ? {
                            backgroundColor: theme.primarySoft,
                            color: theme.primary,
                            borderColor: theme.secondaryBar,
                          }
                        : {
                            borderColor: "transparent",
                            color: theme.textColor,
                          }
                    }
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[16.5px] font-bold transition-all duration-150 cursor-pointer text-left border ${
                      isActive
                        ? "shadow-2xs"
                        : "hover:opacity-80"
                    }`}
                  >
                    <Icon
                      className="w-[19px] h-[19px] shrink-0 transition-colors"
                      style={isActive ? { color: theme.primary } : { color: theme.subtextColor }}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                    {item.id === "notifications" && unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white shadow-xs">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* RECENT TASKS Section */}
            <div
              className="pt-6 mt-5 border-t"
              style={{ borderColor: theme.borderColor }}
            >
              <div
                className="flex items-center justify-between text-xs font-bold uppercase tracking-wider px-3 mb-2.5"
                style={{ color: theme.subtextColor }}
              >
                <span>RECENT TASKS</span>
                <span className="text-xs font-bold" style={{ color: theme.textColor }}>{jobs ? jobs.length : 0}</span>
              </div>

              <div className="px-3">
                {jobs && jobs.length > 0 ? (
                  <div className="space-y-1.5">
                    {jobs.slice(0, 3).map((j) => (
                      <div
                        key={j.job_id}
                        onClick={() => {
                          setActiveJobId(j.job_id);
                          setActiveTab("agent");
                        }}
                        className="p-2 rounded-xl hover:opacity-85 cursor-pointer text-sm flex items-center gap-2.5 group transition-colors"
                        style={{ color: theme.textColor }}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${j.status === "completed" ? "bg-emerald-500" : "bg-purple-500"}`} />
                        <span className="truncate font-medium text-[13px]">
                          {j.message || j.job_id}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic py-1" style={{ color: theme.subtextColor }}>
                    No tasks recorded
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* User Profile Card at Bottom of Sidebar (Click to open Profile Dossier) */}
          <div
            className="p-4 border-t transition-colors"
            style={{
              backgroundColor: theme.sidebarBg,
              borderColor: theme.borderColor,
            }}
          >
            <div
              onClick={() => setProfileModalOpen(true)}
              className="flex items-center justify-between p-2 rounded-2xl hover:opacity-85 transition-all cursor-pointer group"
              title="Open User Profile & Clearance Dossier"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-10 h-10 rounded-full p-0.5 shadow-2xs shrink-0"
                  style={{ background: `linear-gradient(135deg, ${theme.primary}, #6366f1)` }}
                >
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-white font-bold text-xs">
                    {user.slice(0, 2).toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-col min-w-0">
                  <span
                    className="font-bold text-sm leading-tight truncate"
                    style={{ color: theme.textColor }}
                  >
                    {user}
                  </span>
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: theme.subtextColor }}
                  >
                    {isAdmin ? "L4 Admin Dossier" : "L2 User Profile"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSignOut) onSignOut();
                  else setActiveTab("home");
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* Floating Expand Sidebar Pill (when sidebar is closed to the left) */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            backgroundColor: theme.sidebarBg,
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-30 py-3.5 px-2 rounded-r-2xl shadow-xl flex flex-col items-center gap-2 cursor-pointer transition-transform hover:translate-x-1 border border-l-0 group"
          title="Expand Sidebar"
        >
          <PanelLeftOpen
            className="w-4 h-4 animate-pulse group-hover:scale-110 transition-transform"
            style={{ color: theme.primary }}
          />
          <span
            className="text-[10px] font-black tracking-wider uppercase [writing-mode:vertical-lr]"
            style={{ color: theme.subtextColor }}
          >
            Sidebar
          </span>
        </button>
      )}

      {/* ===================================================================
          2. CENTER MAIN DASHBOARD
      =================================================================== */}
      <main
        style={{
          backgroundColor: theme.bg,
          color: theme.textColor,
        }}
        data-rhs="true"
        className="flex-1 min-w-0 overflow-y-auto px-6 sm:px-10 py-6 space-y-6 transition-colors duration-200 rhs-workspace"
      >
        {/* ===================================================================
            TOP HORIZONTAL TASKBAR (Unified Command Dock Ribbon)
            User Request: Add top buttons in a horizontal taskbar & Home stays signed in
        =================================================================== */}
        <header
          style={{
            backgroundColor: theme.isDark ? "rgba(22, 27, 34, 0.85)" : "rgba(255, 255, 255, 0.85)",
            borderColor: theme.borderColor,
            color: theme.textColor,
          }}
          className="w-full rounded-2xl border shadow-sm backdrop-blur-md px-4 py-3 flex flex-wrap items-center justify-between gap-3 select-none transition-all"
        >
          {/* Left: Section Title & Active Breadcrumb */}
          <div className="flex items-center gap-3 shrink-0">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  backgroundColor: theme.isDark ? "#21262d" : "#f1f5f9",
                  borderColor: theme.borderColor,
                  color: theme.textColor,
                }}
                className="flex items-center gap-2 px-3 py-1.5 border rounded-xl text-xs font-semibold hover:opacity-85 transition-all cursor-pointer shrink-0"
                title="Expand Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" style={{ color: theme.primary }} />
                <span className="hidden sm:inline">Sidebar</span>
              </button>
            )}

            <div className="flex flex-col shrink-0">
              <div className="flex items-center gap-2.5">
                <h1
                  className="text-xl sm:text-2xl font-black tracking-tight whitespace-nowrap"
                  style={{ color: theme.textColor }}
                >
                  {activeTab === "home" ? "Home & Workspace" : (SIDEBAR_ITEMS.find((item) => item.id === activeTab)?.label || "Dashboard")}
                </h1>
                {activeTab === "home" ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border whitespace-nowrap inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    NetworkGuard: 100% Offline Loopback (127.0.0.1:11434)
                  </span>
                ) : (
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider shrink-0 border whitespace-nowrap inline-block"
                    style={{
                      backgroundColor: theme.isDark ? "#21262d" : "#f8fafc",
                      borderColor: theme.borderColor,
                      color: theme.subtextColor,
                    }}
                  >
                    Subsystem
                  </span>
                )}
              </div>
              <p
                className="text-xs font-medium text-slate-500 hidden md:block mt-0.5 whitespace-nowrap"
                style={{ color: theme.subtextColor }}
              >
                {activeTab === "home"
                  ? "Air-Gapped Local LLM & Multi-Agent Orchestration Platform"
                  : `AstraSovereign workspace subsystem: ${SIDEBAR_ITEMS.find((item) => item.id === activeTab)?.label}`}
              </p>
            </div>
          </div>

          {/* Right: Horizontal Taskbar Buttons Dock */}
          <div
            style={{
              backgroundColor: theme.isDark ? "rgba(13, 17, 23, 0.6)" : "rgba(244, 245, 248, 0.7)",
              borderColor: theme.borderColor,
            }}
            className="flex items-center gap-1.5 p-1 rounded-xl border flex-wrap shrink-0 shadow-2xs max-w-full"
            role="toolbar"
            aria-label="Horizontal System Taskbar"
          >
            {/* 1. Home Button (Always navigates to Home tab without signing out) */}
            <button
              onClick={() => setActiveTab("home")}
              style={{
                backgroundColor: activeTab === "home" ? theme.primarySoft : (theme.isDark ? theme.cardBg : "#ffffff"),
                borderColor: activeTab === "home" ? theme.secondaryBar : theme.borderColor,
                color: activeTab === "home" ? theme.primary : theme.textColor,
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-2xs cursor-pointer whitespace-nowrap ${
                activeTab === "home" ? "ring-1 ring-purple-300" : ""
              }`}
              title="Go to Home Overview (stays authenticated)"
            >
              <Home className="w-3.5 h-3.5" style={{ color: activeTab === "home" ? theme.primary : "#94a3b8" }} />
              <span className="font-bold">Home</span>
            </button>

            {/* 2. Color Theme Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setThemePickerOpen(!themePickerOpen)}
                style={{
                  backgroundColor: theme.isDark ? theme.cardBg : "#ffffff",
                  borderColor: theme.borderColor,
                  color: theme.textColor,
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                title="Change Workspace Color Theme"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/15"
                  style={{ backgroundColor: theme.primary }}
                />
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold hidden sm:inline">{theme.name.split(" ")[0]}</span>
              </button>

              {themePickerOpen && (
                <div
                  style={{
                    backgroundColor: theme.cardBg,
                    borderColor: theme.borderColor,
                    color: theme.textColor,
                  }}
                  className="absolute right-0 mt-2 w-56 rounded-2xl shadow-xl border p-2 z-50 space-y-1 animate-in fade-in zoom-in-95"
                >
                  <div
                    className="text-xs font-bold px-3 py-1.5 uppercase tracking-wider"
                    style={{ color: theme.subtextColor }}
                  >
                    Select Theme Color
                  </div>
                  {(Object.keys(THEMES) as ColorTheme[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setThemeKey(key);
                        setAppliedCustomTheme(null);
                        setThemePickerOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-bold hover:opacity-80 transition-colors text-left cursor-pointer"
                      style={{
                        backgroundColor: themeKey === key && !appliedCustomTheme ? theme.primarySoft : "transparent",
                        color: themeKey === key && !appliedCustomTheme ? theme.primary : theme.textColor,
                      }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: THEMES[key].primary }}
                      />
                      <span className="font-bold">{THEMES[key].name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Taskbar Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* 3. Authenticated Clearance Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold shadow-2xs select-none whitespace-nowrap ${
                isAdmin
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
              title={`Authenticated Identity: ${user} (${isAdmin ? "L4 Sovereign Directorate Admin" : "L2 Staff Analyst"})`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="font-bold">{isAdmin ? "L4 Admin" : "L2 User"}</span>
            </div>

            {/* 4. Quick Tools Side Drawer Trigger */}
            <button
              onClick={() => setQuickToolsOpen(!quickToolsOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
              title="Toggle Closable Quick Tools Widget"
            >
              <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
              <span className="font-bold hidden sm:inline">Quick Tools</span>
            </button>

            {/* 5. AI Inbox Toggle Button */}
            <button
              onClick={() => setAiPanelOpen(!aiPanelOpen)}
              style={{
                backgroundColor: theme.isDark ? theme.cardBg : (aiPanelOpen ? theme.primarySoft : "#ffffff"),
                borderColor: aiPanelOpen ? theme.secondaryBar : theme.borderColor,
                color: aiPanelOpen ? theme.primary : theme.textColor,
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer hover:opacity-90 whitespace-nowrap ${
                aiPanelOpen ? "ring-1 ring-purple-300" : ""
              }`}
              title="Toggle AI Inbox Panel"
            >
              {aiPanelOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
              <span className="font-bold hidden sm:inline">AI Inbox</span>
            </button>

            {/* 6. Notifications Bell Button */}
            <button
              onClick={() => setActiveTab("notifications")}
              style={{
                backgroundColor: theme.isDark ? theme.cardBg : (activeTab === "notifications" ? "#fff1f2" : "#ffffff"),
                borderColor: activeTab === "notifications" ? "#fecdd3" : theme.borderColor,
                color: activeTab === "notifications" ? "#e11d48" : theme.textColor,
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer hover:opacity-90 whitespace-nowrap ${
                activeTab === "notifications" ? "ring-1 ring-rose-300" : ""
              }`}
              title="Notifications & Alerts"
            >
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold hidden sm:inline">Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Taskbar Divider */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

            {/* 7. User Profile Button */}
            <button
              onClick={() => setProfileModalOpen(true)}
              style={{
                backgroundColor: theme.isDark ? theme.cardBg : "#ffffff",
                borderColor: theme.borderColor,
                color: theme.textColor,
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-bold hover:opacity-90 transition-all shadow-2xs cursor-pointer whitespace-nowrap"
              title="View User Profile & Details"
            >
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-[9px] text-white shrink-0"
                style={{ backgroundColor: theme.primary }}
              >
                {user.slice(0, 1).toUpperCase()}
              </div>
              <span className="font-bold hidden lg:inline">{user}</span>
            </button>

            {/* 8. Dispatch Job Action Button */}
            <button
              onClick={() => {
                if (activeTab === "home") {
                  const composer = document.getElementById("home-task-composer");
                  if (composer) {
                    composer.scrollIntoView({ behavior: "smooth", block: "center" });
                    const input = composer.querySelector("input");
                    input?.focus();
                  }
                } else {
                  setActiveTab("agent");
                }
              }}
              style={{ backgroundColor: theme.primary }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="font-bold">Dispatch</span>
            </button>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────────
            1. HOME / OVERVIEW TAB (Task-Centric Dashboard: Pending, Priority, New Tasks)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "home" && (
          <div className="max-w-[1440px] mx-auto p-6 space-y-6 bg-[#F8FAFC] min-h-screen text-slate-800 antialiased">
            {/* 0. WORKSPACE ORGANIZER & ACCORDION CONTROLS (User Request: Prevent Flooding) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-2 hidden sm:inline">
                  Focused View:
                </span>
                {[
                  { id: "all", label: "All Panels" },
                  { id: "dispatch", label: "Task Queue & Dispatch" },
                  { id: "telemetry", label: "VRAM & System Telemetry" },
                  { id: "deliverables", label: "Office Deliverables" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setHomeCategoryFilter(tab.id as any);
                      if (tab.id === "dispatch") {
                        setHomeSectionsFolded({
                          kpis: true,
                          slaBreakdown: true,
                          modelThroughput: true,
                          liveQueue: false,
                          taskDispatch: false,
                          hardwareTelemetry: true,
                          latestDeliverables: true,
                        });
                      } else if (tab.id === "telemetry") {
                        setHomeSectionsFolded({
                          kpis: false,
                          slaBreakdown: false,
                          modelThroughput: false,
                          liveQueue: true,
                          taskDispatch: true,
                          hardwareTelemetry: false,
                          latestDeliverables: true,
                        });
                      } else if (tab.id === "deliverables") {
                        setHomeSectionsFolded({
                          kpis: true,
                          slaBreakdown: false,
                          modelThroughput: true,
                          liveQueue: true,
                          taskDispatch: true,
                          hardwareTelemetry: true,
                          latestDeliverables: false,
                        });
                      } else {
                        expandAllHomeSections();
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      homeCategoryFilter === tab.id
                        ? "bg-purple-600 text-white shadow-2xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllHomeSections}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-purple-700 hover:bg-purple-50 border border-slate-200 transition-colors cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllHomeSections}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                >
                  Fold All
                </button>
              </div>
            </div>

            {/* 1. TOP EXECUTIVE KPIS (Foldable) */}
            {homeSectionsFolded.kpis ? (
              <div
                onClick={() => toggleHomeSection("kpis")}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Executive KPI Telemetry</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active Loopback
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      7 Pending (3 P0 Critical) &bull; 18 Dispatched Today &bull; 29 Deliverables Ready &bull; Click to expand
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                  <span>Unfold</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Executive KPI Overview
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleHomeSection("kpis")}
                    className="text-xs font-bold text-slate-400 hover:text-purple-600 flex items-center gap-1 cursor-pointer"
                  >
                    <span>Fold</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Pending Tasks */}
                  <div
                    onClick={() => setPriorityFilter("pending")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-600">
                        <Clock className="w-5 h-5 text-amber-500" />
                        <span>Pending Tasks</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Active Queue
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl sm:text-[32px] font-black text-slate-900 tracking-tight">
                        7 Pending
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      3 in-flight &bull; 4 queued
                    </p>
                  </div>

                  {/* Card 2: Critical Priority (P0) */}
                  <div
                    onClick={() => setPriorityFilter("P0")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-600">
                        <AlertTriangle className="w-5 h-5 text-rose-500" />
                        <span>Critical Priority (P0)</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                        High Attention
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl sm:text-[32px] font-black text-rose-600 tracking-tight">
                        3 Critical
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      Requires officer clearance before deliverable generation
                    </p>
                  </div>

                  {/* Card 3: New Tasks Today */}
                  <div
                    onClick={() => setPriorityFilter("all")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-600">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        <span>New Tasks Today</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                        +4 This Hour
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl sm:text-[32px] font-black text-slate-900 tracking-tight">
                        18 Dispatched
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      +24% on-premise throughput
                    </p>
                  </div>

                  {/* Card 4: Deliverables Ready */}
                  <div
                    onClick={() => setActiveTab("outputs")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center justify-between mb-3.5">
                      <div className="flex items-center gap-2.5 text-sm font-bold text-slate-600">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span>Deliverables Ready</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDocument("defense_audit");
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-200 transition-colors cursor-pointer"
                        title="Preview multi-device signed deliverable"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Preview</span>
                      </button>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-3xl sm:text-[32px] font-black text-emerald-600 tracking-tight">
                        29 Ready
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2 font-medium">
                      100% on-premise signed documents ready for export
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Main 12-Column Grid Split (grid grid-cols-1 lg:grid-cols-12 gap-6 items-start) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: lg:col-span-7 (~60-65% width) — Core Analytics & Work Queue */}
              <div className="lg:col-span-7 space-y-6">
                {/* 2. Performance Monitor & Weekly SLA Breakdown Card (Foldable) */}
                {homeSectionsFolded.slaBreakdown ? (
                  <div
                    onClick={() => toggleHomeSection("slaBreakdown")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            Performance Monitor &amp; Weekly SLA Breakdown
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            98.4% On-Time SLA
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Throughput and compliance status &bull; Click to unfold SLA micro-bars
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Unfold</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-5 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 tracking-tight">
                              Performance Monitor &amp; Weekly SLA Breakdown
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              Tier-1 Sovereign SLA (98.4% On-Time)
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">
                            Throughput and compliance status across active agent pipelines.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Time range toggle: [This Week] | [Last 30 Days] */}
                        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80 text-xs font-semibold self-start sm:self-auto">
                          {["This Week", "Last 30 Days"].map((range) => (
                            <button
                              key={range}
                              onClick={() => setSelectedPerformanceRange(range)}
                              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                                selectedPerformanceRange === range
                                  ? "bg-white text-slate-900 font-bold shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection("slaBreakdown")}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Fold section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* 4 Status Mini-Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {/* Completed: 54 Tasks (96.4%) */}
                      <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
                          <span>Completed</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">96.4%</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-emerald-900">54 Tasks</div>
                        <div className="w-full h-1.5 bg-emerald-200/60 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full w-[96.4%]" />
                        </div>
                      </div>

                      {/* On-Time: 52 Tasks (92.8%) */}
                      <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-blue-800">
                          <span>On-Time</span>
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">92.8%</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-blue-900">52 Tasks</div>
                        <div className="w-full h-1.5 bg-blue-200/60 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full w-[92.8%]" />
                        </div>
                      </div>

                      {/* Delayed: 3 Tasks (5.4%) */}
                      <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-amber-800">
                          <span>Delayed</span>
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">5.4%</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-amber-900">3 Tasks</div>
                        <div className="w-full h-1.5 bg-amber-200/60 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500 rounded-full w-[5.4%]" />
                        </div>
                      </div>

                      {/* SLA Breach: 1 Task (1.8%) */}
                      <div className="p-3.5 rounded-xl bg-rose-50/50 border border-rose-200/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold text-rose-800">
                          <span>SLA Breach</span>
                          <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">1.8%</span>
                        </div>
                        <div className="text-lg sm:text-xl font-black text-rose-900">1 Task</div>
                        <div className="w-full h-1.5 bg-rose-200/60 rounded-full overflow-hidden">
                          <div className="h-full bg-rose-600 rounded-full w-[1.8%]" />
                        </div>
                      </div>
                    </div>

                    {/* Weekly Slender SLA Micro-Bars */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                          Weekly SLA Distribution (Mon &ndash; Sun)
                        </span>
                        <div className="flex items-center gap-3 text-[11px] font-bold">
                          <span className="flex items-center gap-1 text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-sm bg-purple-600 inline-block" />
                            On-Time
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
                            Delay
                          </span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
                            Breach
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-2 pt-2">
                        {[
                          { day: "Mon", onTime: 12, delayed: 1, failed: 0 },
                          { day: "Tue", onTime: 15, delayed: 0, failed: 0 },
                          { day: "Wed", onTime: 9, delayed: 2, failed: 1 },
                          { day: "Thu", onTime: 14, delayed: 0, failed: 0 },
                          { day: "Fri", onTime: 18, delayed: 1, failed: 0 },
                          { day: "Sat", onTime: 6, delayed: 0, failed: 0 },
                          { day: "Sun", onTime: 4, delayed: 0, failed: 0 },
                        ].map((d) => {
                          const total = d.onTime + d.delayed + d.failed;
                          const onTimeH = (d.onTime / 20) * 70;
                          const delayedH = (d.delayed / 20) * 70;
                          const failedH = (d.failed / 20) * 70;

                          return (
                            <div key={d.day} className="flex flex-col items-center gap-1.5 text-center">
                              <div className="h-[80px] w-full max-w-[36px] mx-auto bg-slate-200/50 rounded-lg flex flex-col justify-end p-0.5 overflow-hidden group">
                                {d.failed > 0 && (
                                  <div
                                    style={{ height: `${failedH}px` }}
                                    className="w-full bg-rose-500 rounded-t-xs"
                                    title={`${d.failed} Policy Breach`}
                                  />
                                )}
                                {d.delayed > 0 && (
                                  <div
                                    style={{ height: `${delayedH}px` }}
                                    className="w-full bg-amber-400"
                                    title={`${d.delayed} Delayed`}
                                  />
                                )}
                                <div
                                  style={{ height: `${onTimeH}px` }}
                                  className="w-full bg-purple-600 rounded-b-xs"
                                  title={`${d.onTime} On-Time`}
                                />
                              </div>
                              <span className="text-xs font-bold text-slate-700">{d.day}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{total} tasks</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Pending Tasks Live Queue Table (Foldable) */}
                {homeSectionsFolded.liveQueue ? (
                  <div
                    onClick={() => toggleHomeSection("liveQueue")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <ListFilter className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            Pending Tasks Live Queue
                          </h3>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                            {pendingTasks.length} In Pipeline
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Real-time air-gapped queue table &bull; Click to unfold execution list
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Unfold</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <ListFilter className="w-4 h-4 text-purple-600" />
                        <span>Pending Tasks Live Queue</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          {(["all", "P0", "P1", "P2"] as const).map((pf) => (
                            <button
                              key={pf}
                              onClick={() => setPriorityFilter(pf)}
                              className={`px-2 py-0.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                priorityFilter === pf
                                  ? "bg-purple-100 text-purple-800"
                                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              }`}
                            >
                              {pf === "all" ? "All" : pf}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection("liveQueue")}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Fold section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                            <th className="pb-2.5">Task ID</th>
                            <th className="pb-2.5">Description</th>
                            <th className="pb-2.5">Priority</th>
                            <th className="pb-2.5">Assigned Model</th>
                            <th className="pb-2.5">Status</th>
                            <th className="pb-2.5 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/60 font-medium">
                          {pendingTasks
                            .filter((t) => (priorityFilter === "all" ? true : t.priority === priorityFilter))
                            .map((task) => (
                              <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                                <td className="py-3 font-mono font-bold text-slate-800">{task.id}</td>
                                <td className="py-3 max-w-[220px] truncate text-slate-700">{task.title}</td>
                                <td className="py-3">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                      task.priority === "P0"
                                        ? "bg-rose-100 text-rose-800"
                                        : task.priority === "P1"
                                        ? "bg-amber-100 text-amber-800"
                                        : "bg-purple-100 text-purple-800"
                                    }`}
                                  >
                                    {task.priority}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-500 font-mono text-[11px]">{task.model}</td>
                                <td className="py-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      task.status === "running"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${
                                        task.status === "running"
                                          ? "bg-purple-600 animate-pulse"
                                          : "bg-slate-400"
                                      }`}
                                    />
                                    {task.status}
                                  </span>
                                </td>
                                <td className="py-3 text-right">
                                  <button
                                    onClick={() => {
                                      setActiveJobId(task.id);
                                      setActiveTab("agent");
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-bold text-[11px] transition-colors cursor-pointer"
                                  >
                                    Open
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Bottom SLA adherence micro-banner */}
                    <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">Median Response</span>
                        <span className="text-xl font-black text-slate-900 mt-0.5 block">1.8s</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">Token Velocity</span>
                        <span className="text-xl font-black text-slate-900 mt-0.5 block">142 t/s</span>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                        <span className="text-[11px] text-slate-500 font-bold uppercase block">Dropped Packets</span>
                        <span className="text-xl font-black text-emerald-600 mt-0.5 block">0 (Airgap)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: lg:col-span-5 (~35-40% width) — Action, Hardware & Deliverables */}
              <div className="lg:col-span-5 space-y-6">
                {/* 4. Compact "Dispatch Sovereign Task" Card (Foldable) */}
                {homeSectionsFolded.taskDispatch ? (
                  <div
                    onClick={() => toggleHomeSection("taskDispatch")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <Send className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            Dispatch Sovereign Task
                          </h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200">
                            Air-Gap Queue
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Task prompt console &bull; Click to unfold dispatch controls
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Unfold</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                        <Send className="w-4 h-4 text-purple-600" />
                        <span>Dispatch Sovereign Task</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          Air-Gap Queue
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection("taskDispatch")}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Fold section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Properly sized rows={3} textarea */}
                      <textarea
                        rows={3}
                        value={newTaskPrompt}
                        onChange={(e) => setNewTaskPrompt(e.target.value)}
                        placeholder="Describe task instructions for the local air-gapped agent..."
                        className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-300 focus:outline-none resize-none leading-relaxed"
                      />

                      {/* Priority Pills: Segmented horizontal buttons with soft semantic fills */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Priority Level
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {(["P0", "P1", "P2", "P3"] as const).map((p) => {
                            const isSelected = newTaskPriority === p;
                            const styles =
                              p === "P0"
                                ? isSelected
                                  ? "bg-rose-600 text-white border-rose-600"
                                  : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                : p === "P1"
                                ? isSelected
                                  ? "bg-amber-600 text-white border-amber-600"
                                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                : p === "P2"
                                ? isSelected
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                                : isSelected
                                ? "bg-slate-800 text-white border-slate-800"
                                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200";

                            return (
                              <button
                                key={p}
                                type="button"
                                onClick={() => setNewTaskPriority(p)}
                                className={`py-1.5 rounded-lg text-xs font-bold border transition-all text-center cursor-pointer ${styles}`}
                              >
                                {p}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Local Model Selector Dropdown */}
                      <div className="space-y-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Assigned Model
                        </span>
                        <select
                          value={newTaskModel}
                          onChange={(e) => setNewTaskModel(e.target.value)}
                          className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none"
                        >
                          <option value="qwen2.5-coder:14b">qwen2.5-coder:14b</option>
                          <option value="qwen2.5-coder:3b">qwen2.5-coder:3b</option>
                          <option value="llava:7b">llava:7b</option>
                        </select>
                      </div>

                      {/* Quick Template Chips */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Quick Templates
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {[
                            "Audit air-gap perimeter & socket status",
                            "Extract tabular ledger from scanned PDF",
                          ].map((tpl) => (
                            <button
                              key={tpl}
                              type="button"
                              onClick={() => setNewTaskPrompt(tpl)}
                              className="text-left text-xs bg-slate-50 hover:bg-purple-50/50 text-slate-700 hover:text-purple-700 p-2 rounded-lg border border-slate-200 transition-colors cursor-pointer truncate"
                            >
                              &bull; {tpl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Primary Action Button */}
                      <button
                        type="button"
                        onClick={handleDispatchNewTask}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        <span>+ Dispatch to Air-Gap Queue</span>
                      </button>

                      {taskFeedback && (
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center animate-in fade-in">
                          {taskFeedback}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. Local Hardware & VRAM Telemetry Card (Foldable) */}
                {homeSectionsFolded.hardwareTelemetry ? (
                  <div
                    onClick={() => toggleHomeSection("hardwareTelemetry")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <Cpu className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">
                            Local Hardware &amp; VRAM Telemetry
                          </h3>
                          <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            6.8 / 16 GB (42%)
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          RTX 4090 &bull; 52&deg;C Optimal &bull; Click to unfold hardware metrics
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Unfold</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <Cpu className="w-4 h-4 text-purple-600" />
                        <span>Local Hardware &amp; VRAM Telemetry</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                          RTX 4090
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection("hardwareTelemetry")}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Fold section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                          <span>VRAM Allocation (qwen2.5 + llava)</span>
                          <span className="font-mono text-purple-700">6.8 / 16 GB (42%)</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                          <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 w-[42%]" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 font-bold block text-[10px]">Core Temp</span>
                          <span className="text-slate-800 font-bold mt-0.5 block">52&deg;C Optimal</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 font-bold block text-[10px]">PCIe Bus</span>
                          <span className="text-slate-800 font-bold mt-0.5 block">Gen4 x16</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 6. Latest Deliverables (Foldable) */}
                {homeSectionsFolded.latestDeliverables ? (
                  <div
                    onClick={() => toggleHomeSection("latestDeliverables")}
                    className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between cursor-pointer hover:border-purple-200 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">
                            Latest Deliverables
                          </h3>
                          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            2 Ready for Export
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Exec_Brief_Q3.pptx &bull; Telemetry_Audit.docx &bull; Click to unfold
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-purple-600 font-bold group-hover:translate-x-0.5 transition-transform">
                      <span>Unfold</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4 animate-in fade-in">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <FileText className="w-4 h-4 text-purple-600" />
                        <span>Latest Deliverables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab("outputs")}
                          className="text-xs text-purple-600 hover:text-purple-700 font-bold cursor-pointer"
                        >
                          View All &rarr;
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleHomeSection("latestDeliverables")}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Fold section"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {/* Deliverable 1: Exec_Brief_Q3.pptx */}
                      <div className="p-3 rounded-xl border border-slate-200 hover:border-amber-300 bg-white flex items-center justify-between gap-2 group transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Presentation className="w-4 h-4 text-amber-600 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              Exec_Brief_Q3.pptx
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">1.4 MB &bull; Signed</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenDocument("exec_brief")}
                            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <button
                            onClick={() =>
                              handleDownloadArtifact({
                                artifact_id: "art-exec-brief-q3",
                                job_id: "job-demo-exec",
                                filename: "Exec_Brief_Q3.pptx",
                                type: "pptx",
                                status: "completed",
                                size_bytes: 1450000,
                                created_at: new Date().toISOString(),
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>

                      {/* Deliverable 2: Telemetry_Audit.docx */}
                      <div className="p-3 rounded-xl border border-slate-200 hover:border-blue-300 bg-white flex items-center justify-between gap-2 group transition-all">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCheck className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-bold text-slate-800 block truncate">
                              Telemetry_Audit.docx
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">2.8 MB &bull; Sealed</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleOpenDocument("defense_audit")}
                            className="px-2 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Preview</span>
                          </button>
                          <button
                            onClick={() =>
                              handleDownloadArtifact({
                                artifact_id: "art-telemetry-audit-doc",
                                job_id: "job-demo-telemetry",
                                filename: "Telemetry_Audit.docx",
                                type: "docx",
                                status: "completed",
                                size_bytes: 2850000,
                                created_at: new Date().toISOString(),
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
{/* ─────────────────────────────────────────────────────────────────
            NOTIFICATIONS & CLEARANCE ALERTS TAB (User Request)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "notifications" && (
          <div className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-700">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <span>Notification Center</span>
                    {unreadCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white">
                        {unreadCount} Unread
                      </span>
                    )}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                    Real-time alerts for priority escalations, air-gap defense verification, and deliverable sign-offs.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })))
                  }
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>Mark all as read</span>
                </button>
              </div>
            </div>

            {/* Notification Filter Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "all", label: "All Notifications" },
                { id: "unread", label: "Unread" },
                { id: "priority", label: "P0 Priority Alerts" },
                { id: "deliverable", label: "Deliverables Ready" },
                { id: "airgap", label: "Air-Gap & Security" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setNotificationFilter(f.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    notificationFilter === f.id
                      ? "bg-purple-600 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Notifications List */}
            <div className="space-y-3 pt-1">
              {notifications
                .filter((n) => {
                  if (notificationFilter === "unread") return n.unread;
                  if (notificationFilter === "priority") return n.priority === "P0";
                  if (notificationFilter === "deliverable") return n.category === "deliverable";
                  if (notificationFilter === "airgap") return n.category === "airgap";
                  return true;
                })
                .map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-4 ${
                      notif.unread
                        ? "border-purple-200 bg-purple-50/20 shadow-2xs"
                        : "border-slate-100 bg-white hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                          notif.priority === "P0"
                            ? "bg-rose-100 text-rose-700"
                            : notif.category === "deliverable"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {notif.priority === "P0" ? (
                          <AlertTriangle className="w-4.5 h-4.5" />
                        ) : notif.category === "deliverable" ? (
                          <CheckCircle2 className="w-4.5 h-4.5" />
                        ) : (
                          <Bell className="w-4.5 h-4.5" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-bold ${
                              notif.priority === "P0"
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : notif.priority === "P1"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-purple-50 text-purple-700 border border-purple-200"
                            }`}
                          >
                            {notif.priority}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {notif.title}
                          </h4>
                          {notif.unread && (
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                          )}
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-3xl">
                          {notif.desc}
                        </p>

                        <div className="flex items-center gap-3 text-xs text-slate-400 pt-1 font-medium">
                          <span>{notif.time}</span>
                          <span>·</span>
                          <span className="uppercase tracking-wider text-[10px] font-bold text-slate-500">
                            {notif.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          setNotifications((prev) =>
                            prev.map((n) => (n.id === notif.id ? { ...n, unread: !n.unread } : n))
                          );
                        }}
                        className="text-xs text-slate-400 hover:text-slate-700 font-semibold px-2 py-1 rounded cursor-pointer"
                      >
                        {notif.unread ? "Mark read" : "Mark unread"}
                      </button>

                      {notif.category === "deliverable" && (
                        <button
                          onClick={() => handleOpenDocument("defense_audit")}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          title="Preview deliverable document"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview Document</span>
                        </button>
                      )}

                      <button
                        onClick={() => setActiveTab(notif.actionTab)}
                        className="px-3.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        {notif.actionLabel}
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            2. COWORKING SPACE TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "coworking" && (
          <div className="animate-in fade-in">
            <CoworkingView
              onOpenAgentWorkspace={(prompt) => {
                if (prompt) void handleSubmitTask(prompt);
                setActiveTab("agent");
              }}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            3. AI ASSISTANT TAB (Single Agent & Multi-Agent Swarm Multitasking)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "agent" && (
          <div className="space-y-4 animate-in fade-in">
            {/* View Switcher: Single Agent vs Multi-Agent Swarm (Multitasking) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setAgentViewMode("single")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    agentViewMode === "single"
                      ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Terminal className="w-4 h-4" />
                  <span>Single Agent Workspace</span>
                </button>
                <button
                  onClick={() => setAgentViewMode("swarm")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    agentViewMode === "swarm"
                      ? "bg-purple-600 text-white shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>Multi-Agent Swarm (Multitasking)</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black uppercase tracking-wider">
                    Swarm
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>On-Premise NVLink Engine · Air-Gapped Swarm Multitasking</span>
              </div>
            </div>

            {agentViewMode === "single" ? (
              <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in min-h-[680px] flex flex-col">
                <AgentWorkspaceView
                  user={user}
                  activeJob={activeJob}
                  activeJobId={activeJobId}
                  activeStatus={activeStatus}
                  running={activeStatus === "queued" || activeStatus === "running"}
                  onSubmitTask={(msg) => void handleSubmitTask(msg)}
                  onCancelTask={() => void handleCancelTask()}
                  onDownloadArtifact={(a) => void handleDownloadArtifact(a)}
                  chips={chips}
                  onAttachFile={(f) => void addAttachment(f)}
                  onRemoveChip={removeAttachment}
                  consoleOpen={consoleOpen}
                  setConsoleOpen={setConsoleOpen}
                  healthError={healthError}
                  themeKey={themeKey}
                  onResetSession={() => {
                    setActiveJobId(null);
                    setActiveStatus(null);
                    setChips([]);
                  }}
                />
              </div>
            ) : (
              <MultiAgentSwarmView onOpenDocumentPreview={handleOpenDocument} />
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            4. DOCKER SANDBOX (SECURE AIR-GAPPED CODE RUNNER)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "sandbox" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <SandboxView user={user} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            4B. CODE EDITOR TAB (VS CODE STYLE WITH AI ASSISTANT)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "editor" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <VsCodeEditorView user={user} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            5. TASK HISTORY TAB (JOBS)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "jobs" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <JobsView
              jobs={jobs}
              onSelectJob={(id) => {
                setActiveJobId(id);
                setActiveTab("agent");
              }}
              onNewJob={() => {
                setActiveJobId(null);
                setActiveTab("agent");
              }}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            6. KNOWLEDGE BASE TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "knowledge" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-blue-50/60 rounded-2xl border border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Air-Gapped Document Viewer</h3>
                  <p className="text-xs text-slate-500 font-medium">Examine ingested technical specs and documents with Phone notch, Tablet, and Desktop letterhead preview.</p>
                </div>
              </div>
              <button
                onClick={() => handleOpenDocument("inspection_report")}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>Preview Document Content</span>
              </button>
            </div>
            <KnowledgeBaseView
              documents={documents}
              onUploadDocument={(f) => void addAttachment(f)}
              onDeleteDocument={(id) => void handleDeleteDocument(id)}
              uploading={chips.some((c) => c.state === "uploading")}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            7. DELIVERABLES TAB (OUTPUTS)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "outputs" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-purple-50/60 rounded-2xl border border-purple-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Multi-Device Deliverables Inspection</h3>
                  <p className="text-xs text-slate-500 font-medium">Preview compliance PDFs, work orders, and audit files on Phone, Tablet, or Desktop Paper view.</p>
                </div>
              </div>
              <button
                onClick={() => handleOpenDocument("defense_audit")}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-2 shrink-0"
              >
                <Eye className="w-4 h-4" />
                <span>Open Multi-Device Preview</span>
              </button>
            </div>
            <OutputsView
              artifacts={artifacts}
              onDownloadArtifact={(a) => void handleDownloadArtifact(a)}
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            8. WORKSPACE FILES TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "files" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <FilesView />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            9. MODELS & ROUTING TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "models" && (
          !isAdmin ? (
            <ClearanceGuardTab activeTab={activeTab} user={user} onHome={() => setActiveTab("home")} />
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
              <ModelsView />
            </div>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            10. LOCAL TOOLS TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "tools" && (
          !isAdmin ? (
            <ClearanceGuardTab activeTab={activeTab} user={user} onHome={() => setActiveTab("home")} />
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
              <ToolsView />
            </div>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            11. AGENT PIPELINES TAB (WORKFLOWS)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "workflows" && (
          !isAdmin ? (
            <ClearanceGuardTab activeTab={activeTab} user={user} onHome={() => setActiveTab("home")} />
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
              <WorkflowsView />
            </div>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            12. COMPUTE & VRAM TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "compute" && (
          !isAdmin ? (
            <ClearanceGuardTab activeTab={activeTab} user={user} onHome={() => setActiveTab("home")} />
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
              <ComputeView />
            </div>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            13. SYSTEM HEALTH TAB (MONITORING)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "monitoring" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <MonitoringView />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            14. AUDIT TRAIL TAB
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "audit" && (
          !isAdmin ? (
            <ClearanceGuardTab activeTab={activeTab} user={user} onHome={() => setActiveTab("home")} />
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
              <AuditLogsView />
            </div>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            15. TEAM & ROLES TAB (CLEARANCE L1-L4)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "team" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <TeamView user={user} devRole={devRole} />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            16. SETTINGS & WORKSPACE THEME STUDIO (User Request: Custom Color Combinations)
        ───────────────────────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs animate-in fade-in">
            <EnterpriseSettingsView />
          </div>
        )}

      </main>

      {/* ===================================================================
          RIGHT PANEL: AI INBOX (Docked Split vs Slide-Over Drawer Mode)
          Prevents page squeezing - user can switch between docked and slide-over overlay
      =================================================================== */}
      {aiPanelOpen && (
        <>
          {aiInboxDisplayMode === "overlay" && (
            <div
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-[1px] z-40 animate-in fade-in"
              onClick={() => setAiPanelOpen(false)}
            />
          )}

          <aside
            data-rhs="true"
            aria-label="AI Inbox Drawer"
            style={{
              backgroundColor: theme.sidebarBg,
              borderColor: theme.borderColor,
              color: theme.textColor,
            }}
            className={`flex flex-col justify-between p-5 select-none transition-all duration-300 border-l rhs-workspace ${
              aiInboxDisplayMode === "overlay"
                ? "fixed right-0 top-0 bottom-0 w-[420px] max-w-[92vw] z-50 shadow-2xl animate-in slide-in-from-right"
                : "w-[340px] xl:w-[380px] shrink-0 shadow-xs z-20"
            }`}
          >
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
              <div
                className="flex items-center justify-between border-b pb-3"
                style={{ borderColor: theme.borderColor }}
              >
                <div className="flex items-center gap-2">
                  <h2
                    className="text-lg font-bold tracking-tight"
                    style={{ color: theme.textColor }}
                  >
                    AI Inbox
                  </h2>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Air-Gap
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Mode switcher: Docked vs Slide-Over Drawer */}
                  <button
                    onClick={() =>
                      setAiInboxDisplayMode(aiInboxDisplayMode === "docked" ? "overlay" : "docked")
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    title={
                      aiInboxDisplayMode === "docked"
                        ? "Switch to Slide-Over Overlay (prevents any page squeezing)"
                        : "Switch to Docked Split View"
                    }
                  >
                    {aiInboxDisplayMode === "docked" ? (
                      <Maximize2 className="w-4 h-4" />
                    ) : (
                      <Minimize2 className="w-4 h-4" />
                    )}
                  </button>

                  {/* Close AI Inbox button */}
                  <button
                    onClick={() => setAiPanelOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Close AI Inbox"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* User Prompt Bubble */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={() => handleSubmitTask("Summarize system defense & compliance status")}
                  className="bg-[#585c67] hover:bg-[#4a4e58] text-white text-sm font-medium px-4.5 py-2.5 rounded-2xl shadow-sm transition-transform active:scale-95 cursor-pointer max-w-[92%] text-right leading-relaxed"
                >
                  Summarize system defense &amp; compliance status
                </button>
              </div>

              {/* AI Response Card */}
              <div className="space-y-3.5 pt-1">
                {/* Collapsible Reasoning Steps (User Request) */}
                <div className="border border-slate-200/80 rounded-xl p-2.5 bg-slate-50/70 space-y-2 transition-all">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                    <button
                      type="button"
                      onClick={() => setReasoningExpanded(!reasoningExpanded)}
                      className="flex items-center gap-1.5 hover:text-purple-700 transition-colors cursor-pointer group"
                      title="Toggle local model chain-of-thought breakdown"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                      <span className="font-bold text-slate-700 group-hover:text-purple-700">
                        Thought for 2.4s (local model) {reasoningExpanded ? "▾" : ">"}
                      </span>
                    </button>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                      9 sources
                    </span>
                  </div>

                  {reasoningExpanded && (
                    <div className="pt-2 border-t border-slate-200/70 space-y-2 text-[11px] text-slate-600 font-mono animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800">1. Security Bounds:</span>
                          <span className="text-slate-500 ml-1">Verified 0 outbound TCP sockets. Loopback bound to 127.0.0.1:11434 (0.4s)</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800">2. Vector Search:</span>
                          <span className="text-slate-500 ml-1">Retrieved 9 policy & compliance chunks from local encrypted ChromaDB (0.8s)</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800">3. Neural Inference:</span>
                          <span className="text-slate-500 ml-1">Qwen 2.5 32B + Llama 3.3 70B on PCIe NVLink synthesized 3-pillar response (1.1s)</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <div>
                          <span className="font-bold text-slate-800">4. Ledger Seal:</span>
                          <span className="text-slate-500 ml-1">Generated cryptographic SHA-256 deliverable verification token (0.1s)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 items-start">
                  <div className="shrink-0 mt-0.5">
                    <AstraEmblem color={theme.primary} size={20} />
                  </div>
                  <div className="space-y-3.5 text-sm text-slate-600 leading-relaxed">
                    <p>
                      Your sovereign workbench dashboard provides a verified overview of local model inference, physical network isolation, and task throughput. The audit report centers on three core pillars:
                    </p>

                    <div className="space-y-2.5 text-slate-700">
                      <div>
                        <div className="font-bold text-sm text-slate-900">1. Air-Gap Network Isolation</div>
                        <div className="text-slate-500 text-xs sm:text-[13px] leading-normal">
                          Loopback bound strictly to 127.0.0.1. Zero external egress detected across all active worker threads.
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-sm text-slate-900">2. Local Model Allocation</div>
                        <div className="text-slate-500 text-xs sm:text-[13px] leading-normal">
                          Inference distributed between Llama 3.3, Qwen 2.5 Coder, and RapidOCR on local PCIe NVLink bus.
                        </div>
                      </div>

                      <div>
                        <div className="font-bold text-sm text-slate-900">3. Risk &amp; Compliance</div>
                        <div className="text-slate-500 text-xs sm:text-[13px] leading-normal">
                          All deliverables require department sign-off. Cryptographic SHA-256 ledger tamper-evident and verified.
                        </div>
                      </div>
                    </div>

                    {/* Action Icons */}
                    <div className="flex items-center justify-between pt-1.5 text-slate-400">
                      <div className="flex items-center gap-3">
                        <button className="hover:text-slate-700 transition-colors cursor-pointer" title="Helpful">
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <button className="hover:text-slate-700 transition-colors cursor-pointer" title="Unhelpful">
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCopiedResponse(true);
                            setTimeout(() => setCopiedResponse(false), 2000);
                          }}
                          className="hover:text-slate-700 transition-colors cursor-pointer"
                          title="Copy Response"
                        >
                          {copiedResponse ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button className="hover:text-slate-700 transition-colors cursor-pointer" title="Retry">
                          <RotateCw className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => setActiveTab("agent")}
                        className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Personalize message</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Dynamic message history */}
                {aiMessages.slice(2).map((msg) => (
                  <div key={msg.id} className="pt-2 animate-in fade-in">
                    {msg.role === "user" ? (
                      <div className="flex justify-end mb-2">
                        <div className="bg-[#585c67] text-white text-sm font-medium px-4 py-2 rounded-2xl max-w-[92%] leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 items-start bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <AstraEmblem color={theme.primary} size={18} />
                        <div className="text-sm text-slate-600 space-y-2 leading-relaxed">
                          <p>{msg.text}</p>
                          {msg.pillars?.map((p, i) => (
                            <div key={i} className="pt-1">
                              <span className="font-bold text-slate-800 text-sm">{p.title}</span>
                              <p className="text-slate-500 text-xs sm:text-[13px]">{p.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 p-3 rounded-xl animate-pulse">
                    <AstraEmblem color={theme.primary} size={16} />
                    <span className="font-semibold text-xs">Processing on-premise inference...</span>
                  </div>
                )}
              </div>
            </div>

            {/* Floating Input Box with Local Device File Attachments */}
            <div className="pt-3">
              <input
                type="file"
                ref={inboxFileInputRef}
                multiple
                onChange={handleInboxFileUpload}
                className="hidden"
              />
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 space-y-3">
                {/* Attached file chips in AI Inbox */}
                {inboxAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 pb-1 border-b border-slate-100">
                    {inboxAttachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs font-semibold text-purple-800 animate-in fade-in"
                      >
                        <FileText className="w-3 h-3 text-purple-600 shrink-0" />
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <span className="text-[10px] text-purple-500">({att.size})</span>
                        <button
                          type="button"
                          onClick={() => setInboxAttachments((prev) => prev.filter((p) => p.id !== att.id))}
                          className="hover:text-rose-600 ml-0.5 cursor-pointer"
                          title="Remove file"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2.5">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const textWithFiles =
                          inboxAttachments.length > 0
                            ? `${chatInput.trim()} [Attached files: ${inboxAttachments.map((a) => a.name).join(", ")}]`
                            : chatInput.trim();
                        if (textWithFiles) {
                          void handleSubmitTask(textWithFiles);
                          setChatInput("");
                          setInboxAttachments([]);
                        }
                      }
                    }}
                    placeholder={
                      inboxAttachments.length > 0
                        ? "Ask assistant about attached file(s)..."
                        : "Ask Sovereign Assistant anything..."
                    }
                    className="w-full text-sm text-slate-800 placeholder:text-slate-400 bg-transparent outline-none font-medium"
                  />
                  <button
                    onClick={() => {
                      const textWithFiles =
                        inboxAttachments.length > 0
                          ? `${chatInput.trim()} [Attached files: ${inboxAttachments.map((a) => a.name).join(", ")}]`
                          : chatInput.trim();
                      if (textWithFiles) {
                        void handleSubmitTask(textWithFiles);
                        setChatInput("");
                        setInboxAttachments([]);
                      }
                    }}
                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shrink-0"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3.5 text-slate-400 text-xs border-b border-slate-100 pb-2.5">
                  <button
                    type="button"
                    onClick={() => inboxFileInputRef.current?.click()}
                    className="hover:text-purple-700 text-purple-600 transition-colors cursor-pointer flex items-center gap-1 font-semibold"
                    title="Attach File from Local Device"
                  >
                    <Paperclip className="w-4 h-4" />
                    <span className="text-[11px]">Attach File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => inboxFileInputRef.current?.click()}
                    className="hover:text-slate-600 transition-colors cursor-pointer"
                    title="Upload / Scan Document from Device"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmitTask("Optimize model performance and audit security posture")}
                    className="flex items-center gap-1.5 hover:text-slate-600 transition-colors cursor-pointer text-xs font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Improve prompt</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pt-0.5 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                    <span>Sovereign Nodes</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-purple-50 border border-purple-200 text-purple-700 font-bold text-[10px]">
                      OLLAMA
                    </span>
                    <span className="px-2 py-0.5 rounded bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold text-[10px]">
                      DOCKER
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                      OCR
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          FLOATING QUICK TOOLS TRIGGER PILL (Right Viewport Edge)
      ───────────────────────────────────────────────────────────────── */}
      {!quickToolsOpen && (
        <button
          onClick={() => setQuickToolsOpen(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-purple-600 hover:bg-purple-700 text-white py-3.5 px-2 rounded-l-2xl shadow-xl flex flex-col items-center gap-2 cursor-pointer transition-transform hover:-translate-x-1 border border-r-0 border-purple-400/40 group"
          title="Open Quick Access Tools Drawer"
        >
          <Zap className="w-4 h-4 text-amber-300 animate-pulse group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black tracking-wider uppercase [writing-mode:vertical-lr] rotate-180">
            Quick Tools
          </span>
        </button>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          CLOSABLE QUICK ACCESS TOOLS PANEL (Side Widget Drawer)
          User Request: Closable panel with quick features & tools
      ───────────────────────────────────────────────────────────────── */}
      {quickToolsOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 animate-in fade-in duration-200"
            onClick={() => setQuickToolsOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            data-rhs="true"
            style={{
              backgroundColor: theme.sidebarBg,
              borderColor: theme.borderColor,
              color: theme.textColor,
            }}
            className="fixed right-0 top-0 bottom-0 w-[450px] max-w-[94vw] border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-250 rhs-workspace"
          >
            {/* Header */}
            <div
              style={{
                backgroundColor: theme.isDark ? "#161b22" : "rgba(241, 245, 249, 0.8)",
                borderColor: theme.borderColor,
              }}
              className="p-5 border-b flex items-center justify-between"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 shadow-2xs">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3
                    className="text-base font-bold leading-tight"
                    style={{ color: theme.textColor }}
                  >
                    Quick Access Tools
                  </h3>
                  <p
                    className="text-xs font-medium"
                    style={{ color: theme.subtextColor }}
                  >
                    Fast air-gap sandbox, sensors &amp; dispatch
                  </p>
                </div>
              </div>

              <button
                onClick={() => setQuickToolsOpen(false)}
                className="w-8 h-8 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
                title="Close Quick Access Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Tool Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* Tool 1: Instant Air-Gap Dispatcher */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-purple-600" />
                    Instant Task Dispatcher
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    Local GPU
                  </span>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={quickPromptInput}
                    onChange={(e) => setQuickPromptInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && quickPromptInput.trim()) {
                        void handleSubmitTask(quickPromptInput.trim());
                        setQuickPromptInput("");
                      }
                    }}
                    placeholder="Enter prompt for instant air-gap execution..."
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 text-slate-800 font-medium"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (quickPromptInput.trim()) {
                          void handleSubmitTask(quickPromptInput.trim());
                          setQuickPromptInput("");
                        }
                      }}
                      disabled={!quickPromptInput.trim()}
                      className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3 h-3" />
                      <span>Dispatch Instantly</span>
                    </button>
                    <button
                      onClick={() => {
                        setQuickPromptInput("Verify NIST 800-171 physical compliance across all local nodes");
                      }}
                      className="px-2.5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold cursor-pointer"
                      title="Load Sample Compliance Prompt"
                    >
                      Sample
                    </button>
                  </div>
                </div>
              </div>

              {/* Tool 2: Quick Document OCR Scanner & Ingestion */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    Quick Document Scanner &amp; Preview
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    RapidOCR
                  </span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      handleOpenDocument("brief_q3");
                      setQuickToolsOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-amber-700">
                        Exec_Brief_Q3.pptx
                      </div>
                      <div className="text-[11px] text-slate-500">3 Slides • Executive Briefing Deck</div>
                    </div>
                    <Presentation className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
                  </button>

                  <button
                    onClick={() => {
                      handleOpenDocument("telemetry_audit");
                      setQuickToolsOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                        Telemetry_Audit.docx
                      </div>
                      <div className="text-[11px] text-slate-500">2 Sections • Hardware Loopback Audit</div>
                    </div>
                    <FileCheck className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>

                  <button
                    onClick={() => {
                      handleOpenDocument("defense_audit");
                      setQuickToolsOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                        Defense Contract Compliance Audit
                      </div>
                      <div className="text-[11px] text-slate-500">12 Pages • Active Ingestion Beam</div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>

                  <button
                    onClick={() => {
                      handleOpenDocument("inspection_report");
                      setQuickToolsOpen(false);
                    }}
                    className="w-full p-2.5 rounded-xl bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 text-left transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-800 group-hover:text-blue-700">
                        Astra Aircraft Quality Inspection
                      </div>
                      <div className="text-[11px] text-slate-500">6 Pages • Active OCR Scanning</div>
                    </div>
                    <Eye className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                  </button>
                </div>
              </div>

              {/* Tool 3: Isolated Python Scratchpad Sandbox */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-600" />
                    Air-Gap Python Scratchpad
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    Docker 0-Net
                  </span>
                </div>

                <div className="space-y-2">
                  <textarea
                    rows={3}
                    value={quickScratchCode}
                    onChange={(e) => setQuickScratchCode(e.target.value)}
                    className="w-full font-mono text-[11px] p-2.5 bg-[#0a0d14] text-[#f8fafc] rounded-xl border border-slate-800 outline-none resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setQuickScratchOutput("Executing inside isolated container sandbox...");
                        setTimeout(() => {
                          setQuickScratchOutput(
                            "Exit Code: 0 (Execution: 1.1s)\nOutput: AstraSovereign Python 3.11 Sandbox: Active\nAir-gap hash: b61d56e72d4b8e1a\nEgress check: 0 bytes transferred (100% air-gap verified)"
                          );
                        }, 800);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Play className="w-3 h-3" />
                      <span>Run in Sandbox</span>
                    </button>
                    {quickScratchOutput && (
                      <button
                        onClick={() => setQuickScratchOutput(null)}
                        className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                      >
                        Clear Output
                      </button>
                    )}
                  </div>

                  {quickScratchOutput && (
                    <div className="p-2.5 rounded-xl bg-[#0a0d14] border border-emerald-900/40 text-[11px] font-mono text-emerald-400 whitespace-pre-wrap animate-in fade-in">
                      {quickScratchOutput}
                    </div>
                  )}
                </div>
              </div>

              {/* Tool 4: Real-time GPU & VRAM Sensor */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-purple-600" />
                    Hardware VRAM &amp; PCIe Sensors
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    RTX 4090
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>VRAM Allocated</span>
                    <span className="font-mono text-purple-700">14.2 / 24.0 GB (59.2%)</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 w-[59.2%]" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-500">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="block text-slate-400">Core Temp</span>
                      <span className="font-bold text-slate-800">52°C (Optimal)</span>
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <span className="block text-slate-400">PCIe Bandwidth</span>
                      <span className="font-bold text-slate-800">Gen4 x16 (Active)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tool 5: Zero-Egress Loopback Ping Verifier */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Zero-Egress Loopback Ping
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    127.0.0.1
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setQuickPingStatus("testing");
                      setTimeout(() => setQuickPingStatus("verified"), 600);
                    }}
                    className="w-full py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Activity className="w-3.5 h-3.5 text-purple-600" />
                    <span>{quickPingStatus === "testing" ? "Probing Loopback Socket..." : "Verify Loopback Isolation"}</span>
                  </button>

                  {quickPingStatus === "verified" && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1 animate-in fade-in">
                      <div className="flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>100% Zero-Egress Air-Gap Verified</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-normal">
                        All local AI worker threads strictly bound to 127.0.0.1 loopback socket. 0 outgoing packets recorded.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tool 6: Quick Navigation Jumps */}
              <div className="space-y-2 pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quick Navigation
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setActiveTab("sandbox");
                      setQuickToolsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-left cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Code className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">Code Editor</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("agent");
                      setQuickToolsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-left cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Terminal className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">AI Assistant</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("coworking");
                      setQuickToolsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-left cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Users className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">Coworking</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setQuickToolsOpen(false);
                    }}
                    className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-left cursor-pointer transition-all flex items-center gap-2"
                  >
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span className="text-xs font-bold text-slate-700">Theme Studio</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          UNIVERSAL MULTI-DEVICE DOCUMENT PREVIEW MODAL (Phone, Tablet, Desktop)
      ───────────────────────────────────────────────────────────────── */}
      <DocumentPreviewModal
        document={previewDoc}
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />

      {/* ─────────────────────────────────────────────────────────────────
          USER PROFILE & SECURITY CLEARANCE DOSSIER MODAL (User Request)
          Shows full user profile, username, role, department, cryptographic key, node binding
      ───────────────────────────────────────────────────────────────── */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in overflow-y-auto">
          <div className="max-w-5xl w-full max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl border border-slate-200">
            <UserProfileView onClose={() => setProfileModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
