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
  Paperclip,
  X,
  Building2,
  Sparkles,
  Award,
  Lock,
  Check,
  ChevronRight,
  Eye,
  Briefcase,
  Layers,
  ArrowDown,
  Server,
  Trash2,
  UserPlus,
  ArrowLeft,
  GitBranch,
  Shield,
  AlertTriangle,
  CornerDownRight,
  Cpu,
  Scale,
  Coins,
  Truck,
  HelpCircle,
} from "lucide-react";
import type { AuthorizationLevel, CoworkingTask } from "./types";

interface CoworkingViewProps {
  onOpenAgentWorkspace?: (taskPrompt?: string) => void;
}

// ---------------------------------------------------------------------------
// Hierarchy & Clearance Definition
// ---------------------------------------------------------------------------
// Rank 4: L4 Sovereign Admin / Directorate (Topmost Authority)
// Rank 3: L3 Department Director / Lead
// Rank 2: L2 Senior Specialist / Reviewer
// Rank 1: L1 Associate / Contributor / Operator
export interface OrgEmployee {
  id: string;
  name: string;
  avatar: string;
  email: string;
  roleTitle: string;
  department: string;
  rank: 4 | 3 | 2 | 1;
  clearance: AuthorizationLevel;
  nodeIp: string;
  status: "online" | "in-task" | "idle" | "offline";
  activeTasksCount: number;
  specialties: string[];
}

export interface DepartmentInfo {
  id: string;
  name: string;
  icon: React.ElementType;
  leadId: string;
  leadName: string;
  description: string;
  accentColor: string;
  bgLight: string;
  borderColor: string;
  textColor: string;
  slaTarget: string;
}

const INITIAL_DEPARTMENTS: DepartmentInfo[] = [
  {
    id: "ai_eng",
    name: "AI & Engineering",
    icon: Cpu,
    leadId: "user-005",
    leadName: "Dr. Victor Vance",
    description: "Local LLM inference clusters, Docker sandbox validation, and CUDA/NVLink kernel optimization.",
    accentColor: "#7047eb",
    bgLight: "bg-purple-50/70",
    borderColor: "border-purple-200",
    textColor: "text-purple-700",
    slaTarget: "< 2s Execution SLA",
  },
  {
    id: "legal",
    name: "Legal & Contracts",
    icon: Scale,
    leadId: "user-001",
    leadName: "Sarah Jenkins",
    description: "ITAR compliance verification, defense contract liability auditing, and export-control clearance.",
    accentColor: "#2563eb",
    bgLight: "bg-blue-50/70",
    borderColor: "border-blue-200",
    textColor: "text-blue-700",
    slaTarget: "100% ITAR Verification",
  },
  {
    id: "finance",
    name: "Finance & Accounting",
    icon: Coins,
    leadId: "user-002",
    leadName: "Michael Sterling",
    description: "Cross-department budget reconciliations, vendor ledger analysis, and cryptographic payroll checks.",
    accentColor: "#059669",
    bgLight: "bg-emerald-50/70",
    borderColor: "border-emerald-200",
    textColor: "text-emerald-700",
    slaTarget: "Zero Egress Audited",
  },
  {
    id: "ops",
    name: "Operations & Supply",
    icon: Truck,
    leadId: "user-004",
    leadName: "Capt. Ray Thornton",
    description: "Physical hardware custody, RapidOCR logistics waybill extraction, and edge token transportation.",
    accentColor: "#d97706",
    bgLight: "bg-amber-50/70",
    borderColor: "border-amber-200",
    textColor: "text-amber-700",
    slaTarget: "Same-Day Manifest",
  },
  {
    id: "hr",
    name: "HR & Compliance",
    icon: ShieldCheck,
    leadId: "user-003",
    leadName: "Clara Oswald",
    description: "Air-gap ethics governance, clearance level credentialing (L1-L4), and personnel security trails.",
    accentColor: "#e11d48",
    bgLight: "bg-rose-50/70",
    borderColor: "border-rose-200",
    textColor: "text-rose-700",
    slaTarget: "L4 Officer Clearance",
  },
  {
    id: "security",
    name: "Security & Directorate",
    icon: Shield,
    leadId: "admin-001",
    leadName: "Security Officer & Admin",
    description: "Topmost administrative sovereign authority, loopback socket enforcement, and network air-gap defense.",
    accentColor: "#475569",
    bgLight: "bg-slate-100/70",
    borderColor: "border-slate-200",
    textColor: "text-slate-800",
    slaTarget: "Zero Packet Egress",
  },
];

