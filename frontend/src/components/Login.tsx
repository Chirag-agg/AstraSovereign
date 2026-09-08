"use client";

import React, { useState } from "react";
import type { DevRole } from "@/lib/types";
import { ShieldCheck, ArrowRight, Lock, Sparkles, Building2, CheckCircle2 } from "lucide-react";
import { AstraLogo } from "./core/AstraLogo";

const USER_ACCOUNTS = [
  { id: "user-001", name: "Senior Legal Counsel", role: "Legal & Contracts Lead", dept: "Legal & Contracts" },
  { id: "user-002", name: "Lead Financial Analyst", role: "Senior Financial Analyst", dept: "Finance & Accounting" },
  { id: "user-003", name: "Supply Operations Specialist", role: "Supply Operations Specialist", dept: "Operations & Supply" },
  { id: "user-004", name: "Chief Compliance Auditor", role: "Chief Compliance Auditor", dept: "HR & Compliance" },
  { id: "user-005", name: "Infrastructure Lead", role: "Infrastructure & AI Lead", dept: "AI & Engineering" },
];

/**
 * Modern AstraSovereign Sign-In Portal (Enterprise On-Premise Authentication)
 */
export default function Login({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated: (role: DevRole) => void;
  onBack?: () => void;
}) {
  const [userId, setUserId] = useState(USER_ACCOUNTS[0].id);
  const [role, setRole] = useState<DevRole>("user");
  const [signingIn, setSigningIn] = useState(false);

  const selectedAccount = USER_ACCOUNTS.find((u) => u.id === userId) || USER_ACCOUNTS[0];

  const signIn = () => {
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
      <div className="absolute top-1/4 left-1/3 -translate-x-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl p-7 sm:p-8 shadow-[0_10px_35px_-5px_rgba(15,23,42,0.06)] relative z-10 space-y-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            ← Back
          </button>
        ) : null}
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AstraLogo size={38} />
            <div>
              <span className="block font-poster text-2xl tracking-[0.08em] uppercase text-slate-900 leading-none">
                AstraSovereign
              </span>
              <span className="block text-[10px] font-mono font-bold text-blue-600 tracking-[0.24em] uppercase mt-0.5">
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
          <h1 className="font-poster text-3xl sm:text-4xl tracking-[0.04em] uppercase text-slate-900 leading-[0.95]">
            Sign in to Sovereign Workbench
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Local models, document OCR, hierarchical authorization, and collaborative coworking workspaces.
          </p>
        </div>

        {/* Identity Selector Section */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-user" className="block text-xs font-semibold text-slate-700">
              Department Identity & Profile
            </label>
            <select
              id="login-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer shadow-xs"
            >
              {USER_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.role} ({acc.id})
                </option>
              ))}
            </select>
          </div>

          {/* Active Profile Summary Card */}
          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100/80 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {selectedAccount.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1 text-xs">
              <span className="block font-bold text-slate-900 truncate">
                {selectedAccount.name}
              </span>
              <span className="block text-[11px] text-blue-700 font-semibold truncate">
                {selectedAccount.dept}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white text-slate-600 border border-blue-100 shrink-0">
              {selectedAccount.id}
            </span>
          </div>

          {/* Role Mode Selector */}
          <div className="space-y-1.5">
            <label htmlFor="login-role" className="block text-xs font-semibold text-slate-700">
              Access & Authorization Tier
            </label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-600 focus:bg-white transition-all cursor-pointer shadow-xs"
            >
              <option value="user">User (Standard Coworking & Agent Workspace)</option>
              <option value="admin">Admin (System Operations & Air-Gap Console)</option>
            </select>
          </div>
        </div>

        {/* Security & Verification Notice */}
        <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-[11px] text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Local execution verified. External network outbound connections are disabled.</span>
        </div>

        {/* Sign In CTA Button */}
        <button
          type="button"
          onClick={signIn}
          disabled={signingIn}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
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

        {/* Footer info */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 status t-ok">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dot" />
            <span className="font-mono text-slate-500 font-semibold">LOCAL VERIFIED</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
