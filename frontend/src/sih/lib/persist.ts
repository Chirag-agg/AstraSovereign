import type { AuditEntry, Turn } from "./types";

const TURNS_KEY = "wb-turns";
const AUDIT_KEY = "wb-audit";

function hydrateTurn(turn: Turn): Turn {
  const hasApprovalStep = turn.scenario.steps.some((s) => s.kind === "approval");
  return {
    ...turn,
    revealCount: turn.scenario.steps.length,
    approval: turn.approval === "none" && hasApprovalStep ? "pending" : turn.approval,
  };
}

export function loadTurns(): Turn[] {
  try {
    const raw = localStorage.getItem(TURNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Turn[];
    return parsed.map(hydrateTurn);
  } catch {
    return [];
  }
}

export function saveTurns(turns: Turn[]) {
  try {
    localStorage.setItem(TURNS_KEY, JSON.stringify(turns));
  } catch {
    /* storage unavailable, ignore */
  }
}

export function loadAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveAuditLog(entries: AuditEntry[]) {
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable, ignore */
  }
}

export function clearHistory() {
  try {
    localStorage.removeItem(TURNS_KEY);
    localStorage.removeItem(AUDIT_KEY);
  } catch {
    /* storage unavailable, ignore */
  }
}
