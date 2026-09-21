import type { Metadata } from "next";
import "./globals.css";
import ClickEffects from "@/components/ui/click-effects";

// No next/font: Switzer and IBM Plex Mono are vendored under /public/fonts and
// declared in globals.css. next/font would pull from Google's CDN at build
// time, which is a dependency an air-gapped build cannot satisfy.

export const metadata: Metadata = {
  title: "AstraSovereign — On-premise agentic AI workbench",
  description:
    "A self-hosted, air-gapped agentic AI workbench for confidential industrial work. Multi-model routing, local OCR and vision, a sealed code sandbox, and real Word, Excel and PowerPoint deliverables — with zero cloud egress.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="antialiased min-h-screen" style={{ background: "var(--canvas)", color: "var(--bone)" }}>
        {children}
        <ClickEffects />
      </body>
    </html>
  );
}
