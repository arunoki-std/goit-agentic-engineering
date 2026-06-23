"use client";

import React from "react";
import { Badge, Button, Icon, Tabs, Toggle } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { ConfigTab } from "./_components/ConfigTab/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab/PreviewTab";
import { EvalsTab } from "./_components/EvalsTab/EvalsTab";
import { StatsTab } from "./_components/StatsTab/StatsTab";
import { VersionsTab } from "./_components/VersionsTab/VersionsTab";

const TABS = [
  { key: "config",    label: "Config" },
  { key: "preview",   label: "Preview" },
  { key: "evals",     label: "Evals" },
  { key: "stats",     label: "Stats" },
  { key: "versions",  label: "Versions" },
];

const TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric:     { color: "var(--accent)",         bg: "var(--accent-bg)" },
  convention: { color: "#4ca0e0",               bg: "#4ca0e014" },
  security:   { color: "var(--sev-critical)",   bg: "#e0404014" },
  custom:     { color: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

export function SkillDetailPanel({ skill }: { skill: Skill }) {
  const [tab, setTab] = React.useState("config");
  const update = useUpdateSkill();
  const tc = TYPE_COLORS[skill.type] ?? TYPE_COLORS.custom;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <Icon.Sparkles size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
        <span
          className="mono"
          style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}
        >
          {skill.name}
        </span>
        <Badge color={tc.color} bg={tc.bg}>{skill.type}</Badge>
        <Badge color="var(--text-muted)" bg="var(--bg-hover)" mono icon="GitBranch">
          v{skill.version}
        </Badge>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <Button kind="secondary" size="sm" icon="Play" disabled>
            Run on evals
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Enabled</span>
            <Toggle
              on={skill.enabled}
              onChange={(v) => update.mutate({ id: skill.id, patch: { enabled: v } })}
              size={15}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} value={tab} onChange={setTab} pad="0 24px" />

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "config"   && <ConfigTab   skill={skill} />}
        {tab === "preview"  && <PreviewTab  skill={skill} />}
        {tab === "evals"    && <EvalsTab />}
        {tab === "stats"    && <StatsTab />}
        {tab === "versions" && <VersionsTab skillId={skill.id} />}
      </div>
    </div>
  );
}
