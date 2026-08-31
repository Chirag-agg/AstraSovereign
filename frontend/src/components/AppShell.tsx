"use client";

import type { ReactNode } from "react";

export default function AppShell({
  header,
  sidebar,
  main,
  right,
}: {
  header: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="app-shell">
      <header className="app-header">{header}</header>
      <aside className="app-sidebar" aria-label="Jobs and documents">
        {sidebar}
      </aside>
      <main className="app-main" aria-label="Workbench">
        {main}
      </main>
      <aside className="app-right" aria-label="System status">
        {right}
      </aside>
    </div>
  );
}
