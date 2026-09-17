"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Receipt,
  Target,
  TrendingUp,
  Bot,
  Settings,
  Shield,
  Terminal,
  Cpu,
  FileText,
  Lock,
  ChevronDown,
  ChevronsUpDown,
  ArrowUpRight,
  ArrowDownRight,
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
  Send,
  Search,
  Zap,
  Globe,
  Radio,
  ExternalLink,
  Layers,
  Palette,
  Volume2
} from "lucide-react";

/* =========================================================================
   THEMES CONFIGURATION (Exact Finixia Violet by default + optional switchers)
========================================================================= */
export type ColorTheme = "crimson" | "emerald" | "cobalt" | "amber";

interface ThemeStyles {
  name: string;
  primary: string;
  primaryLight: string;
  primarySoft: string;
  secondaryBar: string;
  accentBadge: string;
  glow: string;
}

const THEMES: Record<ColorTheme, ThemeStyles> = {
  crimson: {
    name: "Sovereign Crimson (Red)",
    primary: "#ef4444",
    primaryLight: "#f87171",
    primarySoft: "rgba(239, 68, 68, 0.1)",
    secondaryBar: "#fca5a5",
    accentBadge: "text-red-400 bg-red-950/40 border-red-900/40",
    glow: "rgba(239, 68, 68, 0.25)",
  },
  emerald: {
    name: "Sovereign Emerald",
    primary: "#059669",
    primaryLight: "#10b981",
    primarySoft: "#ecfdf5",
    secondaryBar: "#a7f3d0",
    accentBadge: "text-emerald-700 bg-emerald-50 border-emerald-200",
    glow: "rgba(5, 150, 105, 0.25)",
  },
  cobalt: {
    name: "Deep Cobalt",
    primary: "#2563eb",
    primaryLight: "#3b82f6",
    primarySoft: "#eff6ff",
    secondaryBar: "#bfdbfe",
    accentBadge: "text-blue-700 bg-blue-50 border-blue-200",
    glow: "rgba(37, 99, 235, 0.25)",
  },
  amber: {
    name: "Obsidian Gold",
    primary: "#d97706",
    primaryLight: "#f59e0b",
    primarySoft: "#fffbeb",
    secondaryBar: "#fde68a",
    accentBadge: "text-amber-700 bg-amber-50 border-amber-200",
    glow: "rgba(217, 119, 6, 0.25)",
  },
};

/* =========================================================================
   MONTHLY DATA FOR TOTAL REVENUE CHART
========================================================================= */
interface MonthBar {
  month: string;
  revenue: number; // in dollars (scale up to 1000)
  expense: number;
}

const MONTH_DATA: MonthBar[] = [
  { month: "Jan", revenue: 820, expense: 560 },
  { month: "Feb", revenue: 640, expense: 430 },
  { month: "Mar", revenue: 390, expense: 580 },
  { month: "Apr", revenue: 920, expense: 480 },
  { month: "May", revenue: 890, expense: 360 },
  { month: "Jun", revenue: 540, expense: 390 },
  { month: "Jul", revenue: 980, expense: 710 },
  { month: "Aug", revenue: 520, expense: 550 },
  { month: "Sept", revenue: 470, expense: 620 },
  { month: "Oct", revenue: 840, expense: 490 },
  { month: "Nov", revenue: 670, expense: 420 },
  { month: "Dec", revenue: 560, expense: 480 },
];

/* =========================================================================
   FINIXIA FLOWER / STAR ICON (Custom SVG matching the exact screenshot)
========================================================================= */
function FinixiaLogo({ color = "#ef4444", size = 26 }: { color?: string; size?: number }) {
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
      </g>
    </svg>
  );
}

/* =========================================================================
   TRANSACTIONS DATA (Matching the screenshot)
========================================================================= */
interface TransactionItem {
  id: string;
  name: string;
  type: string;
  time: string;
  amount: string;
  isPositive?: boolean;
  avatarBg: string;
  icon: React.ReactNode;
}

const TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    name: "Apple",
    type: "Subscription",
    time: "2 min ago",
    amount: "-$220.36",
    avatarBg: "bg-slate-900 text-white",
    icon: (
      <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.85-11.7-14.44-6-9.68-10.78-20.73-14.33-33.16-3.55-12.43-5.33-24.08-5.33-34.95 0-14.78 3.82-27.13 11.46-37.05 7.64-9.92 17.1-14.99 28.38-15.22 4.48 0 9.5 1.15 15.06 3.46 5.56 2.31 9.4 3.52 11.53 3.64 1.76-.12 5.86-1.39 12.31-3.82 6.45-2.43 11.83-3.54 16.14-3.35 12.33.6 22.39 5.09 30.18 13.48-10.74 6.52-16.01 15.42-15.82 26.7.2 9.02 3.6 16.63 10.2 22.84 6.6 6.21 14.54 9.77 23.82 10.68-2.29 7.18-5.16 14.44-8.61 21.78zm-32.99-106.91c0-6.19 2.24-12.19 6.72-18 4.48-5.81 10.15-9.67 17-11.58.4 1.3.6 2.62.6 3.96 0 6.09-2.3 12.08-6.9 17.97-4.6 5.89-10.37 9.87-17.3 11.94-.12-1.39-.12-2.82-.12-4.29z"/>
      </svg>
    ),
  },
  {
    id: "tx-2",
    name: "Acme",
    type: "Subscription",
    time: "10 min ago",
    amount: "-$110",
    avatarBg: "bg-zinc-800 text-white",
    icon: (
      <div className="w-4 h-4 rounded-full border-2 border-white/80 border-t-transparent animate-spin" style={{ animationDuration: '6s' }} />
    ),
  },
  {
    id: "tx-3",
    name: "Framer",
    type: "Subscription",
    time: "2h ago",
    amount: "-$220.36",
    avatarBg: "bg-sky-500 text-white",
    icon: (
      <span className="font-bold text-xs tracking-tighter">F</span>
    ),
  },
  {
    id: "tx-4",
    name: "Alex d.",
    type: "Payment",
    time: "Yesterday",
    amount: "-$220.36",
    avatarBg: "bg-amber-100 text-amber-800",
    icon: (
      <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-400 to-orange-400 flex items-center justify-center text-white text-[10px] font-bold">
        AD
      </div>
    ),
  },
  {
    id: "tx-5",
    name: "Stripe",
    type: "Payment",
    time: "12 Jul, 2026",
    amount: "+$3500",
    isPositive: true,
    avatarBg: "bg-indigo-600 text-white",
    icon: (
      <span className="font-bold text-[10px] tracking-tight">stripe</span>
    ),
  },
];

