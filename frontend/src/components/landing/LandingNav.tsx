"use client";

import { ThemeSwitch } from "@/components/ui/theme-switch";

import React from "react";
import Link from "next/link";
import { AstraWordmark } from "@/components/brand/AstraMark";
import { LiquidCarveButton } from "@/components/ui/liquid-carve-button";
import { PAGE } from "@/components/landing/atoms";

export interface LandingNavProps {
  currentPath?: string;
  onEnter?: () => void;
}

export function LandingNav({ currentPath = "/", onEnter }: LandingNavProps) {
  const navLinks = [
    { label: "Pipeline", href: "/pipeline" },
    { label: "Proof", href: "/proof" },
    { label: "Benchmarks", href: "/benchmarks" },
    { label: "Deliverables", href: "/deliverables" },
  ];

  const handleLoginClick = () => {
    if (onEnter) {
      onEnter();
    } else if (typeof window !== "undefined") {
      window.location.href = "/?login=1";
    }
  };

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "color-mix(in srgb, var(--canvas) 86%, transparent)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--carbon)",
      }}
    >
      <div className={PAGE}>
        <div className="flex items-center gap-8" style={{ height: 64 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <AstraWordmark />
          </Link>

          <div className="ml-auto hidden items-center gap-7 md:flex">
            {navLinks.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="astra-navlink"
                  style={{
                    color: isActive ? "var(--bone)" : "var(--granite)",
                    fontWeight: isActive ? 500 : 400,
                    position: "relative",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                  {isActive && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -18,
                        left: 0,
                        right: 0,
                        height: 2,
                        background: "var(--signal)",
                        borderRadius: 1,
                      }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <ThemeSwitch />

          <LiquidCarveButton
            variant="bone"
            size="sm"
            onClick={handleLoginClick}
            className="ml-auto md:ml-0"
          >
            Log in
          </LiquidCarveButton>
        </div>
      </div>
    </nav>
  );
}

export default LandingNav;
