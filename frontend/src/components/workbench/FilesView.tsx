"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Code2,
} from "lucide-react";
import { listProjects, listProjectFiles, readProjectFile } from "@/lib/api";
import type { ProjectMeta, ProjectFileEntry } from "@/lib/api";

function activeUserId(): string {
  return window.localStorage.getItem("sovereign.active-user") || "user-001";
}

interface FileTreeNode {
  name: string;
  path: string;
  kind: "dir" | "file";
  size: number | null;
  updated: string | null;
  children?: FileTreeNode[];
}

function buildTree(entries: ProjectFileEntry[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const map = new Map<string, FileTreeNode>();

  entries.forEach((e) => {
    map.set(e.path, { ...e, children: [] });
  });

  entries.forEach((e) => {
    const node = map.get(e.path)!;
    const parts = e.path.split("/");
    if (parts.length <= 1) {
      root.push(node);
    } else {
      const parentPath = parts.slice(0, -1).join("/");
      const parent = map.get(parentPath) || map.get(parentPath + "/");
      if (parent && parent.kind === "dir") {
        parent.children!.push(node);
      } else {
        root.push(node);
      }
    }
  });

  return root;
}

function formatBytes(size: number | null): string {
  if (size == null) return "";
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatUpdated(ts: string | null): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function FileRow({
  node,
  depth,
  onOpenFile,
}: {
  node: FileTreeNode;
  depth: number;
  onOpenFile: (node: FileTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isDir = node.kind === "dir";
  return (
    <>
      <button
        type="button"
        onClick={() => (isDir ? setExpanded(!expanded) : onOpenFile(node))}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        className={`w-full flex items-center gap-2 text-left px-3 py-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
          isDir
            ? "font-medium text-slate-700 hover:bg-slate-50"
            : "font-mono text-slate-600 hover:bg-slate-50"
        }`}
      >
        {isDir ? (
          <>
            {expanded ? (
              <FolderOpen className="w-4 h-4 text-[#7047eb] shrink-0" />
            ) : (
              <Folder className="w-4 h-4 text-[#7047eb] shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <FileText className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="truncate">{node.name}</span>
            {node.size != null && (
              <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                {formatBytes(node.size)}
              </span>
            )}
          </>
        )}
      </button>
      {isDir && expanded && node.children?.length === 0 && (
        <div className="text-xs text-slate-400 pl-10 py-1">Empty folder</div>
      )}
      {isDir &&
        expanded &&
        node.children?.map((child) => (
          <FileRow key={child.path} node={child} depth={depth + 1} onOpenFile={onOpenFile} />
        ))}
    </>
  );
}

export default function FilesView() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [entries, setEntries] = useState<ProjectFileEntry[]>([]);
  const [content, setContent] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async () => {
    setError(null);
    setLoadingProjects(true);
    try {
      const data = await listProjects(activeUserId());
      setProjects(data || []);
      setSelectedProjectId((current) => {
        if (current && data.some((p) => p.project_id === current)) return current;
        return data[0]?.project_id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const selectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedFile(null);
    setContent(null);
    setEntries([]);
    setError(null);
    setLoadingFiles(true);
    try {
      const res = await listProjectFiles(activeUserId(), projectId);
      setEntries(res?.entries || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load project files");
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  const openFile = useCallback(async (node: FileTreeNode) => {
    if (!selectedProjectId || node.kind !== "file") return;
    setSelectedFile(node.path);
    setContent(null);
    setError(null);
    setLoadingContent(true);
    try {
      const res = await readProjectFile(activeUserId(), selectedProjectId, node.path);
      setContent(res?.content ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read file");
      setContent(null);
    } finally {
      setLoadingContent(false);
    }
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);
  const tree = buildTree(entries);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[#eef1f6]">
      <div className="max-w-[1500px] mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Workspace Files
            </h1>
            <p className="text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Files created and managed within your Cowork projects
            </p>
          </div>

          <button
            type="button"
            onClick={() => void loadProjects()}
            disabled={loadingProjects}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loadingProjects ? "animate-spin" : ""}`} />
            <span>Refresh projects</span>
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200/80 text-rose-700 rounded-xl px-4 py-3 text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 min-h-[420px]">
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-3 lg:w-72 shrink-0 flex flex-col">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 py-2">
              Projects
            </h2>
            {loadingProjects ? (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-10">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            ) : projects.length === 0 ? (
              <p className="text-sm text-slate-500 px-2 py-8 text-center">
                No projects yet. Create one in Cowork.
              </p>
            ) : (
              <div className="space-y-1 overflow-y-auto max-h-[520px]">
                {projects.map((p) => (
                  <button
                    key={p.project_id}
                    type="button"
                    onClick={() => void selectProject(p.project_id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors cursor-pointer flex items-center gap-2 ${
                      selectedProjectId === p.project_id
                        ? "bg-[#7047eb]/5 border-[#7047eb]/30"
                        : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <Folder className={`w-4 h-4 shrink-0 ${selectedProjectId === p.project_id ? "text-[#7047eb]" : "text-slate-400"}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 truncate">{p.project_id}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-3 lg:w-80 shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-2 py-2">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Files
              </h2>
              {selectedProject && (
                <a
                  href="/cowork"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#7047eb] hover:underline"
                >
                  Full editor <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            {selectedProject ? (
              loadingFiles ? (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-10">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading files...
                </div>
              ) : tree.length === 0 ? (
                <p className="text-sm text-slate-500 px-2 py-8 text-center">
                  This project has no files yet.
                </p>
              ) : (
                <div className="overflow-y-auto max-h-[520px] py-1 space-y-0.5">
                  {tree.map((node) => (
                    <FileRow key={node.path} node={node} depth={0} onOpenFile={openFile} />
                  ))}
                </div>
              )
            ) : (
              <p className="text-sm text-slate-500 px-2 py-8 text-center">
                Select a project to browse files.
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-3 flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2 py-2 border-b border-slate-100">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider truncate flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                {selectedFile || "File preview"}
              </h2>
              {selectedFile && selectedProject && (
                <span className="text-[10px] font-mono text-slate-400 truncate">
                  {selectedProject.name}
                </span>
              )}
            </div>
            {loadingContent ? (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-sm py-16 flex-1">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Reading file...
              </div>
            ) : content !== null ? (
              <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-slate-800 font-mono whitespace-pre break-words">
                {content}
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-16 flex-1">
                <Code2 className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm text-slate-500">
                  Select a file to preview its contents
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Read-only preview · edits happen in the Cowork IDE
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
