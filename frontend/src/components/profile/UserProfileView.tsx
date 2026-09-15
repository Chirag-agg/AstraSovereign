"use client";

import React, { useState } from "react";
import {
  Shield,
  Key,
  Cpu,
  Laptop,
  CheckCircle2,
  Camera,
  Copy,
  Check,
  Clock,
  Sparkles,
  FileCheck,
  Presentation,
  Terminal,
  LogOut,
  RefreshCw,
  ExternalLink,
  Edit2,
  Lock,
  HardDrive,
  Activity,
  Layers,
  Fingerprint,
} from "lucide-react";

interface UserProfileViewProps {
  onClose?: () => void;
}

export default function UserProfileView({ onClose }: UserProfileViewProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "credentials" | "sessions">("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState("Alex Rivera");
  const [handle, setHandle] = useState("@arivera_l4");
  const [bio, setBio] = useState(
    "Managing on-premise multi-agent task pipelines and compliance audits across air-gapped GPU nodes."
  );
  const [department, setDepartment] = useState("Defense Intelligence & Systems Avionics");
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedPgp, setCopiedPgp] = useState(false);
  const [revokedNotice, setRevokedNotice] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState(1);

  const auditHash = "sha256:d82e81fc04910e53a258a1835e0766ff0571c69b8493ab12";
  const pgpFingerprint = "8F2A 4B91 C038 9E21 D477 A902 3B4E 718C 9493 021F";

  const handleCopyHash = () => {
    navigator.clipboard.writeText(auditHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyPgp = () => {
    navigator.clipboard.writeText(pgpFingerprint);
    setCopiedPgp(true);
    setTimeout(() => setCopiedPgp(false), 2000);
  };

  const handleRevokeSessions = () => {
    setRevokedNotice(true);
    setTimeout(() => setRevokedNotice(false), 3000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-8">
      {/* ─────────────────────────────────────────────────────────────────
          HEADER & SLEEK GEOMETRIC AURORA BANNER
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Cover Banner: Deep slate with soft violet aurora mesh */}
        <div className="relative h-44 sm:h-52 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 overflow-hidden">
          {/* Aurora Mesh Glow Overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(99,102,241,0.25),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(168,85,247,0.2),transparent_55%)]" />
          
          {/* Subtle Geometric Wireframe Grid */}
          <div className="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Top Right Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Airgap Node Online
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-full text-xs font-bold bg-slate-900/80 backdrop-blur-md text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div className="px-6 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-5">
            {/* 96px Avatar Unit with Camera Button */}
            <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-full ring-4 ring-white bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl flex items-center justify-center text-white font-black text-2xl select-none shrink-0 overflow-hidden">
              <span>{fullName.slice(0, 2).toUpperCase()}</span>
              
              {/* Editable Camera Overlay Button */}
              <button
                type="button"
                onClick={() => setAvatarSeed((s) => s + 1)}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-80 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                title="Change Avatar Profile Photo"
              >
                <Camera className="w-5 h-5 mb-0.5" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Upload</span>
              </button>

              {/* Status Indicator Dot */}
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-400 animate-pulse" />
            </div>

            {/* Actions: Edit Profile Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
                  isEditing
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{isEditing ? "Done Editing" : "Edit Profile"}</span>
              </button>
            </div>
          </div>

          {/* Identity Block */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {isEditing ? (
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-2xl sm:text-3xl font-black text-slate-900 border-b border-purple-400 focus:outline-none bg-purple-50/40 px-1 py-0.5 rounded"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  {fullName}
                </h1>
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="text-sm font-bold text-purple-600 font-mono border-b border-purple-300 focus:outline-none bg-purple-50/40 px-1 rounded"
                />
              ) : (
                <span className="text-sm font-bold text-slate-400 font-mono">
                  {handle}
                </span>
              )}

              {/* Prominent L4 Clearance Pill Badge */}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 shadow-2xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-purple-600" />
                <span>L4 Sovereign Directorate</span>
              </span>
            </div>

            {/* Department */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span>Department:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="text-xs font-semibold text-slate-800 border-b border-purple-300 bg-purple-50/30 px-1 rounded"
                />
              ) : (
                <span className="text-slate-800">{department}</span>
              )}
            </div>

            {/* Bio Textarea */}
            <div className="pt-1">
              {isEditing ? (
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full text-xs sm:text-sm text-slate-700 p-2.5 rounded-xl border border-purple-300 bg-purple-50/30 focus:outline-none resize-none leading-relaxed"
                />
              ) : (
                <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                  {bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 sm:px-8 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview &amp; Activity</span>
          </button>

          <button
            onClick={() => setActiveTab("credentials")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "credentials"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Hardware Security &amp; Keys</span>
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "sessions"
                ? "border-purple-600 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Laptop className="w-4 h-4" />
            <span>Session &amp; Device Security</span>
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          TAB CONTENT
      ───────────────────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Dispatched Tasks
              </span>
              <div className="text-3xl font-black text-slate-900">142 Tasks</div>
              <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% on-premise loopback execution
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Deliverables Generated
              </span>
              <div className="text-3xl font-black text-purple-700">38 Slides/Docs</div>
              <p className="text-[11px] text-slate-500 font-medium">
                PPTX slide decks, DOCX reports, OCR sheets
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Audit Signature Hash
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-800 pt-1">
                <span className="truncate max-w-[170px]" title={auditHash}>
                  {auditHash.slice(0, 16)}...{auditHash.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                  title="Copy SHA-256 Audit Signature"
                >
                  {copiedHash ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold">
                Genesis Block #8493 notarized
              </p>
            </div>
          </div>

          {/* Quick Activity Feed */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Recent Sovereign Activity</h3>
              <span className="text-xs text-slate-400 font-medium">Synced with Local Ledger</span>
            </div>

            <div className="space-y-3.5 divide-y divide-slate-100">
              <div className="flex items-start gap-3.5 pt-3 first:pt-0">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Executed sandbox test on anomaly_detect.py
                  </p>
                  <p className="text-xs text-slate-500">
                    Ephemeral Docker runtime • 0 bytes egress detected • Memory capped at 512MB
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium shrink-0">2h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Presentation className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Generated Exec_Brief_Q3.pptx slide deck
                  </p>
                  <p className="text-xs text-slate-500">
                    3 Slides • Hardware Telemetry &amp; NVLink Benchmarks • Signed with SHA-256
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium shrink-0">4h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Signed Telemetry_Audit.docx with local PGP key
                  </p>
                  <p className="text-xs text-slate-500">
                    Hardware loopback isolation report • NIST SP 800-171 criteria verified
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium shrink-0">6h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Cleared Defense Contract Compliance Audit 2026
                  </p>
                  <p className="text-xs text-slate-500">
                    12 Pages • L4 Directorate clearance seal attached
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-medium shrink-0">1d ago</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Card 1: Hardware Passkey */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">FIDO2 Hardware Security Passkey</h4>
                  <p className="text-xs text-slate-500">Physical hardware token for L4 authorization gating</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                YubiKey 5C NFC • Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold text-[11px]">Hardware Serial</span>
                <span className="font-mono font-bold text-slate-800">#9482-1049-NFC</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold text-[11px]">Key Algorithm</span>
                <span className="font-mono font-bold text-slate-800">FIDO2 / ECC P-256</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-slate-400 block font-semibold text-[11px]">Touch Policy</span>
                <span className="font-bold text-emerald-700">Enforced &amp; Verified</span>
              </div>
            </div>
          </div>

          {/* Card 2: Local PGP Signing Key */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-700">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Local PGP Deliverable Signing Key</h4>
                  <p className="text-xs text-slate-500">Signs Word (.docx) and PowerPoint (.pptx) artifacts offline</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                RSA 4096 • Active
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 text-white font-mono text-xs flex items-center justify-between">
              <div className="space-y-0.5 truncate mr-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Fingerprint</span>
                <span className="text-purple-300 font-bold">{pgpFingerprint}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPgp}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                {copiedPgp ? "Copied!" : "Copy Key"}
              </button>
            </div>
          </div>

          {/* Card 3: Docker Sandbox Identity */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Docker Sandbox Ephemeral Identity</h4>
                  <p className="text-xs text-slate-500">Non-root sandboxed execution privileges</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                workbench-sandbox:py312
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">UID / GID:</span>
                <span className="font-bold text-slate-900">uid=1001(sovereign-agent) gid=1001(airgap-sandbox)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Isolation Boundary:</span>
                <span className="font-bold text-emerald-700">--network none (Drop all sockets)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Root Filesystem:</span>
                <span className="font-bold text-slate-900">--read-only (Wiped after task termination)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Active Sessions List */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Active Local Sessions</h4>
                <p className="text-xs text-slate-500">Authenticated loopback endpoints accessing this node</p>
              </div>
              <button
                type="button"
                onClick={handleRevokeSessions}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Revoke All Other Local Sessions
              </button>
            </div>

            {revokedNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>All secondary sessions revoked. Only current local session remains active.</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Session 1: Current */}
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Windows 11 Localhost (Electron / Browser)</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-600 text-white">Current Session</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      IP: 127.0.0.1 Loopback &bull; Chrome 128 &bull; Authenticated L4
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600">Active Now</span>
              </div>

              {/* Session 2: Local CLI */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Localhost CLI Shell (PowerShell)</span>
                    <span className="text-[11px] font-mono text-slate-500">
                      IP: 127.0.0.1:8000 &bull; PID 14920 &bull; Background Worker
                    </span>
                  </div>
                </div>
                <span className="text-xs text-slate-400 font-medium">Active 45m ago</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
