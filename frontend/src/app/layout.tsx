import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sovereign AI Workbench",
  description:
    "Local, air-gapped on-premise agentic AI workbench. Jobs, agent traces, resources, and generated deliverables — all local.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
