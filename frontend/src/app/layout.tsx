import type { Metadata } from "next";
import "./globals.css";
import ClickEffects from "@/components/ui/click-effects";
import BootGate from "@/components/ui/boot-gate";
import DevHmrBfcacheHandler from "@/components/DevHmrBfcacheHandler";

// No next/font: Switzer and IBM Plex Mono are vendored under /public/fonts and
// declared in globals.css. next/font would pull from Google's CDN at build
// time, which is a dependency an air-gapped build cannot satisfy.

export const metadata: Metadata = {
  title: "AstraSovereign — On-premise agentic AI workbench",
  description:
    "A self-hosted, air-gapped agentic AI workbench for confidential industrial work. Multi-model routing, local OCR and vision, a sealed code sandbox, and real Word, Excel and PowerPoint deliverables — with zero cloud egress.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Theme before first paint. Reading the stored choice in an effect
          means a light-theme user gets a frame of the dark canvas on every
          load — with a full-screen preloader in front of it, that frame is a
          flash of the wrong colour across the whole viewport. This runs
          synchronously in <head>, before the body is painted, so there is
          nothing to flash.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('sovereign.theme');if(t==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}",
          }}
        />
      </head>
      <body className="antialiased min-h-screen" style={{ background: "var(--canvas)", color: "var(--bone)" }}>
        <DevHmrBfcacheHandler />
        <BootGate />
        {children}
        <ClickEffects />
      </body>
    </html>
  );
}
