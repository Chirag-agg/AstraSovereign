import React from "react";

interface AstraLogoProps {
  size?: number;
  className?: string;
}

export function AstraLogo({ size = 32, className = "" }: AstraLogoProps) {
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label="AstraSovereign Emblem"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_2px_10px_rgba(37,99,235,0.28)]"
      >
        <defs>
          {/* Base plate obsidian gradient */}
          <linearGradient id="astra-plate" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="50%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#080d1a" />
          </linearGradient>

          {/* Border highlight */}
          <linearGradient id="astra-border" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.2" />
          </linearGradient>

          {/* Specular facet light */}
          <linearGradient id="astra-facet-light" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.15" />
          </linearGradient>

          {/* Deep shadow facet */}
          <linearGradient id="astra-facet-dark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#0a1329" />
          </linearGradient>
        </defs>

        {/* 1. Precision Titanium Chamfered Shield */}
        <rect
          x="3"
          y="3"
          width="42"
          height="42"
          rx="11"
          fill="url(#astra-plate)"
        />
        <rect
          x="3.5"
          y="3.5"
          width="41"
          height="41"
          rx="10.5"
          stroke="url(#astra-border)"
          strokeWidth="1.2"
        />

        {/* 2. Micro Alignment Ring & Reticle Ticks */}
        <circle cx="24" cy="24" r="17" stroke="#334155" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.8" />
        <line x1="24" y1="5.5" x2="24" y2="8" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="24" y1="40" x2="24" y2="42.5" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="5.5" y1="24" x2="8" y2="24" stroke="#60a5fa" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="40" y1="24" x2="42.5" y2="24" stroke="#3b82f6" strokeWidth="1.6" strokeLinecap="round" />

        {/* 3. Diagonal Starlight Lattice */}
        <path
          d="M24 16 L26 22 L32 24 L26 26 L24 32 L22 26 L16 24 L22 22 Z"
          fill="#1e3a8a"
          opacity="0.5"
        />

        {/* 4. Primary 4-Point Faceted Celestial Star (Astra) */}
        {/* North Ray */}
        <path d="M24 7 L27.5 24 L24 24 Z" fill="url(#astra-facet-light)" />
        <path d="M24 7 L20.5 24 L24 24 Z" fill="#1e40af" />

        {/* South Ray */}
        <path d="M24 41 L27.5 24 L24 24 Z" fill="#1d4ed8" />
        <path d="M24 41 L20.5 24 L24 24 Z" fill="url(#astra-facet-dark)" />

        {/* East Ray */}
        <path d="M41 24 L24 27.5 L24 24 Z" fill="#2563eb" />
        <path d="M41 24 L24 20.5 L24 24 Z" fill="url(#astra-facet-light)" />

        {/* West Ray */}
        <path d="M7 24 L24 27.5 L24 24 Z" fill="url(#astra-facet-dark)" />
        <path d="M7 24 L24 20.5 L24 24 Z" fill="#3b82f6" />

        {/* 5. Central Sovereign Nexus Core */}
        <circle cx="24" cy="24" r="4" fill="#0f172a" stroke="#60a5fa" strokeWidth="1" />
        <circle cx="24" cy="24" r="2.2" fill="#38bdf8" />
        <circle cx="24" cy="24" r="1" fill="#ffffff" />
      </svg>
    </div>
  );
}

export default AstraLogo;
