"use client";

import React from "react";
import { FormField, TextInput, SelectInput, Button, Badge } from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";

const TYPE_OPTIONS: { value: SkillType; label: string }[] = [
  { value: "rubric",     label: "rubric" },
  { value: "convention", label: "convention" },
  { value: "security",   label: "security" },
  { value: "custom",     label: "custom" },
];

function approxTokens(text: string) {
  return Math.ceil(text.length / 4);
}

export function ConfigTab({ skill }: { skill: Skill }) {
  const update = useUpdateSkill();
  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [body, setBody] = React.useState(skill.body);

  React.useEffect(() => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setBody(skill.body);
  }, [skill.id]);

  const dirty = name !== skill.name || description !== skill.description || type !== skill.type || body !== skill.body;
  const tokenCount = skill.token_count != null && !dirty
    ? skill.token_count
    : approxTokens(body);

  const save = () => {
    if (!dirty) return;
    update.mutate({ id: skill.id, patch: { name, description, type, body } });
  };

  return (
    <div style={{ padding: "24px 28px", maxWidth: 860 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Configuration</h2>
        <Badge color="var(--text-muted)" mono icon="GitBranch">
          v{skill.version}
        </Badge>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FormField label="Name" required>
          <TextInput value={name} onChange={setName} placeholder="pr-quality-rubric" />
        </FormField>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FormField
          label="Description"
          hint="Interface of the skill — write as a directive ('Flag any…', 'Report if…')"
        >
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder="Rubric for evaluating overall PR quality…"
          />
        </FormField>
      </div>

      <div style={{ marginBottom: 18 }}>
        <FormField label="Type">
          <SelectInput
            value={type}
            onChange={(v) => setType(v as SkillType)}
            options={TYPE_OPTIONS}
          />
        </FormField>
      </div>

      <div style={{ marginBottom: 20 }}>
        <FormField label="Skill body" required>
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            background: "var(--bg-base)",
          }}
        >
          {/* Editor header bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-elevated)",
              fontSize: 12,
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)" }}>
              <span style={{ opacity: 0.5 }}>□</span>
              <span className="mono">{name || "skill"}.md</span>
            </span>
            {dirty && (
              <span
                style={{
                  fontSize: 11,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "var(--bg-hover)",
                  color: "var(--text-muted)",
                }}
              >
                unsaved
              </span>
            )}
            <span style={{ marginLeft: "auto", color: "var(--text-muted)", fontSize: 11 }}>
              {tokenCount} tokens
            </span>
          </div>
          {/* Textarea */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            spellCheck={false}
            style={{
              width: "100%",
              minHeight: 320,
              padding: "14px 14px 14px 14px",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 13,
              lineHeight: 1.6,
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "vertical",
              color: "var(--text-primary)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 5 }}>
          Saving a changed body creates a new immutable version.
        </div>
      </FormField>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Button
          kind="primary"
          size="sm"
          onClick={save}
          disabled={!dirty || update.isPending}
        >
          {update.isPending ? "Saving…" : "Save"}
        </Button>
        {dirty && (
          <Button
            kind="secondary"
            size="sm"
            onClick={() => { setName(skill.name); setDescription(skill.description); setType(skill.type); setBody(skill.body); }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
