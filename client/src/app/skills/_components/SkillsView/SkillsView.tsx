"use client";

import React from "react";
import { Button, Dropdown, EmptyState, ErrorState, Icon, Skeleton } from "@devdigest/ui";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillDetailPanel } from "../SkillDetailPanel";
import { AddSkillDrawer } from "../AddSkillDrawer";

type DrawerMode = "create" | "file" | "url" | "community" | null;

const ADD_ITEMS = [
  { key: "create",    label: "Create new",   icon: "Plus"      as const },
  { key: "file",      label: "From file",    icon: "Upload"    as const },
  { key: "url",       label: "From URL",     icon: "Link"      as const },
  { key: "community", label: "Community",    icon: "Sparkles"  as const },
];

export function SkillsView() {
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [drawerMode, setDrawerMode] = React.useState<DrawerMode>(null);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(() => {
    if (!skills) return [];
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.type.includes(q)
    );
  }, [skills, search]);

  const selectedSkill = skills?.find((s) => s.id === selectedId) ?? null;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left panel */}
      <div
        style={{
          width: 320,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: "14px 16px 10px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <Icon.Search
              size={13}
              style={{
                position: "absolute",
                left: 8,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search skills…"
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
          <Dropdown
            align="right"
            width={180}
            trigger={
              <Button kind="primary" size="sm" icon="Plus">
                Add
              </Button>
            }
            items={ADD_ITEMS.map((it) => ({
              label: it.label,
              icon: it.icon,
              onClick: () => setDrawerMode(it.key as DrawerMode),
            }))}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px" }}>
          {isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={96} />
              ))}
            </div>
          )}
          {isError && (
            <ErrorState body="Could not load skills." onRetry={() => refetch()} />
          )}
          {!isLoading && !isError && filtered.length === 0 && (
            <EmptyState
              icon="Sparkles"
              title={search ? "No matching skills" : "No skills yet"}
              body={search ? "Try a different search term." : "Create or import your first skill."}
              cta={!search ? "Add skill" : undefined}
              onCta={() => setDrawerMode("create")}
            />
          )}
          {filtered.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              active={skill.id === selectedId}
              onClick={() => setSelectedId(skill.id)}
              onToggle={(enabled) =>
                update.mutate({ id: skill.id, patch: { enabled } })
              }
            />
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {selectedSkill ? (
          <SkillDetailPanel skill={selectedSkill} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--text-muted)",
            }}
          >
            <EmptyState
              icon="Sparkles"
              title="Select a skill"
              body="Pick a skill from the list to view or edit its configuration."
            />
          </div>
        )}
      </div>

      {/* Add drawer */}
      {drawerMode && (
        <AddSkillDrawer
          initialTab={drawerMode}
          onClose={() => setDrawerMode(null)}
        />
      )}
    </div>
  );
}
