"use client";

import React from "react";
import { Badge, Button, EmptyState, ErrorState, Icon, Skeleton, Toggle } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useSkills, useUpdateSkill, useAgentSkillLinks, useSetAgentSkills } from "@/lib/hooks/skills";

const TYPE_COLORS: Record<SkillType, { color: string; bg: string }> = {
  rubric:     { color: "var(--accent)",         bg: "var(--accent-bg)" },
  convention: { color: "#4ca0e0",               bg: "#4ca0e014" },
  security:   { color: "var(--sev-critical)",   bg: "#e0404014" },
  custom:     { color: "var(--text-secondary)", bg: "var(--bg-hover)" },
};

export function SkillsTab({ agentId }: { agentId: string }) {
  const { data: allSkills, isLoading: skillsLoading, isError: skillsError, refetch } = useSkills();
  const { data: links, isLoading: linksLoading } = useAgentSkillLinks(agentId);
  const setAgentSkills = useSetAgentSkills();
  const updateSkill = useUpdateSkill();
  const [search, setSearch] = React.useState("");

  const linkedIds = React.useMemo(
    () => new Set((links ?? []).map((l) => l.skill_id)),
    [links]
  );

  const linkedOrderMap = React.useMemo(() => {
    const m = new Map<string, number>();
    (links ?? []).forEach((l) => m.set(l.skill_id, l.order));
    return m;
  }, [links]);

  const isLoading = skillsLoading || linksLoading;

  const { linked, unlinked } = React.useMemo(() => {
    if (!allSkills) return { linked: [], unlinked: [] };
    const q = search.trim().toLowerCase();
    const filtered = q
      ? allSkills.filter((s) => s.name.includes(q) || s.description?.toLowerCase().includes(q))
      : allSkills;
    const linked = filtered
      .filter((s) => linkedIds.has(s.id))
      .sort((a, b) => (linkedOrderMap.get(a.id) ?? 99) - (linkedOrderMap.get(b.id) ?? 99));
    const unlinked = filtered.filter((s) => !linkedIds.has(s.id));
    return { linked, unlinked };
  }, [allSkills, linkedIds, linkedOrderMap, search]);

  const enabledLinkedCount = linked.filter((s) => s.enabled).length;

  const toggleLink = (skill: Skill) => {
    const currentIds = Array.from(linkedIds);
    const newIds = linkedIds.has(skill.id)
      ? currentIds.filter((id) => id !== skill.id)
      : [...currentIds, skill.id];
    setAgentSkills.mutate({ agentId, skillIds: newIds });
  };

  const moveUp = (skill: Skill) => {
    const arr = linked.map((s) => s.id);
    const idx = arr.indexOf(skill.id);
    if (idx <= 0) return;
    const tmp = arr[idx - 1]!;
    arr[idx - 1] = arr[idx]!;
    arr[idx] = tmp;
    setAgentSkills.mutate({ agentId, skillIds: arr });
  };

  const moveDown = (skill: Skill) => {
    const arr = linked.map((s) => s.id);
    const idx = arr.indexOf(skill.id);
    if (idx < 0 || idx >= arr.length - 1) return;
    const tmp = arr[idx]!;
    arr[idx] = arr[idx + 1]!;
    arr[idx + 1] = tmp;
    setAgentSkills.mutate({ agentId, skillIds: arr });
  };

  if (isLoading) {
    return (
      <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map((i) => <Skeleton key={i} height={52} />)}
      </div>
    );
  }

  if (skillsError) {
    return <ErrorState body="Could not load skills." onRetry={() => refetch()} />;
  }

  return (
    <div style={{ padding: "20px 28px", maxWidth: 860 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Skills</h2>
        <Badge color="var(--text-secondary)" bg="var(--bg-hover)">
          {enabledLinkedCount} of {linked.length} enabled
        </Badge>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>
          Order matters — earlier skills appear earlier in the assembled prompt.
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <Icon.Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter skills…"
          style={{
            width: "100%",
            padding: "7px 8px 7px 28px",
            borderRadius: 6,
            border: "1px solid var(--border)",
            background: "var(--bg-base)",
            color: "var(--text-primary)",
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Linked skills */}
      {linked.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Linked ({linked.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {linked.map((skill, idx) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                linked
                onToggleLink={() => toggleLink(skill)}
                onToggleEnabled={(v) => updateSkill.mutate({ id: skill.id, patch: { enabled: v } })}
                onMoveUp={idx > 0 ? () => moveUp(skill) : undefined}
                onMoveDown={idx < linked.length - 1 ? () => moveDown(skill) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      {linked.length > 0 && unlinked.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)", marginBottom: 16 }} />
      )}

      {/* Unlinked skills */}
      {unlinked.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Available ({unlinked.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {unlinked.map((skill) => (
              <SkillRow
                key={skill.id}
                skill={skill}
                linked={false}
                onToggleLink={() => toggleLink(skill)}
                onToggleEnabled={(v) => updateSkill.mutate({ id: skill.id, patch: { enabled: v } })}
              />
            ))}
          </div>
        </div>
      )}

      {linked.length === 0 && unlinked.length === 0 && (
        <EmptyState
          icon="Sparkles"
          title="No skills"
          body={search ? "No matching skills." : "Create skills on the Skills page, then link them here."}
        />
      )}
    </div>
  );
}

function SkillRow({
  skill,
  linked,
  onToggleLink,
  onToggleEnabled,
  onMoveUp,
  onMoveDown,
}: {
  skill: Skill;
  linked: boolean;
  onToggleLink: () => void;
  onToggleEnabled: (v: boolean) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const tc = TYPE_COLORS[skill.type] ?? TYPE_COLORS.custom;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        border: "1px solid var(--border)",
        borderRadius: 7,
        background: linked ? "var(--bg-elevated)" : "var(--bg-base)",
        opacity: skill.enabled ? 1 : 0.6,
      }}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={linked}
        onChange={onToggleLink}
        style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer", flexShrink: 0 }}
      />
      {/* Name + badges */}
      <span className="mono" style={{ fontSize: 13, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {skill.name}
      </span>
      <Badge color={tc.color} bg={tc.bg}>{skill.type}</Badge>
      {/* Enabled toggle */}
      <Toggle on={skill.enabled} onChange={onToggleEnabled} size={13} />
      {/* Order buttons (linked only) */}
      {linked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0 }}>
          <button
            onClick={onMoveUp}
            disabled={!onMoveUp}
            style={{ background: "none", border: "none", padding: 0, cursor: onMoveUp ? "pointer" : "default", color: onMoveUp ? "var(--text-secondary)" : "var(--border)", lineHeight: 1 }}
            aria-label="Move up"
          >
            <Icon.ArrowUp size={12} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={!onMoveDown}
            style={{ background: "none", border: "none", padding: 0, cursor: onMoveDown ? "pointer" : "default", color: onMoveDown ? "var(--text-secondary)" : "var(--border)", lineHeight: 1 }}
            aria-label="Move down"
          >
            <Icon.ArrowDown size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