/* =========================================================================
   MAIN COMPONENT: FinixiaExactDashboard
========================================================================= */
export default function FinixiaExactDashboard() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [themeKey, setThemeKey] = useState<ColorTheme>("crimson");
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<string>("Last 30 days");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  
  // Dynamic animated chat history in AI Inbox
  const [aiMessages, setAiMessages] = useState([
    {
      id: "u-1",
      role: "user",
      text: "Summarize my portfolio performance",
    },
    {
      id: "a-1",
      role: "assistant",
      thoughtTime: "4 seconds",
      sourcesCount: 9,
      text: "Your portfolio dashboard provides a unified view of positions, performance, and risk. The overview centers on three core pillars:",
      pillars: [
        {
          title: "1. Portfolio Overview",
          desc: "Asset allocation, top holdings, and YTD returns across equities, fixed income, and alternatives.",
        },
        {
          title: "2. Market Analysis",
          desc: "Market trends, sector performance, and macro drivers influencing your positions.",
        },
        {
          title: "3. Risk & Compliance",
          desc: "Risk metrics (VaR, Sharpe), regulatory alerts, and compliance checks for your book.",
        },
      ],
    },
  ]);

  const [isThinking, setIsThinking] = useState(false);

  const theme = THEMES[themeKey];

  // Handle user question in AI Inbox
  const handleSendPrompt = (textToSend?: string) => {
    const query = textToSend || chatInput;
    if (!query.trim() || isThinking) return;

    const userMsg = {
      id: `u-${Date.now()}`,
      role: "user",
      text: query,
    };

    setAiMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setIsThinking(true);

    setTimeout(() => {
      const assistantMsg = {
        id: `a-${Date.now()}`,
        role: "assistant",
        thoughtTime: "2 seconds",
        sourcesCount: 6,
        text: `Analysis generated for: "${query}". All verification metrics conform with local confidential boundaries. Zero external data egress occurred.`,
        pillars: [
          {
            title: "1. Local Runtime Verification",
            desc: "Inference executed on NVIDIA RTX 4090 (14.2 / 24 GB VRAM) with 0 bytes outbound telemetry.",
          },
          {
            title: "2. Department Sign-Off Status",
            desc: "Clearance level verified at L3 (Dept Lead) with immutable SHA-256 ledger signed.",
          },
        ],
      };
      setAiMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
    }, 1200);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f5f8] text-slate-800 font-sans selection:bg-purple-200">
      
      {/* ===================================================================
          1. LEFT SIDEBAR (EXACT MATCH TO SCREENSHOT)
      =================================================================== */}
      <aside className="w-[230px] shrink-0 bg-white border-r border-slate-100 flex flex-col justify-between p-4 select-none">
        <div>
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 py-2 mb-6 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
            <div className="flex items-center gap-3">
              <FinixiaLogo color={theme.primary} size={28} />
              <div className="flex flex-col">
                <span className="font-extrabold text-[15px] tracking-tight text-slate-900 leading-tight">
                  Finixia
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  info@finixia.com
                </span>
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>

          {/* Section: Track */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Track
            </div>
            <nav className="space-y-1">
              {[
                { id: "overview", label: "Overview", icon: LayoutDashboard },
                { id: "spendings", label: "Spendings", icon: Receipt },
                { id: "goal", label: "Goal", icon: Target },
                { id: "investments", label: "Investments", icon: TrendingUp },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-[#f4f5f8] text-slate-900 font-bold shadow-2xs translate-x-1"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? "text-slate-900" : "text-slate-400"
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Section: Services */}
          <div className="mb-6">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Services
            </div>
            <nav className="space-y-1">
              {[
                { id: "assistant", label: "Assistant", icon: Bot },
                { id: "settings", label: "Settings", icon: Settings },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-[13px] font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "bg-[#f4f5f8] text-slate-900 font-bold shadow-2xs translate-x-1"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? "text-slate-900" : "text-slate-400"
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Integrated AstraSovereign Features Group */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center justify-between">
              <span>Sovereign Ops</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <nav className="space-y-1">
              {[
                { id: "sandbox", label: "Docker Sandbox", icon: Terminal },
                { id: "models", label: "Model Registry", icon: Cpu },
                { id: "audit", label: "Audit Ledger", icon: Lock },
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-2xl text-[12px] font-medium transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#f4f5f8] text-slate-900 font-bold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* User Profile Card (Bottom of Sidebar) */}
        <div className="pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-200 via-rose-200 to-indigo-300 p-0.5 shadow-2xs">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  <span className="font-bold text-xs text-slate-700">AL</span>
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[13px] text-slate-800 leading-tight">
                  Alixia
                </span>
                <span className="text-[10.5px] text-slate-400 font-medium">
                  info@alixia.com
                </span>
              </div>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
        </div>
      </aside>

      {/* ===================================================================
          2. MAIN CONTENT VIEWPORT (CENTER)
      =================================================================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto px-8 py-6 space-y-6">
        
        {/* Top Header: Welcome Alixia & + Add new Button */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Welcome Alixia
          </h1>

          <div className="flex items-center gap-3">
            {/* Color Theme Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setThemePickerOpen(!themePickerOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
                title="Change Color Theme"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: theme.primary }}
                />
                <Palette className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline text-[11px]">{theme.name.split(" ")[0]}</span>
              </button>

              {themePickerOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Select Theme Color
                  </div>
                  {(Object.keys(THEMES) as ColorTheme[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setThemeKey(key);
                        setThemePickerOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-xs font-medium hover:bg-slate-50 transition-colors text-left"
                    >
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: THEMES[key].primary }}
                      />
                      <span className="text-slate-700">{THEMES[key].name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* + Add new Button (Matching Screenshot) */}
            <button
              style={{ backgroundColor: theme.primary }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl text-white text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all transform cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add new</span>
            </button>
          </div>
        </div>

        {/* 4 Stat Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            {
              id: "rev",
              label: "Total revenue",
              val: "$4,500",
              pill: "+12.5%",
              icon: (
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="12" width="4" height="8" rx="1" />
                  <rect x="10" y="8" width="4" height="12" rx="1" />
                  <rect x="17" y="4" width="4" height="16" rx="1" />
                </svg>
              ),
            },
            {
              id: "exp",
              label: "Total expense",
              val: "$2,300",
              pill: "+12.5%",
              icon: (
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
              ),
            },
            {
              id: "profit",
              label: "Net profit",
              val: "$4,800",
              pill: "+12.5%",
              icon: (
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="1" />
                </svg>
              ),
            },
            {
              id: "flow",
              label: "Cashflow",
              val: "$2,500",
              pill: "+12.5%",
              icon: (
                <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                  <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              ),
            },
          ].map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-3xl p-5 border border-slate-100/90 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3">
                {item.icon}
                <span>{item.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-2xl sm:text-[26px] font-bold text-slate-900 tracking-tight">
                  {item.val}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  <ArrowUpRight className="w-3 h-3 stroke-[2.5]" />
                  <span>{item.pill}</span>
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Large Chart Card: Total Revenue (Exact Double Bar Chart) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs space-y-6">
          {/* Card Top Row with metrics and dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="12" width="4" height="8" rx="1" />
                  <rect x="10" y="8" width="4" height="12" rx="1" />
                  <rect x="17" y="4" width="4" height="16" rx="1" />
                </svg>
                <span>Total revenue</span>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                {/* Revenue Metric */}
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-0.5 rounded-full"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <span className="text-xs font-medium text-slate-500">Revenue</span>
                  <span className="text-2xl font-bold text-slate-900">
                    $8,750.00
                  </span>
                  <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md">
                    ^ 12%
                  </span>
                </div>

                {/* Expense Metric */}
                <div className="flex items-center gap-2">
                  <span className="w-3 h-0.5 rounded-full bg-rose-400 border border-dashed border-rose-400" />
                  <span className="text-xs font-medium text-slate-500">Expense</span>
                  <span className="text-xl font-bold text-slate-900">
                    1,852
                  </span>
                  <span className="inline-flex items-center text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded-md">
                    v 3%
                  </span>
                </div>
              </div>
            </div>

            {/* Timeframe Dropdown */}
            <div className="relative self-start sm:self-center">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span>{selectedTimeRange}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-40 text-xs animate-in fade-in">
                  {["Last 7 days", "Last 30 days", "Last 90 days", "Year to date"].map((opt) => (
                    <button
                      key={opt}
                      onClick={() => {
                        setSelectedTimeRange(opt);
                        setDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 text-slate-700 font-medium"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* DYNAMIC SVG DOUBLE-BAR CHART (Jan - Dec) */}
          <div className="relative pt-4 pb-2">
            <div className="flex justify-between items-end h-[210px] w-full px-2">
              {MONTH_DATA.map((item, idx) => {
                const maxVal = 1000;
                const revHeightPercent = Math.min((item.revenue / maxVal) * 100, 100);
                const expHeightPercent = Math.min((item.expense / maxVal) * 100, 100);
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={item.month}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="flex flex-col items-center flex-1 h-full justify-end group cursor-pointer"
                  >
                    {/* Hover Floating Tooltip */}
                    <div
                      className={`text-[10px] font-bold text-slate-700 bg-white border border-slate-200 shadow-md px-2 py-1 rounded-lg mb-2 transition-all duration-200 pointer-events-none ${
                        isHovered ? "opacity-100 scale-100 -translate-y-1" : "opacity-0 scale-90"
                      }`}
                    >
                      ${item.revenue} / ${item.expense}
                    </div>

                    {/* Dual Bars Container */}
                    <div className="flex items-end gap-1 sm:gap-1.5 w-full max-w-[28px] justify-center">
                      {/* 1. Primary Bar (Revenue) */}
                      <div
                        style={{
                          height: `${revHeightPercent}%`,
                          backgroundColor: theme.primary,
                        }}
                        className="w-2.5 sm:w-3 rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-110 group-hover:scale-y-105 origin-bottom"
                      />

                      {/* 2. Secondary Bar (Expense) */}
                      <div
                        style={{
                          height: `${expHeightPercent}%`,
                          backgroundColor: theme.secondaryBar,
                        }}
                        className="w-2.5 sm:w-3 rounded-t-sm transition-all duration-500 ease-out group-hover:brightness-95 group-hover:scale-y-105 origin-bottom"
                      />
                    </div>

                    {/* Month Label */}
                    <span className="text-[11px] font-medium text-slate-400 mt-3 group-hover:text-slate-800 transition-colors">
                      {item.month}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Horizontal Faint Guide Lines */}
            <div className="absolute inset-x-0 top-6 border-b border-slate-100 pointer-events-none" />
            <div className="absolute inset-x-0 top-20 border-b border-slate-100 pointer-events-none" />
            <div className="absolute inset-x-0 top-36 border-b border-slate-100 pointer-events-none" />
          </div>
        </div>

        {/* Bottom Row: Spending Breakdown & Transactions (2 Columns) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* 1. Spending Breakdown Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="12" width="4" height="8" rx="1" />
                    <rect x="10" y="8" width="4" height="12" rx="1" />
                    <rect x="17" y="4" width="4" height="16" rx="1" />
                  </svg>
                  <span>Spending breakdown</span>
                </div>
                <button className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  View all
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-slate-900">$4,250</span>
                <span className="inline-flex items-center text-[10.5px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full">
                  +2.3%
                </span>
              </div>

              {/* Segmented Pill Progress Bar */}
              <div className="flex items-center gap-1.5 h-2.5 w-full">
                <div
                  style={{ width: "45%", backgroundColor: theme.primary }}
                  className="h-full rounded-full transition-all duration-700"
                />
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-700" style={{ width: "30%" }} />
                <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: "25%" }} />
              </div>

              {/* Legend with Color Dots */}
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primary }} />
                  <span>Housing</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>Food &amp; Dining</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Transport</span>
                </div>
              </div>

              {/* Category Table */}
              <div className="pt-4 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 pb-1 border-b border-slate-100">
                  <span>Categories</span>
                  <div className="flex gap-12 pr-2">
                    <span>Percent</span>
                    <span>Total</span>
                  </div>
                </div>

                {[
                  {
                    cat: "Housing",
                    pct: "45%",
                    total: "$1,912",
                    iconColor: "text-purple-600 bg-purple-50",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                    ),
                  },
                  {
                    cat: "Food & Dining",
                    pct: "30%",
                    total: "$1,275",
                    iconColor: "text-amber-600 bg-amber-50",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 2v20M2 12h8a4 4 0 0 0 4-4V2" />
                      </svg>
                    ),
                  },
                  {
                    cat: "Transport",
                    pct: "25%",
                    total: "$1,063",
                    iconColor: "text-sky-600 bg-sky-50",
                    icon: (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="1" y="3" width="22" height="13" rx="2" />
                        <path d="M16 21v-2a2 2 0 0 0-2-2H10a2 2 0 0 0-2 2v2" />
                      </svg>
                    ),
                  },
                ].map((row) => (
                  <div
                    key={row.cat}
                    className="flex items-center justify-between py-1 hover:bg-slate-50/80 px-1 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${row.iconColor}`}>
                        {row.icon}
                      </div>
                      <span className="text-xs font-semibold text-slate-800">{row.cat}</span>
                    </div>

                    <div className="flex items-center gap-12 pr-2 text-xs">
                      <span className="text-slate-400 font-medium">{row.pct}</span>
                      <span className="font-bold text-slate-900 w-12 text-right">{row.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Transactions Card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4" />
                    <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span>Transactions</span>
                </div>
                <button className="text-xs font-semibold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                  View all
                </button>
              </div>

              <div className="space-y-3.5">
                {TRANSACTIONS.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between p-1 hover:bg-slate-50 rounded-2xl transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-2xs ${tx.avatarBg} group-hover:scale-105 transition-transform`}>
                        {tx.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 leading-tight">
                          {tx.name}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {tx.type}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold ${tx.isPositive ? "text-emerald-600" : "text-slate-900"}`}>
                        {tx.amount}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {tx.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

      </main>

      {/* ===================================================================
          3. RIGHT AI INBOX PANEL (EXACT MATCH TO SCREENSHOT)
      =================================================================== */}
      <aside className="w-[340px] shrink-0 bg-white border-l border-slate-100 flex flex-col justify-between p-5 select-none shadow-xs">
        
        {/* Header: AI Inbox */}
        <div className="space-y-4 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              AI Inbox
            </h2>
            <span className="text-[10.5px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Air-Gap
            </span>
          </div>

          {/* User Prompt Pill (Dark Charcoal Right-Aligned Bubble) */}
          <div className="flex justify-end pt-2">
            <button
              onClick={() => handleSendPrompt("Summarize my portfolio performance")}
              className="bg-[#585c67] hover:bg-[#4a4e58] text-white text-[11.5px] font-medium px-4 py-2 rounded-2xl shadow-sm transition-transform active:scale-95 cursor-pointer max-w-[90%] text-right leading-relaxed"
            >
              Summarize my portfolio performance
            </button>
          </div>

          {/* AI Response Card Container */}
          <div className="space-y-3 pt-1">
            {/* Thought time and sources pill */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
              <div className="flex items-center gap-1">
                <span className="text-amber-500">💡</span>
                <span>Thought for 4 seconds &gt;</span>
              </div>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.2 rounded-md">
                Swe 9 sources
              </span>
            </div>

            {/* Main AI Response Body */}
            <div className="flex gap-2.5 items-start">
              <div className="shrink-0 mt-0.5">
                <FinixiaLogo color={theme.primary} size={18} />
              </div>
              <div className="space-y-3 text-[11.5px] text-slate-600 leading-relaxed">
                <p>
                  Your portfolio dashboard provides a unified view of positions, performance, and risk. The overview centers on three core pillars:
                </p>

                <div className="space-y-2 text-slate-700">
                  <div>
                    <div className="font-bold text-slate-900">1. Portfolio Overview</div>
                    <div className="text-slate-500 text-[11px]">
                      Asset allocation, top holdings, and YTD returns across equities, fixed income, and alternatives.
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900">2. Market Analysis</div>
                    <div className="text-slate-500 text-[11px]">
                      Market trends, sector performance, and macro drivers influencing your positions.
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900">3. Risk &amp; Compliance</div>
                    <div className="text-slate-500 text-[11px]">
                      Risk metrics (VaR, Sharpe), regulatory alerts, and compliance checks for your book.
                    </div>
                  </div>
                </div>

                {/* Response Action Icons */}
                <div className="flex items-center justify-between pt-1 text-slate-400">
                  <div className="flex items-center gap-3">
                    <button className="hover:text-slate-700 transition-colors cursor-pointer">
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button className="hover:text-slate-700 transition-colors cursor-pointer">
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setCopiedResponse(true);
                        setTimeout(() => setCopiedResponse(false), 2000);
                      }}
                      className="hover:text-slate-700 transition-colors cursor-pointer"
                    >
                      {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button className="hover:text-slate-700 transition-colors cursor-pointer">
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer">
                    <Edit3 className="w-3 h-3" />
                    <span>Personalize message</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Additional Dynamically Sent AI Responses */}
            {aiMessages.slice(2).map((msg) => (
              <div key={msg.id} className="pt-2 animate-in fade-in">
                {msg.role === "user" ? (
                  <div className="flex justify-end mb-2">
                    <div className="bg-[#585c67] text-white text-[11.5px] font-medium px-4 py-2 rounded-2xl">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5 items-start bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <FinixiaLogo color={theme.primary} size={16} />
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <p>{msg.text}</p>
                      {msg.pillars?.map((p, i) => (
                        <div key={i}>
                          <span className="font-bold text-slate-800">{p.title}</span>
                          <p className="text-slate-500">{p.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 text-xs text-purple-600 bg-purple-50 p-2.5 rounded-xl animate-pulse">
                <FinixiaLogo color={theme.primary} size={14} />
                <span className="font-semibold text-[11px]">Computing locally via Llama 3.3...</span>
              </div>
            )}
          </div>
        </div>

        {/* Floating Input Card Container (Bottom) */}
        <div className="pt-3">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3 space-y-2.5">
            {/* Input Row */}
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendPrompt()}
                placeholder="Ask me anything"
                className="w-full text-xs text-slate-800 placeholder:text-slate-400 bg-transparent outline-none font-medium"
              />
              <button
                onClick={() => handleSendPrompt()}
                className="w-7 h-7 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-transform active:scale-90 cursor-pointer shrink-0"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Lower Attachment Toolbar */}
            <div className="flex items-center gap-3 text-slate-400 text-xs border-b border-slate-100 pb-2">
              <button className="hover:text-slate-600 transition-colors cursor-pointer">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button className="hover:text-slate-600 transition-colors cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <button className="flex items-center gap-1 hover:text-slate-600 transition-colors cursor-pointer text-[10.5px]">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Improve prompt</span>
              </button>
            </div>

            {/* Bottom Row: Connect Apps */}
            <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <span>🔗 Connect apps</span>
              </div>

              {/* Connected App Icons: Slack, Notion, GitHub */}
              <div className="flex items-center gap-1.5">
                {/* Slack Icon */}
                <span className="w-4 h-4 rounded bg-[#4A154B] text-white flex items-center justify-center font-bold text-[8px]">
                  S
                </span>
                {/* Excel / Microsoft Green */}
                <span className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center font-bold text-[8px]">
                  X
                </span>
                {/* Notion / Git */}
                <span className="w-4 h-4 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-[8px]">
                  N
                </span>
              </div>
            </div>
          </div>
        </div>

      </aside>

    </div>
  );
}
