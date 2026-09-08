"use client";

import dynamic from "next/dynamic";

const WorkbenchApp = dynamic(() => import("@/sih/App"), { ssr: false });

export default function PreviewPage() {
  return <WorkbenchApp />;
}
