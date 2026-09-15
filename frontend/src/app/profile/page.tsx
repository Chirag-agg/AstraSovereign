"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import UserProfileView from "@/components/profile/UserProfileView";

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-[#F8FAFC] text-slate-800 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between pb-2">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Workspace</span>
          </Link>
          <span className="text-xs font-bold text-slate-400">
            AstraSovereign Profile &bull; L4 Sovereign Credentials
          </span>
        </div>

        <UserProfileView />
      </div>
    </main>
  );
}
