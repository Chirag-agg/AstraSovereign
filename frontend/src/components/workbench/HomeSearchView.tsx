"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  LayoutDashboard,
  Wallet,
  BarChart2,
  Bot,
  Settings,
  Plus,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ShieldCheck,
  Terminal,
  Cpu,
  RefreshCw,
  Zap,
  Layers,
} from "lucide-react";
import type { ArtifactSummary, DocumentMeta, JobSummary } from "@/lib/types";

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface HomeSearchViewProps {
  onSearchSubmit: (query: string) => void;
  onNavigate: (section: any) => void;
  jobs: JobSummary[] | null;
  documents?: DocumentMeta[] | null;
  onDownloadArtifact: (artifact: ArtifactSummary) => void;
}

type DashTab = "overview" | "jobs" | "sandbox" | "models" | "audit";
type TimeRange = "7d" | "30d" | "90d";

/* ══════════════════════════════════════════════════════════════
   RIPPLE HOOK — fires a CSS ripple on any button click
══════════════════════════════════════════════════════════════ */
function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);

  const trigger = useCallback((e: React.MouseEvent) => {
    const btn = ref.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2;
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    const ripple = document.createElement("span");
    ripple.style.cssText = `
      position:absolute;left:${x}px;top:${y}px;
      width:${size}px;height:${size}px;border-radius:50%;
      background:rgba(255,255,255,0.35);pointer-events:none;
      transform:scale(0);animation:ripple-anim 0.55s ease-out forwards;
    `;
    btn.style.position = "relative";
    btn.style.overflow = "hidden";
    btn.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
  }, []);

  return { ref, trigger };
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED NUMBER COUNTER
══════════════════════════════════════════════════════════════ */
function CountUp({ target, suffix = "", prefix = "", duration = 1200 }: {
  target: number; suffix?: string; prefix?: string; duration?: number;
}) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  if (target > 1000) {
    const disp = val >= 1000 ? `${(val / 1000).toFixed(1)}K` : `${val}`;
    return <>{prefix}{disp}{suffix}</>;
  }
  return <>{prefix}{val.toLocaleString()}{suffix}</>;
}

