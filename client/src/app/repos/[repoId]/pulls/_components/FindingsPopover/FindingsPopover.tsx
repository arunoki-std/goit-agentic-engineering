"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Icon, SEV, ConfidenceNum } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { usePrReviews } from "../../../../../../lib/hooks/reviews";

const SEV_ORDER: Record<string, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2 };

interface FindingsPopoverProps {
  prId: string;
  repoId: string;
  prNumber: number;
  anchorRect: DOMRect;
  onClose: () => void;
}

export function FindingsPopover({ prId, repoId, prNumber, anchorRect, onClose }: FindingsPopoverProps) {
  const router = useRouter();
  const { data: reviews, isLoading } = usePrReviews(prId);
  const ref = React.useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // Close on outside click or Escape
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [onClose]);

  const findings = React.useMemo<FindingRecord[]>(() => {
    if (!reviews) return [];
    const all = reviews.flatMap((r) => r.findings.filter((f) => !f.dismissed_at));
    return [...all].sort(
      (a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9),
    );
  }, [reviews]);

  // Position: below anchor, left-aligned; clamp to viewport right edge
  const POPOVER_W = 400;
  const GAP = 8;
  const top = anchorRect.bottom + GAP + window.scrollY;
  const left = Math.min(
    anchorRect.left + window.scrollX,
    window.innerWidth - POPOVER_W - 16,
  );

  const popover = (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top,
        left,
        width: POPOVER_W,
        maxHeight: 480,
        overflowY: "auto",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        boxShadow: "0 8px 32px rgba(0,0,0,.45)",
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px 10px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.06em",
        color: "var(--text-muted)",
        textTransform: "uppercase",
      }}>
        <Icon.Info size={13} />
        {isLoading ? "Loading…" : `${findings.length} finding${findings.length === 1 ? "" : "s"}`}
      </div>

      {/* Findings list */}
      {isLoading ? (
        <div style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 13 }}>
          Loading findings…
        </div>
      ) : findings.length === 0 ? (
        <div style={{ padding: "20px 16px", color: "var(--text-muted)", fontSize: 13 }}>
          No findings for this PR.
        </div>
      ) : (
        findings.map((f, i) => {
          const sev = SEV[f.severity as keyof typeof SEV] ?? SEV.SUGGESTION;
          const SevIcon = Icon[sev.icon];
          return (
            <div
              key={f.id}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                router.push(`/repos/${repoId}/pulls/${prNumber}?tab=findings`);
              }}
              style={{
                padding: "11px 16px",
                borderBottom: i < findings.length - 1 ? "1px solid var(--border)" : "none",
                cursor: "pointer",
              }}
            >
              {/* Row 1: icon + title + category */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
                <SevIcon size={14} style={{ color: sev.c, flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)", flex: 1 }}>
                  {f.title}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}>
                  {f.category}
                </span>
              </div>
              {/* Row 2: file:line + confidence */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--accent-text)" }}>
                  {f.file}:{f.start_line}
                  {f.end_line !== f.start_line ? `-${f.end_line}` : ""}
                </span>
                <ConfidenceNum value={f.confidence} />
              </div>
              {/* Row 3: rationale, 2 lines */}
              <div style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.5,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}>
                {f.rationale}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  if (!mounted) return null;
  return createPortal(popover, document.body);
}
