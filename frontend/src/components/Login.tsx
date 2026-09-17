"use client";

import React, { useState } from "react";
import type { DevRole } from "@/lib/types";
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Sparkles,
  Building2,
  CheckCircle2,
  ArrowLeft,
  User,
  KeyRound,
  AlertCircle,
  Shield,
  Eye,
  EyeOff,
} from "lucide-react";

const USER_ACCOUNTS = [
  { id: "user-001", name: "Senior Legal Counsel", role: "Legal & Contracts Lead", dept: "Legal & Contracts" },
  { id: "user-002", name: "Lead Financial Analyst", role: "Senior Financial Analyst", dept: "Finance & Accounting" },
  { id: "user-003", name: "Supply Operations Specialist", role: "Supply Operations Specialist", dept: "Operations & Supply" },
  { id: "user-004", name: "Chief Compliance Auditor", role: "Chief Compliance Auditor", dept: "HR & Compliance" },
  { id: "user-005", name: "Infrastructure Lead", role: "Infrastructure & AI Lead", dept: "AI & Engineering" },
];

function AstraEmblem({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(16,16)">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <path
            key={i}
            d="M0 -3.2 C 1.2 -6.5, 2.2 -11, 0 -14.5 C -2.2 -11, -1.2 -6.5, 0 -3.2 Z"
            fill="#ef4444"
            transform={`rotate(${angle})`}
            opacity={i % 2 === 0 ? 1 : 0.85}
          />
        ))}
        <circle cx="0" cy="0" r="3" fill="#09090b" />
        <circle cx="0" cy="0" r="1.5" fill="#ef4444" />
      </g>
    </svg>
  );
}

/**
 * AstraSovereign Enterprise On-Premise Authentication Portal
 * Enforces Admin (admin123) and Normal User (user123) credentials at sign-in
 */
export default function Login({
  onAuthenticated,
  onBack,
}: {
  onAuthenticated: (role: DevRole) => void;
  onBack?: () => void;
}) {
  const [role, setRole] = useState<DevRole>("admin");
  const [username, setUsername] = useState("admin");
  const [selectedUserAccount, setSelectedUserAccount] = useState(USER_ACCOUNTS[0].id);
  const [password, setPassword] = useState("admin123");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  const handleRoleChange = (newRole: DevRole) => {
    setRole(newRole);
    setErrorMessage(null);
    if (newRole === "admin") {
      setUsername("admin");
      setPassword("admin123");
    } else {
      setUsername(selectedUserAccount);
      setPassword("user123");
    }
  };

  const handleUserAccountChange = (id: string) => {
    setSelectedUserAccount(id);
    setUsername(id);
    setErrorMessage(null);
  };

  const handleSignIn = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    // Validate credentials per user requirements:
    // Admin password: admin123
    // User password: user123
    if (role === "admin") {
      if (password !== "admin123") {
        setErrorMessage("Invalid Admin credentials. Password for Admin must be: admin123");
        return;
      }
    } else {
      if (password !== "user123") {
        setErrorMessage("Invalid User credentials. Password for Normal User must be: user123");
        return;
      }
    }

    setSigningIn(true);
    const activeUserId = role === "admin" ? (username.trim() || "admin") : (username.trim() || selectedUserAccount);

    try {
      window.localStorage.setItem("sovereign.active-user", activeUserId);
      window.localStorage.setItem("sovereign.dev-role", role);
      window.sessionStorage.setItem("sovereign.session", "1");
    } catch {
      // storage unavailable
    }

    setTimeout(() => onAuthenticated(role), 350);
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#09090b] text-zinc-200 p-4 relative overflow-hidden select-none font-sans">
      {/* Background Soft Ambient Crimson Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#111115] rounded-2xl p-7 md:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] border border-zinc-800 relative z-10 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Back Button */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
        )}

        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AstraEmblem size={32} />
            <div>
              <span className="block text-base font-extrabold text-white tracking-tight leading-tight">
                AstraSovereign
              </span>
              <span className="block text-[11px] font-semibold text-red-400 tracking-wide font-mono">
                Sign in to the on-premise AI workbench
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-full border border-red-800/40 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>Zero Egress</span>
          </div>
        </div>

        {/* Discreet Single-Line Status Chip */}
        <div className="flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-400 font-mono">
          <span className="w-2 h-2 rounded-full bg-red-500 shadow-xs animate-pulse" />
          <span>NetworkGuard Active • 100% Offline Loopback</span>
        </div>

        {/* Role Selector: Admin L4 vs Normal User L2 */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
            Workspace Role
          </label>
          <div className="grid grid-cols-2 p-1 bg-zinc-950 rounded-xl border border-zinc-800 gap-1">
            <button
              type="button"
              onClick={() => handleRoleChange("admin")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === "admin"
                  ? "bg-red-950/60 text-red-200 shadow-xs border border-red-800/60"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin L4</span>
            </button>

            <button
              type="button"
              onClick={() => handleRoleChange("user")}
              className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                role === "user"
                  ? "bg-red-950/60 text-red-200 shadow-xs border border-red-800/60"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Normal User L2</span>
            </button>
          </div>
        </div>

        {/* If Normal User, allow choosing department profile */}
        {role === "user" && (
          <div className="space-y-1.5 animate-in fade-in">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Department Profile
            </label>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {USER_ACCOUNTS.map((acc) => {
                const isSelected = acc.id === selectedUserAccount;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleUserAccountChange(acc.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-red-600 bg-red-950/40 text-red-200 shadow-2xs"
                        : "border-zinc-800/80 hover:border-zinc-700 bg-zinc-900/60 text-zinc-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${
                        isSelected ? "bg-red-600 text-white" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {acc.id.split("-")[1]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-zinc-200 leading-tight">
                          {acc.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium">
                          {acc.dept}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Login Form: Username & Password */}
        <form onSubmit={handleSignIn} className="space-y-3.5">
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 focus:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all pl-9"
                placeholder="Enter username"
              />
              <User className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                Password
              </label>
              <span className="text-[10.5px] font-medium text-zinc-500 font-mono">
                {role === "admin" ? "Default: admin123" : "Default: user123"}
              </span>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 focus:bg-zinc-950 focus:border-red-500 focus:ring-1 focus:ring-red-500/50 outline-none transition-all pl-9 pr-9"
                placeholder="Enter password"
              />
              <KeyRound className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-800/80 flex items-start gap-2 text-red-200 text-xs font-medium animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={signingIn}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.98] text-white text-xs font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] transition-all cursor-pointer disabled:opacity-70"
          >
            {signingIn ? (
              <span>Authorizing {role === "admin" ? "Admin" : "Analyst"} Clearance...</span>
            ) : (
              <>
                <span>Sign In as {role === "admin" ? "Admin (L4)" : "Normal User (L2)"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer info */}
        <div className="text-center text-[10.5px] text-zinc-500 font-medium font-mono">
          Bare-metal NVLink PCIe · AES-256 Ephemeral Token Storage
        </div>
      </div>
    </div>
  );
}
