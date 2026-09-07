"use client";

import { useState } from "react";

import ThemeToggle from "@/components/core/theme-toggle";
import type { DevRole } from "@/lib/types";

const USER_IDS = ["user-001", "user-002", "user-003", "user-004", "user-005"];

/**
 * Development sign-in (on-premise workbench entry point).
 * NOT authentication: selects a dev user id + role used for X-User-ID / X-Role.
 */
export default function Login({
  onAuthenticated,
}: {
  onAuthenticated: (role: DevRole) => void;
}) {
  const [userId, setUserId] = useState(USER_IDS[0]);
  const [role, setRole] = useState<DevRole>("user");
  const [signingIn, setSigningIn] = useState(false);

  const signIn = () => {
    setSigningIn(true);
    try {
      window.localStorage.setItem("sovereign.active-user", userId);
      window.localStorage.setItem("sovereign.dev-role", role);
      window.sessionStorage.setItem("sovereign.session", "1");
    } catch {
      // storage unavailable
    }
    setTimeout(() => onAuthenticated(role), 600);
  };

  return (
    <div className="login">
      <div className="login-panel">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="login-wordmark">AI Workbench</span>
        </div>

        <h1 className="login-title">Sign in to the on-premise AI workbench</h1>
        <p className="login-sub">
          Local models, OCR, knowledge and the sandbox run on this machine.
          Nothing you do here leaves it.
        </p>

        <div className="login-dev" role="group" aria-label="Development identity">
          <div className="login-field">
            <label htmlFor="login-user">User</label>
            <select
              id="login-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            >
              {USER_IDS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </div>
          <div className="login-field">
            <label htmlFor="login-role">Role</label>
            <select
              id="login-role"
              value={role}
              onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
            >
              <option value="user">User (workspace)</option>
              <option value="admin">Admin (operations console)</option>
            </select>
          </div>
          <p className="login-note">
            Development identity sent as <code>X-User-ID</code>
            {role === "admin" ? " + X-Role: admin" : ""}. Not authentication.
          </p>
        </div>

        <button type="button" className="btn btn-accent login-cta" onClick={signIn} disabled={signingIn}>
          {signingIn ? "Signing in…" : "Sign in"}
        </button>

        <div className="login-foot">
          <span className="status t-ok">
            <span className="dot" aria-hidden="true" />
            LOCAL
          </span>
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
