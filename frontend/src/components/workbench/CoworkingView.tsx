"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  Send,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Filter,
  Search,
  FileText,
  AlertCircle,
  ChevronDown,
  ArrowUpRight,
  TrendingUp,
  Paperclip,
  X,
  Building2,
  Sparkles,
  Award,
} from "lucide-react";
import type { AuthorizationLevel, Coworker, CoworkingActivity, CoworkingTask } from "./types";
import { FigurePanel, StatSlab, Gantt, type GanttRow } from "@/components/ui/instrument";

interface CoworkingViewProps {
  onOpenAgentWorkspace?: (taskPrompt?: string) => void;
}

const INITIAL_TASKS: CoworkingTask[] = [
  {
    id: "TSK-801",
    title: "Q3 Vendor Procurement Contract Compliance",
    department: "Legal & Contracts",
    assignee: {
      name: "Senior Legal Counsel",
      avatar: "LC",
      role: "Department Lead",
    },
    requiredLevel: "L3: Dept Lead",
    status: "Pending L3 Approval",
    deadline: "Tomorrow, 5:00 PM",
    deliverable: {
      name: "vendor_master_agreement_q3.docx",
      type: "docx",
      size: "1.4 MB",
    },
    notes: "Requires Level 3 Sign-Off prior to offline vendor signature binding.",
  },
  {
    id: "TSK-802",
    title: "Cross-Department Payroll Audit & Tax Anonymization",
    department: "Finance & Accounting",
    assignee: {
      name: "Lead Financial Analyst",
      avatar: "FA",
      role: "Finance Lead",
    },
    requiredLevel: "L4: Sovereign Officer",
    status: "In Progress",
    deadline: "15 Sep, 2026",
    deliverable: {
      name: "payroll_audit_ledger_v2.xlsx",
      type: "xlsx",
      size: "3.8 MB",
    },
    notes: "Requires strict air-gap OCR reconciliation against 42 bank slips.",
  },
  {
    id: "TSK-803",
    title: "Local OCR Extraction of 120 Logistics Waybills",
    department: "Operations & Supply",
    assignee: {
      name: "Supply Operations Specialist",
      avatar: "SO",
      role: "Operations Specialist",
    },
    requiredLevel: "L1: Contributor",
    status: "Completed",
    deadline: "Completed today",
    deliverable: {
      name: "logistics_manifest_extracted.pdf",
      type: "pdf",
      size: "5.2 MB",
    },
    notes: "Processed completely offline via on-prem vision OCR pipeline.",
  },
  {
    id: "TSK-804",
    title: "Internal Data Governance & Air-Gap Compliance Checklist",
    department: "HR & Compliance",
    assignee: {
      name: "Chief Compliance Auditor",
      avatar: "CA",
      role: "Compliance Lead",
    },
    requiredLevel: "L2: Reviewer",
    status: "Pending L2 Review",
    deadline: "18 Sep, 2026",
    deliverable: {
      name: "airgap_compliance_manifesto.docx",
      type: "docx",
      size: "820 KB",
    },
    notes: "Review requested for section 4: Zero External Telemetry Rules.",
  },
  {
    id: "TSK-805",
    title: "Offline Embedding Cluster Calibration & Benchmark",
    department: "AI & Engineering",
    assignee: {
      name: "Infrastructure Lead",
      avatar: "IL",
      role: "AI Architect",
    },
    requiredLevel: "L4: Sovereign Officer",
    status: "L4 Signed Off",
    deadline: "Yesterday",
    deliverable: {
      name: "vector_index_benchmark.pdf",
      type: "pdf",
      size: "2.1 MB",
    },
    notes: "Signed off by Security Directorate. Zero network leakage verified.",
  },
];

const INITIAL_COWORKERS: Coworker[] = [
  {
    id: "cw-1",
    name: "Senior Legal Counsel",
    department: "Legal & Contracts",
    avatar: "LC",
    status: "online",
    lastMessage: "Submitted Q3 Contract for Level 3 Lead authorization.",
    time: "4:12 PM",
    unreadCount: 2,
  },
  {
    id: "cw-2",
    name: "Lead Financial Analyst",
    department: "Finance & Accounting",
    avatar: "FA",
    status: "in-review",
    lastMessage: "Reconciling the ledger with local document OCR results.",
    time: "3:45 PM",
    unreadCount: 0,
  },
  {
    id: "cw-3",
    name: "Chief Compliance Auditor",
    department: "HR & Compliance",
    avatar: "CA",
    status: "online",
    lastMessage: "Please verify authorization levels for new onboarding batch.",
    time: "2:10 PM",
    unreadCount: 1,
  },
  {
    id: "cw-4",
    name: "Supply Operations Specialist",
    department: "Operations & Supply",
    avatar: "SO",
    status: "busy",
    lastMessage: "Local OCR batch completed: 120 manifests processed.",
    time: "1:20 PM",
    unreadCount: 0,
  },
  {
    id: "cw-5",
    name: "Infrastructure Lead",
    department: "AI & Engineering",
    avatar: "IL",
    status: "online",
    lastMessage: "Air-gap verification hash verified against sha256 checksum.",
    time: "11:05 AM",
    unreadCount: 0,
  },
];

