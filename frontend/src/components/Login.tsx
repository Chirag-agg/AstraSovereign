"use client";

import React, { useState } from "react";
import { ShieldCheck, ArrowRight, Eye, EyeOff, Lock, ArrowLeft } from "lucide-react";
import type { DevRole } from "@/lib/types";

export const USER_ACCOUNTS: { id: string; name: string; role: string; dept: string }[] = [
  { id: "admin-001", name: "Security Officer & Admin", role: "System Administrator", dept: "Security & Directorate" },
  { id: "user-001", name: "Senior Legal Counsel", role: "Legal Department Lead", dept: "Legal & Contracts" },
  { id: "user-002", name: "Lead Financial Analyst", role: "Finance Lead", dept: "Finance & Accounting" },
  { id: "user-003", name: "Chief Compliance Auditor", role: "Compliance Lead", dept: "HR & Compliance" },
  { id: "user-004", name: "Supply Operations Specialist", role: "Operations Specialist", dept: "Operations & Supply" },
  { id: "user-005", name: "Infrastructure Lead", role: "Infrastructure & AI Lead", dept: "AI & Engineering" },
];

interface LoginProps {
  onAuthenticated: (role: DevRole) => void;
  onBack?: () => void;
}

/**
 * Modern AstraSovereign Sign-In Portal (Enterprise On-Premise Authentication)
 */
export default function Login({
  onAuthenticated,
  onBack,
}: LoginProps) {
  const [userId, setUserId] = useState(USER_ACCOUNTS[0].id);
  const [role, setRole] = useState<DevRole>("user");
  const [password, setPassword] = useState("sovereign2026");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const selectedAccount = USER_ACCOUNTS.find((u) => u.id === userId) || USER_ACCOUNTS[0];

  const signIn = () => {
    if (!password.trim()) {
      setPasswordError("Please enter your security passkey.");
      return;
    }
    setPasswordError(null);
    setSigningIn(true);
    try {
      window.localStorage.setItem("sovereign.active-user", userId);
      window.localStorage.setItem("sovereign.dev-role", role);
      window.sessionStorage.setItem("sovereign.session", "1");
    } catch {
      // storage unavailable
    }
    setTimeout(() => onAuthenticated(role), 450);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#eef1f6] p-4 relative overflow-hidden select-none">
      {/* Background Soft Studio Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-3xl p-7 md:p-8 shadow-[0_20px_60px_rgba(112,71,235,0.06)] border border-slate-200/80 relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#7047eb] to-[#9d7cfc] text-white shadow-md font-bold text-base">
              <span>AS</span>
            </div>
            <div>
              <span className="block text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                AstraSovereign
              </span>
              <span className="block text-[11px] font-semibold text-purple-600 tracking-wide uppercase">
                Sovereign OS
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Air-Gapped</span>
          </div>
        </div>

        {/* Title & Introduction */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sign in to the sovereign AI workbench
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Local model cluster, document intelligence, L1–L4 clearance sign-offs, and isolated execution.
          </p>
        </div>

        {/* Identity & Password Form */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-user" className="block text-xs font-semibold text-slate-700">
              Department Identity &amp; Profile
            </label>
            <select
              id="login-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all cursor-pointer shadow-xs"
            >
              {USER_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.role} ({acc.id})
                </option>
              ))}
            </select>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                Passkey / Password
              </label>
              <span className="text-[10px] text-purple-600 font-mono">Default: sovereign2026</span>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter security passkey..."
                className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {passwordError && (
              <p className="text-[11px] text-rose-600 font-medium">{passwordError}</p>
            )}
          </div>

          {/* Active Profile Summary Card */}
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100 flex items-center justify-between">
            <div>
              <span className="block text-xs font-bold text-slate-800">{selectedAccount.name}</span>
              <span className="block text-[10.5px] text-purple-700 font-medium">{selectedAccount.dept}</span>
            </div>
            <span className="font-mono text-[10.5px] bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-800 font-semibold">
              {selectedAccount.id}
            </span>
          </div>

          {/* Role Mode Selector */}
          <div className="space-y-1.5">
            <label htmlFor="login-role" className="block text-xs font-semibold text-slate-700">
              Access &amp; Authorization Tier
            </label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-purple-500 focus:bg-white transition-all cursor-pointer shadow-xs"
            >
              <option value="user">User (Standard Coworking &amp; Agent Workspace)</option>
              <option value="admin">Admin (System Operations &amp; Air-Gap Console)</option>
            </select>
          </div>
        </div>

        {/* Security & Verification Notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Local execution verified. External network outbound connections are disabled.</span>
        </div>

        {/* Sign In CTA Button */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={signIn}
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[#7047eb] hover:bg-[#5e37d8] active:bg-[#522ec4] text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            {signingIn ? (
              <span>Signing in to Sovereign Workspace…</span>
            ) : (
              <>
                <span>Enter Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Overview</span>
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="font-mono text-slate-500 font-semibold">LOCAL VERIFIED</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
