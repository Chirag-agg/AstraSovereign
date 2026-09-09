"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  ChevronUp,
  ArrowUpRight,
  TrendingUp,
  Paperclip,
  X,
  Building2,
  Sparkles,
  Award,
  Lock,
  Laptop,
  Check,
  ChevronRight,
  Eye,
  Briefcase,
  Layers,
  ArrowDown,
  Radio,
  Server,
} from "lucide-react";
import type { AuthorizationLevel, Coworker, CoworkingActivity, CoworkingTask } from "./types";

interface CoworkingViewProps {
  onOpenAgentWorkspace?: (taskPrompt?: string) => void;
}

// -------------------------------------------------------------
// Organization Hierarchy Definition
// -------------------------------------------------------------
export interface HierarchyRole {
  id: string;
  name: string;
  roleTitle: string;
  department: CoworkingTask["department"];
  rank: number; // 4: Admin, 3: Manager/Lead, 1: Contributor
  clearance: AuthorizationLevel;
  deviceNode: string;
}

const HIERARCHY_ROLES: Record<string, HierarchyRole> = {
  "admin-001": {
    id: "admin-001",
    name: "Security Officer & Admin",
    roleTitle: "System Administrator",
    department: "AI & Engineering",
    rank: 4,
    clearance: "L4: Sovereign Officer",
    deviceNode: "SEC-ROOT-00",
  },
  "user-001": {
    id: "user-001",
    name: "Senior Legal Counsel",
    roleTitle: "Legal Department Lead",
    department: "Legal & Contracts",
    rank: 3,
    clearance: "L3: Dept Lead",
    deviceNode: "LEGAL-TERM-02",
  },
  "user-002": {
    id: "user-002",
    name: "Lead Financial Analyst",
    roleTitle: "Finance Lead",
    department: "Finance & Accounting",
    rank: 3,
    clearance: "L4: Sovereign Officer",
    deviceNode: "FIN-LEDGER-03",
  },
  "user-003": {
    id: "user-003",
    name: "Chief Compliance Auditor",
    roleTitle: "Compliance Lead",
    department: "HR & Compliance",
    rank: 3,
    clearance: "L2: Reviewer",
    deviceNode: "COMPLY-GATE-05",
  },
  "user-005": {
    id: "user-005",
    name: "Infrastructure Lead",
    roleTitle: "Infrastructure & AI Lead",
    department: "AI & Engineering",
    rank: 3,
    clearance: "L4: Sovereign Officer",
    deviceNode: "DEV-GPU-01",
  },
  "user-004": {
    id: "user-004",
    name: "Supply Operations Specialist",
    roleTitle: "Operations Specialist",
    department: "Operations & Supply",
    rank: 1,
    clearance: "L1: Contributor",
    deviceNode: "OPS-EDGE-04",
  },
};

// -------------------------------------------------------------
// Interconnected Hardware & Device Mesh Fabric
// -------------------------------------------------------------
interface ConnectedDevice {
  id: string;
  name: string;
  department: CoworkingTask["department"];
  ip: string;
  operatorId: string;
  operatorName: string;
  clearance: string;
  status: "online" | "syncing" | "busy";
  os: string;
  latency: string;
}