const INITIAL_ACTIVITIES: CoworkingActivity[] = [
  {
    id: "act-1",
    actor: "Legal Counsel",
    avatar: "LC",
    action: "submitted deliverable",
    target: "vendor_master_agreement_q3.docx",
    time: "15m ago",
    levelBadge: "L3 Approval Needed",
  },
  {
    id: "act-2",
    actor: "Infrastructure Lead",
    avatar: "IL",
    action: "signed off air-gap release",
    target: "TSK-805 Vector Cluster Calibration",
    time: "1h ago",
    levelBadge: "L4 Signed Off",
  },
  {
    id: "act-3",
    actor: "Operations Specialist",
    avatar: "SO",
    action: "completed local OCR extraction",
    target: "120 Logistics Waybills",
    time: "3h ago",
    levelBadge: "L1 Completed",
  },
];

const CHART_MONTHS = [
  { month: "Jan", completed: 65, uncompleted: 25 },
  { month: "Feb", completed: 80, uncompleted: 30 },
  { month: "Mar", completed: 72, uncompleted: 20 },
  { month: "Apr", completed: 90, uncompleted: 18 },
  { month: "May", completed: 85, uncompleted: 24 },
  { month: "Jun", completed: 95, uncompleted: 15 },
  { month: "Jul", completed: 78, uncompleted: 22 },
  { month: "Aug", completed: 88, uncompleted: 19 },
  { month: "Sep", completed: 94, uncompleted: 14 },
  { month: "Oct", completed: 82, uncompleted: 20 },
  { month: "Nov", completed: 91, uncompleted: 16 },
  { month: "Dec", completed: 97, uncompleted: 12 },
];

