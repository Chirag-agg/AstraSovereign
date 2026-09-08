export type WorkbenchSection =
  | "home"
  | "coworking"
  | "dashboard"
  | "jobs"
  | "agent"
  | "models"
  | "tools"
  | "workflows"
  | "knowledge"
  | "documents"
  | "files"
  | "outputs"
  | "compute"
  | "monitoring"
  | "audit"
  | "sandbox"
  | "team"
  | "settings";

export type AuthorizationLevel =
  | "L1: Contributor"
  | "L2: Reviewer"
  | "L3: Dept Lead"
  | "L4: Sovereign Officer";

export interface CoworkingTask {
  id: string;
  title: string;
  department: "Legal & Contracts" | "Finance & Accounting" | "Operations & Supply" | "HR & Compliance" | "AI & Engineering";
  assignee: {
    name: string;
    avatar: string;
    role: string;
  };
  requiredLevel: AuthorizationLevel;
  status: "In Progress" | "Pending L2 Review" | "Pending L3 Approval" | "L4 Signed Off" | "Completed";
  deadline: string;
  deliverable?: {
    name: string;
    type: "docx" | "xlsx" | "pdf" | "report";
    size: string;
  };
  notes?: string;
}

export interface Coworker {
  id: string;
  name: string;
  department: string;
  avatar: string;
  status: "online" | "in-review" | "busy" | "offline";
  lastMessage: string;
  time: string;
  unreadCount?: number;
  phone?: string;
}

export interface CoworkingActivity {
  id: string;
  actor: string;
  avatar: string;
  action: string;
  target: string;
  time: string;
  levelBadge?: string;
}

export interface NavItem {
  id: WorkbenchSection;
  label: string;
  badge?: string | number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface WorkbenchJob {
  id: string;
  task: string;
  model: string;
  status: "running" | "completed" | "queued" | "failed" | "cancelled";
  started: string;
  duration: string;
  user: string;
  deliverable?: {
    name: string;
    type: "docx" | "xlsx" | "pptx" | "code" | "pdf";
    size: string;
  };
}

export interface ComputeMetrics {
  gpu0: {
    name: string;
    vramUsed: number;
    vramTotal: number;
    load: number;
    temp: number;
    power: number;
  };
  gpu1: {
    name: string;
    vramUsed: number;
    vramTotal: number;
    load: number;
    temp: number;
    power: number;
  };
  cpu: {
    model: string;
    cores: number;
    load: number;
    temp: number;
  };
  ram: {
    used: number;
    total: number;
  };
  socket: string;
  networkEgress: string;
}

export interface ModelRouteEntry {
  taskType: string;
  model: string;
  family: string;
  status: "ready" | "loading" | "offline";
  latencyMs: number;
  quant: string;
  contextWindow: string;
  vram: string;
}

export interface AgentActivityEvent {
  id: string;
  time: string;
  subsystem: string;
  message: string;
  status: "ok" | "running" | "err";
}

export interface AuditRecord {
  id: string;
  time: string;
  actor: string;
  subsystem: string;
  action: string;
  hash: string;
}
