"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Box, ShieldCheck, WifiOff } from "lucide-react";
import SandboxView from "@/components/workbench/SandboxView";

export default function SandboxPage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-6">
      <div className="max-w-[1500px] mx-auto space-y-4">
        <div className="flex items-center justify-between pb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">
              AstraSovereign Ephemeral Runtime
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
              <WifiOff className="w-3 h-3 text-emerald-600" />
              Strict Air-Gap (--network none)
            </span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-100/90 shadow-2xs">
          <SandboxView user="user-001" />
        </div>
      </div>
    </main>
  );
}
