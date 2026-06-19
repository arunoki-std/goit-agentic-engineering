import type { CSSProperties } from "react";

export const s = {
  severityFilterBar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 14,
  } satisfies CSSProperties,
  severityFilterBtn: (active: boolean): CSSProperties => ({
    background: "none",
    border: active ? "2px solid currentColor" : "2px solid transparent",
    borderRadius: 7,
    padding: 0,
    cursor: "pointer",
    outline: "none",
    display: "inline-flex",
    opacity: 1,
    transition: "border-color .1s",
  }),
  severityFilterLabel: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginRight: 4,
    flexShrink: 0,
  } satisfies CSSProperties,
  reviewInProgress: {
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  reviewInProgressText: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  reviewInProgressSub: {
    fontSize: 13,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  lethalTrifecta: {
    marginBottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    border: "1px solid var(--crit)",
    background: "var(--crit-bg)",
  } satisfies CSSProperties,
  lethalTrifectaTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--crit)",
  } satisfies CSSProperties,
  liveRunSection: {
    marginBottom: 18,
  } satisfies CSSProperties,
  timelineSection: {
    marginBottom: 18,
  } satisfies CSSProperties,
  cancelActions: {
    display: "flex",
    gap: 8,
  } satisfies CSSProperties,
} as const;
