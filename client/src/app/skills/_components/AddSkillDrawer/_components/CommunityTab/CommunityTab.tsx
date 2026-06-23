"use client";

import React from "react";
import { Icon, Button, ErrorState, Skeleton, Badge } from "@devdigest/ui";
import type { CommunitySkill } from "@devdigest/shared";
import { useCommunitySkills, useImportSkill } from "@/lib/hooks/skills";

function StarCount({ n }: { n: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text-muted)" }}>
      <Icon.Star size={11} />
      {n}
    </span>
  );
}

export function CommunityTab({ onDone }: { onDone: () => void }) {
  const [q, setQ] = React.useState("");
  const { data: skills, isLoading, isError, refetch } = useCommunitySkills(q || undefined);
  const importSkill = useImportSkill();
  const [importing, setImporting] = React.useState<string | null>(null);

  const doImport = async (s: CommunitySkill) => {
    setImporting(s.name);
    await importSkill.mutateAsync({
      body: `# ${s.name}\n\n${s.desc}`,
      name: s.name,
      source: "community",
    }).catch(() => null);
    setImporting(null);
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "4px 0" }}>
      <div
        style={{
          padding: "8px 10px",
          borderRadius: 6,
          background: "var(--bg-hover)",
          fontSize: 12,
          color: "var(--text-muted)",
          border: "1px solid var(--border)",
        }}
      >
        Community skills are untrusted. They start <strong>disabled</strong> — vet before enabling for an agent.
      </div>

      <div style={{ position: "relative" }}>
        <Icon.Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search community skills…"
          style={{
            width: "100%",
            padding: "8px 10px 8px 32px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {isLoading && <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skeleton height={56} /><Skeleton height={56} /><Skeleton height={56} /></div>}
      {isError && <ErrorState body="Could not load community skills." onRetry={() => refetch()} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(skills ?? []).map((s) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              border: "1px solid var(--border)",
              borderRadius: 7,
              background: "var(--bg-elevated)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                <Badge color="var(--text-muted)" bg="var(--bg-hover)">{s.lang}</Badge>
                <StarCount n={s.stars} />
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{s.desc}</p>
            </div>
            <Button
              kind="secondary"
              size="sm"
              onClick={() => doImport(s)}
              disabled={importing === s.name || importSkill.isPending}
            >
              {importing === s.name ? "Importing…" : "Import"}
            </Button>
          </div>
        ))}
        {!isLoading && (skills ?? []).length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: "20px 0" }}>
            No matching skills.
          </p>
        )}
      </div>
    </div>
  );
}
