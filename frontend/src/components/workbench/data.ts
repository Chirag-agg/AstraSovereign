import type {
  AgentActivityEvent,
  AuditRecord,
  ComputeMetrics,
  ModelRouteEntry,
  WorkbenchJob,
} from "./types";

export const INITIAL_COMPUTE: ComputeMetrics = {
  gpu0: {
    name: "-",
    vramUsed: 0,
    vramTotal: 0,
    load: 0,
    temp: 0,
    power: 0,
  },
  gpu1: {
    name: "-",
    vramUsed: 0,
    vramTotal: 0,
    load: 0,
    temp: 0,
    power: 0,
  },
  cpu: {
    model: "-",
    cores: 0,
    load: 0,
    temp: 0,
  },
  ram: {
    used: 0,
    total: 0,
  },
  socket: "-",
  networkEgress: "-",
};

export const INITIAL_JOBS: WorkbenchJob[] = [];
export const MODEL_ROUTES: ModelRouteEntry[] = [];
export const RECENT_AGENT_ACTIVITY: AgentActivityEvent[] = [];
export const RECENT_AUDIT_LOGS: AuditRecord[] = [];
export const REGISTERED_TOOLS: any[] = [];
export const KB_DOCUMENTS: any[] = [];
export const DELIVERABLE_OUTPUTS: any[] = [];