/* ══════════════════════════════════════════════════════════════
   STAGGERED REVEAL WRAPPER
══════════════════════════════════════════════════════════════ */
function Reveal({ children, delay = 0, from = "bottom" }: {
  children: React.ReactNode; delay?: number; from?: "bottom" | "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVis(true); obs.disconnect(); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const startY = from === "bottom" ? 24 : 0;
  const startX = from === "left" ? -24 : from === "right" ? 24 : 0;

  return (
    <div
      ref={ref}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translate(0,0)" : `translate(${startX}px,${startY}px)`,
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.4,0,0.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RIPPLE BUTTON — drop-in replacement for <button>
══════════════════════════════════════════════════════════════ */
function RippleButton({
  onClick, className, style, children, type = "button",
}: {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string; style?: React.CSSProperties;
  children: React.ReactNode; type?: "button" | "submit";
}) {
  const { ref, trigger } = useRipple();
  return (
    <button
      ref={ref}
      type={type}
      onClick={(e) => { trigger(e); onClick?.(e); }}
      className={className}
      style={{ position: "relative", overflow: "hidden", ...style }}
    >
      {children}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════
   DATA
══════════════════════════════════════════════════════════════ */
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function generateBars(seed: number) {
  return MONTH_LABELS.map((m, i) => ({
    month: m,
    jobs:   Math.round(40 + 60 * Math.abs(Math.sin((i + seed) * 0.9))),
    tokens: Math.round(20 + 35 * Math.abs(Math.sin((i + seed) * 1.4))),
  }));
}
const BARS_DATA: Record<TimeRange, ReturnType<typeof generateBars>> = {
  "7d":  generateBars(0).slice(0, 7),
  "30d": generateBars(1),
  "90d": generateBars(3),
};

const TASK_BREAKDOWN = [
  { label: "Analysis",  pct: 45, color: "#14b8a6" },
  { label: "Code Gen",  pct: 28, color: "#0ea5e9" },
  { label: "Doc OCR",   pct: 17, color: "#f59e0b" },
  { label: "Reasoning", pct: 10, color: "#a78bfa" },
];

const RECENT_JOBS_DEMO = [
  { icon: "🔎", name: "Contract Risk Scan",     dept: "Legal",   delta: "-2 risks found",   ago: "2 min ago",   sign: -1 },
  { icon: "🧮", name: "Budget Variance Calc",   dept: "Finance", delta: "+$3,500 savings",  ago: "10 min ago",  sign:  1 },
  { icon: "🖼️", name: "Invoice OCR Batch",      dept: "Ops",     delta: "48 docs parsed",   ago: "2 h ago",     sign:  1 },
  { icon: "👤", name: "HR Policy Audit",         dept: "HR",      delta: "3 gaps flagged",   ago: "Yesterday",   sign: -1 },
  { icon: "⚡", name: "API Endpoint Test",       dept: "Eng",     delta: "4/4 passed",       ago: "12 Jul 2026", sign:  1 },
];

const STAT_CARDS = [
  { label: "Total Jobs Run",  rawVal: 1284,  display: "1,284",  icon: <Layers    className="w-4 h-4"/>, delta: "+12.5%", up: true,  accent: "#14b8a6" },
  { label: "Tokens Used",     rawVal: 8750,  display: "8.75M",  icon: <Zap       className="w-4 h-4"/>, delta: "+12%",   up: true,  accent: "#0ea5e9" },
  { label: "Active Agents",   rawVal: 4,     display: "4",      icon: <Cpu       className="w-4 h-4"/>, delta: "+1",     up: true,  accent: "#a78bfa" },
  { label: "Zero Egress",     rawVal: 0,     display: "0 B",    icon: <ShieldCheck className="w-4 h-4"/>, delta: "✓ Clean", up: true, accent: "#10b981" },
];

/* ══════════════════════════════════════════════════════════════
   ANIMATED BAR CHART (pure SVG)
══════════════════════════════════════════════════════════════ */
function BarChart({ data, range }: { data: ReturnType<typeof generateBars>; range: TimeRange }) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    setMounted(false);
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, [range]);

  const W = 560, H = 190, PAD_L = 36, PAD_B = 22, PAD_T = 12;
  const chartH = H - PAD_B - PAD_T;
  const maxVal = Math.max(...data.map(d => Math.max(d.jobs, d.tokens)), 1);
  const slotW = (W - PAD_L) / data.length;
  const barW = Math.max(4, Math.floor(slotW * 0.28));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full overflow-visible"
      style={{ height: 190 }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* guide lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
        <g key={i}>
          <line
            x1={PAD_L} x2={W}
            y1={PAD_T + chartH * (1 - t)} y2={PAD_T + chartH * (1 - t)}
            stroke="#e2e8f0" strokeWidth="0.6" strokeDasharray="3 4"
          />
          <text x={PAD_L - 4} y={PAD_T + chartH * (1 - t) + 4}
            textAnchor="end" fontSize="8.5" fill="#94a3b8">
            {Math.round(maxVal * t)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = PAD_L + i * slotW + slotW / 2;
        const jobH  = mounted ? Math.max(2, (d.jobs   / maxVal) * chartH) : 0;
        const tokH  = mounted ? Math.max(2, (d.tokens / maxVal) * chartH) : 0;
        const isHov = hovered === i;

        return (
          <g
            key={d.month}
            onMouseEnter={() => setHovered(i)}
            style={{ cursor: "pointer" }}
          >
            {/* hover highlight column */}
            <rect
              x={cx - slotW / 2} y={PAD_T}
              width={slotW} height={chartH}
              fill={isHov ? "rgba(20,184,166,0.06)" : "transparent"}
              rx={4}
              style={{ transition: "fill 0.15s" }}
            />

            {/* jobs bar */}
            <rect
              x={cx - barW - 1}
              y={PAD_T + chartH - jobH}
              width={barW} height={jobH}
              rx={3}
              fill={isHov ? "#0d9488" : "#14b8a6"}
              opacity={isHov ? 1 : 0.82}
              style={{
                transition: "height 0.65s cubic-bezier(0.4,0,0.2,1), y 0.65s cubic-bezier(0.4,0,0.2,1), fill 0.2s, opacity 0.2s",
                transitionDelay: `${i * 28}ms`,
              }}
            />

            {/* token bar */}
            <rect
              x={cx + 1}
              y={PAD_T + chartH - tokH}
              width={barW} height={tokH}
              rx={3}
              fill={isHov ? "#818cf8" : "#c7d2fe"}
              opacity={isHov ? 1 : 0.75}
              style={{
                transition: "height 0.65s cubic-bezier(0.4,0,0.2,1), y 0.65s cubic-bezier(0.4,0,0.2,1), fill 0.2s, opacity 0.2s",
                transitionDelay: `${i * 28 + 30}ms`,
              }}
            />

            {/* tooltip on hover */}
            {isHov && (
              <g>
                <rect
                  x={cx - 28} y={PAD_T + chartH - Math.max(jobH, tokH) - 40}
                  width={56} height={32} rx={6}
                  fill="white" stroke="#e2e8f0" strokeWidth="1"
                  style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.1))" }}
                />
                <text x={cx} y={PAD_T + chartH - Math.max(jobH, tokH) - 28}
                  textAnchor="middle" fontSize="9" fontWeight="700" fill="#14b8a6">
                  {d.jobs} jobs
                </text>
                <text x={cx} y={PAD_T + chartH - Math.max(jobH, tokH) - 16}
                  textAnchor="middle" fontSize="8.5" fill="#818cf8">
                  {d.tokens}k tok
                </text>
              </g>
            )}

            {/* month label */}
            <text
              x={cx} y={H - 4}
              textAnchor="middle" fontSize="8.5"
              fill={isHov ? "#14b8a6" : "#94a3b8"}
              fontWeight={isHov ? "700" : "400"}
              style={{ transition: "fill 0.2s, font-weight 0.2s" }}
            >
              {d.month}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   SPARKLINE
══════════════════════════════════════════════════════════════ */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 300); return () => clearTimeout(t); }, []);

  const W = 80, H = 28;
  const max = Math.max(...values), min = Math.min(...values);
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / (max - min || 1)) * H * 0.8 - H * 0.1;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}>
      <polyline
        points={drawn ? pts : pts.split(" ").slice(0, 1).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ transition: "points 1.2s cubic-bezier(0.4,0,0.2,1)" }}
      />
      {/* glow */}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
        opacity={0.15}
      />
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED DONUT
══════════════════════════════════════════════════════════════ */
function DonutChart({ segments }: { segments: { pct: number; color: string }[] }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 200); return () => clearTimeout(t); }, []);

  const R = 38, CX = 50, CY = 50, strokeW = 11;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <svg viewBox="0 0 100 100" className="w-20 h-20 -rotate-90">
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f1f5f9" strokeWidth={strokeW} />
      {segments.map((seg, i) => {
        const dash    = drawn ? (seg.pct / 100) * C : 0;
        const el = (
          <circle
            key={i} cx={CX} cy={CY} r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeW}
            strokeDasharray={`${dash} ${C - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
            style={{ transition: `stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1) ${i * 120}ms` }}
          />
        );
        offset += (seg.pct / 100) * C;
        return el;
      })}
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   LIVE PULSE DOT
══════════════════════════════════════════════════════════════ */
function PulseDot({ color = "#14b8a6" }: { color?: string }) {
  return (
    <span className="relative inline-flex w-2 h-2">
      <span
        className="absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ background: color, animation: "ping 1.4s cubic-bezier(0,0,0.2,1) infinite" }}
      />
      <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: color }} />
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════
   AI ASSISTANT PANEL
══════════════════════════════════════════════════════════════ */
interface AiPanelMsg {
  id: string; role: "user" | "ai"; text: string;
  sources?: number; bullets?: string[];
}

const INIT_MSGS: AiPanelMsg[] = [{
  id: "1", role: "ai",
  text: "Your workbench dashboard provides a unified view of running jobs, model performance, and system health across all three core pillars.",
  sources: 6,
  bullets: [
    "Job Overview — active tasks, queue depth, success rate.",
    "Model Analysis — GPU utilisation and per-model latency.",
    "Security & Compliance — egress counter, sandbox isolation and audit chain.",
  ],
}];

function AiPanel({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [msgs, setMsgs] = useState<AiPanelMsg[]>(INIT_MSGS);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { ref: sendRef, trigger: sendTrigger } = useRipple();

  const QUICK_PROMPTS = [
    "Summarise performance",
    "Best latency model?",
    "Show failed jobs",
  ];

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setMsgs(m => [...m, { id: Date.now().toString(), role: "user", text }]);
    setInput("");
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setMsgs(m => [...m, {
      id: (Date.now()+1).toString(), role: "ai",
      text: `Processing "${text.slice(0,36)}…" — all inference runs locally on your sovereign hardware with zero external egress.`,
    }]);
    setLoading(false);
    onSubmit(text);
  }, [loading, onSubmit]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  return (
    <aside
      className="flex flex-col h-full bg-white border-l border-slate-100"
      style={{ width: 280, minWidth: 220, maxWidth: 320 }}
    >
      {/* header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <PulseDot color="#14b8a6" />
          <span className="text-sm font-bold text-slate-800">AI Inbox</span>
        </div>
        <RippleButton
          onClick={() => send("Summarise my dashboard performance")}
          className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl text-white cursor-pointer transition-all hover:opacity-90 active:scale-95"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)", boxShadow: "0 2px 12px #14b8a640" }}
        >
          Summarise performance
        </RippleButton>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {msgs.map((m, idx) => (
          <div
            key={m.id}
            style={{
              opacity: 0,
              animation: `fadeSlideUp 0.4s ease ${idx * 60}ms forwards`,
            }}
          >
            {m.role === "ai" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="w-4 h-4 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
                    <Bot className="w-2.5 h-2.5 text-teal-500" />
                  </span>
                  Thought for 4 seconds ·
                  {m.sources && (
                    <span className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-500">
                      {m.sources} sources
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-slate-600 leading-relaxed">{m.text}</div>
                {m.bullets?.map((b, i) => {
                  const parts = b.split(" — ");
                  return (
                    <div key={i} className="text-[11.5px] text-slate-600 pl-2 border-l-2 border-teal-200">
                      <span className="font-bold text-slate-800">{parts[0]}</span>
                      {parts[1] ? ` — ${parts[1]}` : ""}
                    </div>
                  );
                })}
              </div>
            )}
            {m.role === "user" && (
              <div className="flex justify-end">
                <div
                  className="text-[12px] text-white rounded-2xl rounded-tr-sm px-3 py-2 max-w-[90%]"
                  style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)", boxShadow: "0 2px 12px #14b8a630" }}
                >
                  {m.text}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-slate-400" style={{ animation: "fadeSlideUp 0.3s ease forwards" }}>
            <span className="w-4 h-4 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center">
              <Bot className="w-2.5 h-2.5 text-teal-500 animate-pulse" />
            </span>
            <span className="flex gap-1">
              <span style={{ animation: "bounce 0.8s infinite 0ms" }}>·</span>
              <span style={{ animation: "bounce 0.8s infinite 150ms" }}>·</span>
              <span style={{ animation: "bounce 0.8s infinite 300ms" }}>·</span>
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* quick chip buttons */}
      <div className="px-4 pb-2 flex flex-wrap gap-1.5 shrink-0">
        {QUICK_PROMPTS.map(p => (
          <RippleButton
            key={p}
            onClick={() => send(p)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-teal-50 border border-slate-200 hover:border-teal-300 text-slate-600 hover:text-teal-700 cursor-pointer transition-all active:scale-95"
            style={{ background: undefined }}
          >
            {p}
          </RippleButton>
        ))}
      </div>

      {/* input */}
      <div className="px-4 pb-4 pt-1 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-teal-400 focus-within:shadow-[0_0_0_3px_rgba(20,184,166,0.12)] transition-all duration-200">
          <input
            className="flex-1 text-[12px] bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
            placeholder="Ask me anything"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") send(input); }}
          />
          <button
            ref={sendRef}
            type="button"
            onClick={e => { sendTrigger(e); send(input); }}
            className="text-teal-500 hover:text-teal-600 cursor-pointer transition-all hover:scale-110 active:scale-90"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            <button type="button" className="hover:text-slate-600 cursor-pointer transition-transform hover:scale-110 active:scale-90">📎</button>
            <button type="button" className="hover:text-slate-600 cursor-pointer transition-transform hover:scale-110 active:scale-90">💬</button>
            <button type="button" className="hover:text-slate-600 cursor-pointer flex items-center gap-1 transition-colors">
              <RefreshCw className="w-3 h-3" /> Improve prompt
            </button>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>Connect apps</span>
            {["$","≡","⚙"].map((s, i) => (
              <span key={i} className={`px-1.5 py-0.5 rounded font-mono text-[9px] cursor-pointer hover:scale-110 transition-transform active:scale-90 inline-block ${
                i===0?"bg-emerald-100 text-emerald-700":i===1?"bg-blue-100 text-blue-700":"bg-orange-100 text-orange-700"
              }`}>{s}</span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN DASHBOARD CONTENT
══════════════════════════════════════════════════════════════ */
function DashboardContent({
  jobs, onNavigate,
}: { jobs: JobSummary[] | null; onNavigate: (s: any) => void }) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const sparkData = [30, 45, 38, 60, 52, 70, 65, 80, 72, 90, 85, 95];

  return (
    <div className="flex-1 overflow-y-auto min-h-0 bg-[#f6f8fa]">
      {/* top bar */}
      <div className="flex items-center justify-between px-7 pt-7 pb-5">
        <Reveal delay={0}>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Welcome back 👋
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <PulseDot color="#10b981" />
              All systems sovereign &amp; air-gapped
            </p>
          </div>
        </Reveal>
        <Reveal delay={80} from="right">
          <RippleButton
            onClick={() => onNavigate("agent")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition-all hover:scale-105 active:scale-95 hover:shadow-lg"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)", boxShadow: "0 4px 16px #14b8a640" }}
          >
            <Plus className="w-4 h-4" /> New Task
          </RippleButton>
        </Reveal>
      </div>

      <div className="px-7 pb-10 space-y-6">
        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {STAT_CARDS.map((c, i) => (
            <Reveal key={i} delay={i * 70}>
              <div
                className="group bg-white rounded-2xl p-5 border border-slate-100 shadow-xs cursor-default transition-all duration-300 hover:shadow-lg hover:-translate-y-1"
                style={{ borderTop: `3px solid ${c.accent}` }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                    <span
                      className="p-1.5 rounded-lg transition-transform duration-300 group-hover:scale-110"
                      style={{ background: `${c.accent}18`, color: c.accent }}
                    >
                      {c.icon}
                    </span>
                    {c.label}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-black text-slate-900">
                    {c.rawVal === 0 ? "0 B" : c.rawVal < 10 ? c.rawVal :
                      <CountUp target={c.rawVal} />}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    <Sparkline values={sparkData.slice(0, 8)} color={c.accent} />
                    <span
                      className={`flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-lg ${c.up ? "text-emerald-600 bg-emerald-50" : "text-rose-500 bg-rose-50"}`}
                    >
                      {c.up ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownRight className="w-3 h-3"/>}
                      {c.delta}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* ── BAR CHART ── */}
        <Reveal delay={120}>
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <BarChart2 className="w-3.5 h-3.5 text-teal-500" /> Total job throughput
                </p>
                <div className="flex items-center gap-6 mt-1">
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      <CountUp target={1284} />
                    </span>
                    <span className="ml-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-lg">↑12%</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Jobs last period</p>
                  </div>
                  <div>
                    <span className="text-2xl font-black text-slate-900">
                      <CountUp target={8750} suffix="K" />
                    </span>
                    <span className="ml-2 text-xs font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-lg">↑3%</span>
                    <p className="text-[10px] text-slate-400 mt-0.5">Tokens processed</p>
                  </div>
                </div>
              </div>

              {/* time range switcher */}
              <div className="flex items-center gap-1 border border-slate-200 rounded-xl p-1 bg-slate-50">
                {(["7d","30d","90d"] as TimeRange[]).map(r => (
                  <RippleButton
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                      timeRange === r
                        ? "bg-white text-teal-600 shadow-xs border border-slate-200 scale-105"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/60"
                    }`}
                  >
                    {r}
                  </RippleButton>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-5 mb-3 text-[10.5px] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-teal-500 inline-block"/>Jobs run
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 rounded-full bg-indigo-200 inline-block"/>Token volume
              </span>
            </div>

            <BarChart data={BARS_DATA[timeRange]} range={timeRange} />
          </div>
        </Reveal>

        {/* ── BOTTOM ROW ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Task breakdown */}
          <Reveal delay={160} from="left">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-800">Task Breakdown</p>
                <RippleButton
                  onClick={() => onNavigate("jobs")}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-teal-50 transition-all active:scale-95"
                >
                  View all →
                </RippleButton>
              </div>

              <div className="flex items-center gap-5 mb-4">
                <DonutChart segments={TASK_BREAKDOWN} />
                <div className="space-y-1.5 flex-1">
                  <p className="text-2xl font-black text-slate-900">
                    <CountUp target={1284} />
                  </p>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg inline-block">+2.3%</span>
                  <p className="text-[10px] text-slate-400">Total tasks</p>
                </div>
              </div>

              {/* colour strip */}
              <div className="h-2 rounded-full overflow-hidden flex mb-3 transition-all">
                {TASK_BREAKDOWN.map(s => (
                  <div
                    key={s.label}
                    style={{ width: `${s.pct}%`, background: s.color, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-[10.5px] font-semibold text-slate-500 mb-4">
                {TASK_BREAKDOWN.map(s => (
                  <span key={s.label} className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.color }}/>
                    {s.label}
                  </span>
                ))}
              </div>

              {/* table */}
              <div className="space-y-0.5">
                <div className="grid grid-cols-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 pb-1 border-b border-slate-100">
                  <span>Category</span><span className="text-right">Share</span><span className="text-right">Jobs</span>
                </div>
                {TASK_BREAKDOWN.map((s, i) => (
                  <div
                    key={s.label}
                    className="grid grid-cols-3 text-[11.5px] font-medium text-slate-700 px-1 py-1.5 hover:bg-slate-50 rounded-lg transition-colors cursor-default group"
                    style={{ animationDelay: `${i*80}ms` }}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black transition-transform group-hover:scale-110"
                        style={{ background: `${s.color}20`, color: s.color }}
                      >
                        {s.label[0]}
                      </span>
                      {s.label}
                    </span>
                    <span className="text-right font-bold">{s.pct}%</span>
                    <span className="text-right text-slate-500">{Math.round(1284 * s.pct / 100)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Recent Tasks */}
          <Reveal delay={200} from="right">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 h-full">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-slate-800">Recent Tasks</p>
                <RippleButton
                  onClick={() => onNavigate("jobs")}
                  className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 cursor-pointer px-2 py-1 rounded-lg hover:bg-teal-50 transition-all active:scale-95"
                >
                  View all →
                </RippleButton>
              </div>

              <div className="space-y-0.5">
                {(jobs && jobs.length > 0
                  ? jobs.slice(0,5).map(j => ({
                      icon: j.status==="completed"?"✅":j.status==="running"?"⚡":j.status==="failed"?"❌":"⏳",
                      name: j.message?.slice(0,32) ?? j.job_id.slice(0,16),
                      dept: j.user_id ?? "User",
                      delta: j.status,
                      ago: j.created_at ? new Date(j.created_at).toLocaleDateString() : "–",
                      sign: j.status==="completed" ? 1 : -1,
                    }))
                  : RECENT_JOBS_DEMO
                ).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-2 py-2.5 rounded-xl cursor-pointer transition-all duration-200 hover:bg-slate-50 hover:translate-x-1 active:scale-[0.98]"
                    onClick={() => onNavigate("jobs")}
                    style={{
                      opacity: 0,
                      animation: `fadeSlideUp 0.4s ease ${i*60 + 200}ms forwards`,
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-base shrink-0 transition-transform hover:scale-110">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold text-slate-800 truncate">{item.name}</p>
                      <p className="text-[10.5px] text-slate-400">{item.dept}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-[12px] font-bold ${item.sign > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                        {item.delta}
                      </p>
                      <p className="text-[10px] text-slate-400">{item.ago}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   LEFT SIDEBAR
══════════════════════════════════════════════════════════════ */
const TRACK_NAV = [
  { id: "overview", label: "Overview",   icon: LayoutDashboard },
  { id: "jobs",     label: "Tasks",      icon: Wallet          },
  { id: "sandbox",  label: "Sandbox",    icon: Terminal        },
  { id: "models",   label: "Models",     icon: Cpu             },
];
const SERVICE_NAV = [
  { id: "agent",    label: "AI Assistant", icon: Bot      },
  { id: "settings", label: "Settings",     icon: Settings },
];

function DashSidebar({
  activeTab, onTab, onNavigate, user,
}: { activeTab: DashTab; onTab: (t: DashTab) => void; onNavigate: (s: any) => void; user: string }) {
  return (
    <aside
      className="flex flex-col bg-white border-r border-slate-100 py-5 shrink-0"
      style={{ width: 200, minWidth: 180 }}
    >
      {/* Logo */}
      <div className="px-5 mb-6 flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white transition-transform hover:scale-110 cursor-default"
          style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)", boxShadow: "0 2px 10px #14b8a640" }}
        >
          AS
        </div>
        <div>
          <p className="text-[13px] font-extrabold text-slate-900 leading-none">AstraSovereign</p>
          <p className="text-[10px] text-slate-400 flex items-center gap-1">
            <PulseDot color="#10b981" />
            {user}
          </p>
        </div>
      </div>

      {/* Track */}
      <div className="px-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">Track</p>
        {TRACK_NAV.map(n => {
          const isActive = (activeTab as string) === n.id;
          const Icon = n.icon;
          return (
            <RippleButton
              key={n.id}
              onClick={() => { onTab(n.id as DashTab); if (n.id !== "overview") onNavigate(n.id); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all mb-0.5 text-left
                ${isActive
                  ? "bg-teal-50 text-teal-700 border border-teal-100 shadow-xs"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-0.5"
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-teal-500 scale-110" : "text-slate-400"}`} />
              {n.label}
              {isActive && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "#14b8a6", boxShadow: "0 0 6px #14b8a6" }}
                />
              )}
            </RippleButton>
          );
        })}
      </div>

      {/* Services */}
      <div className="px-3 mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">Services</p>
        {SERVICE_NAV.map(n => {
          const Icon = n.icon;
          return (
            <RippleButton
              key={n.id}
              onClick={() => onNavigate(n.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold cursor-pointer transition-all mb-0.5 text-left text-slate-500 hover:bg-slate-50 hover:text-slate-800 hover:translate-x-0.5"
            >
              <Icon className="w-4 h-4 text-slate-400 shrink-0" />
              {n.label}
            </RippleButton>
          );
        })}
      </div>

      <div className="flex-1"/>

      {/* User */}
      <div className="px-4 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-all group">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 transition-transform group-hover:scale-110"
            style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)" }}
          >
            {user.slice(0,2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-slate-800 truncate">{user}</p>
            <p className="text-[10px] text-slate-400 truncate">info@sovereign.local</p>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto transition-transform group-hover:translate-y-0.5" />
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════
   ROOT — animated tab transitions
══════════════════════════════════════════════════════════════ */
export default function HomeSearchView({
  onSearchSubmit, onNavigate, jobs, documents, onDownloadArtifact,
}: HomeSearchViewProps) {
  const [activeTab, setActiveTab] = useState<DashTab>("overview");
  const [animDir, setAnimDir] = useState<"left"|"right">("right");
  const [visible, setVisible] = useState(true);

  const TAB_ORDER: DashTab[] = ["overview","jobs","sandbox","models","audit"];

  const switchTab = useCallback((next: DashTab) => {
    if (next === activeTab) return;
    const from = TAB_ORDER.indexOf(activeTab);
    const to   = TAB_ORDER.indexOf(next);
    setAnimDir(to > from ? "right" : "left");
    setVisible(false);
    setTimeout(() => { setActiveTab(next); setVisible(true); }, 200);
  }, [activeTab]);

  const user = jobs?.[0]?.user_id ?? "user-001";

  const tabTransition = {
    opacity:   visible ? 1 : 0,
    transform: visible ? "translateX(0) scale(1)" : `translateX(${animDir==="right"?"-18px":"18px"}) scale(0.99)`,
    transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(0.4,0,0.2,1)",
  };

  return (
    <>
      {/* ── global keyframes injected once ── */}
      <style>{`
        @keyframes ripple-anim {
          to { transform: scale(1); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
      `}</style>

      <div className="flex h-full w-full overflow-hidden" style={{ background: "#f6f8fa" }}>
        {/* LEFT */}
        <DashSidebar activeTab={activeTab} onTab={switchTab} onNavigate={onNavigate} user={user} />

        {/* CENTRE */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden" style={tabTransition}>
          {activeTab === "overview" && (
            <DashboardContent jobs={jobs} onNavigate={onNavigate} />
          )}

          {activeTab === "jobs" && (
            <div className="flex-1 overflow-y-auto p-8" style={{ height: "100%" }}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-extrabold text-slate-900">Task Queue</h2>
                <RippleButton
                  onClick={() => onNavigate("agent")}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white cursor-pointer hover:scale-105 active:scale-95 transition-all"
                  style={{ background: "linear-gradient(135deg,#14b8a6,#0ea5e9)" }}
                >
                  <Plus className="w-4 h-4"/> New Task
                </RippleButton>
              </div>
              <div className="space-y-2">
                {(jobs ?? []).slice(0, 20).map((j, i) => (
                  <div
                    key={j.job_id}
                    className="flex items-center gap-4 bg-white rounded-2xl px-5 py-4 border border-slate-100 shadow-xs hover:shadow-md cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-200"
                    style={{ animation: `fadeSlideUp 0.35s ease ${i*40}ms both` }}
                    onClick={() => onNavigate("jobs")}
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      j.status==="running"?"bg-teal-400 animate-pulse":
                      j.status==="completed"?"bg-emerald-400":
                      j.status==="failed"?"bg-rose-400":"bg-slate-300"}`}
                    />
                    <p className="flex-1 text-[13px] font-semibold text-slate-800 truncate">
                      {j.message ?? j.job_id}
                    </p>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg ${
                      j.status==="running"?"bg-teal-50 text-teal-700":
                      j.status==="completed"?"bg-emerald-50 text-emerald-700":
                      j.status==="failed"?"bg-rose-50 text-rose-700":"bg-slate-100 text-slate-600"}`}>
                      {j.status}
                    </span>
                  </div>
                ))}
                {(!jobs || jobs.length === 0) && (
                  <p className="text-slate-400 text-sm">
                    No tasks yet.{" "}
                    <RippleButton
                      onClick={() => onNavigate("agent")}
                      className="text-teal-600 font-semibold cursor-pointer hover:underline"
                    >
                      Start a new task →
                    </RippleButton>
                  </p>
                )}
              </div>
            </div>
          )}

          {(activeTab === "sandbox" || activeTab === "models" || activeTab === "audit") && (
            <div className="flex items-center justify-center h-full">
              <div
                className="text-center"
                style={{ animation: "fadeSlideUp 0.4s ease both" }}
              >
                <div className="text-6xl mb-5" style={{ animation: "bounce 2s ease infinite" }}>
                  {activeTab==="sandbox"?"🔒":activeTab==="models"?"🧠":"📜"}
                </div>
                <h3 className="text-2xl font-extrabold text-slate-700 mb-2">
                  {activeTab==="sandbox"?"Docker Sandbox":activeTab==="models"?"Model Registry":"Audit Chain"}
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  {activeTab==="sandbox"?"Isolated execution with --network none":""}
                  {activeTab==="models"?"On-premise model routing matrix":""}
                  {activeTab==="audit"?"Tamper-proof cryptographic log chain":""}
                </p>
                <RippleButton
                  onClick={() => onNavigate(activeTab)}
                  className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold text-white cursor-pointer mx-auto transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg,#14b8a6,#0ea5e9)",
                    boxShadow: "0 8px 32px #14b8a640",
                  }}
                >
                  Open Full View →
                </RippleButton>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT AI */}
        <AiPanel onSubmit={onSearchSubmit} />
      </div>
    </>
  );
}
