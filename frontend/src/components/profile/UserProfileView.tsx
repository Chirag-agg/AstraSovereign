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
      <div className="bg-[#111115] text-zinc-100 rounded-3xl border border-zinc-800 shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden">
        {/* Cover Banner: Deep black with crimson mesh */}
        <div className="relative h-44 sm:h-52 w-full bg-gradient-to-r from-zinc-950 via-[#1c0505] to-[#2c0b0b] overflow-hidden">
          {/* Red Mesh Glow Overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(239,68,68,0.25),transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(220,38,38,0.15),transparent_55%)]" />
          
          {/* Geometric Technical Wireframe Grid */}
          <div className="absolute inset-0 opacity-20 bg-[linear-gradient(to_right,#ef444415_1px,transparent_1px),linear-gradient(to_bottom,#ef444415_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Top Right Controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-950/80 backdrop-blur-md text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Airgap Node Online
            </span>
            {onClose && (
              <button
                onClick={onClose}
                className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-950/80 backdrop-blur-md text-zinc-300 hover:text-white border border-zinc-700 cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Profile Identity Bar */}
        <div className="px-6 sm:px-8 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-5">
            {/* 96px Avatar Unit with Camera Button & Photo Display */}
            <div className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-2xl ring-4 ring-zinc-900 bg-gradient-to-br from-zinc-950 to-[#2b0808] shadow-xl flex items-center justify-center text-white font-black text-2xl select-none shrink-0 overflow-hidden border border-red-900/60">
              {/* Employee ID Portrait Placeholder */}
              <div className="flex flex-col items-center justify-center">
                <span className="text-xl font-bold tracking-wider text-red-400">{fullName.slice(0, 2).toUpperCase()}</span>
                <span className="text-[9px] font-mono text-red-500 mt-0.5">EMP #{1000 + avatarSeed}</span>
              </div>
              
              {/* Editable Camera Overlay Button */}
              <button
                type="button"
                onClick={() => setAvatarSeed((s) => s + 1)}
                className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white cursor-pointer"
                title="Change Employee Photo / Badge ID"
              >
                <Camera className="w-5 h-5 mb-0.5 text-red-400" />
                <span className="text-[9px] font-bold uppercase tracking-wider">Change ID</span>
              </button>

              {/* Status Indicator Dot */}
              <span className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-900 animate-pulse" />
            </div>

            {/* Actions: Edit Profile Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
                  isEditing
                    ? "bg-red-600 text-white border-red-600 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                    : "bg-zinc-900 text-zinc-200 border-zinc-800 hover:bg-zinc-800"
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
                  className="text-2xl sm:text-3xl font-black text-white border-b border-red-500 focus:outline-none bg-red-950/40 px-1 py-0.5 rounded"
                />
              ) : (
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {fullName}
                </h1>
              )}

              {isEditing ? (
                <input
                  type="text"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="text-sm font-bold text-red-400 font-mono border-b border-red-500 focus:outline-none bg-red-950/40 px-1 rounded"
                />
              ) : (
                <span className="text-sm font-bold text-zinc-500 font-mono">
                  {handle}
                </span>
              )}

              {/* Prominent L4 Clearance Pill Badge */}
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950/40 text-red-300 border border-red-800/50 shadow-2xs flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-red-500" />
                <span>L4 Sovereign Officer</span>
              </span>
            </div>

            {/* Department */}
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
              <span>Department:</span>
              {isEditing ? (
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="text-xs font-semibold text-white border-b border-red-500 bg-red-950/40 px-1 rounded focus:outline-none"
                />
              ) : (
                <span className="text-zinc-200">{department}</span>
              )}
            </div>

            {/* Bio Textarea */}
            <div className="pt-1">
              {isEditing ? (
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full text-xs sm:text-sm text-zinc-100 p-2.5 rounded-xl border border-red-500 bg-red-950/30 focus:outline-none resize-none leading-relaxed"
                />
              ) : (
                <p className="text-xs sm:text-sm text-zinc-400 max-w-3xl leading-relaxed">
                  {bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 sm:px-8 border-t border-zinc-800 bg-[#0c0c10]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "overview"
                ? "border-red-600 text-red-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview &amp; Activity</span>
          </button>

          <button
            onClick={() => setActiveTab("credentials")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "credentials"
                ? "border-red-600 text-red-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Key className="w-4 h-4" />
            <span>Hardware Security &amp; Keys</span>
          </button>

          <button
            onClick={() => setActiveTab("sessions")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "sessions"
                ? "border-red-600 text-red-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
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
            <div className="bg-[#111115] p-5 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Total Dispatched Tasks
              </span>
              <div className="text-3xl font-black text-white">142 Tasks</div>
              <p className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 100% on-premise loopback execution
              </p>
            </div>

            <div className="bg-[#111115] p-5 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Deliverables Generated
              </span>
              <div className="text-3xl font-black text-red-400">38 Slides/Docs</div>
              <p className="text-[11px] text-zinc-400 font-medium">
                PPTX slide decks, DOCX reports, OCR sheets
              </p>
            </div>

            <div className="bg-[#111115] p-5 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                Audit Signature Hash
              </span>
              <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-200 pt-1">
                <span className="truncate max-w-[170px]" title={auditHash}>
                  {auditHash.slice(0, 16)}...{auditHash.slice(-6)}
                </span>
                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                  title="Copy SHA-256 Audit Signature"
                >
                  {copiedHash ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-emerald-400 font-semibold">
                Genesis Block #8493 notarized
              </p>
            </div>
          </div>

          {/* Quick Activity Feed */}
          <div className="bg-[#111115] rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white">Recent Sovereign Activity</h3>
              <span className="text-xs text-zinc-400 font-medium">Synced with Local Ledger</span>
            </div>

            <div className="space-y-3.5 divide-y divide-zinc-800/80">
              <div className="flex items-start gap-3.5 pt-3 first:pt-0">
                <div className="w-8 h-8 rounded-xl bg-red-950/40 text-red-400 border border-red-800/40 flex items-center justify-center shrink-0 mt-0.5">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-zinc-200">
                    Executed sandbox test on anomaly_detect.py
                  </p>
                  <p className="text-xs text-zinc-400">
                    Ephemeral Docker runtime • 0 bytes egress detected • Memory capped at 512MB
                  </p>
                </div>
                <span className="text-xs text-zinc-500 font-medium shrink-0">2h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-red-950/30 text-rose-400 border border-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Presentation className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-zinc-200">
                    Generated Exec_Brief_Q3.pptx slide deck
                  </p>
                  <p className="text-xs text-zinc-400">
                    3 Slides • Hardware Telemetry &amp; NVLink Benchmarks • Signed with SHA-256
                  </p>
                </div>
                <span className="text-xs text-zinc-500 font-medium shrink-0">4h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 text-red-400 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                  <FileCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-zinc-200">
                    Signed Telemetry_Audit.docx with local PGP key
                  </p>
                  <p className="text-xs text-zinc-400">
                    Hardware loopback isolation report • NIST SP 800-171 criteria verified
                  </p>
                </div>
                <span className="text-xs text-zinc-500 font-medium shrink-0">6h ago</span>
              </div>

              <div className="flex items-start gap-3.5 pt-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-950/30 text-emerald-400 border border-emerald-800/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-zinc-200">
                    Cleared Defense Contract Compliance Audit 2026
                  </p>
                  <p className="text-xs text-zinc-400">
                    12 Pages • L4 Directorate clearance seal attached
                  </p>
                </div>
                <span className="text-xs text-zinc-500 font-medium shrink-0">1d ago</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "credentials" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Card 1: Hardware Passkey */}
          <div className="bg-[#111115] p-6 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">FIDO2 Hardware Security Passkey</h4>
                  <p className="text-xs text-zinc-400">Physical hardware token for L4 authorization gating</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                YubiKey 5C NFC • Active
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[11px]">Hardware Serial</span>
                <span className="font-mono font-bold text-zinc-200">#9482-1049-NFC</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[11px]">Key Algorithm</span>
                <span className="font-mono font-bold text-zinc-200">FIDO2 / ECC P-256</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
                <span className="text-zinc-400 block font-semibold text-[11px]">Touch Policy</span>
                <span className="font-bold text-emerald-400">Enforced &amp; Verified</span>
              </div>
            </div>
          </div>

          {/* Card 2: Local PGP Signing Key */}
          <div className="bg-[#111115] p-6 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-950/40 border border-red-800/40 flex items-center justify-center text-red-400">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Local PGP Deliverable Signing Key</h4>
                  <p className="text-xs text-zinc-400">Signs Word (.docx) and PowerPoint (.pptx) artifacts offline</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-950/40 text-red-300 border border-red-800/50">
                RSA 4096 • Active
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-xs flex items-center justify-between">
              <div className="space-y-0.5 truncate mr-2">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">Fingerprint</span>
                <span className="text-red-400 font-bold">{pgpFingerprint}</span>
              </div>
              <button
                type="button"
                onClick={handleCopyPgp}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                {copiedPgp ? "Copied!" : "Copy Key"}
              </button>
            </div>
          </div>

          {/* Card 3: Docker Sandbox Identity */}
          <div className="bg-[#111115] p-6 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Docker Sandbox Ephemeral Identity</h4>
                  <p className="text-xs text-zinc-400">Non-root sandboxed execution privileges</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/50">
                workbench-sandbox:py312
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">UID / GID:</span>
                <span className="font-bold text-zinc-200">uid=1001(sovereign-agent) gid=1001(airgap-sandbox)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Isolation Boundary:</span>
                <span className="font-bold text-emerald-400">--network none (Drop all sockets)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-500">Root Filesystem:</span>
                <span className="font-bold text-zinc-200">--read-only (Wiped after task termination)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-5 animate-in fade-in">
          {/* Active Sessions List */}
          <div className="bg-[#111115] p-6 rounded-2xl border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.4)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h4 className="text-sm font-bold text-white">Active Local Sessions</h4>
                <p className="text-xs text-zinc-400">Authenticated loopback endpoints accessing this node</p>
              </div>
              <button
                type="button"
                onClick={handleRevokeSessions}
                className="px-3.5 py-1.5 rounded-xl bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Revoke All Other Local Sessions
              </button>
            </div>

            {revokedNotice && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 text-xs font-bold animate-in fade-in flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>All secondary sessions revoked. Only current local session remains active.</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Session 1: Current */}
              <div className="p-4 rounded-xl border border-red-800/60 bg-red-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-red-950/60 text-red-400 border border-red-800/40 flex items-center justify-center shrink-0">
                    <Laptop className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">Windows 11 Localhost (Electron / Browser)</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-600 text-white">Current Session</span>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      IP: 127.0.0.1 Loopback &bull; Chrome 128 &bull; Authenticated L4
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-400">Active Now</span>
              </div>

              {/* Session 2: Local CLI */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-[#141419] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-850 text-zinc-400 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">Localhost CLI Shell (PowerShell)</span>
                    <span className="text-[11px] font-mono text-zinc-400">
                      IP: 127.0.0.1:8000 &bull; PID 14920 &bull; Background Worker
                    </span>
                  </div>
                </div>
                <span className="text-xs text-zinc-500 font-medium">Active 45m ago</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
