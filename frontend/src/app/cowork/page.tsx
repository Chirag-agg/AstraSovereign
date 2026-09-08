"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FolderPlus, FilePlus2, Save, RefreshCw, Trash2, Send, X, Lock, Play } from "lucide-react";
import Login from "@/components/Login";
import Markdown from "@/components/Markdown";
import { getJob } from "@/lib/api";
import type { Job, TraceEntry } from "@/lib/types";
import {
  coworkChat,
  createProject,
  deleteProject,
  listProjectFiles,
  listProjects,
  projectHistory,
  readProjectFile,
  writeProjectFile,
} from "@/lib/api";
import type { ProjectFileEntry, ProjectHistory, ProjectMeta } from "@/lib/api";

const TERMINAL = new Set(["completed", "failed", "cancelled"]);

function activeUserId(): string {
  try {
    return window.localStorage.getItem("sovereign.active-user") || "user-001";
  } catch {
    return "user-001";
  }
}

function timeLabel(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fileLang(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (["py"].includes(ext)) return "python";
  if (["md", "markdown"].includes(ext)) return "text";
  return ext || "text";
}

export default function CoworkPage() {
  const [authed, setAuthed] = useState(false);
  const userId = activeUserId();

  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const [history, setHistory] = useState<ProjectHistory | null>(null);
  const [files, setFiles] = useState<ProjectFileEntry[]>([]);
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [newFilePath, setNewFilePath] = useState("");

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const selected = projects.find((p) => p.project_id === selectedId) ?? null;

  const refreshProjects = useCallback(async () => {
    try {
      setProjects(await listProjects(userId));
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not load projects.");
    }
  }, [userId]);

  const refreshProject = useCallback(
    async (projectId: string) => {
      if (!projectId) return;
      try {
        setHistory(await projectHistory(userId, projectId));
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Could not load history.");
      }
      try {
        const res = await listProjectFiles(userId, projectId);
        setFiles(res.entries);
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Could not load files.");
      }
    },
    [userId],
  );

  // session gate
  useEffect(() => {
    try {
      setAuthed(window.sessionStorage.getItem("sovereign.session") === "1");
    } catch {
      setAuthed(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void refreshProjects();
    const id = setInterval(() => void refreshProjects(), 15000);
    return () => clearInterval(id);
  }, [authed, refreshProjects]);

  // refresh history + files periodically while a project is open (agent may finish elsewhere)
  useEffect(() => {
    if (!authed || !selectedId) return;
    void refreshProject(selectedId);
    const id = setInterval(() => void refreshProject(selectedId), 2500);
    return () => clearInterval(id);
  }, [authed, selectedId, refreshProject]);

  // poll the active job (live trace/reasoning)
  useEffect(() => {
    if (!authed || !activeJobId) return;
    let alive = true;
    const tick = async () => {
      try {
        const j = await getJob(userId, activeJobId);
        if (!alive) return;
        setJob(j);
        if (TERMINAL.has(j.status)) {
          setActiveJobId(null);
          setJob(null);
          if (selectedId) void refreshProject(selectedId);
        }
      } catch {
        // keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1200);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [authed, activeJobId, selectedId, refreshProject, userId]);

  useEffect(() => {
    chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight });
  }, [history?.messages.length, job?.execution_trace?.length]);

  const selectProject = (id: string) => {
    setSelectedId(id);
    setOpenPath(null);
    setJob(null);
  };

  const createNew = async () => {
    if (!projectName.trim()) return;
    setCreating(true);
    try {
      const meta = await createProject(userId, projectName.trim());
      setProjectName("");
      setProjects((p) => [meta, ...p]);
      setSelectedId(meta.project_id);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setCreating(false);
    }
  };

  const openFile = async (path: string) => {
    if (!selectedId) return;
    setOpenPath(path);
    setFileError(null);
    try {
      const res = await readProjectFile(userId, selectedId, path);
      setContent(res.content);
      setDirty(false);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not read file.");
    }
  };

  const saveFile = async () => {
    if (!selectedId || !openPath) return;
    setSaving(true);
    setFileError(null);
    try {
      await writeProjectFile(userId, selectedId, openPath, content);
      setDirty(false);
      void refreshProject(selectedId);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not save file.");
    } finally {
      setSaving(false);
    }
  };

  const createFile = async () => {
    const path = newFilePath.trim().replace(/^\/+/, "");
    if (!selectedId || !path) return;
    setSaving(true);
    setFileError(null);
    try {
      await writeProjectFile(userId, selectedId, path, "");
      setNewFilePath("");
      await openFile(path);
      void refreshProject(selectedId);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not create file.");
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    const text = message.trim();
    if (!selectedId || !text) return;
    setSubmitting(true);
    setMessage("");
    try {
      const submit = await coworkChat(userId, selectedId, text);
      setActiveJobId(submit.job_id);
      void refreshProject(selectedId);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not submit message.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeProject = async (id: string) => {
    try {
      await deleteProject(userId, id);
      setProjects((p) => p.filter((x) => x.project_id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setHistory(null);
        setFiles([]);
      }
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Could not delete project.");
    }
  };

  if (!authed) {
    return <Login onAuthenticated={(role) => (role === "admin" ? (window.location.href = "/admin") : setAuthed(true))} />;
  }

  const locked = Boolean(activeJobId);
  const editorPath = openPath;
  const historyMessages = history?.messages ?? [];

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--bg-canvas)" }}>
      <header
        className="flex h-12 shrink-0 items-center justify-between border-b px-4"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
      >
        <div className="flex items-center gap-3">
          <span className="brand-mark" aria-hidden="true" />
          <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Cowork
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            project IDE · files stay on this machine
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: locked ? "var(--warn, #d9a441)" : "var(--safe-600)" }} />
            {locked ? "agent working" : "ready"}
          </span>
          <a href="/" className="rounded-md border px-2 py-1 text-[12px]" style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}>
            Chat
          </a>
          <button
            onClick={() => {
              window.sessionStorage.removeItem("sovereign.session");
              setAuthed(false);
            }}
            className="rounded-md border px-2 py-1 text-[12px]"
            style={{ borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left: projects + conversation */}
        <aside className="flex w-[300px] shrink-0 flex-col border-r" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="border-b p-2" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex gap-1.5">
              <input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void createNew()}
                placeholder="New project name"
                className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-[12.5px]"
                style={{ background: "var(--bg-sunken)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
              />
              <button
                onClick={() => void createNew()}
                disabled={creating}
                className="flex h-8 w-8 items-center justify-center rounded-md text-white"
                style={{ background: "var(--accent-solid)" }}
                title="Create project"
              >
                <FolderPlus size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto border-b px-2 py-1.5" style={{ borderColor: "var(--border-subtle)" }}>
            {projects.length === 0 ? (
              <p className="px-1 py-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                No projects yet. Create one, then ask the agent to build something.
              </p>
            ) : (
              projects.map((p) => {
                const active = p.project_id === selectedId;
                return (
                  <div key={p.project_id} className="group flex items-center gap-1">
                    <button
                      onClick={() => selectProject(p.project_id)}
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-[12.5px]"
                      style={{
                        background: active ? "var(--bg-selected)" : "transparent",
                        color: active ? "var(--accent-strong)" : "var(--text-primary)",
                      }}
                    >
                      <span className="block truncate">{p.name}</span>
                      <span className="block text-[10px]" style={{ color: "var(--text-tertiary)" }}>{p.project_id.slice(0, 14)}…</span>
                    </button>
                    <button
                      onClick={() => void removeProject(p.project_id)}
                      className="hidden h-6 w-6 items-center justify-center rounded group-hover:flex"
                      style={{ color: "var(--text-tertiary)" }}
                      title="Delete project"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {selected && (
            <>
              <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
                <p className="truncate text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{selected.name}</p>
                <span className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>{timeLabel()}</span>
              </div>
              <div ref={chatScrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
                {historyMessages.length === 0 ? (
                  <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
                    Ask the agent to build or change this project. Files it writes appear in the tree.
                  </p>
                ) : (
                  historyMessages.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "mb-3 flex justify-end" : "mb-3"}>
                      <div
                        className={m.role === "user" ? "max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2" : "max-w-[92%]"}
                        style={
                          m.role === "user"
                            ? { background: "var(--bg-sunken)", color: "var(--text-primary)" }
                            : { color: "var(--text-primary)" }
                        }
                      >
                        {m.role === "assistant" ? (
                          <div className="md text-[13.5px]" style={{ color: "var(--text-primary)" }}>
                            <Markdown text={m.text} />
                          </div>
                        ) : (
                          <p className="text-[13.5px] leading-relaxed">{m.text}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {activeJobId && (
                  <div className="mb-3 flex items-center gap-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                    <span className="caret" style={{ color: "var(--accent-strong)" }}>▍</span>
                    agent working…
                  </div>
                )}
              </div>
              <div className="border-t p-2" style={{ borderColor: "var(--border-subtle)" }}>
                <div className="flex gap-1.5">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    placeholder="Tell the agent what to build or change in this project…"
                    className="min-w-0 flex-1 resize-none rounded-md border px-2.5 py-2 text-[13px]"
                    style={{ background: "var(--bg-sunken)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                  />
                  <button
                    onClick={() => void send()}
                    disabled={!message.trim() || Boolean(activeJobId) || submitting}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-white disabled:opacity-40"
                    style={{ background: "var(--accent-solid)" }}
                    title="Send"
                  >
                    <Send size={15} />
                  </button>
                </div>
                {locked && (
                  <p className="mt-1 flex items-center gap-1 text-[10.5px]" style={{ color: "var(--warn, #d9a441)" }}>
                    <Lock size={10} /> project locked while the agent runs
                  </p>
                )}
              </div>
            </>
          )}
        </aside>

        {/* center: files + editor */}
        <section className="flex min-w-0 flex-1 flex-col" style={{ background: "var(--bg-canvas)" }}>
          {pageError && (
            <div className="mx-4 mt-3 rounded-md border px-3 py-2 text-[12px]" style={{ borderColor: "var(--alert-100)", background: "var(--alert-100)", color: "var(--alert-600)" }}>
              {pageError}
              <button className="ml-2" onClick={() => setPageError(null)}>✕</button>
            </div>
          )}
          {!selected ? (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-[13px]" style={{ color: "var(--text-tertiary)" }}>
              Select or create a project on the left to start.
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              <div className="flex w-64 shrink-0 flex-col border-r" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Files</p>
                  <button onClick={() => selectedId && void refreshProject(selectedId)} title="Refresh files" className="flex h-6 w-6 items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
                    <RefreshCw size={12} className={locked ? "animate-spin" : ""} />
                  </button>
                </div>
                <div className="border-b p-2" style={{ borderColor: "var(--border-subtle)" }}>
                  <div className="flex gap-1">
                    <input
                      value={newFilePath}
                      onChange={(e) => setNewFilePath(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && void createFile()}
                      placeholder="new file path, e.g. main.py"
                      className="min-w-0 flex-1 rounded-md border px-2 py-1 text-[11.5px]"
                      style={{ background: "var(--bg-sunken)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                    />
                    <button onClick={() => void createFile()} title="Create file" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ borderColor: "var(--border-default)" }}>
                      <FilePlus2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
                  {files.length === 0 ? (
                    <p className="px-2 py-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                      No files yet. Ask the agent to create some.
                    </p>
                  ) : (
                    files.map((f) => {
                      const active = f.path === openPath;
                      return (
                        <button
                          key={f.path}
                          onClick={() => f.kind === "file" && void openFile(f.path)}
                          className={f.kind === "file" ? "w-full truncate rounded px-2 py-1 text-left text-[12px]" : "w-full truncate rounded px-2 py-1 text-left text-[12px] font-semibold"}
                          style={{
                            paddingLeft: f.path.split("/").length * 8,
                            background: active ? "var(--bg-selected)" : "transparent",
                            color: active ? "var(--accent-strong)" : f.kind === "dir" ? "var(--text-2, var(--text-secondary))" : "var(--text-primary)",
                            cursor: f.kind === "file" ? "pointer" : "default",
                          }}
                        >
                          {f.name}
                          {f.kind === "file" && f.size !== null ? (
                            <span className="ml-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>{f.size} B</span>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                  <p className="mono truncate text-[12px]" style={{ color: "var(--text-secondary)" }}>{editorPath ?? "no file open"}</p>
                  {editorPath && (
                    <button
                      onClick={() => void saveFile()}
                      disabled={locked || saving || !dirty}
                      className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-40"
                      style={{ background: "var(--accent-solid)" }}
                    >
                      <Save size={12} />
                      {saving ? "Saving…" : dirty ? "Save" : "Saved"}
                    </button>
                  )}
                </div>
                {locked && editorPath && (
                  <div className="border-b px-4 py-1.5 text-[11.5px]" style={{ borderColor: "var(--border-subtle)", background: "var(--amber-100)", color: "var(--amber-600)" }}>
                    <Lock size={10} className="mr-1 inline" /> Project locked while the agent is working — edits are disabled until it finishes.
                  </div>
                )}
                {fileError && (
                  <div className="border-b px-4 py-1.5 text-[11.5px]" style={{ borderColor: "var(--border-subtle)", background: "var(--alert-100)", color: "var(--alert-600)" }}>
                    {fileError}
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-auto">
                  {editorPath ? (
                    <textarea
                      value={content}
                      onChange={(e) => {
                        setContent(e.target.value);
                        setDirty(true);
                      }}
                      disabled={locked}
                      spellCheck={false}
                      className="h-full w-full resize-none bg-transparent px-4 py-3 outline-none"
                      style={{
                        color: "var(--text-primary)",
                        fontFamily: "var(--mono)",
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    />
                  ) : (
                    <div className="p-8 text-center text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
                      Select a file to view or edit it. Files the agent writes appear here automatically.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* right: reasoning / execution */}
        <aside className="flex w-[320px] shrink-0 flex-col border-l" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
          <div className="border-b px-3 py-2" style={{ borderColor: "var(--border-subtle)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>
              {locked ? "Agent execution" : "Recent executions"}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {locked && job ? <ExecutionTrace job={job} /> : null}
            {!locked && (history?.executions ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {history!.executions.map((e, i) => (
                  <div key={i} className="rounded-lg border p-2.5" style={{ borderColor: "var(--border-subtle)" }}>
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-primary)" }}>{e.summary}</p>
                    <p className="mt-1 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
                      {e.model ? `model · ${e.model} · ` : ""}
                      {(e.files_touched ?? []).join(", ") || "no files changed"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              !locked && (
                <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                  Execution summaries appear here once the agent finishes a request.
                </p>
              )
            )}
            {(history?.decisions ?? []).length > 0 && (
              <>
                <p className="mb-1 mt-4 text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>Decisions</p>
                <ul className="flex flex-col gap-1">
                  {history!.decisions.map((d, i) => (
                    <li key={i} className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                      • {d.decision}
                      {d.reason ? <span style={{ color: "var(--text-tertiary)" }}> — {d.reason}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ExecutionTrace({ job }: { job: Job }) {
  const trace: TraceEntry[] = job.execution_trace ?? [];
  if (trace.length === 0) {
    return <p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>Waiting for the agent to start…</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {job.model ? (
        <p className="text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>
          model · {job.model} · {job.task_type}
        </p>
      ) : null}
      {trace.map((entry, i) => {
        const type = String(entry.type);
        const tool = entry.tool ? String(entry.tool) : "";
        const label = entry.label ? String(entry.label) : "";
        const model = entry.model ? String(entry.model) : "";
        const plan = entry.description ? String(entry.description) : "";
        const result = entry.result_summary ? String(entry.result_summary) : "";
        const ok = entry.ok !== false && entry.ok !== undefined;
        return (
          <div key={i} className="rounded-md px-2 py-1.5" style={{ background: "var(--bg-sunken)" }}>
            <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>
              <span className="mono" style={{ color: "var(--text-tertiary)" }}>{type}</span>
              {label ? <span className="ml-1 font-medium">{label}</span> : null}
              {tool ? <span className="mono ml-1" style={{ color: "var(--accent-strong)" }}>{tool}</span> : null}
              {model ? <span className="mono ml-1 text-[10.5px]" style={{ color: "var(--text-tertiary)" }}>{model}</span> : null}
            </p>
            {plan && (
              <p className="mt-0.5 text-[11.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {plan.length > 300 ? `${plan.slice(0, 300)}…` : plan}
              </p>
            )}
            {result && (
              <p className="mt-0.5 whitespace-pre-wrap text-[11px] leading-snug" style={{ color: ok ? "var(--safe-600)" : "var(--alert-600)" }}>
                {ok ? "✓ " : "✕ "}
                {result.length > 400 ? `${result.slice(0, 400)}…` : result}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
