"use client";

import type { ReactNode } from "react";

/** A single source chip: trigger label + hover preview card. */
export function Source({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={`pka-source ${className}`} href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

export function SourceTrigger({
  children,
  showFavicon = false,
}: {
  children?: ReactNode;
  showFavicon?: boolean;
}) {
  return (
    <span className="pka-source-label">
      {showFavicon ? (
        <span className="favicon" aria-hidden="true">
          ◦
        </span>
      ) : null}
      {children}
    </span>
  );
}

export function SourceContent({ title, description }: { title?: string; description?: string }) {
  return (
    <span className="pka-source-pop" role="tooltip">
      {title ? <span className="title">{title}</span> : null}
      {description ? <span className="desc">{description}</span> : null}
    </span>
  );
}

export default Source;
