"use client";

import React from "react";
import { Button, SectionLabel, Skeleton } from "@devdigest/ui";
import { usePrIntent, useRecalcIntent } from "@/lib/hooks/reviews";
import type { CSSProperties } from "react";

const s = {
  card: {
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: "var(--bg-elevated)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  } satisfies CSSProperties,
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  intentText: {
    fontSize: 14,
    lineHeight: 1.55,
    color: "var(--text-secondary)",
  } satisfies CSSProperties,
  scopeSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  } satisfies CSSProperties,
  scopeList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: 5,
  } satisfies CSSProperties,
  scopeItem: {
    fontSize: 13,
    lineHeight: 1.5,
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
  } satisfies CSSProperties,
  inScopePrefix: {
    color: "var(--success, #22c55e)",
    flexShrink: 0,
    fontWeight: 700,
  } satisfies CSSProperties,
  outScopePrefix: {
    color: "var(--crit, #ef4444)",
    flexShrink: 0,
    fontWeight: 700,
  } satisfies CSSProperties,
  emptyState: {
    textAlign: "center" as const,
    padding: "24px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  } satisfies CSSProperties,
  emptyText: {
    fontSize: 13,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
} as const;

export function IntentCard({ prId }: { prId: string }) {
  const intent = usePrIntent(prId);
  const recalc = useRecalcIntent(prId);

  // Initial load skeleton
  if (intent.isLoading) {
    return (
      <div style={s.card}>
        <Skeleton height={14} width={160} />
        <Skeleton height={60} />
        <Skeleton height={14} width={100} />
        <Skeleton height={40} />
      </div>
    );
  }

  const record = intent.data ?? null;

  return (
    <div style={s.card}>
      <div style={s.titleRow}>
        <SectionLabel icon="Brain">Intent Analysis</SectionLabel>
        <Button
          kind="secondary"
          size="sm"
          icon="RefreshCw"
          loading={recalc.isPending}
          disabled={recalc.isPending}
          onClick={() => recalc.mutate()}
        >
          Recalculate
        </Button>
      </div>

      {!record ? (
        <div style={s.emptyState}>
          <p style={s.emptyText}>No intent analyzed yet.</p>
          <Button
            kind="primary"
            size="sm"
            icon="Zap"
            loading={recalc.isPending}
            disabled={recalc.isPending}
            onClick={() => recalc.mutate()}
          >
            Analyze intent
          </Button>
        </div>
      ) : (
        <>
          <p style={s.intentText}>{record.intent}</p>

          {record.in_scope.length > 0 && (
            <div style={s.scopeSection}>
              <SectionLabel>In scope</SectionLabel>
              <ul style={s.scopeList}>
                {record.in_scope.map((item, i) => (
                  <li key={i} style={s.scopeItem}>
                    <span style={s.inScopePrefix}>✓</span>
                    <span style={{ color: "var(--text-secondary)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {record.out_of_scope.length > 0 && (
            <div style={s.scopeSection}>
              <SectionLabel>Out of scope</SectionLabel>
              <ul style={s.scopeList}>
                {record.out_of_scope.map((item, i) => (
                  <li key={i} style={s.scopeItem}>
                    <span style={s.outScopePrefix}>✗</span>
                    <span style={{ color: "var(--text-secondary)" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
