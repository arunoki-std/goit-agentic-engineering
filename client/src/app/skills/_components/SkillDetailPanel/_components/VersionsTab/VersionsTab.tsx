"use client";

import React from "react";
import { Skeleton, ErrorState, Badge } from "@devdigest/ui";
import { useSkillVersions } from "@/lib/hooks/skills";

export function VersionsTab({ skillId }: { skillId: string }) {
  const { data: versions, isLoading, isError } = useSkillVersions(skillId);

  if (isLoading) return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
      <Skeleton height={60} />
      <Skeleton height={60} />
    </div>
  );

  if (isError) return (
    <div style={{ padding: "24px 28px" }}>
      <ErrorState body="Could not load version history." />
    </div>
  );

  return (
    <div style={{ padding: "24px 28px" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Version history</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(versions ?? []).map((v) => (
          <div
            key={v.version}
            style={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "14px 16px",
              background: "var(--bg-elevated)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Badge color="var(--text-muted)" mono>v{v.version}</Badge>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {new Date(v.created_at).toLocaleString()}
              </span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>
                {v.token_count} tokens
              </span>
            </div>
            <pre
              style={{
                margin: 0,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--text-secondary)",
                maxHeight: 160,
                overflow: "auto",
              }}
            >
              {v.body.slice(0, 400)}{v.body.length > 400 ? "\n…" : ""}
            </pre>
          </div>
        ))}
        {versions?.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No versions recorded yet.</p>
        )}
      </div>
    </div>
  );
}