export default function CoworkingView({ onOpenAgentWorkspace }: CoworkingViewProps) {
  const [tasks, setTasks] = useState<CoworkingTask[]>(INITIAL_TASKS);
  const [coworkers] = useState<Coworker[]>(INITIAL_COWORKERS);
  const [activities, setActivities] = useState<CoworkingActivity[]>(INITIAL_ACTIVITIES);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("All");
  const [selectedLevel, setSelectedLevel] = useState<string>("All");

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedTaskForSubmission, setSelectedTaskForSubmission] = useState<CoworkingTask | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDept, setNewDept] = useState<CoworkingTask["department"]>("Legal & Contracts");
  const [newAssignee, setNewAssignee] = useState("Senior Legal Counsel");
  const [newLevel, setNewLevel] = useState<AuthorizationLevel>("L2: Reviewer");
  const [newDeadline, setNewDeadline] = useState("In 3 days");
  const [newNotes, setNewNotes] = useState("");

  // Submit modal form state
  const [submitFileName, setSubmitFileName] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitLevel, setSubmitLevel] = useState<AuthorizationLevel>("L3: Dept Lead");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const getActiveUserInfo = () => {
    if (typeof window === "undefined") {
      return { id: "user-001", name: "Senior Legal Counsel", role: "manager" as const, dept: "Legal & Contracts" as const, roleTitle: "Department Lead" };
    }
    const uid = window.localStorage.getItem("sovereign.active-user") || "user-001";
    const devRole = window.localStorage.getItem("sovereign.dev-role");
    if (uid === "admin-001" || devRole === "admin") {
      return { id: uid, name: "Security Officer (Admin)", role: "admin" as const, dept: "AI & Engineering" as const, roleTitle: "System Administrator" };
    }
    if (uid === "user-001") {
      return { id: uid, name: "Senior Legal Counsel", role: "manager" as const, dept: "Legal & Contracts" as const, roleTitle: "Legal Lead" };
    }
    if (uid === "user-002") {
      return { id: uid, name: "Lead Financial Analyst", role: "manager" as const, dept: "Finance & Accounting" as const, roleTitle: "Finance Lead" };
    }
    if (uid === "user-003") {
      return { id: uid, name: "Chief Compliance Auditor", role: "manager" as const, dept: "HR & Compliance" as const, roleTitle: "Compliance Lead" };
    }
    if (uid === "user-005") {
      return { id: uid, name: "Infrastructure Lead", role: "manager" as const, dept: "AI & Engineering" as const, roleTitle: "AI Lead" };
    }
    return { id: uid, name: "Supply Operations Specialist", role: "junior" as const, dept: "Operations & Supply" as const, roleTitle: "Operations Specialist" };
  };

  const currentUser = getActiveUserInfo();

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.assignee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.department.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = selectedDept === "All" || t.department === selectedDept;
    const matchesLevel = selectedLevel === "All" || t.requiredLevel.startsWith(selectedLevel);
    return matchesSearch && matchesDept && matchesLevel;
  });

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    // Hierarchy rule check
    let effectiveDept = newDept;
    let effectiveAssignee = newAssignee;

    if (currentUser.role === "manager") {
      effectiveDept = currentUser.dept;
    } else if (currentUser.role === "junior") {
      effectiveDept = currentUser.dept;
      effectiveAssignee = currentUser.name;
    }

    const coworkerMatch = coworkers.find((c) => c.name === effectiveAssignee) || coworkers[0];
    const newTask: CoworkingTask = {
      id: `TSK-${Math.floor(800 + Math.random() * 200)}`,
      title: newTitle.trim(),
      department: effectiveDept,
      assignee: {
        name: coworkerMatch.name,
        avatar: coworkerMatch.avatar,
        role: coworkerMatch.department,
      },
      requiredLevel: newLevel,
      status: "In Progress",
      deadline: newDeadline,
      notes: newNotes,
    };

    setTasks([newTask, ...tasks]);
    setActivities([
      {
        id: `act-${Date.now()}`,
        actor: currentUser.name,
        avatar: currentUser.name.slice(0, 2).toUpperCase(),
        action: currentUser.role === "admin" ? "dispatched department task" : currentUser.role === "manager" ? "delegated task to junior" : "created draft task",
        target: newTask.title,
        time: "Just now",
        levelBadge: newTask.requiredLevel,
      },
      ...activities,
    ]);

    setIsAssignModalOpen(false);
    setNewTitle("");
    setNewNotes("");
    setFeedbackNotice(`Task assigned to ${effectiveAssignee} (${effectiveDept}) with ${newLevel} requirement.`);
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForSubmission) return;

    const updatedTasks = tasks.map((t) => {
      if (t.id === selectedTaskForSubmission.id) {
        return {
          ...t,
          status:
            submitLevel.includes("L4")
              ? ("Pending L3 Approval" as const)
              : ("Pending L2 Review" as const),
          deliverable: submitFileName
            ? {
                name: submitFileName,
                type: "docx" as const,
                size: "1.8 MB",
              }
            : t.deliverable,
          notes: submitNotes || t.notes,
        };
      }
      return t;
    });

    setTasks(updatedTasks);
    setActivities([
      {
        id: `act-${Date.now()}`,
        actor: selectedTaskForSubmission.assignee.name,
        avatar: selectedTaskForSubmission.assignee.avatar,
        action: "submitted task for authorization",
        target: selectedTaskForSubmission.title,
        time: "Just now",
        levelBadge: submitLevel,
      },
      ...activities,
    ]);

    setIsSubmitModalOpen(false);
    setSelectedTaskForSubmission(null);
    setSubmitFileName("");
    setSubmitNotes("");
    setFeedbackNotice("Deliverable submitted for authorization! Teammate backend endpoint binding ready.");
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const doneStates = /complete|signed off/i;
  const completed = tasks.filter((t) => doneStates.test(t.status)).length;
  const waiting = tasks.filter((t) => /pending|review/i.test(t.status)).length;
  const active = tasks.length - completed - waiting;
  const completionPct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const byDept = tasks.reduce<Record<string, { total: number; done: number }>>((acc, t) => {
    const key = t.department;
    const entry = acc[key] ?? { total: 0, done: 0 };
    entry.total += 1;
    if (doneStates.test(t.status)) entry.done += 1;
    acc[key] = entry;
    return acc;
  }, {});

  const deptRows: GanttRow[] = Object.entries(byDept)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([dept, entry]) => ({
      label: dept,
      start: 0,
      width: entry.total > 0 ? Math.max(0.02, entry.done / entry.total) : 0.02,
      tone: entry.done === entry.total ? "metric" : entry.done === 0 ? "ochre" : "signal",
      value: `${entry.done}/${entry.total}`,
    }));

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="pb-4 border-b border-[var(--carbon)]">
          <span className="mono-label" style={{ letterSpacing: "0.12em" }}>Handover</span>
          <h1 className="tracking-tight" style={{ margin: "10px 0 0" }}>Work passing between departments</h1>
          <p style={{ margin: "8px 0 0" }}>
            A task carries the authorisation level it needs. It moves to the next person only
            when someone at that level signs it off, and every hand-over is recorded.
          </p>
        </div>

        {feedbackNotice && (
          <div
            className="flex items-center justify-between gap-3"
            style={{ borderLeft: "2px solid var(--signal)", padding: "10px 14px", borderRadius: 2, fontSize: 13, color: "var(--stone)" }}
          >
            <span>{feedbackNotice}</span>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              aria-label="Dismiss"
              style={{ background: "transparent", border: "none", color: "var(--granite)", cursor: "pointer", padding: 0 }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,210px)_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <StatSlab
              value={`${completionPct}%`}
              label="Signed off"
              tone={completionPct === 100 ? "metric" : completionPct === 0 ? "neutral" : "signal"}
            />
            <FigurePanel figure="1" title="Where things stand">
              <dl style={{ margin: 0 }}>
                {[
                  { k: "Signed off", v: completed, c: "var(--metric)" },
                  { k: "Waiting on someone", v: waiting, c: "var(--ochre)" },
                  { k: "Being worked on", v: active, c: "var(--signal)" },
                ].map((row) => (
                  <div key={row.k} className="flex items-baseline justify-between gap-2" style={{ padding: "9px 0", borderBottom: "1px solid var(--carbon)" }}>
                    <dt className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--graphite)" }}>{row.k}</dt>
                    <dd className="font-mono tnum" style={{ margin: 0, fontSize: 14, color: row.c }}>{row.v}</dd>
                  </div>
                ))}
              </dl>
            </FigurePanel>
          </div>

          <FigurePanel figure="2" title="Progress by department" caption="signed off, against everything assigned">
            {deptRows.length > 0 ? (
              <Gantt rows={deptRows} />
            ) : (
              <p className="font-mono" style={{ margin: 0, fontSize: 12, color: "var(--graphite)" }}>
                Nothing assigned yet.
              </p>
            )}
          </FigurePanel>
        </div>


      {/* Middle Section: Coworking Tasks & Team Communications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FigurePanel
            figure="3"
            title="The board"
            caption="a task moves only when someone at the required level signs it off"
            actions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.08em", padding: "6px 10px", borderRadius: 2, border: "1px solid var(--signal)", background: "transparent", color: "var(--signal)", cursor: "pointer" }}
                >
                  Assign
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTaskForSubmission(tasks[0] || null);
                    setIsSubmitModalOpen(true);
                  }}
                  className="font-mono uppercase"
                  style={{ fontSize: 10, letterSpacing: "0.08em", padding: "6px 10px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                >
                  Hand over
                </button>
              </div>
            }
            flush
          >
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-3"
              style={{ padding: "12px 16px", borderBottom: "1px solid var(--carbon)" }}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--graphite)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tasks, people or departments"
                  className="w-full bg-transparent font-mono"
                  style={{ fontSize: 12, color: "var(--bone)", border: "none", outline: "none", padding: 0 }}
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="font-mono"
                  style={{ fontSize: 11, padding: "5px 8px" }}
                >
                  <option value="All">All departments</option>
                  <option value="Legal &amp; Contracts">Legal &amp; Contracts</option>
                  <option value="Finance &amp; Accounting">Finance &amp; Accounting</option>
                  <option value="Operations &amp; Supply">Operations &amp; Supply</option>
                  <option value="HR &amp; Compliance">HR &amp; Compliance</option>
                  <option value="AI &amp; Engineering">AI &amp; Engineering</option>
                </select>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="font-mono"
                  style={{ fontSize: 11, padding: "5px 8px" }}
                >
                  <option value="All">Any level</option>
                  <option value="L1">Level 1</option>
                  <option value="L2">Level 2</option>
                  <option value="L3">Level 3</option>
                  <option value="L4">Level 4</option>
                </select>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>With</th>
                  <th>Needs</th>
                  <th style={{ textAlign: "right" }}>Hand over</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="font-mono" style={{ color: "var(--graphite)" }}>
                      Nothing matches that filter.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((t) => {
                    const done = /complete|signed off/i.test(t.status);
                    const waiting = /pending|review/i.test(t.status);
                    const colour = done ? "var(--metric)" : waiting ? "var(--ochre)" : "var(--signal)";
                    return (
                      <tr key={t.id}>
                        <td style={{ maxWidth: 400 }}>
                          <span className="block truncate" style={{ color: "var(--bone)" }} title={t.title}>
                            {t.title}
                          </span>
                          <span className="flex items-center gap-2 font-mono truncate" style={{ marginTop: 3, fontSize: 11, color: "var(--graphite)" }}>
                            {t.id} · {t.department}
                            {t.deliverable ? (
                              <span style={{ color: "var(--metric)" }}>· {t.deliverable.name}</span>
                            ) : null}
                          </span>
                        </td>
                        <td style={{ verticalAlign: "top" }}>
                          <span className="block truncate" style={{ color: "var(--stone)" }}>{t.assignee.name}</span>
                          <span className="block truncate" style={{ marginTop: 3, fontSize: 11.5, color: "var(--graphite)" }}>
                            {t.assignee.role}
                          </span>
                        </td>
                        <td style={{ verticalAlign: "top" }}>
                          <span className="font-mono" style={{ fontSize: 11, color: "var(--granite)" }}>{t.requiredLevel}</span>
                          <span className="flex items-center gap-2 font-mono uppercase" style={{ marginTop: 4, fontSize: 10, letterSpacing: "0.08em", color: colour }}>
                            <span style={{ width: 5, height: 5, borderRadius: 99, background: colour }} />
                            {t.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right", verticalAlign: "top", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTaskForSubmission(t);
                              setIsSubmitModalOpen(true);
                            }}
                            className="font-mono uppercase"
                            style={{ fontSize: 10, letterSpacing: "0.08em", padding: "5px 9px", borderRadius: 2, border: "1px solid var(--ash)", background: "transparent", color: "var(--stone)", cursor: "pointer" }}
                          >
                            Pass on
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </FigurePanel>
        </div>


        {/* Right 1 Col: Department Communication Drawer */}
        <div className="space-y-4">
          <div className="astra-plate rounded-[6px] p-6">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <h3 className="mono-label" style={{ margin: 0 }}>Who is here</h3>
                <span className="font-mono tnum" style={{ fontSize: 11, color: "var(--signal)" }}>
                  {coworkers.length}
                </span>
              </div>
              <span className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: "0.08em", color: "var(--graphite)" }}>
                {activities.length} update(s)
              </span>
            </div>

            {/* Department member list */}
            <div className="divide-y divide-zinc-50 pt-2">
              {coworkers.map((cw) => (
                <div
                  key={cw.id}
                  className="py-3 flex items-start gap-3 hover:bg-zinc-50/80 rounded-xl px-2 transition-colors cursor-pointer group"
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-9 h-9 rounded-full bg-purple-100 text-[var(--accent)] font-bold flex items-center justify-center text-xs border border-purple-200 shadow-xs">
                      {cw.avatar}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white ${
                        cw.status === "online"
                          ? "bg-emerald-500"
                          : cw.status === "in-review"
                          ? "bg-purple-500"
                          : "bg-amber-500"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-zinc-900 truncate">{cw.name}</h4>
                      <span className="text-[10px] text-zinc-400">{cw.time}</span>
                    </div>
                    <span className="text-[10px] font-medium text-purple-700 block truncate">
                      {cw.department}
                    </span>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5">{cw.lastMessage}</p>
                  </div>

                  {cw.unreadCount && cw.unreadCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9.5px] font-bold shrink-0 self-center">
                      {cw.unreadCount}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Live Activity Feed */}
            <div className="mt-5 pt-4 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Live Authorization Feed
                </span>
                <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  AIR-GAP AUDITED
                </span>
              </div>

              <div className="space-y-3">
                {activities.map((act) => (
                  <div key={act.id} className="text-xs flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 text-zinc-700 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5 border border-zinc-200">
                      {act.avatar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-zinc-800">{act.actor}</span>{" "}
                      <span className="text-zinc-500">{act.action}</span>{" "}
                      <span className="font-medium text-zinc-700 truncate block">{act.target}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-zinc-400">{act.time}</span>
                        {act.levelBadge && (
                          <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-100">
                            {act.levelBadge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal 1: Assign Task Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[var(--accent)]">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Assign New Task</h3>
                  <p className="text-xs text-zinc-500">
                    Delegate work with explicit role-based authorization requirements.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Hierarchy Scope Indicator */}
            {currentUser.role === "admin" ? (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl flex items-start gap-2 text-xs text-purple-900">
                <ShieldCheck className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">ADMIN PRIVILEGE (Cross-Department)</span>
                  <p className="text-[11px] text-purple-700 mt-0.5 leading-relaxed">
                    Authorized to assign and dispatch work orders to any department and staff member across the organization.
                  </p>
                </div>
              </div>
            ) : currentUser.role === "manager" ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-2 text-xs text-blue-900">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">DEPARTMENT MANAGER ({currentUser.dept})</span>
                  <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                    Authorized to delegate tasks to junior specialists and operators within {currentUser.dept}.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">JUNIOR CONTRIBUTOR / OPERATOR</span>
                  <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                    Delegating tasks to other staff is restricted to Managers &amp; Admins. This item will be created as a self-assigned draft.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleAssignTask} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q3 Vendor Compliance Review or Ledger Reconciliation"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Target Department</label>
                  {currentUser.role === "admin" ? (
                    <select
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                    >
                      <option value="Legal & Contracts">Legal & Contracts</option>
                      <option value="Finance & Accounting">Finance & Accounting</option>
                      <option value="Operations & Supply">Operations & Supply</option>
                      <option value="HR & Compliance">HR & Compliance</option>
                      <option value="AI & Engineering">AI & Engineering</option>
                    </select>
                  ) : (
                    <div className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 font-semibold text-xs">
                      {currentUser.dept} (Locked to Dept)
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Assignee</label>
                  {currentUser.role === "junior" ? (
                    <div className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 font-semibold text-xs">
                      {currentUser.name} (Self-Assigned)
                    </div>
                  ) : (
                    <select
                      value={newAssignee}
                      onChange={(e) => setNewAssignee(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                    >
                      {coworkers
                        .filter((c) => currentUser.role === "admin" || c.department === currentUser.dept || c.department.includes("Specialist") || c.department.includes("Operations"))
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name} ({c.department})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">
                    Authorization Level Required
                  </label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                  >
                    <option value="L1: Contributor">L1: Contributor (Operator)</option>
                    <option value="L2: Reviewer">L2: Reviewer (Specialist)</option>
                    <option value="L3: Dept Lead">L3: Dept Lead (Department Head)</option>
                    <option value="L4: Sovereign Officer">L4: Sovereign Officer (Air-Gap Sign-Off)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-700 mb-1">Deadline</label>
                  <input
                    type="text"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">Instructions / Notes</label>
                <textarea
                  rows={3}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Specific compliance guidelines, local OCR inputs, or air-gap requirements..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold shadow-sm"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Submit Task for Authorization Modal */}
      {isSubmitModalOpen && selectedTaskForSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[var(--accent)]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Submit Deliverable for Sign-Off</h3>
                  <p className="text-xs text-zinc-500">
                    Route this completed task through hierarchical authorization.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4 text-xs">
              <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                <span className="text-[10px] text-zinc-400 font-mono">SELECTED TASK</span>
                <div className="font-bold text-zinc-800 text-sm mt-0.5">
                  {selectedTaskForSubmission.title}
                </div>
                <div className="flex items-center gap-2 mt-1 text-zinc-500">
                  <span>{selectedTaskForSubmission.department}</span>
                  <span>·</span>
                  <span>Assigned to: {selectedTaskForSubmission.assignee.name}</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Attach Deliverable (DOCX, XLSX, PDF)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. final_procurement_report.docx"
                    value={submitFileName}
                    onChange={(e) => setSubmitFileName(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                  />
                  <label className="px-3 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 cursor-pointer flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Browse</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setSubmitFileName(e.target.files[0].name);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Authorization Level to Request
                </label>
                <select
                  value={submitLevel}
                  onChange={(e) => setSubmitLevel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                >
                  <option value="L2: Reviewer">L2: Reviewer (Peer Specialist Check)</option>
                  <option value="L3: Dept Lead">L3: Dept Lead (Official Approval)</option>
                  <option value="L4: Sovereign Officer">L4: Sovereign Officer (Air-Gap Cryptographic Sign-Off)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 mb-1">
                  Submission Memo / Review Notes
                </label>
                <textarea
                  rows={2}
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  placeholder="Add notes for the reviewer or compliance team..."
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-800 text-[11px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-purple-600" />
                <span>
                  Task will be routed to the selected department lead for review and sign-off.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white font-semibold shadow-sm"
                >
                  Submit for Authorization
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
