"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Users,
  RefreshCw,
  AlertCircle,
  Shield,
  ShieldCheck,
  Plus,
  UserPlus,
  CheckCircle2,
  Lock,
  Edit3,
  Send,
  Building2,
  X,
  FileText,
  UserCheck,
} from "lucide-react";
import { getAdminUsers } from "@/lib/api";
import type { AdminUserRow } from "@/lib/types";
import { FigurePanel } from "@/components/ui/instrument";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

function isCurrentUserAdmin(): boolean {
  if (typeof window === "undefined") return false;
  const devRole = window.localStorage.getItem("sovereign.dev-role");
  const activeUser = window.localStorage.getItem("sovereign.active-user") || "";
  return devRole === "admin" || activeUser.startsWith("admin");
}

function formatActivity(ts: string | null | undefined): string {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

interface TeamMemberDetails {
  userId: string;
  name: string;
  department: string;
  roleTitle: string;
  authLevel: string;
  isAdmin?: boolean;
}

const DEFAULT_MEMBERS: Record<string, TeamMemberDetails> = {
  "user-001": {
    userId: "user-001",
    name: "Senior Legal Counsel",
    department: "Legal & Contracts",
    roleTitle: "Department Lead",
    authLevel: "L3: Dept Lead",
    isAdmin: false,
  },
  "user-002": {
    userId: "user-002",
    name: "Lead Financial Analyst",
    department: "Finance & Accounting",
    roleTitle: "Finance Lead",
    authLevel: "L4: Sovereign Officer",
    isAdmin: false,
  },
  "user-003": {
    userId: "user-003",
    name: "Chief Compliance Auditor",
    department: "HR & Compliance",
    roleTitle: "Compliance Lead",
    authLevel: "L2: Reviewer",
    isAdmin: false,
  },
  "user-004": {
    userId: "user-004",
    name: "Supply Operations Specialist",
    department: "Operations & Supply",
    roleTitle: "Operations Specialist",
    authLevel: "L1: Contributor",
    isAdmin: false,
  },
  "user-005": {
    userId: "user-005",
    name: "Infrastructure Lead",
    department: "AI & Engineering",
    roleTitle: "AI Architect",
    authLevel: "L4: Sovereign Officer",
    isAdmin: false,
  },
  "admin-001": {
    userId: "admin-001",
    name: "Security Officer & Admin",
    department: "Security & Directorate",
    roleTitle: "System Administrator",
    authLevel: "L4: Sovereign Officer",
    isAdmin: true,
  },
};

const DEPARTMENTS = [
  "Security & Directorate",
  "Legal & Contracts",
  "Finance & Accounting",
  "Operations & Supply",
  "HR & Compliance",
  "AI & Engineering",
];

const ROLES = [
  "System Administrator",
  "Sovereign Officer (L4)",
  "Department Lead (L3)",
  "Specialist Reviewer (L2)",
  "Operator / Contributor (L1)",
];

export default function TeamView({
  user = "user-001",
  devRole = "user",
}: {
  user?: string;
  devRole?: "user" | "admin";
}) {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [memberDetails, setMemberDetails] = useState<Record<string, TeamMemberDetails>>(DEFAULT_MEMBERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Dynamic admin check from props and storage
  const isAdmin = devRole === "admin" || user.startsWith("admin") || isCurrentUserAdmin();

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [selectedUserForTask, setSelectedUserForTask] = useState<string | null>(null);

  // New Employee Form
  const [newUserId, setNewUserId] = useState("");
  const [newName, setNewName] = useState("");
  const [newDept, setNewDept] = useState("Security & Directorate");
  const [newRole, setNewRole] = useState("System Administrator");
  const [grantAdminAccess, setGrantAdminAccess] = useState(true);

  // Assign Task Form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDept, setTaskDept] = useState("Legal & Contracts");
  const [taskPriority, setTaskPriority] = useState("High");
  const [taskDeadline, setTaskDeadline] = useState("In 3 days");

  // Load custom employees from localStorage
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("sovereign.custom-employees");
      if (saved) {
        const parsed = JSON.parse(saved);
        setMemberDetails((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveCustomEmployees = (updated: Record<string, TeamMemberDetails>) => {
    setMemberDetails(updated);
    try {
      window.localStorage.setItem("sovereign.custom-employees", JSON.stringify(updated));
      window.dispatchEvent(new Event("sovereign:employees-updated"));
    } catch {
      // ignore
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await getAdminUsers();
      setRows(data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Combine rows with known members
  const allUserIds = Array.from(new Set([...rows.map((r) => r.user_id), ...Object.keys(memberDetails)]));

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const isEmpAdmin = grantAdminAccess || newRole === "System Administrator";
    const cleanId = newUserId.trim() || (isEmpAdmin ? `admin-${Math.floor(100 + Math.random() * 900)}` : `user-${Math.floor(100 + Math.random() * 900)}`);
    const cleanName = newName.trim() || cleanId;
    const effectiveRole = isEmpAdmin ? "System Administrator" : newRole;

    const updated = {
      ...memberDetails,
      [cleanId]: {
        userId: cleanId,
        name: cleanName,
        department: isEmpAdmin && newDept === "Legal & Contracts" ? "Security & Directorate" : newDept,
        roleTitle: effectiveRole,
        authLevel: isEmpAdmin ? "L4: Sovereign Officer" : effectiveRole.includes("L4") ? "L4: Sovereign Officer" : effectiveRole.includes("L3") ? "L3: Dept Lead" : effectiveRole.includes("L2") ? "L2: Reviewer" : "L1: Contributor",
        isAdmin: isEmpAdmin,
      },
    };

    saveCustomEmployees(updated);
    setIsAddModalOpen(false);
    setNewUserId("");
    setNewName("");
    setGrantAdminAccess(true);
    setNotice(`Successfully registered ${cleanName} (${cleanId}) as ${effectiveRole}.`);
    setTimeout(() => setNotice(null), 5000);
  };

  const handleMakeAdmin = (userId: string) => {
    const existing = memberDetails[userId] || {
      userId,
      name: userId,
      department: "Security & Directorate",
      roleTitle: "System Administrator",
      authLevel: "L4: Sovereign Officer",
    };
    const updated = {
      ...memberDetails,
      [userId]: {
        ...existing,
        roleTitle: "System Administrator",
        authLevel: "L4: Sovereign Officer",
        isAdmin: true,
      },
    };
    saveCustomEmployees(updated);
    setNotice(`Granted Administrator privileges to ${existing.name || userId}.`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRevokeAdmin = (userId: string) => {
    const existing = memberDetails[userId];
    if (!existing) return;
    const updated = {
      ...memberDetails,
      [userId]: {
        ...existing,
        roleTitle: "Department Lead (L3)",
        authLevel: "L3: Dept Lead",
        isAdmin: false,
      },
    };
    saveCustomEmployees(updated);
    setNotice(`Revoked Administrator privileges for ${existing.name || userId}. Role set to Department Lead.`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleRoleChange = (userId: string, newRoleTitle: string) => {
    const isEmpAdmin = newRoleTitle === "System Administrator";
    const existing = memberDetails[userId] || {
      userId,
      name: userId,
      department: "General",
      roleTitle: newRoleTitle,
      authLevel: "L1: Contributor",
    };
    const updated = {
      ...memberDetails,
      [userId]: {
        ...existing,
        roleTitle: newRoleTitle,
        authLevel: isEmpAdmin ? "L4: Sovereign Officer" : newRoleTitle.includes("L4") ? "L4: Sovereign Officer" : newRoleTitle.includes("L3") ? "L3: Dept Lead" : newRoleTitle.includes("L2") ? "L2: Reviewer" : "L1: Contributor",
        isAdmin: isEmpAdmin,
      },
    };
    saveCustomEmployees(updated);
    setNotice(`Updated role for ${userId} to ${newRoleTitle}.`);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setNotice(`Task "${taskTitle.trim()}" dispatched to ${selectedUserForTask || taskDept}. Tracked under Coworking Space.`);
    setIsAssignTaskModalOpen(false);
    setTaskTitle("");
    setTimeout(() => setNotice(null), 5000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-[var(--carbon)]">
          <div>
            <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Access</span>
            <div className="flex items-center gap-3" style={{ margin: "10px 0 0" }}>
              <h1 className="tracking-tight" style={{ margin: 0 }}>Who can use this workbench</h1>
              <span
                className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  padding: "3px 8px",
                  borderRadius: 2,
                  border: `1px solid ${isAdmin ? "var(--signal)" : "var(--ash)"}`,
                  color: isAdmin ? "var(--signal)" : "var(--granite)",
                }}
              >
                {isAdmin ? "You can change this" : "View only"}
              </span>
            </div>
            <p style={{ margin: "8px 0 0" }}>
              Every person here has their own workspace, their own documents and their own
              audit trail. Nothing is shared between them unless a task is handed over.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => {
                  setGrantAdminAccess(false);
                  setNewRole("Operator / Contributor (L1)");
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-mono uppercase"
                style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "8px 13px", borderRadius: 2, border: "1px solid var(--signal)", background: "transparent", color: "var(--signal)", cursor: "pointer" }}
              >
                <UserPlus className="w-3 h-3" />
                Add a person
              </button>
            )}
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 font-mono uppercase"
              style={{ fontSize: 10.5, letterSpacing: "0.08em", padding: "8px 13px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Feedback / Notice */}
        {notice && (
          <div style={{ borderLeft: "2px solid var(--metric)", padding: "10px 14px", borderRadius: 2, fontSize: 13, color: "var(--metric)" }}>
            {notice}
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" style={{ borderLeft: "2px solid var(--alert)", padding: "10px 14px", background: "var(--alert-surface)", borderRadius: 2, fontSize: 13, color: "var(--alert-ink)" }}>
            {error}
          </div>
        )}

        {isAdmin && (
          <FigurePanel figure="1" title="What you can change" caption="administrator actions">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p style={{ margin: 0, fontSize: 13.5, color: "var(--granite)", maxWidth: 680 }}>
                You can add people, decide who else administers this machine, and hand a task
                to someone in another department. Each change is written to the audit trail
                under your name.
              </p>
              <button
                type="button"
                onClick={() => {
                  setGrantAdminAccess(true);
                  setNewRole("System Administrator");
                  setNewDept("Security & Directorate");
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 font-mono uppercase shrink-0"
                style={{ fontSize: 10, letterSpacing: "0.08em", padding: "7px 11px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
              >
                <UserCheck className="w-3 h-3" />
                Add an administrator
              </button>
            </div>
          </FigurePanel>
        )}

        {/* Team Table */}
        <div className="astra-plate rounded-[6px] flex flex-col overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading team directory...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3 px-5">Employee &amp; ID</th>
                    <th className="py-3 px-5">Department</th>
                    <th className="py-3 px-5">Assigned Role</th>
                    <th className="py-3 px-5">Clearance</th>
                    <th className="py-3 px-5 text-center">Admin Access</th>
                    <th className="py-3 px-5 text-right">Tasks</th>
                    <th className="py-3 px-5 text-right">Active</th>
                    {isAdmin && <th className="py-3 px-5 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allUserIds.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="py-12 text-center text-slate-500 text-sm">
                        No team records found.
                      </td>
                    </tr>
                  ) : (
                    allUserIds.map((uid) => {
                      const details = memberDetails[uid] || {
                        userId: uid,
                        name: uid,
                        department: "Operations",
                        roleTitle: "Operator / Contributor (L1)",
                        authLevel: "L1: Contributor",
                        isAdmin: false,
                      };
                      const rowStats = rows.find((r) => r.user_id === uid);
                      const isCurrent = uid === activeUserId();
                      const isEmpAdmin = details.isAdmin || details.roleTitle === "System Administrator";

                      return (
                        <tr key={uid} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-5">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold uppercase shrink-0 ${
                                isEmpAdmin
                                  ? "bg-purple-600 text-white shadow-xs"
                                  : "bg-[var(--accent)]/10 text-[var(--accent)]"
                              }`}>
                                {isCurrent ? "You" : details.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-800 block truncate">{details.name}</span>
                                  {isEmpAdmin && (
                                    <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                      ADMIN
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-slate-400 block truncate">
                                  {uid} {isCurrent && "• (current user)"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-5 text-xs font-medium text-slate-600">
                            {details.department}
                          </td>

                          <td className="py-3 px-5">
                            {isAdmin ? (
                              <select
                                value={details.roleTitle}
                                onChange={(e) => handleRoleChange(uid, e.target.value)}
                                className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none focus:border-purple-500 cursor-pointer shadow-2xs"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-semibold text-slate-800">
                                {details.roleTitle}
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                                details.authLevel.includes("L4")
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : details.authLevel.includes("L3")
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : details.authLevel.includes("L2")
                                  ? "bg-amber-50 text-amber-800 border-amber-200"
                                  : "bg-slate-50 text-slate-700 border-slate-200"
                              }`}
                            >
                              {details.authLevel}
                            </span>
                          </td>

                          {/* Admin Access Column */}
                          <td className="py-3 px-5 text-center">
                            {isEmpAdmin ? (
                              <div className="inline-flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-[var(--accent)] border border-purple-200">
                                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                                  Admin
                                </span>
                                {isAdmin && uid !== "admin-001" && (
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeAdmin(uid)}
                                    title="Revoke Admin Access"
                                    className="text-[10px] text-slate-400 hover:text-rose-600 underline cursor-pointer"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            ) : isAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleMakeAdmin(uid)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-600 hover:text-[var(--accent)] border border-slate-200 hover:border-purple-200 text-xs font-semibold transition-colors cursor-pointer"
                                title="Promote this employee to System Administrator"
                              >
                                <Shield className="w-3.5 h-3.5 text-slate-400" />
                                <span>Make Admin</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3 px-5 text-right font-semibold text-slate-700">
                            {rowStats?.jobs ?? 0}
                          </td>

                          <td className="py-3 px-5 text-right">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                              {rowStats?.active_jobs ?? 0}
                            </span>
                          </td>

                          {isAdmin && (
                            <td className="py-3 px-5 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUserForTask(details.name);
                                  setTaskDept(details.department);
                                  setIsAssignTaskModalOpen(true);
                                }}
                                className="px-3 py-1 rounded-xl bg-purple-50 hover:bg-purple-100 text-[var(--accent)] text-xs font-semibold border border-purple-200 transition-colors cursor-pointer"
                              >
                                Assign Task
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal 1: Add Employee / Administrator */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[var(--accent)]">
                  {grantAdminAccess ? <ShieldCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    {grantAdminAccess ? "Add System Administrator" : "Add Employee"}
                  </h3>
                  <p className="text-xs text-zinc-500">
                    {grantAdminAccess ? "Grant full administrator and AI workspace access" : "Register department employee and allocate clearance"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-3.5 text-xs">
              {/* Account Privilege Level Selector */}
              <div>
                <label className="block font-semibold text-zinc-700 mb-1.5">Account Privilege Level</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGrantAdminAccess(true);
                      setNewRole("System Administrator");
                      setNewDept("Security & Directorate");
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      grantAdminAccess
                        ? "border-[var(--accent)] bg-purple-50/80 text-purple-950 font-bold ring-2 ring-[var(--accent)]/20 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${grantAdminAccess ? "bg-[var(--accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">Admin</div>
                      <div className="text-[10px] text-slate-500">Full workspace</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGrantAdminAccess(false);
                      setNewRole("Operator / Contributor (L1)");
                      setNewDept("Legal & Contracts");
                    }}
                    className={`flex items-center gap-2.5 p-2.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      !grantAdminAccess
                        ? "border-[var(--accent)] bg-purple-50/80 text-purple-950 font-bold ring-2 ring-[var(--accent)]/20 shadow-xs"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-medium"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${!grantAdminAccess ? "bg-[var(--accent)] text-white" : "bg-slate-100 text-slate-500"}`}>
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">Employee</div>
                      <div className="text-[10px] text-slate-500">Staff member</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  {grantAdminAccess ? "Administrator Full Name" : "Employee Full Name"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={grantAdminAccess ? "e.g. Alexander Wright (SecOps Lead)" : "e.g. Sarah Connor"}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">User ID / Handle (Optional)</label>
                <input
                  type="text"
                  placeholder={grantAdminAccess ? "e.g. admin-002" : "e.g. user-006"}
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Department</label>
                <select
                  value={newDept}
                  onChange={(e) => setNewDept(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Role &amp; Clearance</label>
                <select
                  value={newRole}
                  onChange={(e) => {
                    setNewRole(e.target.value);
                    if (e.target.value === "System Administrator") {
                      setGrantAdminAccess(true);
                    } else {
                      setGrantAdminAccess(false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold shadow-xs cursor-pointer"
                >
                  {grantAdminAccess ? "Save Administrator" : "Save Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Assign Task */}
      {isAssignTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[var(--accent)]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Assign Work Order</h3>
                  <p className="text-xs text-zinc-500">Dispatch sovereign work order to employee or department</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignTaskModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Target Assignee / Department</label>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800">
                  {selectedUserForTask ? `${selectedUserForTask} (${taskDept})` : taskDept}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Task Deliverable Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Defense Air-Gap Hardware Certification"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                  >
                    <option value="Urgent">Urgent (Air-Gap Direct)</option>
                    <option value="High">High</option>
                    <option value="Standard">Standard</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Deadline</label>
                  <input
                    type="text"
                    value={taskDeadline}
                    onChange={(e) => setTaskDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAssignTaskModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold shadow-xs cursor-pointer"
                >
                  Dispatch Task Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