const INITIAL_EMPLOYEES: OrgEmployee[] = [
  // Topmost Admin (Security & Directorate)
  {
    id: "admin-001",
    name: "Security Officer & Admin",
    avatar: "SA",
    email: "admin@sovereign.local",
    roleTitle: "Topmost Sovereign Administrator",
    department: "Security & Directorate",
    rank: 4,
    clearance: "L4: Sovereign Officer",
    nodeIp: "10.0.1.10",
    status: "online",
    activeTasksCount: 0,
    specialties: ["Air-Gap Root", "Policy Enforcement", "Org Monitoring", "Crypto Authority"],
  },
  // AI & Engineering
  {
    id: "user-005",
    name: "Dr. Victor Vance",
    avatar: "VV",
    email: "v.vance@sovereign.local",
    roleTitle: "Infrastructure & AI Lead",
    department: "AI & Engineering",
    rank: 3,
    clearance: "L3: Dept Lead",
    nodeIp: "10.0.1.25",
    status: "online",
    activeTasksCount: 2,
    specialties: ["Llama 3.3", "Qwen 2.5", "NVLink Bus", "Docker Isolation"],
  },
  {
    id: "emp-ai-02",
    name: "Elena Rostova",
    avatar: "ER",
    email: "e.rostova@sovereign.local",
    roleTitle: "Senior Neural Model Engineer",
    department: "AI & Engineering",
    rank: 2,
    clearance: "L2: Reviewer",
    nodeIp: "10.0.1.26",
    status: "in-task",
    activeTasksCount: 3,
    specialties: ["Model Quantization", "VRAM Profiling", "Python Sandbox"],
  },
  {
    id: "emp-ai-03",
    name: "Marcus Chen",
    avatar: "MC",
    email: "m.chen@sovereign.local",
    roleTitle: "Docker Sandbox Operator",
    department: "AI & Engineering",
    rank: 1,
    clearance: "L1: Contributor",
    nodeIp: "10.0.1.27",
    status: "idle",
    activeTasksCount: 1,
    specialties: ["Linux Containers", "Network None", "Ephemeral Filesystems"],
  },
  // Legal & Contracts
  {
    id: "user-001",
    name: "Sarah Jenkins",
    avatar: "SJ",
    email: "s.jenkins@sovereign.local",
    roleTitle: "Senior Legal Counsel",
    department: "Legal & Contracts",
    rank: 3,
    clearance: "L3: Dept Lead",
    nodeIp: "10.0.1.32",
    status: "online",
    activeTasksCount: 1,
    specialties: ["ITAR Regulatory", "Defense Procurement", "Sovereign IP"],
  },
  {
    id: "emp-leg-02",
    name: "David Morales",
    avatar: "DM",
    email: "d.morales@sovereign.local",
    roleTitle: "Contract Compliance Specialist",
    department: "Legal & Contracts",
    rank: 2,
    clearance: "L2: Reviewer",
    nodeIp: "10.0.1.33",
    status: "in-task",
    activeTasksCount: 2,
    specialties: ["Clause Extraction", "Risk Scoring", "Vendor Agreements"],
  },
  {
    id: "emp-leg-03",
    name: "Aisha Patel",
    avatar: "AP",
    email: "a.patel@sovereign.local",
    roleTitle: "Legal Records Clerk",
    department: "Legal & Contracts",
    rank: 1,
    clearance: "L1: Contributor",
    nodeIp: "10.0.1.34",
    status: "idle",
    activeTasksCount: 0,
    specialties: ["Document Archiving", "Metadata Tagging", "PDF Ledger Sign-off"],
  },
  // Finance & Accounting
  {
    id: "user-002",
    name: "Michael Sterling",
    avatar: "MS",
    email: "m.sterling@sovereign.local",
    roleTitle: "Lead Financial Analyst",
    department: "Finance & Accounting",
    rank: 3,
    clearance: "L3: Dept Lead",
    nodeIp: "10.0.1.44",
    status: "online",
    activeTasksCount: 2,
    specialties: ["Budget Forecasting", "Cost Allocation", "Tamper-Proof Ledgers"],
  },
  {
    id: "emp-fin-02",
    name: "Rachel Kim",
    avatar: "RK",
    email: "r.kim@sovereign.local",
    roleTitle: "Treasury & Budget Auditor",
    department: "Finance & Accounting",
    rank: 2,
    clearance: "L2: Reviewer",
    nodeIp: "10.0.1.45",
    status: "online",
    activeTasksCount: 1,
    specialties: ["Audit Trail Check", "Anonymized Payroll", "Multi-Currency"],
  },
  {
    id: "emp-fin-03",
    name: "Lucas Zhang",
    avatar: "LZ",
    email: "l.zhang@sovereign.local",
    roleTitle: "Ledger Reconciliation Operator",
    department: "Finance & Accounting",
    rank: 1,
    clearance: "L1: Contributor",
    nodeIp: "10.0.1.46",
    status: "in-task",
    activeTasksCount: 1,
    specialties: ["Receipt Ingestion", "OCR Table Extraction", "Variance Verification"],
  },
  // Operations & Supply
  {
    id: "user-004",
    name: "Capt. Ray Thornton",
    avatar: "RT",
    email: "r.thornton@sovereign.local",
    roleTitle: "Supply Operations Lead",
    department: "Operations & Supply",
    rank: 3,
    clearance: "L3: Dept Lead",
    nodeIp: "10.0.1.58",
    status: "online",
    activeTasksCount: 2,
    specialties: ["Physical Air-Gap Custody", "Hardware Mesh", "Supply Chain Security"],
  },
  {
    id: "emp-ops-02",
    name: "Tanya Brooks",
    avatar: "TB",
    email: "t.brooks@sovereign.local",
    roleTitle: "Air-Gap Hardware Dispatcher",
    department: "Operations & Supply",
    rank: 1,
    clearance: "L1: Contributor",
    nodeIp: "10.0.1.59",
    status: "online",
    activeTasksCount: 2,
    specialties: ["USB Token Verification", "Manifest Scanning", "Edge Device Setup"],
  },
  // HR & Compliance
  {
    id: "user-003",
    name: "Clara Oswald",
    avatar: "CO",
    email: "c.oswald@sovereign.local",
    roleTitle: "Chief Compliance Auditor",
    department: "HR & Compliance",
    rank: 3,
    clearance: "L3: Dept Lead",
    nodeIp: "10.0.1.61",
    status: "online",
    activeTasksCount: 1,
    specialties: ["Clearance Credentialing", "Air-Gap Ethics", "Audit Trail Verification"],
  },
  {
    id: "emp-hr-02",
    name: "Julian Rossi",
    avatar: "JR",
    email: "j.rossi@sovereign.local",
    roleTitle: "Ethics & Policy Officer",
    department: "HR & Compliance",
    rank: 2,
    clearance: "L2: Reviewer",
    nodeIp: "10.0.1.62",
    status: "idle",
    activeTasksCount: 1,
    specialties: ["L1-L4 Policy Checks", "Employee Onboarding", "Confidential Records"],
  },
];

