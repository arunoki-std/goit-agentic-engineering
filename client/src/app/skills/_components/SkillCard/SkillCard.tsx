"use client";

import React from "react";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill, SkillType, SkillSource } from "@devdigest/shared";
import { s } from "./styles";

const TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric:     { color: "var(--accent)",        bg: "var(--accent-bg)" },
  convention: { color: "#4ca0e0",              bg: "#4ca0e014" },
  security:   { color: "var(--sev-critical)",  bg: "#e0404014" },
  custom:     { color: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

const SOURCE_LABELS: Record<SkillSource, string> = {
  manual:       "Manual",
  extracted:    "Extracted",
  community:    "Community",
  imported_url: "Imported",
};

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const tc = TYPE_COLORS[skill.type] ?? TYPE_COLORS.custom;

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox}>
          <Icon.Sparkles size={13} />
        </div>
        <span className="mono" style={s.name}>{skill.name}</span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
      </div>

      <div style={s.description}>{skill.description || " "}</div>

      <div style={s.metaRow}>
        <Badge color={tc.color} bg={tc.bg}>{skill.type}</Badge>
        <Badge color="var(--text-muted)" bg="var(--bg-hover)">
          {SOURCE_LABELS[skill.source] ?? skill.source}
        </Badge>
      </div>

      {skill.agent_count !== undefined && (
        <div style={s.statsLine}>
          {skill.agent_count} {skill.agent_count === 1 ? "agent" : "agents"}
        </div>
      )}
    </div>
  );
}
