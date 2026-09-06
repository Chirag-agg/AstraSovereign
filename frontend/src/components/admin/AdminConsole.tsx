"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  getAdminAudit,
  getAdminJob,
  getAdminJobs,
  getAdminKnowledge,
  getAdminModels,
  getAdminOverview,
  getAdminResources,
  getAdminSovereignty,
  getAdminSystem,
  getAdminUsers,
} from "@/lib/api";
import AnimatedNumber from "@/components/core/animated-number";
import ThemeToggle from "@/components/core/theme-toggle";
import { useDevRole, usePolling } from "@/lib/hooks";
import type {
  AdminJobDetail,
  AdminJobMeta,
  DevRole,
  JobStatus,
} from "@/lib/types";

const SECTIONS = [
  "overview",
  "workloads",
  "users",
  "models",
  "resources",
  "knowledge",
  "audit",
  "sovereignty",
  "system",
] as const;

type Section = (typeof SECTIONS)[number];

const SECTION_TITLES: Record<Section, { title: string; sub: string }> = {
  overview: { title: "Platform overview", sub: "Is the AI platform healthy right now?" },
  workloads: { title: "Workloads", sub: "All organizational jobs and queue state." },
  users: { title: "Users", sub: "Operational metadata per development user." },
  models: { title: "Models", sub: "Registry: providers, availability, resources." },
  resources: { title: "Resources", sub: "Capacity and live allocation." },
  knowledge: { title: "Knowledge base", sub: "Ingestion and embedding health." },
  audit: { title: "Audit", sub: "Non-sensitive platform audit trail." },
  sovereignty: { title: "Sovereignty", sub: "Verified local-only operation." },
  system: { title: "System health", sub: "Component states (dev view)." },
};

function StateBadge({ state }: { state: string }) {
  let cls = "t-mut";
  if (state === "HEALTHY") cls = "t-ok";
  if (state === "DEGRADED") cls = "t-warn";
  if (state === "UNAVAILABLE") cls = "t-fail";
  if (state === "DISABLED") cls = "t-mut";
  return (
    <span className={`status ${cls}`}>
      <span className="dot" aria-hidden="true" />
      {state}
    </span>
  );
}

function jobStatusClass(status: string): string {
  if (status === "completed") return "t-ok";
  if (status === "running" || status === "queued") return "t-run";
  if (status === "failed") return "t-fail";
  return "t-warn";
}