const INITIAL_ORG_TASKS: CoworkingTask[] = [
  {
    id: "TSK-801",
    title: "Vendor Procurement Agreement Export-Control Audit",
    department: "Legal & Contracts",
    assignee: {
      name: "Sarah Jenkins",
      avatar: "SJ",
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
    assignedBy: "Security Officer & Admin (L4)",
  },
  {
    id: "TSK-802",
    title: "Air-Gapped Payroll Variance & Tax Anonymization",
    department: "Finance & Accounting",
    assignee: {
      name: "Michael Sterling",
      avatar: "MS",
      role: "Finance Lead",
    },
    requiredLevel: "L3: Dept Lead",
    status: "In Progress",
    deadline: "15 Sep, 2026",
    deliverable: {
      name: "payroll_audit_ledger_v2.xlsx",
      type: "xlsx",
      size: "3.8 MB",
    },
    notes: "Requires strict air-gap OCR reconciliation against bank ledger slips.",
    assignedBy: "Security Officer & Admin (L4)",
  },
  {
    id: "TSK-803",
    title: "RapidOCR Ingestion of 120 Logistics Waybills",
    department: "Operations & Supply",
    assignee: {
      name: "Tanya Brooks",
      avatar: "TB",
      role: "Operations Operator",
    },
    requiredLevel: "L1: Contributor",
    status: "Completed",
    deadline: "Completed today",
    deliverable: {
      name: "logistics_manifest_extracted.pdf",
      type: "pdf",
      size: "5.2 MB",
    },
    notes: "Processed completely offline via on-prem RapidOCR pipeline.",
    assignedBy: "Capt. Ray Thornton (L3)",
  },
  {
    id: "TSK-804",
    title: "Docker Sandbox Python Leak & Compliance Benchmark",
    department: "AI & Engineering",
    assignee: {
      name: "Elena Rostova",
      avatar: "ER",
      role: "Senior Model Engineer",
    },
    requiredLevel: "L2: Reviewer",
    status: "In Progress",
    deadline: "Today, 6:00 PM",
    deliverable: {
      name: "sandbox_benchmark_report.pdf",
      type: "pdf",
      size: "1.8 MB",
    },
    notes: "Verified zero network egress during 50 isolated loop executions.",
    assignedBy: "Dr. Victor Vance (L3)",
  },
  {
    id: "TSK-805",
    title: "Clearance Level Verification for 4 New Onboarding Technicians",
    department: "HR & Compliance",
    assignee: {
      name: "Julian Rossi",
      avatar: "JR",
      role: "Ethics Officer",
    },
    requiredLevel: "L2: Reviewer",
    status: "Pending L2 Review",
    deadline: "In 2 days",
    deliverable: {
      name: "clearance_credentials_manifest.pdf",
      type: "pdf",
      size: "940 KB",
    },
    notes: "L2 credentialing check before issuing physical cryptographic tokens.",
    assignedBy: "Clara Oswald (L3)",
  },
];

export default function CoworkingView({ onOpenAgentWorkspace }: CoworkingViewProps) {
  // Global states
  const [employees, setEmployees] = useState<OrgEmployee[]>(INITIAL_EMPLOYEES);
  const [departments] = useState<DepartmentInfo[]>(INITIAL_DEPARTMENTS);
  const [tasks, setTasks] = useState<CoworkingTask[]>(INITIAL_ORG_TASKS);

  // Active User / Role Simulation State
  const [activeUserId, setActiveUserId] = useState<string>("admin-001");
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);
  const [treeModalOpen, setTreeModalOpen] = useState(false);

  // Department Selection & Drilldown
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);

  // Department Employee Query & Filter State
  const [empQuery, setEmpQuery] = useState("");
  const [empRankFilter, setEmpRankFilter] = useState<"all" | "L4" | "L3" | "L2" | "L1">("all");
  const [empStatusFilter, setEmpStatusFilter] = useState<"all" | "available" | "in-task">("all");

  // Modals state
  const [workModalOpen, setWorkModalOpen] = useState(false);
  const [selectedTargetEmp, setSelectedTargetEmp] = useState<OrgEmployee | null>(null);
  const [workModalMode, setWorkModalMode] = useState<"assign" | "request" | "consult">("assign");

  // Work Dispatch Form
  const [workTitle, setWorkTitle] = useState("");
  const [workPriority, setWorkPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [workDeadline, setWorkDeadline] = useState("In 3 days");
  const [workDeliverableType, setWorkDeliverableType] = useState<"pdf" | "docx" | "xlsx" | "report">("pdf");
  const [workNotes, setWorkNotes] = useState("");

  // Manual Employee Creation Modal State (For Admin)
  const [createEmpModalOpen, setCreateEmpModalOpen] = useState(false);
  const [newEmpName, setNewEmpName] = useState("");
  const [newEmpRole, setNewEmpRole] = useState("");
  const [newEmpDept, setNewEmpDept] = useState("AI & Engineering");
  const [newEmpRank, setNewEmpRank] = useState<4 | 3 | 2 | 1>(1);
  const [newEmpEmail, setNewEmpEmail] = useState("");
  const [newEmpNode, setNewEmpNode] = useState("10.0.1.75");
  const [newEmpSpecialties, setNewEmpSpecialties] = useState("");

  // Assign Job to Department Modal State (For Admin)
  const [deptJobModalOpen, setDeptJobModalOpen] = useState(false);
  const [targetDeptForJob, setTargetDeptForJob] = useState("AI & Engineering");
  const [deptJobTitle, setDeptJobTitle] = useState("");
  const [deptJobPriority, setDeptJobPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [deptJobDeadline, setDeptJobDeadline] = useState("In 2 days");
  const [deptJobDeliverable, setDeptJobDeliverable] = useState<"pdf" | "docx" | "xlsx" | "report">("pdf");

  // Notifications / Toast
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "warning" | "info" } | null>(null);

  const showToast = (text: string, type: "success" | "warning" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Sync active user
  useEffect(() => {
    const syncUser = () => {
      try {
        const uid = window.localStorage.getItem("sovereign.active-user") || "admin-001";
        setActiveUserId(uid);
      } catch {
        // ignore
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

  const handleSwitchUser = (uid: string) => {
    setActiveUserId(uid);
    try {
      window.localStorage.setItem("sovereign.active-user", uid);
      const matched = employees.find((e) => e.id === uid);
      if (matched) {
        window.localStorage.setItem("sovereign.dev-role", matched.rank === 4 ? "admin" : "staff");
      }
      window.dispatchEvent(new Event("sovereign:active-user-updated"));
    } catch {
      // ignore
    }
    setRoleSwitcherOpen(false);
    showToast(`Switched active profile to ${employees.find((e) => e.id === uid)?.name} (${employees.find((e) => e.id === uid)?.roleTitle})`, "info");
  };

  // Active Current User Details
  const currentUser = useMemo(() => {
    return (
      employees.find((e) => e.id === activeUserId) ||
      employees[0]
    );
  }, [activeUserId, employees]);

  const isAdmin = currentUser.rank === 4;

  // Selected Department Info
  const activeDepartment = useMemo(() => {
    return departments.find((d) => d.name === selectedDeptId || d.id === selectedDeptId) || null;
  }, [selectedDeptId, departments]);

  // Employees of the Selected Department (filtered by query and rank)
  const departmentEmployees = useMemo(() => {
    if (!activeDepartment) return [];
    let list = employees.filter((e) => e.department === activeDepartment.name);

    if (empQuery.trim()) {
      const q = empQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.roleTitle.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q) ||
          e.clearance.toLowerCase().includes(q) ||
          e.specialties.some((s) => s.toLowerCase().includes(q))
      );
    }

    if (empRankFilter !== "all") {
      const rMap = { L4: 4, L3: 3, L2: 2, L1: 1 };
      list = list.filter((e) => e.rank === rMap[empRankFilter]);
    }

    if (empStatusFilter === "available") {
      list = list.filter((e) => e.status === "online" || e.status === "idle");
    } else if (empStatusFilter === "in-task") {
      list = list.filter((e) => e.status === "in-task");
    }

    return list;
  }, [activeDepartment, employees, empQuery, empRankFilter, empStatusFilter]);

  // Handle Opening Work Modal
  const handleOpenWorkModal = (target: OrgEmployee, forceMode?: "assign" | "request" | "consult") => {
    setSelectedTargetEmp(target);

    // Enforce Hierarchy Rules:
    // 1. Admin (rank 4) CANNOT be assigned tasks by subordinates
    // 2. Upper to Lower (currentUser.rank > target.rank) -> Assign Work Order
    // 3. Same Level (currentUser.rank === target.rank) -> Request Collaboration
    // 4. Lower to Upper (currentUser.rank < target.rank) -> Consultative Query only
    if (target.rank === 4 && currentUser.rank < 4) {
      setWorkModalMode("consult");
    } else if (currentUser.rank > target.rank) {
      setWorkModalMode(forceMode === "consult" ? "consult" : "assign");
    } else if (currentUser.rank === target.rank) {
      setWorkModalMode("request");
    } else {
      setWorkModalMode("consult");
    }

    setWorkTitle("");
    setWorkNotes("");
    setWorkModalOpen(true);
  };

  // Submit Work Dispatch
  const handleDispatchWork = () => {
    if (!selectedTargetEmp || !workTitle.trim()) return;

    // Check hierarchy compliance
    if (workModalMode === "assign" && currentUser.rank <= selectedTargetEmp.rank) {
      showToast("Hierarchy Restriction: Work orders can only be assigned to lower-level personnel.", "warning");
      return;
    }

    const newTask: CoworkingTask = {
      id: `TSK-${Math.floor(1000 + Math.random() * 9000)}`,
      title: workTitle,
      department: selectedTargetEmp.department as CoworkingTask["department"],
      assignee: {
        name: selectedTargetEmp.name,
        avatar: selectedTargetEmp.avatar,
        role: selectedTargetEmp.roleTitle,
      },
      requiredLevel: selectedTargetEmp.clearance,
      status: workModalMode === "assign" ? "In Progress" : "Pending L2 Review",
      deadline: workDeadline,
      deliverable: {
        name: `${workTitle.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24)}.${workDeliverableType}`,
        type: workDeliverableType,
        size: "1.2 MB",
      },
      notes: workNotes || `Dispatched via Coworking Hub by ${currentUser.name} (${currentUser.roleTitle}).`,
      assignedBy: `${currentUser.name} (${currentUser.clearance.split(":")[0]})`,
    };

    setTasks((prev) => [newTask, ...prev]);

    // Update target employee active tasks count & status
    setEmployees((prev) =>
      prev.map((e) =>
        e.id === selectedTargetEmp.id
          ? { ...e, activeTasksCount: e.activeTasksCount + 1, status: "in-task" }
          : e
      )
    );

    setWorkModalOpen(false);

    if (workModalMode === "assign") {
      showToast(`Work Order "${workTitle}" assigned to ${selectedTargetEmp.name} (Level ${selectedTargetEmp.rank})!`, "success");
    } else if (workModalMode === "request") {
      showToast(`Peer Collaboration Request sent to ${selectedTargetEmp.name}!`, "success");
    } else {
      showToast(`Consultation query submitted to senior officer ${selectedTargetEmp.name}!`, "info");
    }
  };

  // Manual Employee Creation (Admin task without query)
  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Access Denied: Only Topmost Admin can add employees.", "warning");
      return;
    }
    if (!newEmpName.trim() || !newEmpRole.trim()) return;

    const clearanceMap: Record<number, AuthorizationLevel> = {
      4: "L4: Sovereign Officer",
      3: "L3: Dept Lead",
      2: "L2: Reviewer",
      1: "L1: Contributor",
    };

    const newEmp: OrgEmployee = {
      id: `emp-${Date.now().toString().slice(-4)}`,
      name: newEmpName.trim(),
      avatar: newEmpName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2),
      email: newEmpEmail.trim() || `${newEmpName.toLowerCase().replace(/\s+/g, ".")}@sovereign.local`,
      roleTitle: newEmpRole.trim(),
      department: newEmpDept,
      rank: newEmpRank,
      clearance: clearanceMap[newEmpRank],
      nodeIp: newEmpNode.trim() || `10.0.1.${Math.floor(60 + Math.random() * 30)}`,
      status: "online",
      activeTasksCount: 0,
      specialties: newEmpSpecialties ? newEmpSpecialties.split(",").map((s) => s.trim()) : ["General Operations"],
    };

    setEmployees((prev) => [...prev, newEmp]);
    setCreateEmpModalOpen(false);
    setNewEmpName("");
    setNewEmpRole("");
    setNewEmpSpecialties("");
    showToast(`Employee ${newEmp.name} successfully created in ${newEmp.department}!`, "success");
  };

  // Manual Employee Deletion (Admin task)
  const handleDeleteEmployee = (empId: string) => {
    if (!isAdmin) {
      showToast("Access Denied: Only Topmost Admin can delete employees.", "warning");
      return;
    }
    const target = employees.find((e) => e.id === empId);
    if (!target) return;
    if (target.id === "admin-001") {
      showToast("Cannot delete the root Topmost Administrator account.", "warning");
      return;
    }

    if (confirm(`Are you sure you want to remove ${target.name} (${target.roleTitle}) from the sovereign organization?`)) {
      setEmployees((prev) => prev.filter((e) => e.id !== empId));
      showToast(`Personnel record for ${target.name} removed.`, "info");
    }
  };

  // Assign Job to Entire Department (Admin task)
  const handleAssignDeptJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast("Access Denied: Only Topmost Admin can assign jobs to entire departments.", "warning");
      return;
    }
    if (!deptJobTitle.trim()) return;

    // Route to the department lead or least busy employee in that department
    const deptPersonnel = employees.filter((e) => e.department === targetDeptForJob);
    const lead = deptPersonnel.find((e) => e.rank === 3) || deptPersonnel[0];

    const newDeptTask: CoworkingTask = {
      id: `TSK-${Math.floor(2000 + Math.random() * 7000)}`,
      title: deptJobTitle,
      department: targetDeptForJob as CoworkingTask["department"],
      assignee: {
        name: lead ? lead.name : "Department Lead Queue",
        avatar: lead ? lead.avatar : "DL",
        role: lead ? lead.roleTitle : "Department Dispatch",
      },
      requiredLevel: lead ? lead.clearance : "L3: Dept Lead",
      status: "In Progress",
      deadline: deptJobDeadline,
      deliverable: {
        name: `${deptJobTitle.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 24)}.${deptJobDeliverable}`,
        type: deptJobDeliverable,
        size: "2.4 MB",
      },
      notes: `Directive issued by Topmost Admin to the entire ${targetDeptForJob} department queue.`,
      assignedBy: "Security Officer & Admin (L4)",
    };

    setTasks((prev) => [newDeptTask, ...prev]);
    setDeptJobModalOpen(false);
    setDeptJobTitle("");
    showToast(`Job "${deptJobTitle}" successfully assigned to ${targetDeptForJob}!`, "success");
  };

  return (
    <div className="space-y-8 animate-in fade-in pb-10">
      {/* ─────────────────────────────────────────────────────────────────
          1. HEADER & ACTIVE ACCOUNT HIERARCHY TRAIL SWITCHER
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-100 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700 font-black text-sm shrink-0">
                {currentUser.avatar}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {currentUser.name}
                  </h2>
                  <span
                    className={`px-3 py-0.5 rounded-full text-xs font-bold border ${
                      currentUser.rank === 4
                        ? "bg-purple-100 text-purple-800 border-purple-300"
                        : currentUser.rank === 3
                        ? "bg-blue-100 text-blue-800 border-blue-300"
                        : currentUser.rank === 2
                        ? "bg-amber-100 text-amber-800 border-amber-300"
                        : "bg-slate-100 text-slate-700 border-slate-300"
                    }`}
                  >
                    Level {currentUser.rank}: {currentUser.clearance.split(":")[0]}
                  </span>
                  {isAdmin && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Topmost Admin
                    </span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">
                  {currentUser.roleTitle} &bull; {currentUser.department} &bull; Station: {currentUser.nodeIp}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons: Switch Profile & View Org Hierarchy Tree */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Hierarchy Tree Modal Button */}
            <button
              type="button"
              onClick={() => setTreeModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <GitBranch className="w-4 h-4 text-purple-600" />
              <span>Org Hierarchy Tree</span>
            </button>

            {/* Role Switcher Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-purple-300 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                title="Switch account persona to test hierarchy permissions"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>Switch Account Role</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {roleSwitcherOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-2 z-50 space-y-1 animate-in fade-in">
                  <div className="text-[11px] font-bold text-slate-400 px-3 py-1.5 uppercase tracking-wider">
                    Simulate Hierarchy Identity
                  </div>
                  {[
                    { id: "admin-001", name: "Security Officer & Admin", rank: "Level 4 (Topmost Admin)", dept: "Security Directorate" },
                    { id: "user-001", name: "Sarah Jenkins", rank: "Level 3 (Dept Director)", dept: "Legal & Contracts" },
                    { id: "emp-ai-02", name: "Elena Rostova", rank: "Level 2 (Senior Specialist)", dept: "AI & Engineering" },
                    { id: "emp-ai-03", name: "Marcus Chen", rank: "Level 1 (Operator)", dept: "AI & Engineering" },
                  ].map((acc) => (
                    <button
                      key={acc.id}
                      onClick={() => handleSwitchUser(acc.id)}
                      className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                        activeUserId === acc.id ? "bg-purple-50 text-purple-900 font-bold" : "hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 mt-0.5 shrink-0">
                        {acc.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="text-xs font-semibold">{acc.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {acc.rank} &bull; {acc.dept}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dynamic Authority Scope Banner based on Hierarchy */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Shield className="w-4.5 h-4.5 text-purple-600 shrink-0" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-800">
                {currentUser.rank === 4
                  ? "Topmost Administrative Clearance (Rank 4)"
                  : currentUser.rank === 3
                  ? `Department Leadership Scope: ${currentUser.department} (Rank 3)`
                  : currentUser.rank === 2
                  ? `Senior Specialist Scope: ${currentUser.department} (Rank 2)`
                  : `Associate / Operator Scope: ${currentUser.department} (Rank 1)`}
              </span>
              <p className="text-slate-500">
                {currentUser.rank === 4
                  ? "Full cross-department directive authority. Cannot be assigned tasks by subordinates. Oversees all operations."
                  : currentUser.rank === 3
                  ? "Authorized to assign tasks downwards to L2/L1 personnel, request peer work from other L3 leads. Cannot assign to L4 Admin."
                  : currentUser.rank === 2
                  ? "Authorized to assign tasks downwards to L1 personnel, request peer work from other L2 specialists. Cannot assign to L3 or L4."
                  : "Authorized to request peer collaboration from L1 operators. Cannot command higher-ranking personnel."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold">
              Assigns: {currentUser.rank > 1 ? `L${currentUser.rank - 1} and below` : "None (Operator)"}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 font-semibold">
              Requests: L{currentUser.rank} Peers
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          2. DEDICATED TOPMOST ADMIN MONITORING PANEL (When currentUser is Admin)
      ───────────────────────────────────────────────────────────────── */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-7 text-white space-y-6 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-purple-200">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold tracking-tight">
                    Topmost Administrator Operations Monitor
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold border border-emerald-400/30">
                    AIR-GAP SUPERVISOR ACTIVE
                  </span>
                </div>
                <p className="text-xs text-purple-200">
                  Global overview of cross-departmental tasks, personnel rosters, and air-gap SLA governance.
                </p>
              </div>
            </div>

            {/* Admin Direct Action Buttons */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setCreateEmpModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-purple-900 hover:bg-purple-50 text-xs font-bold transition-all shadow-sm cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Add Employee Manually</span>
              </button>

              <button
                type="button"
                onClick={() => setDeptJobModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-700/80 hover:bg-purple-600 border border-purple-400/40 text-white text-xs font-bold transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Assign Job to Department</span>
              </button>
            </div>
          </div>

          {/* Org Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">
                Total Departments
              </span>
              <span className="text-2xl font-black mt-1 block">6 Active</span>
              <span className="text-[11px] text-purple-300 mt-1 block">100% Isolated Mesh</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">
                Total Personnel
              </span>
              <span className="text-2xl font-black mt-1 block">{employees.length} Members</span>
              <span className="text-[11px] text-purple-300 mt-1 block">L1 through L4 Cleared</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">
                Work Orders In-Flight
              </span>
              <span className="text-2xl font-black mt-1 block">{tasks.length} Orders</span>
              <span className="text-[11px] text-purple-300 mt-1 block">
                {tasks.filter((t) => t.status === "In Progress").length} actively executing
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider block">
                Admin Task Inflow
              </span>
              <span className="text-2xl font-black text-emerald-300 mt-1 block">0 (Protected)</span>
              <span className="text-[11px] text-purple-300 mt-1 block">Admin cannot be assigned tasks</span>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          3. DEPARTMENT SELECTION & WORKSPACE (SIMPLIFIED IN CARDS)
      ───────────────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-600" />
              <span>Cross-Departmental Coworking Hub</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Choose a department card below to drill down, run employee queries, or assign/request work according to hierarchy rules.
            </p>
          </div>

          {selectedDeptId && (
            <button
              type="button"
              onClick={() => setSelectedDeptId(null)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to All Departments</span>
            </button>
          )}
        </div>

        {/* ── MODE A: ALL DEPARTMENTS CARDS SHOWCASE (When none is expanded) ── */}
        {!selectedDeptId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => {
              const deptEmps = employees.filter((e) => e.department === dept.name);
              const deptTasks = tasks.filter((t) => t.department === dept.name);
              const IconComp = dept.icon;

              return (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.name)}
                  className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center ${dept.bgLight} ${dept.textColor} border ${dept.borderColor}`}
                      >
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600">
                        {dept.slaTarget}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-lg font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
                        {dept.name}
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1 font-medium">
                        {dept.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Department Lead:</span>
                        <span className="font-bold text-slate-800">{dept.leadName}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Personnel Count:</span>
                        <span className="font-bold text-slate-800">{deptEmps.length} Employees</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-600 font-medium">
                        <span>Active Tasks:</span>
                        <span className="font-bold text-purple-700">{deptTasks.length} Work Orders</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">Click to inspect roster &amp; work</span>
                    <div className="flex items-center gap-1 text-xs font-bold text-purple-700 group-hover:translate-x-1 transition-transform">
                      <span>Inspect</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── MODE B: SELECTED DEPARTMENT DRILLDOWN WORKSPACE ── */
          activeDepartment && (
            <div className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs space-y-7 animate-in fade-in">
              {/* Department Header */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeDepartment.bgLight} ${activeDepartment.textColor} border ${activeDepartment.borderColor} shrink-0`}
                  >
                    {React.createElement(activeDepartment.icon, { className: "w-6 h-6" })}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-black text-slate-900">
                        {activeDepartment.name}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Lead: {activeDepartment.leadName}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {activeDepartment.description}
                    </p>
                  </div>
                </div>

                {/* Admin-only direct actions on this department */}
                {isAdmin && (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpDept(activeDepartment.name);
                        setCreateEmpModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ Add Employee to {activeDepartment.name}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setTargetDeptForJob(activeDepartment.name);
                        setDeptJobModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Assign Job to Dept Queue</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Natural Language / Query on Employees in this Department */}
              <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Query &amp; Search Personnel in {activeDepartment.name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Showing {departmentEmployees.length} of {employees.filter((e) => e.department === activeDepartment.name).length} employees
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={empQuery}
                      onChange={(e) => setEmpQuery(e.target.value)}
                      placeholder={`Query employees (e.g. 'find L2 clearance', 'Docker', 'Elena', 'specialties')...`}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                    />
                    {empQuery && (
                      <button
                        onClick={() => setEmpQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Level Filter */}
                    <select
                      value={empRankFilter}
                      onChange={(e) => setEmpRankFilter(e.target.value as any)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer outline-none"
                    >
                      <option value="all">All Levels</option>
                      <option value="L4">Level 4 (Directorate)</option>
                      <option value="L3">Level 3 (Lead)</option>
                      <option value="L2">Level 2 (Senior)</option>
                      <option value="L1">Level 1 (Operator)</option>
                    </select>

                    {/* Status Filter */}
                    <select
                      value={empStatusFilter}
                      onChange={(e) => setEmpStatusFilter(e.target.value as any)}
                      className="px-3 py-2 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-700 cursor-pointer outline-none"
                    >
                      <option value="all">All Statuses</option>
                      <option value="available">Available / Idle</option>
                      <option value="in-task">In Task</option>
                    </select>
                  </div>
                </div>

                {/* Quick Query Template Chips */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Quick Queries:
                  </span>
                  {[
                    "Level 2 Reviewers",
                    "Available Personnel",
                    "Sandbox",
                    "Clearance L3",
                    "ITAR",
                  ].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setEmpQuery(chip === "Level 2 Reviewers" ? "L2" : chip === "Clearance L3" ? "L3" : chip)}
                      className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-purple-300 text-slate-600 transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                  {empQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setEmpQuery("");
                        setEmpRankFilter("all");
                        setEmpStatusFilter("all");
                      }}
                      className="text-xs font-bold text-purple-700 hover:underline ml-1 cursor-pointer"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>

              {/* Department Employees Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-bold text-slate-900">
                    Department Personnel ({departmentEmployees.length})
                  </h4>
                  <span className="text-xs text-slate-400 font-medium">
                    Hierarchy rule: Assign downwards &bull; Request peer
                  </span>
                </div>

                {departmentEmployees.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 text-center space-y-2">
                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">No personnel match current query</p>
                    <p className="text-xs text-slate-400">
                      Try adjusting the search query or reset the filters.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {departmentEmployees.map((emp) => {
                      const isSelf = emp.id === currentUser.id;
                      const isTargetAdmin = emp.rank === 4;

                      // Determine action capability:
                      const canAssign = currentUser.rank > emp.rank;
                      const canRequest = currentUser.rank === emp.rank;
                      const isSuperior = currentUser.rank < emp.rank;

                      return (
                        <div
                          key={emp.id}
                          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                            isSelf
                              ? "bg-purple-50/40 border-purple-200 ring-2 ring-purple-100"
                              : "bg-white border-slate-200/90 shadow-2xs hover:shadow-xs hover:border-slate-300"
                          }`}
                        >
                          <div className="space-y-3">
                            {/* Employee Header */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 font-extrabold text-xs flex items-center justify-center border border-slate-200">
                                    {emp.avatar}
                                  </div>
                                  <span
                                    className={`w-2.5 h-2.5 rounded-full border-2 border-white absolute -bottom-0.5 -right-0.5 ${
                                      emp.status === "online"
                                        ? "bg-emerald-500"
                                        : emp.status === "in-task"
                                        ? "bg-amber-500"
                                        : "bg-slate-400"
                                    }`}
                                    title={`Status: ${emp.status}`}
                                  />
                                </div>

                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="text-sm font-bold text-slate-900 leading-tight">
                                      {emp.name}
                                    </h5>
                                    {isSelf && (
                                      <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.2 rounded">
                                        You
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium truncate max-w-[170px]">
                                    {emp.roleTitle}
                                  </p>
                                </div>
                              </div>

                              {/* Authority Badge */}
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                  emp.rank === 4
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : emp.rank === 3
                                    ? "bg-blue-50 text-blue-800 border-blue-200"
                                    : emp.rank === 2
                                    ? "bg-amber-50 text-amber-800 border-amber-200"
                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                }`}
                              >
                                Level {emp.rank}
                              </span>
                            </div>

                            {/* Details & Specs */}
                            <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Station Node:</span>
                                <span className="font-mono text-slate-700 font-semibold">{emp.nodeIp}</span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-400">Active Tasks:</span>
                                <span className="font-bold text-purple-700">{emp.activeTasksCount} In-Flight</span>
                              </div>
                            </div>

                            {/* Specialties tags */}
                            <div className="flex items-center gap-1.5 flex-wrap pt-1">
                              {emp.specialties.slice(0, 3).map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[10px] font-medium bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-100"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Action Row */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            {/* Delete Employee (Admin Only) */}
                            {isAdmin && !isSelf && (
                              <button
                                type="button"
                                onClick={() => handleDeleteEmployee(emp.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete employee from sovereign roster"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}

                            <div className="flex items-center gap-2 ml-auto">
                              {isSelf ? (
                                <span className="text-xs font-semibold text-slate-400 italic">
                                  Current User Session
                                </span>
                              ) : isTargetAdmin && !isAdmin ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkModal(emp, "consult")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                  title="Admin cannot be assigned tasks. Send consultation query."
                                >
                                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Consult Admin</span>
                                </button>
                              ) : canAssign ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkModal(emp, "assign")}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                                  title="Assign directive downwards (Hierarchy Authorized)"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Assign Work</span>
                                </button>
                              ) : canRequest ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkModal(emp, "request")}
                                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition-colors cursor-pointer"
                                  title="Request collaboration from equal peer"
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  <span>Request Work</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWorkModal(emp, "consult")}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                  title="Senior rank. Submit consultative inquiry."
                                >
                                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Consult Inquiry</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          4. ALL ACTIVE COWORKING TASKS & DISPATCH STREAM
      ───────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-7 border border-slate-100/90 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h4 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              <span>Cross-Department Live Work Orders</span>
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Tasks assigned between upper and lower hierarchy, peer collaborations, and deliverables in progress.
            </p>
          </div>

          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-3 py-1 rounded-full border border-purple-200 self-start sm:self-auto">
            {tasks.length} Active Directives
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10.5px]">
                <th className="pb-3 pr-4">Order ID</th>
                <th className="pb-3 pr-4">Work Description</th>
                <th className="pb-3 pr-4">Department</th>
                <th className="pb-3 pr-4">Assignee</th>
                <th className="pb-3 pr-4">Assigned By</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 text-right">Deadline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 pr-4 font-mono font-bold text-purple-700">
                    {task.id}
                  </td>
                  <td className="py-3.5 pr-4 font-bold text-slate-900 max-w-xs truncate">
                    {task.title}
                  </td>
                  <td className="py-3.5 pr-4 text-slate-600 font-medium">
                    {task.department}
                  </td>
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                        {task.assignee.avatar}
                      </div>
                      <span className="font-semibold text-slate-800">{task.assignee.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 pr-4 text-slate-500 font-medium">
                    {task.assignedBy || "Directorate"}
                  </td>
                  <td className="py-3.5 pr-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${
                        task.status === "Completed"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : task.status === "In Progress"
                          ? "bg-purple-50 text-purple-700 border border-purple-200"
                          : "bg-amber-50 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-right font-medium text-slate-500">
                    {task.deadline}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────
          MODAL 1: WORK DISPATCH & COLLABORATION MODAL (Strict Hierarchy)
      ───────────────────────────────────────────────────────────────── */}
      {workModalOpen && selectedTargetEmp && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-lg w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">
                    {workModalMode === "assign"
                      ? "Assign Work Order (Directive)"
                      : workModalMode === "request"
                      ? "Request Peer Collaboration"
                      : "Submit Consultative Query"}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Target: <strong className="text-slate-800">{selectedTargetEmp.name}</strong> ({selectedTargetEmp.roleTitle} &bull; Level {selectedTargetEmp.rank})
                </p>
              </div>

              <button
                type="button"
                onClick={() => setWorkModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Hierarchy Relationship Notice */}
            <div
              className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                workModalMode === "assign"
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                  : workModalMode === "request"
                  ? "bg-blue-50/80 border-blue-200 text-blue-800"
                  : "bg-amber-50/80 border-amber-200 text-amber-800"
              }`}
            >
              {workModalMode === "assign" && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Hierarchy Rule Verified:</strong> As an L{currentUser.rank} officer, you have direct command authority over L{selectedTargetEmp.rank} personnel. Directives are recorded in the air-gap audit ledger.
                  </div>
                </div>
              )}
              {workModalMode === "request" && (
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Peer Collaboration:</strong> Both accounts share Level {currentUser.rank} authority. Submitting as a cross-departmental peer cooperation request.
                  </div>
                </div>
              )}
              {workModalMode === "consult" && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Hierarchy Policy:</strong> Subordinate personnel (Level {currentUser.rank}) cannot issue mandatory work orders to senior officers (Level {selectedTargetEmp.rank}). This will be routed as an advisory consultation.
                  </div>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Work Title / Directive Summary
                </label>
                <input
                  type="text"
                  value={workTitle}
                  onChange={(e) => setWorkTitle(e.target.value)}
                  placeholder="e.g. Audit export compliance clauses across vendor schematics"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Priority Level
                  </label>
                  <select
                    value={workPriority}
                    onChange={(e) => setWorkPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="P0">P0 - Critical / Immediate</option>
                    <option value="P1">P1 - High Priority</option>
                    <option value="P2">P2 - Standard Queue</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Target Deliverable
                  </label>
                  <select
                    value={workDeliverableType}
                    onChange={(e) => setWorkDeliverableType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="pdf">Signed PDF Document</option>
                    <option value="docx">Word Specification (DOCX)</option>
                    <option value="xlsx">Spreadsheet Audit Ledger (XLSX)</option>
                    <option value="report">Compliance Brief</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Deadline / SLA Target
                </label>
                <select
                  value={workDeadline}
                  onChange={(e) => setWorkDeadline(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                >
                  <option value="Today, 5:00 PM">Today, 5:00 PM</option>
                  <option value="Tomorrow, 12:00 PM">Tomorrow, 12:00 PM</option>
                  <option value="In 3 days">In 3 days</option>
                  <option value="Next Week">Next Week (Standard SLA)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Detailed Instructions / Context
                </label>
                <textarea
                  rows={3}
                  value={workNotes}
                  onChange={(e) => setWorkNotes(e.target.value)}
                  placeholder="Specify key constraints, required clearance levels, or references..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none resize-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setWorkModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDispatchWork}
                disabled={!workTitle.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {workModalMode === "assign"
                    ? "Dispatch Work Order"
                    : workModalMode === "request"
                    ? "Send Request"
                    : "Submit Consultation"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL 2: MANUAL EMPLOYEE CREATION MODAL (Admin Only)
      ───────────────────────────────────────────────────────────────── */}
      {createEmpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600" />
                  <span>Manual Employee Creation</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Topmost Admin authority: Register new personnel into air-gap roster without query.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCreateEmpModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  placeholder="e.g. Commander Jason Hayes"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Role Title
                </label>
                <input
                  type="text"
                  required
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value)}
                  placeholder="e.g. Lead Cryptographic Systems Engineer"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Department
                  </label>
                  <select
                    value={newEmpDept}
                    onChange={(e) => setNewEmpDept(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Clearance Hierarchy
                  </label>
                  <select
                    value={newEmpRank}
                    onChange={(e) => setNewEmpRank(Number(e.target.value) as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value={1}>Level 1: Contributor (Operator)</option>
                    <option value={2}>Level 2: Reviewer (Senior)</option>
                    <option value={3}>Level 3: Dept Lead (Director)</option>
                    <option value={4}>Level 4: Sovereign Officer</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Workstation IP Node
                  </label>
                  <input
                    type="text"
                    value={newEmpNode}
                    onChange={(e) => setNewEmpNode(e.target.value)}
                    placeholder="10.0.1.75"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={newEmpEmail}
                    onChange={(e) => setNewEmpEmail(e.target.value)}
                    placeholder="j.hayes@sovereign.local"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Specialties (Comma Separated)
                </label>
                <input
                  type="text"
                  value={newEmpSpecialties}
                  onChange={(e) => setNewEmpSpecialties(e.target.value)}
                  placeholder="Python, ITAR, Hardware, Cryptography"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateEmpModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Create Employee</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL 3: ASSIGN JOB TO ENTIRE DEPARTMENT (Admin Only)
      ───────────────────────────────────────────────────────────────── */}
      {deptJobModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-5 h-5 text-purple-600" />
                  <span>Assign Job to Department Queue</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Topmost Admin Directive: Dispatch work order to an entire department.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDeptJobModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignDeptJob} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Target Department
                </label>
                <select
                  value={targetDeptForJob}
                  onChange={(e) => setTargetDeptForJob(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name} (Lead: {d.leadName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Job Directive Title
                </label>
                <input
                  type="text"
                  required
                  value={deptJobTitle}
                  onChange={(e) => setDeptJobTitle(e.target.value)}
                  placeholder="e.g. Q4 Defense Perimeter Security Audit & Stress Test"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:border-purple-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Priority
                  </label>
                  <select
                    value={deptJobPriority}
                    onChange={(e) => setDeptJobPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="P0">P0 - Critical</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Standard</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Deliverable Format
                  </label>
                  <select
                    value={deptJobDeliverable}
                    onChange={(e) => setDeptJobDeliverable(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="pdf">Signed PDF</option>
                    <option value="docx">Word Report (DOCX)</option>
                    <option value="xlsx">Ledger Sheet (XLSX)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeptJobModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Assign to Department</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL 4: INTERACTIVE VISUAL HIERARCHY TREE MODAL
      ───────────────────────────────────────────────────────────────── */}
      {treeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl p-7 max-w-2xl w-full shadow-2xl border border-slate-100 space-y-6 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-600" />
                  <span>Sovereign Organization Hierarchy Trail</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Visual reporting chain &amp; authority matrix across all 4 clearance tiers.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setTreeModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tree Flow Visual Representation */}
            <div className="space-y-4">
              {/* Level 4: Topmost Admin */}
              <div className="p-4 rounded-2xl bg-purple-50/80 border-2 border-purple-300 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-purple-700 text-white text-xs font-black">
                    LEVEL 4: SOVEREIGN DIRECTORATE (TOPMOST ADMIN)
                  </span>
                  <span className="text-xs font-bold text-purple-700">Root Authority</span>
                </div>
                <div className="text-sm font-bold text-slate-900">
                  Security Officer &amp; Admin (admin-001)
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Monitors all department operations. Can create/delete employees, assign jobs to any department or individual. <strong>Cannot be assigned tasks by subordinates.</strong>
                </p>
              </div>

              <div className="flex justify-center text-purple-400">
                <ArrowDown className="w-5 h-5" />
              </div>

              {/* Level 3: Department Directors / Leads */}
              <div className="p-4 rounded-2xl bg-blue-50/80 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-blue-700 text-white text-xs font-black">
                    LEVEL 3: DEPARTMENT DIRECTORS / LEADS
                  </span>
                  <span className="text-xs font-bold text-blue-700">Department Heads</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-slate-800 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-blue-100">
                    Dr. Victor Vance (AI &amp; Eng)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-blue-100">
                    Sarah Jenkins (Legal)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-blue-100">
                    Michael Sterling (Finance)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-blue-100">
                    Capt. Ray Thornton (Supply)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-blue-100">
                    Clara Oswald (HR)
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Can assign directives to L2 and L1 personnel below them. Can request peer collaboration from other Level 3 leads. Cannot command Level 4 Admin.
                </p>
              </div>

              <div className="flex justify-center text-blue-400">
                <ArrowDown className="w-5 h-5" />
              </div>

              {/* Level 2: Senior Specialists / Reviewers */}
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-700 text-white text-xs font-black">
                    LEVEL 2: SENIOR SPECIALISTS / REVIEWERS
                  </span>
                  <span className="text-xs font-bold text-amber-700">Audit &amp; Code Review</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-slate-800 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-amber-100">
                    Elena Rostova (AI)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-amber-100">
                    David Morales (Legal)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-amber-100">
                    Rachel Kim (Finance)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-amber-100">
                    Julian Rossi (HR)
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Can assign tasks downwards to Level 1 Operators. Can request peer collaboration with other Level 2 specialists. Cannot command L3 or L4 superiors.
                </p>
              </div>

              <div className="flex justify-center text-amber-400">
                <ArrowDown className="w-5 h-5" />
              </div>

              {/* Level 1: Associates / Operators */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-md bg-slate-700 text-white text-xs font-black">
                    LEVEL 1: ASSOCIATES / OPERATORS
                  </span>
                  <span className="text-xs font-bold text-slate-600">Task Execution</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-semibold text-slate-800 pt-1">
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    Marcus Chen (Docker)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    Aisha Patel (Records)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    Lucas Zhang (Ledger)
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200">
                    Tanya Brooks (Hardware)
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed pt-1">
                  Executes assigned work orders. Can request peer collaboration with Level 1 operators. Cannot assign tasks upwards.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setTreeModalOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Close Hierarchy View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold animate-in slide-in-from-bottom-5 ${
            toastMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200"
              : toastMessage.type === "warning"
              ? "bg-amber-50 text-amber-900 border-amber-200"
              : "bg-purple-50 text-purple-900 border-purple-200"
          }`}
        >
          {toastMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : toastMessage.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-purple-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
