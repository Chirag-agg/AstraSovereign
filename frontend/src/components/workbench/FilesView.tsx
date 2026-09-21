"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  RefreshCw,
  AlertCircle,
  Code2,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  X,
} from "lucide-react";
import {
  listProjects,
  listProjectFiles,
  readProjectFile,
  createProject,
  writeProjectFile,
  deleteProject,
} from "@/lib/api";
import type { ProjectMeta, ProjectFileEntry } from "@/lib/api";

function activeUserId(): string {
  if (typeof window === "undefined") return "user-001";
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

function FileRow({
  node,
  depth,
  selectedFilePath,
  onOpenFile,
}: {
  node: FileTreeNode;
  depth: number;
  selectedFilePath: string | null;
  onOpenFile: (node: FileTreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = node.kind === "dir";
  const isSelected = selectedFilePath === node.path;

  return (
    <>
      <button
        type="button"
        onClick={() => (isDir ? setExpanded(!expanded) : onOpenFile(node))}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className={`w-full flex items-center gap-2 text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
          isSelected
            ? "bg-[var(--accent-light)] text-[var(--accent-strong)] font-semibold"
            : isDir
            ? "font-semibold text-slate-700 hover:bg-slate-100"
            : "font-mono text-slate-600 hover:bg-slate-100"
        }`}
      >
        {isDir ? (
          <>
            {expanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </>
        ) : (
          <>
            <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
        <div className="text-[11px] text-slate-400 pl-8 py-0.5 italic">Empty folder</div>
      )}
      {isDir &&
        expanded &&
        node.children?.map((child) => (
          <FileRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedFilePath={selectedFilePath}
            onOpenFile={onOpenFile}
          />
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
  const [editContent, setEditContent] = useState<string>("");
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Modals
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);

  const [isNewFileModalOpen, setIsNewFileModalOpen] = useState(false);
  const [newFilePath, setNewFilePath] = useState("");
  const [newFileContent, setNewFileContent] = useState("");
  const [creatingFile, setCreatingFile] = useState(false);

  const loadProjects = useCallback(async (selectId?: string) => {
    setError(null);
    setLoadingProjects(true);
    try {
      const data = await listProjects(activeUserId());
      setProjects(data || []);
      setSelectedProjectId((current) => {
        if (selectId && data.some((p) => p.project_id === selectId)) return selectId;
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
    setEditContent("");
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

  useEffect(() => {
    if (selectedProjectId) {
      void selectProject(selectedProjectId);
    }
  }, [selectedProjectId, selectProject]);

  const openFile = useCallback(
    async (node: FileTreeNode) => {
      if (!selectedProjectId || node.kind !== "file") return;
      setSelectedFile(node.path);
      setContent(null);
      setError(null);
      setLoadingContent(true);
      try {
        const res = await readProjectFile(activeUserId(), selectedProjectId, node.path);
        const text = res?.content ?? "";
        setContent(text);
        setEditContent(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to read file");
        setContent(null);
      } finally {
        setLoadingContent(false);
      }
    },
    [selectedProjectId]
  );

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name || creatingProject) return;

    setCreatingProject(true);
    setError(null);
    try {
      const meta = await createProject(activeUserId(), name);
      setIsNewProjectModalOpen(false);
      setNewProjectName("");
      setNotice(`Project "${meta.name}" created successfully.`);
      setTimeout(() => setNotice(null), 4000);
      await loadProjects(meta.project_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreatingProject(false);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    const path = newFilePath.trim();
    if (!path || creatingFile) return;

    setCreatingFile(true);
    setError(null);
    try {
      await writeProjectFile(activeUserId(), selectedProjectId, path, newFileContent);
      setIsNewFileModalOpen(false);
      setNewFilePath("");
      setNewFileContent("");
      setNotice(`File "${path}" created successfully.`);
      setTimeout(() => setNotice(null), 4000);

      // Refresh files and select this new file
      const res = await listProjectFiles(activeUserId(), selectedProjectId);
      setEntries(res?.entries || []);
      setSelectedFile(path);
      setContent(newFileContent);
      setEditContent(newFileContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create file");
    } finally {
      setCreatingFile(false);
    }
  };

  const handleSaveFile = async () => {
    if (!selectedProjectId || !selectedFile || savingFile) return;
    setSavingFile(true);
    setError(null);
    try {
      await writeProjectFile(activeUserId(), selectedProjectId, selectedFile, editContent);
      setContent(editContent);
      setNotice(`Saved "${selectedFile}".`);
      setTimeout(() => setNotice(null), 3000);
      const res = await listProjectFiles(activeUserId(), selectedProjectId);
      setEntries(res?.entries || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setSavingFile(false);
    }
  };

  const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    try {
      await deleteProject(activeUserId(), projectId);
      setNotice("Project deleted.");
      setTimeout(() => setNotice(null), 3000);
      await loadProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  };

  const selectedProject = projects.find((p) => p.project_id === selectedProjectId);
  const tree = buildTree(entries);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7 min-w-0 min-h-0 bg-[var(--canvas)]">
      <div className="max-w-[1500px] mx-auto w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">
              Workspace Files &amp; Projects
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1 leading-relaxed">
              Create and manage projects, source code, scripts, and deliverables in isolated local workspaces.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsNewProjectModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ New Project</span>
            </button>

            <button
              type="button"
              onClick={() => void loadProjects()}
              disabled={loadingProjects}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingProjects ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Notice & Error */}
        {notice && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-xs animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-2.5 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 3-Column Workspace Explorer */}
        <div className="flex flex-col lg:flex-row gap-4 min-h-[520px]">
          {/* Column 1: Projects List */}
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-3 lg:w-72 shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Projects
              </h2>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(true)}
                className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>

            {loadingProjects ? (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-12">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-12 text-center space-y-2">
                <Folder className="w-8 h-8 text-slate-500 mx-auto" />
                <p className="text-xs font-semibold text-slate-700">No workspace projects</p>
                <p className="text-[11px] text-slate-400">Click &quot;+ New Project&quot; above to create your first project!</p>
              </div>
            ) : (
              <div className="space-y-1 overflow-y-auto max-h-[540px] pr-1">
                {projects.map((p) => {
                  const isSelected = selectedProjectId === p.project_id;
                  return (
                    <div
                      key={p.project_id}
                      onClick={() => void selectProject(p.project_id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        isSelected
                          ? "bg-[var(--accent-light)] border-[var(--brand-300)] text-[var(--accent-strong)] shadow-xs"
                          : "border-transparent hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 pr-1">
                        <Folder className={`w-4 h-4 shrink-0 ${isSelected ? "text-[var(--accent)]" : "text-slate-400"}`} />
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px] font-mono text-slate-400 truncate">{p.project_id}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => void handleDeleteProject(p.project_id, e)}
                        title="Delete project"
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Column 2: Files Tree */}
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-3 lg:w-80 shrink-0 flex flex-col">
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-2">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Files
              </h2>
              {selectedProject && (
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(true)}
                  className="text-[11px] font-bold text-[var(--accent)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ File</span>
                </button>
              )}
            </div>

            {selectedProject ? (
              loadingFiles ? (
                <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-12">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Loading files...
                </div>
              ) : tree.length === 0 ? (
                <div className="px-3 py-12 text-center space-y-2">
                  <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">Project is empty</p>
                  <button
                    type="button"
                    onClick={() => setIsNewFileModalOpen(true)}
                    className="text-xs font-bold text-[var(--accent)] hover:underline cursor-pointer"
                  >
                    + Create a file (e.g. main.py)
                  </button>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[540px] py-1 space-y-0.5 pr-1">
                  {tree.map((node) => (
                    <FileRow
                      key={node.path}
                      node={node}
                      depth={0}
                      selectedFilePath={selectedFile}
                      onOpenFile={openFile}
                    />
                  ))}
                </div>
              )
            ) : (
              <p className="text-xs text-slate-400 px-2 py-12 text-center">
                Select a project to inspect and add files.
              </p>
            )}
          </div>

          {/* Column 3: File Content & Editor */}
          <div className="bg-white border border-slate-200/80 shadow-[0_4px_20px_-2px_rgba(15,23,42,0.03)] rounded-2xl p-4 flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 truncate">
                <FileText className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="text-xs font-bold text-slate-900 truncate">
                  {selectedFile || "Workspace File Preview"}
                </span>
                {selectedProject && selectedFile && (
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    {selectedProject.name}
                  </span>
                )}
              </div>

              {selectedFile && (
                <button
                  type="button"
                  onClick={() => void handleSaveFile()}
                  disabled={savingFile}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingFile ? "Saving..." : "Save File"}</span>
                </button>
              )}
            </div>

            {loadingContent ? (
              <div className="flex items-center justify-center gap-2 text-slate-500 text-xs py-20 flex-1">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading file content...
              </div>
            ) : selectedFile && content !== null ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 w-full p-4 mt-3 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-purple-500 transition-all resize-none leading-relaxed shadow-inner"
                spellCheck={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-24 flex-1 space-y-2">
                <Code2 className="w-10 h-10 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">No file selected</p>
                <p className="text-xs text-slate-400 max-w-sm">
                  Select an existing file from the tree to edit or click &quot;+ File&quot; to create a new file in this project.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: New Project */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create New Workspace Project</h3>
              <button
                type="button"
                onClick={() => setIsNewProjectModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Pipeline Reliability Analysis"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingProject || !newProjectName.trim()}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingProject ? "Creating..." : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New File */}
      {isNewFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Create File in &quot;{selectedProject?.name}&quot;
              </h3>
              <button
                type="button"
                onClick={() => setIsNewFileModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFile} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  File Path / Filename
                </label>
                <input
                  type="text"
                  required
                  value={newFilePath}
                  onChange={(e) => setNewFilePath(e.target.value)}
                  placeholder="e.g. main.py or utils/helpers.py"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Content (optional)
                </label>
                <textarea
                  rows={5}
                  value={newFileContent}
                  onChange={(e) => setNewFileContent(e.target.value)}
                  placeholder="# Initial code or document notes..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewFileModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingFile || !newFilePath.trim()}
                  className="px-5 py-2 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {creatingFile ? "Creating..." : "Create File"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