const CONNECTED_DEVICES: ConnectedDevice[] = [
  {
    id: "SEC-ROOT-00",
    name: "Directorate Station",
    department: "AI & Engineering",
    ip: "10.0.1.10",
    operatorId: "admin-001",
    operatorName: "Security Officer & Admin",
    clearance: "L4",
    status: "online",
    os: "Sovereign Linux",
    latency: "< 0.2ms",
  },
  {
    id: "DEV-GPU-01",
    name: "AI Inference Cluster",
    department: "AI & Engineering",
    ip: "10.0.1.25",
    operatorId: "user-005",
    operatorName: "Infrastructure Lead",
    clearance: "L4",
    status: "online",
    os: "Ubuntu 24.04-Airgap",
    latency: "< 0.4ms",
  },
  {
    id: "LEGAL-TERM-02",
    name: "Legal Workstation",
    department: "Legal & Contracts",
    ip: "10.0.1.32",
    operatorId: "user-001",
    operatorName: "Senior Legal Counsel",
    clearance: "L3",
    status: "online",
    os: "Win11-Secured",
    latency: "< 0.3ms",
  },
  {
    id: "FIN-LEDGER-03",
    name: "Finance Ledger Node",
    department: "Finance & Accounting",
    ip: "10.0.1.44",
    operatorId: "user-002",
    operatorName: "Lead Financial Analyst",
    clearance: "L4",
    status: "online",
    os: "RHEL-Gov",
    latency: "< 0.3ms",
  },
  {
    id: "OPS-EDGE-04",
    name: "Operations Edge Terminal",
    department: "Operations & Supply",
    ip: "10.0.1.58",
    operatorId: "user-004",
    operatorName: "Supply Operations Specialist",
    clearance: "L1",
    status: "online",
    os: "EdgeOS-Secure",
    latency: "< 0.5ms",
  },
  {
    id: "COMPLY-GATE-05",
    name: "Compliance Audit Node",
    department: "HR & Compliance",
    ip: "10.0.1.61",
    operatorId: "user-003",
    operatorName: "Chief Compliance Auditor",
    clearance: "L2",
    status: "online",
    os: "macOS-Secured",
    latency: "< 0.4ms",
  },
];

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
    assignedBy: "Security Officer & Admin",
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
    assignedBy: "Security Officer & Admin",
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
    assignedBy: "Lead Financial Analyst",
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
    assignedBy: "Security Officer & Admin",
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
    assignedBy: "Security Officer & Admin",
  },
  {
    id: "TSK-806",
    title: "Physical Air-Gap USB Token Transport & Verification",
    department: "Operations & Supply",
    assignee: {
      name: "Supply Operations Specialist",
      avatar: "SO",
      role: "Operations Specialist",
    },
    requiredLevel: "L1: Contributor",
    status: "In Progress",
    deadline: "20 Sep, 2026",
    deliverable: {
      name: "token_transfer_chain_custody.pdf",
      type: "pdf",
      size: "1.1 MB",
    },
    notes: "Cryptographic physical handoff token verification for edge sensors.",
    assignedBy: "Security Officer & Admin",
  },
  {
    id: "TSK-807",
    title: "Docker Sandbox Network-None Stress Benchmark",
    department: "AI & Engineering",
    assignee: {
      name: "Infrastructure Lead",
      avatar: "IL",
      role: "AI Architect",
    },
    requiredLevel: "L4: Sovereign Officer",
    status: "In Progress",
    deadline: "22 Sep, 2026",
    deliverable: {
      name: "sandbox_zero_egress_report.docx",
      type: "docx",
      size: "3.2 MB",
    },
    notes: "Confirming zero egress under 500 parallel Python sandbox jobs.",
    assignedBy: "Security Officer & Admin",
  },
  {
    id: "TSK-808",
    title: "On-Premise Software Licensing & Intellectual Property Clearance",
    department: "Legal & Contracts",
    assignee: {
      name: "Senior Legal Counsel",
      avatar: "LC",
      role: "Department Lead",
    },
    requiredLevel: "L3: Dept Lead",
    status: "Completed",
    deadline: "10 Sep, 2026",
    deliverable: {
      name: "sovereign_license_schedule.docx",
      type: "docx",
      size: "950 KB",
    },
    notes: "Air-gap Apache 2.0 and MIT license compliance verified.",
    assignedBy: "Senior Legal Counsel",
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

const DEPARTMENTS: CoworkingTask["department"][] = [
  "Legal & Contracts",
  "Finance & Accounting",
  "Operations & Supply",
  "HR & Compliance",
  "AI & Engineering",
];

export default function CoworkingView({ onOpenAgentWorkspace }: CoworkingViewProps) {
  const [tasks, setTasks] = useState<CoworkingTask[]>(INITIAL_TASKS);
  const [coworkers] = useState<Coworker[]>(INITIAL_COWORKERS);
  const [activities, setActivities] = useState<CoworkingActivity[]>(INITIAL_ACTIVITIES);

  // Active user / session state
  const [activeUserId, setActiveUserId] = useState<string>("user-001");
  const [selectedDevice, setSelectedDevice] = useState<string>("SEC-ROOT-00");
  const [expandedDept, setExpandedDept] = useState<string | null>("Legal & Contracts");

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
  const [assignError, setAssignError] = useState<string | null>(null);

  // Submit modal form state
  const [submitFileName, setSubmitFileName] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");
  const [submitLevel, setSubmitLevel] = useState<AuthorizationLevel>("L3: Dept Lead");
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Cross-department collaboration chat stream
  const [collabMessages, setCollabMessages] = useState<
    { id: string; sender: string; role: string; dept: string; text: string; time: string; deliverable?: string }[]
  >([
    {
      id: "cm-1",
      sender: "Senior Legal Counsel",
      role: "Legal Lead",
      dept: "Legal & Contracts",
      text: "Uploaded sanitized vendor procurement addendum for air-gapped node telemetry. Clause 14.2 verified. Operations and Finance may review ledger allocations.",
      time: "10:24 AM",
      deliverable: "vendor_master_agreement_q3.docx",
    },
    {
      id: "cm-2",
      sender: "Supply Operations Specialist",
      role: "Operations Specialist",
      dept: "Operations & Supply",
      text: "Received legal release. Transport manifest for isolated flash-token modules has been generated. Ready for AI & Engineering verification.",
      time: "10:31 AM",
      deliverable: "logistics_manifest_extracted.pdf",
    },
    {
      id: "cm-3",
      sender: "Infrastructure Lead",
      role: "AI Lead",
      dept: "AI & Engineering",
      text: "Ephemeral Docker sandbox test passed with --network none. Zero egress confirmed across all test payloads.",
      time: "10:39 AM",
    },
  ]);
  const [newCollabText, setNewCollabText] = useState("");

  // Sync active user from localStorage and storage events
  useEffect(() => {
    const syncUser = () => {
      try {
        const uid = window.localStorage.getItem("sovereign.active-user") || "admin-001";
        setActiveUserId(uid);
      } catch {
        // storage unavailable
      }
    };
    syncUser();
    window.addEventListener("storage", syncUser);
    window.addEventListener("sovereign:active-user-updated", syncUser);
    return () => {
      window.removeEventListener("storage", syncUser);
      window.removeEventListener("sovereign:active-user-updated", syncUser);
    };
  }, []);

  const currentUser = useMemo(() => {
    return (
      HIERARCHY_ROLES[activeUserId] || {
        id: activeUserId,
        name: "Security Officer & Admin",
        roleTitle: "System Administrator",
        department: "AI & Engineering" as const,
        rank: 4,
        clearance: "L4: Sovereign Officer" as const,
        deviceNode: "SEC-ROOT-00",
      }
    );
  }, [activeUserId]);

  const isAdmin = currentUser.id === "admin-001" || currentUser.rank === 4;

  // Filtered tasks for task table
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.department.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = selectedDept === "All" || t.department === selectedDept;
      const matchesLevel = selectedLevel === "All" || t.requiredLevel.startsWith(selectedLevel);
      return matchesSearch && matchesDept && matchesLevel;
    });
  }, [tasks, searchQuery, selectedDept, selectedLevel]);

  // Department Tasks Left & Progress Breakdown (Admin Oversight)
  const departmentStats = useMemo(() => {
    return DEPARTMENTS.map((dept) => {
      const deptTasks = tasks.filter((t) => t.department === dept);
      const total = deptTasks.length;
      const completed = deptTasks.filter((t) => t.status === "Completed" || t.status === "L4 Signed Off").length;
      const pendingTasks = deptTasks.filter((t) => t.status !== "Completed" && t.status !== "L4 Signed Off");
      const leftCount = pendingTasks.length;
      const percent = total === 0 ? 100 : Math.round((completed / total) * 100);

      return {
        dept,
        total,
        completed,
        leftCount,
        percent,
        pendingTasks,
      };
    });
  }, [tasks]);

  const totalOrgTasks = tasks.length;
  const totalOrgCompleted = tasks.filter((t) => t.status === "Completed" || t.status === "L4 Signed Off").length;
  const totalOrgLeft = totalOrgTasks - totalOrgCompleted;
  const orgVelocityPercent = totalOrgTasks === 0 ? 100 : Math.round((totalOrgCompleted / totalOrgTasks) * 100);

  // Eligible assignees based on hierarchy:
  // Rule: Higher position employees can assign tasks down to lower rank employees (or self-assign).
  // Lower rank employees CANNOT assign tasks to higher rank employees.
  const eligibleAssignees = useMemo(() => {
    return Object.values(HIERARCHY_ROLES).filter((role) => {
      if (currentUser.rank === 4) return true; // Admin can assign to anyone
      if (currentUser.rank === 3) {
        // Leads can assign to people of lower rank (e.g. rank 1), or people in their own department
        return role.rank < currentUser.rank || role.id === currentUser.id || role.department === currentUser.department;
      }
      // Junior / Rank 1 can only self-assign
      return role.id === currentUser.id;
    });
  }, [currentUser]);

  // Handle task assignment with hierarchy verification
  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    setAssignError(null);
    if (!newTitle.trim()) return;

    // Find the selected assignee's role
    const targetRole = Object.values(HIERARCHY_ROLES).find((r) => r.name === newAssignee) || HIERARCHY_ROLES["user-004"];

    // Hierarchy rule check: Higher position employees can assign to lower ones.
    if (currentUser.rank < targetRole.rank) {
      setAssignError(
        `Hierarchy Policy Violation: As ${currentUser.roleTitle} (Rank ${currentUser.rank}), you cannot assign tasks upward to ${targetRole.name} (Rank ${targetRole.rank}). Lower employees cannot delegate to superiors.`
      );
      return;
    }

    if (currentUser.rank === 1 && targetRole.id !== currentUser.id) {
      setAssignError("Hierarchy Rule: Operators (Rank 1) can only create self-assigned drafts for managerial review.");
      return;
    }

    const newTask: CoworkingTask = {
      id: `TSK-${Math.floor(800 + Math.random() * 200)}`,
      title: newTitle.trim(),
      department: currentUser.rank === 4 ? newDept : targetRole.department,
      assignee: {
        name: targetRole.name,
        avatar: targetRole.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        role: targetRole.roleTitle,
      },
      requiredLevel: newLevel,
      status: "In Progress",
      deadline: newDeadline,
      notes: newNotes,
      assignedBy: `${currentUser.name} (${currentUser.roleTitle})`,
    };

    setTasks([newTask, ...tasks]);
    setActivities([
      {
        id: `act-${Date.now()}`,
        actor: currentUser.name,
        avatar: currentUser.name.slice(0, 2).toUpperCase(),
        action:
          currentUser.rank === 4
            ? "dispatched organization work order"
            : currentUser.rank === 3
            ? `delegated task down to ${targetRole.name}`
            : "created draft task",
        target: newTask.title,
        time: "Just now",
        levelBadge: newTask.requiredLevel,
      },
      ...activities,
    ]);

    setIsAssignModalOpen(false);
    setNewTitle("");
    setNewNotes("");
    setFeedbackNotice(
      `Task assigned down to ${targetRole.name} (${targetRole.department}) by ${currentUser.roleTitle}. Hierarchy validated.`
    );
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const handleSubmitTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskForSubmission) return;

    const updatedTasks = tasks.map((t) => {
      if (t.id === selectedTaskForSubmission.id) {
        return {
          ...t,
          status: submitLevel.includes("L4")
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
        action: "submitted deliverable for authorization",
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
    setFeedbackNotice("Deliverable submitted for authorization! Routed up the hierarchy chain.");
    setTimeout(() => setFeedbackNotice(null), 5000);
  };

  const postCollabMessage = () => {
    if (!newCollabText.trim()) return;
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setCollabMessages([
      ...collabMessages,
      {
        id: `cm-${Date.now()}`,
        sender: currentUser.name,
        role: currentUser.roleTitle,
        dept: currentUser.department,
        text: newCollabText.trim(),
        time: timeNow,
      },
    ]);
    setNewCollabText("");
  };

  const getLevelBadgeClass = (level: AuthorizationLevel) => {
    if (level.startsWith("L1")) return "bg-slate-100 text-slate-700 border-slate-200";
    if (level.startsWith("L2")) return "bg-blue-50 text-blue-700 border-blue-200";
    if (level.startsWith("L3")) return "bg-purple-50 text-purple-700 border-purple-200";
    return "bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold";
  };

  const getStatusBadge = (status: CoworkingTask["status"]) => {
    switch (status) {
      case "Completed":
      case "L4 Signed Off":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {status}
          </span>
        );
      case "Pending L3 Approval":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-600" />
            L3 Sign-Off Pending
          </span>
        );
      case "Pending L2 Review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            L2 Review Required
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
            <Clock className="w-3 h-3 text-zinc-500" />
            In Progress
          </span>
        );
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#f8fafc]">
      <div className="max-w-[1600px] mx-auto w-full space-y-6">

        {/* Feedback Alert */}
        {feedbackNotice && (
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between shadow-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span className="font-medium">{feedbackNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              className="text-purple-600 hover:text-purple-900 cursor-pointer text-sm font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* ================= TOP BAR: ACTIVE USER CONTEXT & HIERARCHY BADGE ================= */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${
              isAdmin ? "bg-gradient-to-tr from-[#7047eb] to-indigo-600 shadow-purple-500/20" : "bg-gradient-to-tr from-slate-700 to-slate-900"
            }`}>
              {isAdmin ? <ShieldCheck className="w-6 h-6" /> : <Briefcase className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-zinc-900">Interconnected Coworking Space</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold border ${
                  isAdmin
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}>
                  {isAdmin ? "ADMINISTRATOR PRIVILEGES (L4)" : `NORMAL USER: ${currentUser.roleTitle}`}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  0 BYTES EGRESS
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">
                Logged in as <strong className="text-zinc-800">{currentUser.name}</strong> &bull; {currentUser.department} &bull; Hierarchy Rank: <strong>Level {currentUser.rank}</strong>
              </p>
            </div>
          </div>

          {/* Role Switcher Tester for Instant Evaluation */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs">
            <span className="text-zinc-400 pl-1.5 font-medium">Preview As:</span>
            <select
              value={activeUserId}
              onChange={(e) => {
                const uid = e.target.value;
                setActiveUserId(uid);
                try {
                  window.localStorage.setItem("sovereign.active-user", uid);
                  window.localStorage.setItem("sovereign.dev-role", uid.startsWith("admin") ? "admin" : "user");
                } catch {
                  // ignore
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-zinc-800 font-medium focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              <option value="admin-001">Admin (admin-001) [L4 System Administrator]</option>
              <option value="user-001">Legal Lead (user-001) [L3 Department Lead]</option>
              <option value="user-002">Finance Analyst (user-002) [L4 Finance Lead]</option>
              <option value="user-003">Compliance Auditor (user-003) [L2 Compliance Lead]</option>
              <option value="user-004">Operations Specialist (user-004) [L1 Junior Operator]</option>
              <option value="user-005">AI Lead (user-005) [L4 AI Architect]</option>
            </select>
          </div>
        </div>

        {/* ================= SECTION 1: INTERCONNECTED HARDWARE & DEVICE MESH ================= */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#7047eb] animate-pulse" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-900">
                  Interconnected Organization Device &amp; Hardware Mesh
                </h2>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full font-mono bg-purple-50 text-purple-700 border border-purple-200">
                  P2P Air-Gapped Network
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Direct peer-to-peer interconnection linking all department workstations. Fast local buffer sync with zero external cloud routing.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                6/6 Stations Online
              </span>
              <span>&bull;</span>
              <span>TLS 1.3 mTLS Intranet</span>
            </div>
          </div>

          {/* Connected Device Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 mt-4">
            {CONNECTED_DEVICES.map((dev) => {
              const isSelected = selectedDevice === dev.id;
              const isCurrentDevice = dev.operatorId === currentUser.id;

              return (
                <div
                  key={dev.id}
                  onClick={() => setSelectedDevice(dev.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? "bg-purple-50/50 border-[#7047eb] shadow-md shadow-purple-500/10"
                      : "bg-slate-50/60 hover:bg-white border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${isSelected ? "bg-purple-100 text-[#7047eb]" : "bg-zinc-200 text-zinc-700"}`}>
                        <Server className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-bold font-mono text-zinc-900">{dev.id}</span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>

                  <div className="mt-2.5 space-y-0.5">
                    <div className="text-[11px] font-semibold text-zinc-800 truncate">{dev.department}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{dev.operatorName}</div>
                    <div className="text-[10px] font-mono text-slate-400">IP: {dev.ip}</div>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-emerald-700">{dev.latency}</span>
                    {isCurrentDevice && (
                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold">YOU</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= SECTION 2: DEPARTMENT TASK PROGRESS & BACKLOG (ADMIN ONLY vs RESTRICTED) ================= */}
        {isAdmin ? (
          /* ================= ADMIN VIEW: WHAT TASKS ARE LEFT IN WHICH DEPARTMENT ================= */
          <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-[0_10px_30px_-5px_rgba(112,71,235,0.08)] space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-100">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-[#7047eb]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-zinc-900">
                      Department Task Progress &amp; Remaining Backlog Oversight
                    </h2>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 uppercase tracking-wider">
                      Admin Clearance Required &bull; Confidential Telemetry
                    </span>
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">
                  Exclusive administrative supervisor dashboard. Track remaining work orders, pending sign-offs, and bottlenecks across all 5 departments.
                </p>
              </div>

              {/* Summary Stats Pill */}
              <div className="flex items-center gap-4 bg-purple-50/70 border border-purple-100 px-4 py-2.5 rounded-2xl">
                <div>
                  <span className="text-[10px] font-mono uppercase text-purple-700 font-bold block">Total Work Orders</span>
                  <span className="text-lg font-extrabold text-purple-900">{totalOrgTasks}</span>
                </div>
                <div className="h-7 w-px bg-purple-200" />
                <div>
                  <span className="text-[10px] font-mono uppercase text-emerald-700 font-bold block">Completed</span>
                  <span className="text-lg font-extrabold text-emerald-800">{totalOrgCompleted}</span>
                </div>
                <div className="h-7 w-px bg-purple-200" />
                <div>
                  <span className="text-[10px] font-mono uppercase text-rose-700 font-bold block">Tasks Left</span>
                  <span className="text-lg font-extrabold text-rose-800">{totalOrgLeft}</span>
                </div>
              </div>
            </div>

            {/* Department Breakdown Cards (Showing which dept has what tasks left) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {departmentStats.map((stat) => {
                const isExpanded = expandedDept === stat.dept;

                return (
                  <div
                    key={stat.dept}
                    className={`rounded-2xl p-4 border transition-all ${
                      stat.leftCount > 0
                        ? "bg-white border-slate-200/90 shadow-xs hover:border-purple-300"
                        : "bg-slate-50/50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-zinc-900 leading-tight">{stat.dept}</span>
                      <span
                        className={`text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          stat.leftCount > 0
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {stat.leftCount} Left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-mono mb-1 text-zinc-500">
                        <span>Progress</span>
                        <span className="font-bold text-zinc-800">{stat.percent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[#7047eb] h-full rounded-full transition-all duration-500"
                          style={{ width: `${stat.percent}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[11px] text-zinc-400 font-mono">
                        Done: {stat.completed}/{stat.total}
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedDept(isExpanded ? null : stat.dept)}
                        className="text-[11px] font-semibold text-[#7047eb] hover:text-[#5e38d6] flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>{isExpanded ? "Hide" : "Inspect"}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed Remaining Tasks Accordion for the Inspected Department */}
            {expandedDept && (
              <div className="p-4 rounded-2xl bg-purple-50/40 border border-purple-100 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#7047eb]" />
                    <h3 className="text-xs font-bold text-zinc-900">
                      Remaining Tasks for <span className="text-[#7047eb]">{expandedDept}</span>
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {departmentStats.find((d) => d.dept === expandedDept)?.leftCount || 0} active work orders requiring completion
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {departmentStats
                    .find((d) => d.dept === expandedDept)
                    ?.pendingTasks.map((pt) => (
                      <div
                        key={pt.id}
                        className="p-3.5 rounded-xl bg-white border border-purple-100 shadow-xs flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-purple-700 font-bold">{pt.id}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              {pt.status}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-zinc-900 mt-1.5">{pt.title}</h4>
                          <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{pt.notes}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">
                            Assignee: <strong className="text-zinc-800">{pt.assignee.name}</strong>
                          </span>
                          <span className="text-zinc-400 font-mono">Due: {pt.deadline}</span>
                        </div>
                      </div>
                    ))}
                  {departmentStats.find((d) => d.dept === expandedDept)?.pendingTasks.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-xs text-emerald-700 font-medium">
                      All tasks in {expandedDept} have been successfully signed off and completed!
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ================= NORMAL USER RESTRICTED VIEW: AIR-GAP SECURITY SHIELD ================= */
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-10 w-10 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Cross-Department Task Progress Telemetry Locked
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  In compliance with Sovereign Air-Gap Security Directive §4.2, cross-department velocity and backlog oversight are restricted exclusively to <strong className="text-zinc-700">System Administrators (admin-001)</strong>. You have full access to your department deliverables and collaboration space below.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveUserId("admin-001");
                try {
                  window.localStorage.setItem("sovereign.active-user", "admin-001");
                  window.localStorage.setItem("sovereign.dev-role", "admin");
                } catch {
                  // ignore
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#7047eb] font-semibold text-xs border border-purple-200 transition-colors shrink-0 cursor-pointer"
            >
              Sign In as Admin to View
            </button>
          </div>
        )}

        {/* ================= SECTION 3: WORKSPACE GRID (TASK TABLE + COLLABORATION WORKSTREAM) ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Cols: Tasks Table with Hierarchy Delegation */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-zinc-900">Department Work Orders &amp; Tasks</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-800">
                      Hierarchy Enforced
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Higher position employees can assign tasks down to lower position employees.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignError(null);
                      setIsAssignModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7047eb] hover:bg-[#5e38d6] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Assign Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTaskForSubmission(tasks[0] || null);
                      setIsSubmitModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Deliverable</span>
                  </button>
                </div>
              </div>

              {/* Filter and Search Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 pb-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search tasks, assignees, or departments..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-zinc-50 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-purple-500 focus:bg-white transition-all"
                  />
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  <div className="flex items-center gap-1 text-xs text-zinc-500">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Dept:</span>
                  </div>
                  <select
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    className="text-xs rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700 cursor-pointer focus:outline-none"
                  >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1 text-xs text-zinc-500 ml-2">
                    <span>Level:</span>
                  </div>
                  <select
                    value={selectedLevel}
                    onChange={(e) => setSelectedLevel(e.target.value)}
                    className="text-xs rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700 cursor-pointer focus:outline-none"
                  >
                    <option value="All">All Clearance Levels</option>
                    <option value="L1">Level 1 (Contributor)</option>
                    <option value="L2">Level 2 (Reviewer)</option>
                    <option value="L3">Level 3 (Dept Lead)</option>
                    <option value="L4">Level 4 (Officer Sign-Off)</option>
                  </select>
                </div>
              </div>

              {/* Task Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 text-zinc-400 uppercase tracking-wider font-semibold text-[10px]">
                      <th className="py-2.5 px-2">Task Details</th>
                      <th className="py-2.5 px-2">Assignee &amp; Delegator</th>
                      <th className="py-2.5 px-2">Clearance Req</th>
                      <th className="py-2.5 px-2">Status</th>
                      <th className="py-2.5 px-2">Deliverable</th>
                      <th className="py-2.5 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {filteredTasks.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-zinc-400">
                          No tasks match current search or filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTasks.map((t) => (
                        <tr key={t.id} className="hover:bg-zinc-50/70 transition-colors group">
                          {/* Task Title & Dept */}
                          <td className="py-3 px-2 max-w-[220px]">
                            <div className="font-semibold text-zinc-800 truncate" title={t.title}>
                              {t.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-zinc-400">{t.id}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-zinc-100 text-zinc-600 font-medium">
                                {t.department}
                              </span>
                            </div>
                          </td>

                          {/* Assignee & Delegator */}
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-xs shrink-0 border border-purple-200">
                                {t.assignee.avatar}
                              </div>
                              <div className="truncate">
                                <span className="block font-medium text-zinc-800 truncate">
                                  {t.assignee.name}
                                </span>
                                {t.assignedBy && (
                                  <span className="block text-[10px] text-purple-700 truncate font-mono">
                                    by {t.assignedBy}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Authorization Level */}
                          <td className="py-3 px-2">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md text-[10.5px] border ${getLevelBadgeClass(
                                t.requiredLevel
                              )}`}
                            >
                              {t.requiredLevel}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-2">{getStatusBadge(t.status)}</td>

                          {/* Deliverable */}
                          <td className="py-3 px-2">
                            {t.deliverable ? (
                              <div className="flex items-center gap-1.5 text-purple-700 bg-purple-50/70 px-2 py-1 rounded-lg border border-purple-100 max-w-[130px] truncate">
                                <FileText className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                                <span className="text-[10.5px] font-medium truncate" title={t.deliverable.name}>
                                  {t.deliverable.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 text-[11px] italic">Not attached</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTaskForSubmission(t);
                                setIsSubmitModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-[11px] transition-colors cursor-pointer"
                            >
                              Submit / Review
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right 1 Col: Cross-Department Collaboration Stream */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] flex flex-col h-[640px]">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#7047eb]" />
                  <h3 className="text-sm font-bold text-zinc-900">Cross-Department Collab Stream</h3>
                </div>
                <span className="text-[10px] font-mono text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                {collabMessages.map((msg) => (
                  <div key={msg.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <strong className="text-zinc-800">{msg.sender}</strong>
                        <span className="px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 text-[10px] font-mono">
                          {msg.dept}
                        </span>
                      </div>
                      <span className="text-zinc-400 text-[10px] font-mono">{msg.time}</span>
                    </div>
                    <p className="text-zinc-600 leading-relaxed text-xs">{msg.text}</p>
                    {msg.deliverable && (
                      <div className="mt-1 p-2 rounded-lg bg-white border border-purple-100 flex items-center gap-2 text-[11px] text-purple-800 font-mono">
                        <FileText className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span className="truncate">{msg.deliverable}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Collaboration Message Composer */}
              <div className="pt-3 border-t border-zinc-100 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Broadcast cross-department memo as ${currentUser.name}...`}
                    value={newCollabText}
                    onChange={(e) => setNewCollabText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && postCollabMessage()}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 bg-zinc-50 text-xs focus:outline-none focus:border-purple-500 focus:bg-white"
                  />
                  <button
                    type="button"
                    onClick={postCollabMessage}
                    className="p-2 rounded-xl bg-[#7047eb] hover:bg-[#5e38d6] text-white transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-zinc-400 font-mono flex items-center justify-between">
                  <span>Signed as: {currentUser.roleTitle}</span>
                  <span>TLS 1.3 Intranet Replicated</span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* ================= MODAL 1: HIERARCHICAL TASK ASSIGNMENT MODAL ================= */}
        {isAssignModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#7047eb]">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900">Hierarchical Task Assignment</h3>
                    <p className="text-xs text-zinc-500">
                      Higher position employees delegate tasks down to lower ranks.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Role Hierarchy Scope Indicator */}
              <div className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 ${
                currentUser.rank === 4
                  ? "bg-purple-50 border-purple-200 text-purple-900"
                  : currentUser.rank === 3
                  ? "bg-blue-50 border-blue-200 text-blue-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}>
                {currentUser.rank === 4 ? (
                  <ShieldCheck className="w-4 h-4 text-[#7047eb] shrink-0 mt-0.5" />
                ) : currentUser.rank === 3 ? (
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <span className="font-bold uppercase tracking-wider text-[10.5px]">
                    YOUR HIERARCHY LEVEL: RANK {currentUser.rank} ({currentUser.roleTitle})
                  </span>
                  <p className="text-[11px] mt-0.5 leading-relaxed">
                    {currentUser.rank === 4
                      ? "Top-level Administrator. Authorized to assign work orders downward to any department lead or junior staff."
                      : currentUser.rank === 3
                      ? `Department Lead. Authorized to delegate tasks downward to junior specialists within ${currentUser.department}.`
                      : "Operator / Contributor (Rank 1). Hierarchy policy does not permit delegating tasks upward to managers or leads. Tasks are self-assigned drafts."}
                  </p>
                </div>
              </div>

              {/* Hierarchy Error Banner if triggered */}
              {assignError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{assignError}</span>
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
                    {currentUser.rank === 4 ? (
                      <select
                        value={newDept}
                        onChange={(e) => setNewDept(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                      >
                        {DEPARTMENTS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 font-semibold text-xs">
                        {currentUser.department} (Scoped to Dept)
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">Assignee (Hierarchy Filtered)</label>
                    {currentUser.rank === 1 ? (
                      <div className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-700 font-semibold text-xs">
                        {currentUser.name} (Self-Assigned Draft)
                      </div>
                    ) : (
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
                      >
                        {eligibleAssignees.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name} &bull; Rank {r.rank} ({r.roleTitle})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-zinc-700 mb-1">Clearance Level Required</label>
                    <select
                      value={newLevel}
                      onChange={(e) => setNewLevel(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
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
                  <label className="block font-semibold text-zinc-700 mb-1">Delegation Instructions / Notes</label>
                  <textarea
                    rows={2}
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
                    className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#7047eb] hover:bg-[#5e38d6] text-white font-semibold shadow-sm cursor-pointer"
                  >
                    Confirm Delegation
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 2: SUBMIT TASK FOR AUTHORIZATION ================= */}
        {isSubmitModalOpen && selectedTaskForSubmission && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-100 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-[#7047eb]">
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
                  className="text-zinc-400 hover:text-zinc-700 p-1 cursor-pointer"
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
                    <span>&bull;</span>
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
                    className="w-full px-3 py-2 rounded-xl border border-zinc-200 focus:outline-none focus:border-purple-500 text-xs cursor-pointer"
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
                    Deliverable will route up the hierarchy to the designated department lead or administrator.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsSubmitModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-700 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#7047eb] hover:bg-[#5e38d6] text-white font-semibold shadow-sm cursor-pointer"
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
