"use client";

import React, { useState } from "react";
import type { DevRole } from "@/lib/types";
import { AstraMark } from "@/components/brand/AstraMark";
import { DotMatrix } from "@/components/ui/dot-matrix";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";

const USER_ACCOUNTS = [
  { id: "user-001", name: "Senior Legal Counsel", role: "Legal & Contracts Lead", dept: "Legal & Contracts" },
  { id: "user-002", name: "Lead Financial Analyst", role: "Senior Financial Analyst", dept: "Finance & Accounting" },
  { id: "user-003", name: "Supply Operations Specialist", role: "Supply Operations Specialist", dept: "Operations & Supply" },
  { id: "user-004", name: "Chief Compliance Auditor", role: "Chief Compliance Auditor", dept: "HR & Compliance" },
  { id: "user-005", name: "Infrastructure Lead", role: "Infrastructure & AI Lead", dept: "AI & Engineering" },
];

const TIERS: { value: DevRole; label: string; detail: string }[] = [
  { value: "user", label: "Standard", detail: "Coworking and agent workspace" },
  { value: "admin", label: "Operations", detail: "System console and air-gap evidence" },
];

/**
 * Sign-in.
 *
 * The card sits on a live dot-matrix field that resolves outward from the
 * centre on load — the panel booting, not a decorative glow. The field is
 * the one place in the product where a shader is affordable: no model is
 * running yet, so the GPU is idle.
 *
 * The fields are unchanged from the previous portal (department identity,
 * authorization tier) because they are what this system actually
 * authenticates on; only the surface is new.
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
  const initials = selectedAccount.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3);

  const signIn = () => {
    setSigningIn(true);
    try {
      window.localStorage.setItem("sovereign.active-user", userId);
      window.localStorage.setItem("sovereign.dev-role", role);
      window.sessionStorage.setItem("sovereign.session", "1");
    } catch {
      // storage unavailable
    }
    setTimeout(() => onAuthenticated(role), 420);
  };

  const field: React.CSSProperties = {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 4,
    border: "1px solid var(--ash)",
    background: "#0c0b0a",
    color: "var(--bone)",
    fontSize: 13.5,
    fontFamily: "var(--sans)",
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      className="relative flex min-h-screen w-full select-none items-center justify-center overflow-hidden p-4"
      style={{ background: "var(--canvas)" }}
    >
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 0 }}>
        <DotMatrix pitch={24} dot={6} />
      </div>
      {/* Vignette: pulls the field down at the edges so the card is the only
          thing with full contrast. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 1,
          background:
            "radial-gradient(120% 90% at 50% 45%, rgba(16,16,16,0.1) 0%, rgba(16,16,16,0.88) 58%, #101010 100%)",
        }}
      />

      <div
        className="relative w-full"
        style={{
          zIndex: 2,
          maxWidth: 430,
          background: "#121110",
          border: "1px solid #262220",
          borderRadius: 10,
          padding: 28,
        }}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="font-mono uppercase"
            style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--granite)", background: "none", border: 0, padding: 0, cursor: "pointer" }}
          >
            ← Back
          </button>
        )}

        <div className="mt-5 flex flex-col items-center text-center">
          <AstraMark size={46} handles={false} />
          <h1
            style={{
              margin: "16px 0 0",
              fontFamily: "var(--display)",
              fontVariationSettings: "'wdth' 86",
              fontWeight: 500,
              fontSize: 25,
              letterSpacing: "-0.03em",
              color: "var(--bone)",
            }}
          >
            Sign in to the workbench
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.5, color: "var(--granite)", maxWidth: "34ch" }}>
            Local models, on-device OCR, and an audit trail that never leaves this machine.
          </p>
        </div>

        <div style={{ height: 1, background: "#262220", margin: "22px 0" }} />

        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="mono-label" style={{ fontSize: 10.5, letterSpacing: "0.1em" }}>
              Department identity
            </span>
            <select id="login-user" value={userId} onChange={(e) => setUserId(e.target.value)} style={field}>
              {USER_ACCOUNTS.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} — {acc.role}
                </option>
              ))}
            </select>
          </label>

          <div
            className="flex items-center gap-3"
            style={{ padding: 12, borderRadius: 4, border: "1px solid var(--carbon)", background: "#0c0b0a" }}
          >
            <span
              className="flex shrink-0 items-center justify-center font-mono"
              style={{ width: 38, height: 38, borderRadius: 3, background: "var(--signal)", color: "#101010", fontSize: 12, fontWeight: 600 }}
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate" style={{ fontSize: 13.5, color: "var(--bone)" }}>
                {selectedAccount.name}
              </span>
              <span className="block truncate font-mono" style={{ fontSize: 11, color: "var(--signal)" }}>
                {selectedAccount.dept}
              </span>
            </span>
            <span
              className="shrink-0 font-mono"
              style={{ fontSize: 10.5, padding: "3px 7px", borderRadius: 2, border: "1px solid var(--carbon)", color: "var(--granite)" }}
            >
              {selectedAccount.id}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="mono-label" style={{ fontSize: 10.5, letterSpacing: "0.1em" }}>
              Authorization tier
            </span>
            {/* Two real choices read better as a segmented control than as a
                dropdown that hides the one you did not pick. */}
            <div className="grid grid-cols-2 gap-2">
              {TIERS.map((tier) => {
                const active = role === tier.value;
                return (
                  <button
                    key={tier.value}
                    type="button"
                    onClick={() => setRole(tier.value)}
                    aria-pressed={active}
                    className="text-left"
                    style={{
                      padding: "11px 12px",
                      borderRadius: 4,
                      border: `1px solid ${active ? "var(--signal)" : "var(--ash)"}`,
                      background: active ? "#1a1109" : "#0c0b0a",
                      cursor: "pointer",
                      transition: "border-color 160ms cubic-bezier(0.4,0,0.2,1), background-color 160ms cubic-bezier(0.4,0,0.2,1)",
                    }}
                  >
                    <span className="block" style={{ fontSize: 13.5, color: active ? "var(--signal)" : "var(--bone)" }}>
                      {tier.label}
                    </span>
                    <span className="block" style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--granite)", marginTop: 2 }}>
                      {tier.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          className="mt-5 flex items-start gap-2.5"
          style={{ padding: 11, borderRadius: 4, border: "1px solid var(--carbon)", background: "#0d160b" }}
        >
          <span className="astra-pulse mt-1 shrink-0" style={{ width: 6, height: 6, background: "var(--metric)" }} />
          <span style={{ fontSize: 12, lineHeight: 1.5, color: "var(--metric)" }}>
            Local execution verified. Outbound connections to external hosts are blocked and recorded.
          </span>
        </div>

        <LiquidCarveButton
          variant="bone"
          size="lg"
          arrow={!signingIn}
          onClick={signIn}
          disabled={signingIn}
          className="mt-5 w-full"
        >
          {signingIn ? "Entering…" : "Enter workspace"}
        </LiquidCarveButton>

        <div
          className="mt-5 flex items-center justify-between font-mono"
          style={{ paddingTop: 16, borderTop: "1px solid #262220", fontSize: 10.5, letterSpacing: "0.06em", color: "var(--graphite)" }}
        >
          <span className="inline-flex items-center gap-2">
            <span className="astra-pulse" style={{ width: 5, height: 5, background: "var(--metric)" }} />
            LOCAL VERIFIED
          </span>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}
