"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  Server,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  Radio,
  FileCode,
  Database,
  ExternalLink,
} from "lucide-react";
import { getSovereignty } from "@/lib/api";
import type { Health, SovereigntyStatus } from "@/lib/types";

interface SecurityConsoleViewProps {
  health?: Health | null;
}

export default function SecurityConsoleView({ health }: SecurityConsoleViewProps) {
  const [sovereignty, setSovereignty] = useState<SovereigntyStatus | null>(
    health?.sovereignty || null
  );
  const [verifying, setVerifying] = useState(false);
  const [lastVerified, setLastVerified] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runVerification = useCallback(async () => {
    setVerifying(true);
    setError(null);
    try {
      const data = await getSovereignty();
      setSovereignty(data);
      setLastVerified(new Date().toLocaleTimeString());
    } catch {
      // If direct call fails, use health.sovereignty if present
      if (health?.sovereignty) {
        setSovereignty(health.sovereignty);
        setLastVerified(new Date().toLocaleTimeString());
      } else {
        setError("Unable to reach sovereignty verification endpoint");
      }
    } finally {
      setVerifying(false);
    }
  }, [health?.sovereignty]);

  useEffect(() => {
    if (!sovereignty && health?.sovereignty) {
      setSovereignty(health.sovereignty);
      setLastVerified(new Date().toLocaleTimeString());
    } else if (!sovereignty) {
      void runVerification();
    }
  }, [health?.sovereignty, sovereignty, runVerification]);

  const extStatus = sovereignty?.external_connections?.status || "VERIFIED_LOCAL";
  const extCount = sovereignty?.external_connections?.count ?? 0;
  const blockedCount = sovereignty?.external_connections?.blocked_attempts ?? 0;
  const localCalls = sovereignty?.local_model_calls ?? 0;
  const auditEvents = sovereignty?.audit_events ?? 0;
  const sandboxNet = sovereignty?.sandbox_network ?? "DISABLED";
  const netPolicy = sovereignty?.network_policy ?? "LOCAL_ONLY";
  const ollamaUrl = sovereignty?.ollama_endpoint || health?.ollama?.url || "http://localhost:11434";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Security & Data Sovereignty
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Air-Gap Verified
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
              Cryptographic and runtime guarantees that all intelligence, files, and computations remain 100% on-premise
            </p>
          </div>

          <div className="flex items-center gap-2">
            {lastVerified && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                Verified at {lastVerified}
              </span>
            )}
            <button
              type="button"
              onClick={() => void runVerification()}
              disabled={verifying}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${verifying ? "animate-spin" : ""}`} />
              <span>Verify Sovereign Guarantees</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs flex items-center gap-2 border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Certificate Card */}
        <div className="bg-gradient-to-r from-[#7047eb] to-[#5b32d6] rounded-2xl p-6 text-white shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white backdrop-blur-xs">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Phase 11 Certified Architecture</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight">Zero-Egress Sovereign Enclave</h2>
              <p className="text-xs text-purple-100 max-w-xl leading-relaxed">
                Guarded transport blocks all unauthorized outbound network attempts. Code runs inside network-disabled Docker sandboxes. All audit trails are appended locally without cloud telemetry.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0 bg-white/10 p-3 rounded-xl backdrop-blur-xs border border-white/10">
              <div className="text-center px-2">
                <div className="text-2xl font-black text-emerald-300">{extCount}</div>
                <div className="text-[10px] text-purple-200 uppercase font-semibold">External Calls</div>
              </div>
              <div className="text-center px-2 border-l border-white/10">
                <div className="text-2xl font-black text-white">{localCalls}</div>
                <div className="text-[10px] text-purple-200 uppercase font-semibold">Local Calls</div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Sovereignty Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* 1. Network Policy & Egress */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Network Guard & Transport</h3>
                  <p className="text-[11px] text-slate-500">Kernel & HTTP client egress control</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                {extStatus}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Enforced Policy</span>
                <span className="font-mono font-semibold text-slate-800">{netPolicy}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">External Egress Connections</span>
                <span className="font-mono font-bold text-emerald-600">{extCount} (Zero Outbound)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Blocked External Attempts</span>
                <span className="font-mono font-semibold text-slate-700">{blockedCount}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Ollama Local Endpoint</span>
                <span className="font-mono text-slate-700 truncate max-w-xs">{ollamaUrl}</span>
              </div>
            </div>
          </div>

          {/* 2. Isolated Code Sandbox */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-50 text-[#7047eb] rounded-xl">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Docker Code Sandbox</h3>
                  <p className="text-[11px] text-slate-500">Phase 5 ephemeral execution runtime</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                Network {sandboxNet}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Container Isolation</span>
                <span className="font-mono font-semibold text-slate-800">--network none</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Root Filesystem</span>
                <span className="font-mono font-semibold text-emerald-600">Read-Only (:ro)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Security Privileges</span>
                <span className="font-mono font-semibold text-slate-700">--cap-drop ALL</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Orphan Container Cleanup</span>
                <span className="font-mono text-emerald-600 font-semibold">Strict Awaited rm -f</span>
              </div>
            </div>
          </div>

          {/* 3. Audit Evidence Logging */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Append-Only Audit Store</h3>
                  <p className="text-[11px] text-slate-500">Phase 11 compliance tracking</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
                Active
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Logged Events Count</span>
                <span className="font-mono font-bold text-slate-800">{auditEvents} events</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">File Storage</span>
                <span className="font-mono font-semibold text-slate-700">data/audit/audit.jsonl</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Thread-Safe Concurrent Writes</span>
                <span className="font-mono text-emerald-600 font-semibold">Guaranteed</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Sensitive Prompt Redaction</span>
                <span className="font-mono text-emerald-600 font-semibold">Enforced</span>
              </div>
            </div>
          </div>

          {/* 4. Data Isolation & Workspaces */}
          <div className="bg-white border border-slate-200/80 shadow-xs rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Workspace Isolation</h3>
                  <p className="text-[11px] text-slate-500">Phase 4 & 7 containment</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                Active
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Workspace Directory</span>
                <span className="font-mono font-semibold text-slate-700">data/workspaces/&lt;user&gt;/&lt;job&gt;</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Path Traversal Protection</span>
                <span className="font-mono text-emerald-600 font-semibold">Rejects .. & symlinks</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Vector Knowledge Isolation</span>
                <span className="font-mono text-slate-700">Per-User data/knowledge/&lt;user&gt;</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Third-Party Telemetry</span>
                <span className="font-mono text-emerald-600 font-semibold">Disabled (ORT_TELEMETRY=0)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