function shortDuration(ms?: number | null): string {
  if (ms == null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function shortTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function useAdmin<T>(fetcher: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  return usePolling<T>(fetcher, { intervalMs, retryOnError: true }, deps);
}

function OverviewView() {
  const { data } = useAdmin(getAdminOverview, 3000);
  const jobs = data?.jobs ?? {};
  const sovereign = data?.sovereignty;
  const spring = { duration: 1200, bounce: 0 };
  return (
    <>
      <div className="stat-row">
        <Stat k="Active jobs" v={<AnimatedNumber value={jobs.running ?? 0} springOptions={spring} />} />
        <Stat k="Queued jobs" v={<AnimatedNumber value={jobs.queued ?? 0} springOptions={spring} />} />
        <Stat k="Completed" v={<AnimatedNumber value={jobs.completed ?? 0} springOptions={spring} />} />
        <Stat k="Failed" v={<AnimatedNumber value={jobs.failed ?? 0} springOptions={spring} />} />
        <Stat k="Models available" v={<AnimatedNumber value={data?.models_available ?? 0} springOptions={spring} />} />
        <Stat k="Failed today" v={<AnimatedNumber value={data?.failed_today ?? 0} springOptions={spring} />} />
        <Stat k="Audit events" v={<AnimatedNumber value={data?.audit_events ?? 0} springOptions={spring} />} />
      </div>

      <Panel title="Workload">
        <RecentJobsView />
      </Panel>

      <Panel title="System health">
        <div className="tbl-wrap">
          <table className="tbl">
            <tbody>
              <Row k="Ollama" v={<StateBadge state={data?.ollama_reachable ? "HEALTHY" : "UNAVAILABLE"} />} />
              <Row k="Worker" v={data?.worker?.state ?? "unknown"} />
              <Row k="Network policy" v={sovereign?.network_policy ?? "unknown"} />
              <Row
                k="External network"
                v={`${sovereign?.external_connections?.status ?? "UNKNOWN"} · ${sovereign?.external_connections?.count ?? 0} external`}
              />
              <Row k="Sandbox network" v={sovereign?.sandbox_network ?? "DISABLED"} />
              <Row k="Audit logging" v={sovereign?.audit_logging ? "ENABLED" : "DISABLED"} />
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Stat({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel-block">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr>
      <td style={{ color: "var(--text-3)", width: "200px" }}>{k}</td>
      <td>{v}</td>
    </tr>
  );
}

function RecentJobsView() {
  const { data } = useAdmin(() => getAdminJobs(undefined, 8), 3000);
  return <JobTable jobs={data ?? []} onSelect={() => undefined} />;
}

function JobTable({
  jobs,
  onSelect,
}: {
  jobs: AdminJobMeta[];
  onSelect: (jobId: string) => void;
}) {
  return (
    <table className="tbl">
      <thead>
        <tr>
          <th>Job</th>
          <th>User</th>
          <th>Task</th>
          <th>Status</th>
          <th>Model</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        {jobs.length === 0 ? (
          <tr>
            <td colSpan={6} style={{ color: "var(--text-3)" }}>
              No jobs.
            </td>
          </tr>
        ) : (
          jobs.map((job) => (
            <tr key={job.job_id}>
              <td>
                {onSelect ? (
                  <button type="button" className="sb-item" onClick={() => onSelect(job.job_id)}>
                    {job.job_id.slice(0, 10)}
                  </button>
                ) : (
                  job.job_id.slice(0, 10)
                )}
              </td>
              <td>{job.user_id}</td>
              <td>{job.task_type}</td>
              <td>
                <span className={`status ${jobStatusClass(job.status)}`}>
                  <span className="dot" aria-hidden="true" />
                  {job.status}
                </span>
              </td>
              <td>{job.model ?? "—"}</td>
              <td>{shortDuration(job.duration_ms)}</td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function WorkloadsView() {
  const [status, setStatus] = useState<JobStatus | "">("");
  const [selected, setSelected] = useState<AdminJobDetail | null>(null);
  const { data, error } = useAdmin(
    () => getAdminJobs(status === "" ? undefined : (status as JobStatus), 200),
    status === "" ? 1000 : 3000,
    [status],
  );

  return (
    <>
      <Panel title="All jobs">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          Status
          <select
            className="user-select"
            style={{ width: "auto" }}
            value={status}
            onChange={(e) => setStatus(e.target.value as JobStatus | "")}
          >
            <option value="">all</option>
            <option value="queued">queued</option>
            <option value="running">running</option>
            <option value="completed">completed</option>
            <option value="failed">failed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </label>
        {error ? (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        ) : null}
        <JobTable jobs={data ?? []} onSelect={(id) => void getAdminJob(id).then(setSelected).catch(() => undefined)} />
      </Panel>
      {selected ? <JobDetail job={selected} onClose={() => setSelected(null)} /> : null}
    </>
  );
}

function JobDetail({ job, onClose }: { job: AdminJobDetail; onClose: () => void }) {
  return (
    <Panel title={`Job ${job.job_id} · ${job.user_id}`}>
      <button type="button" className="btn btn-ghost" onClick={onClose}>
        ← Close
      </button>
      <table className="tbl">
        <tbody>
          <Row k="Task type" v={job.task_type} />
          <Row k="Status" v={job.status} />
          <Row k="Model" v={job.model ?? "—"} />
          <Row k="Duration" v={shortDuration(job.duration_ms)} />
          <Row k="Resource status" v={job.resource_status ?? "—"} />
          <Row k="Agent stage" v={job.agent_stage ?? "—"} />
          <Row k="Iterations / tools" v={`${job.iteration_count ?? 0} / ${job.tool_call_count ?? 0}`} />
          <Row
            k="Error"
            v={job.error ? <span className="status t-fail">{job.error}</span> : "none"}
          />
        </tbody>
      </table>
      <h3 style={{ margin: "12px 0 4px", fontSize: 13, color: "var(--text-3)" }}>Execution trace</h3>
      <div className="console" style={{ maxWidth: 640 }}>
        <div className="console-body" style={{ maxHeight: 260 }}>
          {job.execution_trace.map((entry, i) => (
            <div key={i} className="cline">
              <span className="cmd">{entry.type}</span>
              {entry.tool ? <span> · {entry.tool}</span> : null}
              {entry.result_summary ? <span className="meta"> → {entry.result_summary}</span> : null}
            </div>
          ))}
        </div>
      </div>
      {job.artifacts.length ? (
        <>
          <h3 style={{ margin: "12px 0 4px", fontSize: 13, color: "var(--text-3)" }}>Artifacts</h3>
          <ul className="notice-list">
            {job.artifacts.map((a) => (
              <li key={a.artifact_id}>
                {a.filename} · {a.type} · {a.size_bytes} B
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Panel>
  );
}

function UsersView() {
  const { data, error } = useAdmin(getAdminUsers, 5000);
  return (
    <Panel title="Users">
      {error ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <table className="tbl">
        <thead>
          <tr>
            <th>User</th>
            <th>Jobs</th>
            <th>Active</th>
            <th>Failed</th>
            <th>Documents</th>
            <th>Artifacts</th>
            <th>Recent activity</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((u) => (
            <tr key={u.user_id}>
              <td>{u.user_id}</td>
              <td>{u.jobs}</td>
              <td>{u.active_jobs}</td>
              <td>{u.failed_jobs}</td>
              <td>{u.documents}</td>
              <td>{u.artifacts}</td>
              <td>{shortTime(u.recent_activity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function ModelsView() {
  const { data, error } = useAdmin(getAdminModels, 5000);
  return (
    <Panel title="Model registry">
      {error ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <table className="tbl">
        <thead>
          <tr>
            <th>Task</th>
            <th>Model</th>
            <th>Provider</th>
            <th>State</th>
            <th>Capabilities</th>
            <th>Resources</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((m) => {
            const r = m.resources as { gpu_vram_mb?: number; cpu_cores?: number; memory_mb?: number };
            return (
              <tr key={m.task_type}>
                <td>{m.task_type}</td>
                <td>{m.model}</td>
                <td>{m.provider}</td>
                <td>
                  <span className={`status ${m.enabled ? (m.available ? "t-ok" : "t-warn") : "t-mut"}`}>
                    <span className="dot" aria-hidden="true" />
                    {m.enabled ? (m.available ? "available" : "not pulled") : "disabled"}
                  </span>
                </td>
                <td>{m.capabilities.join(", ")}</td>
                <td>
                  {r.gpu_vram_mb ? `${(r.gpu_vram_mb / 1024).toFixed(0)} GB VRAM · ` : ""}
                  {r.cpu_cores ? `${r.cpu_cores} cores · ` : ""}
                  {r.memory_mb ? `${(r.memory_mb / 1024).toFixed(0)} GB` : ""}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function ResourcesView() {
  const { data, error } = useAdmin(getAdminResources, 3000);
  const gpus = data?.capacity.gpus ?? [];
  const gpuAlloc = data?.allocated_gpu ?? {};
  return (
    <>
      <div className="stat-row">
        <Stat k="Running jobs" v={String(data?.running_jobs ?? 0)} />
        <Stat k="Waiting jobs" v={String(data?.waiting_jobs ?? 0)} />
        <Stat k="CPU" v={`${data?.capacity.cpu_cores ?? 0} cores`} />
        <Stat k="Memory" v={`${data?.capacity.memory_mb ?? 0} MB`} />
      </div>
      <Panel title="GPU capacity">
        {error ? (
          <div className="banner banner-error" role="alert">
            {error}
          </div>
        ) : null}
        {gpus.length === 0 ? (
          <p className="loading-row">No GPU in capacity.</p>
        ) : (
          gpus.map((gpu) => {
            const alloc = gpuAlloc[gpu.gpu_id] ?? { allocated_vram_mb: 0, capacity_vram_mb: gpu.vram_mb };
            return (
              <div key={gpu.gpu_id} className="kv">
                <span className="k">GPU {gpu.gpu_id}</span>
                <span className="v">
                  {alloc.allocated_vram_mb} / {alloc.capacity_vram_mb} MB allocated
                </span>
              </div>
            );
          })
        )}
      </Panel>
      <Panel title="Allocated">
        <ul className="notice-list">
          {(data?.allocated ?? []).map((a) => (
            <li key={a.job_id}>
              {a.job_id} · {a.gpu_id ?? "cpu"} · {a.gpu_vram_mb || a.cpu_cores} unit(s)
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}

function KnowledgeView() {
  const { data } = useAdmin(getAdminKnowledge, 5000);
  return (
    <>
      <div className="stat-row">
        <Stat k="Documents" v={String(data?.documents ?? 0)} />
        <Stat k="Chunks" v={String(data?.chunks ?? 0)} />
        <Stat k="Embedding" v={String((data?.embedding?.model as string) ?? "—")} />
      </div>
      <Panel title="Documents per development user">
        <table className="tbl">
          <tbody>
            {Object.entries(data?.per_user ?? {}).map(([user, count]) => (
              <Row key={user} k={user} v={String(count)} />
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function AuditView() {
  const [userId, setUserId] = useState("");
  const [eventType, setEventType] = useState("");
  const { data, error } = useAdmin(
    () =>
      getAdminAudit({
        userId: userId || undefined,
        eventType: eventType || undefined,
      }),
    8000,
    [userId, eventType],
  );
  return (
    <Panel title="Audit trail (metadata only)">
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <label>
          User{" "}
          <select className="user-select" style={{ width: "auto" }} value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">all</option>
            {["user-001", "user-002", "user-003", "user-004", "user-005"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </label>
        <input
          aria-label="Event filter"
          className="user-select"
          placeholder="Event (e.g. JOB_COMPLETED)"
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
        />
      </div>
      {error ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <table className="tbl">
        <thead>
          <tr>
            <th>Time</th>
            <th>Event</th>
            <th>User</th>
            <th>Job</th>
            <th>Component</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {(data ?? []).map((e) => (
            <tr key={e.event_id}>
              <td>{shortTime(e.timestamp)}</td>
              <td>{e.event_type}</td>
              <td>{e.user_id ?? "—"}</td>
              <td>{e.job_id ? e.job_id.slice(0, 10) : "—"}</td>
              <td>{e.component}</td>
              <td>{e.status}</td>
            </tr>
          ))}
          {(data ?? []).length === 0 ? (
            <tr>
              <td colSpan={6} style={{ color: "var(--text-3)" }}>
                No audit events.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Panel>
  );
}

function SovereigntyView() {
  const { data, error } = useAdmin(getAdminSovereignty, 5000);
  const ext = data?.external_connections;
  return (
    <Panel title="Verified local operation">
      {error ? (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      ) : null}
      <table className="tbl">
        <tbody>
          <Row k="Network policy" v={data?.network_policy ?? "unknown"} />
          <Row
            k="External traffic"
            v={`${ext?.status ?? "UNKNOWN"} · ${ext?.count ?? 0} external · ${ext?.blocked_attempts ?? 0} blocked`}
          />
          <Row k="Local model calls" v={String(data?.local_model_calls ?? 0)} />
          <Row k="Ollama endpoint" v={data?.ollama_endpoint ?? "unknown"} />
          <Row k="Audit logging" v={data?.audit_logging ? "ENABLED" : "DISABLED"} />
          <Row k="Audit events" v={String(data?.audit_events ?? 0)} />
          <Row k="Sandbox network" v={data?.sandbox_network ?? "DISABLED"} />
        </tbody>
      </table>
    </Panel>
  );
}

function SystemView() {
  const { data, error } = useAdmin(getAdminSystem, 3000);
  if (error) {
    return (
      <div className="banner banner-error" role="alert">
        {error}
      </div>
    );
  }
  if (!data) {
    return <div className="loading-row">Loading system health…</div>;
  }
  const entries = [
    ["Ollama", data.ollama],
    ["Models", data.models],
    ["Worker", data.worker],
    ["Queue", data.queue],
    ["Scheduler", data.scheduler],
    ["Knowledge base", data.knowledge_base],
    ["OCR", data.ocr],
    ["Vision", data.vision],
    ["Document generation", data.document_generation],
    ["Audit store", data.audit_store],
  ];
  return (
    <Panel title="Component states">
      <table className="tbl">
        <tbody>
          {entries.map(([k, v]) => (
            <Row key={k} k={k} v={<StateBadge state={String(v)} />} />
          ))}
          <Row k="Sandbox network" v={<StateBadge state={data.sandbox_network} />} />
        </tbody>
      </table>
    </Panel>
  );
}

function RoleSwitch({ role, onChange }: { role: DevRole; onChange: (r: DevRole) => void }) {
  return (
    <select
      className="user-select"
      style={{ width: "auto" }}
      aria-label="Development role"
      value={role}
      onChange={(e) => onChange(e.target.value as DevRole)}
    >
      <option value="user">User</option>
      <option value="admin">Admin</option>
    </select>
  );
}

export default function AdminConsole() {
  const pathname = usePathname() ?? "/admin";
  const router = useRouter();
  const [role, setRole] = useDevRole();
  const section = useMemo<Section>(() => {
    const seg = pathname.split("/").filter(Boolean)[1] ?? "overview"; // [admin, section?]
    return (SECTIONS as readonly string[]).includes(seg) ? (seg as Section) : "overview";
  }, [pathname]);

  const changeRole = (next: DevRole) => {
    setRole(next);
    router.replace(next === "admin" ? "/admin" : "/");
  };

  if (role !== "admin") {
    return (
      <div className="admin">
        <div className="admin-top">
          <div className="brand">
            <span className="brand-icon" aria-hidden="true">
              🛡
            </span>
            Sovereign Control Plane
          </div>
          <span className="dev-note">development — not authentication</span>
        </div>
        <div className="dev-gate">
          <h2>Operations console</h2>
          <p style={{ color: "var(--text-2)" }}>
            This area is the platform operations console for administrators.
          </p>
          <div className="warn-box">
            The switch below is a <strong>development-only</strong> role selection, not
            production authentication. The backend independently enforces the admin
            boundary on /api/admin/* and never exposes users&apos; private messages or
            document contents.
          </div>
          <RoleSwitch role={role} onChange={changeRole} />
          <button type="button" className="btn btn-ghost" onClick={() => router.push("/")}>
            ← Back to my work
          </button>
        </div>
      </div>
    );
  }

  const title = SECTION_TITLES[section] ?? SECTION_TITLES.overview;

  return (
    <div className="admin">
      <div className="admin-top">
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            🛡
          </span>
          Sovereign Control Plane
        </div>
        <span className="dev-note">development admin</span>
        <div className="topbar-spacer" />
        <ThemeToggle />
        <RoleSwitch role={role} onChange={changeRole} />
        <Link href="/" className="menu-btn">
          User workspace
        </Link>
      </div>
      <div className="admin-body">
        <nav className="admin-nav" aria-label="Admin sections">
          <div className="nav-head">Operations</div>
          {SECTIONS.map((s) => (
            <Link
              key={s}
              href={`/admin/${s}`}
              className={section === s ? "nav-item active" : "nav-item"}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          ))}
        </nav>
        <main className="admin-content" aria-label="Admin content">
          <h2>{title.title}</h2>
          <p className="sub">{title.sub}</p>
          {section === "overview" ? <OverviewView /> : null}
          {section === "workloads" ? <WorkloadsView /> : null}
          {section === "users" ? <UsersView /> : null}
          {section === "models" ? <ModelsView /> : null}
          {section === "resources" ? <ResourcesView /> : null}
          {section === "knowledge" ? <KnowledgeView /> : null}
          {section === "audit" ? <AuditView /> : null}
          {section === "sovereignty" ? <SovereigntyView /> : null}
          {section === "system" ? <SystemView /> : null}
        </main>
      </div>
    </div>
  );
}
