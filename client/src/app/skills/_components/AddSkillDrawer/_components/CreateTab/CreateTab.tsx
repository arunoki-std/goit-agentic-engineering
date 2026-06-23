"use client";

import React from "react";
import { FormField, TextInput, SelectInput, Textarea, Button } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useCreateSkill } from "@/lib/hooks/skills";

const TYPE_OPTIONS: { value: SkillType; label: string }[] = [
  { value: "rubric",     label: "rubric" },
  { value: "convention", label: "convention" },
  { value: "security",   label: "security" },
  { value: "custom",     label: "custom" },
];

export function CreateTab({ onDone }: { onDone: () => void }) {
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("custom");
  const [body, setBody] = React.useState("");

  const submit = async () => {
    if (!name.trim() || !body.trim()) return;
    await create.mutateAsync({ name: name.trim(), description, type, body });
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
      <FormField label="Name" required>
        <TextInput
          value={name}
          onChange={setName}
          placeholder="pr-quality-rubric"
        />
      </FormField>
      <FormField label="Description" hint="Interface of the skill — write as a directive ('Flag any…', 'Report if…')">
        <TextInput
          value={description}
          onChange={setDescription}
          placeholder="Rubric for evaluating overall PR quality…"
        />
      </FormField>
      <FormField label="Type">
        <SelectInput
          value={type}
          onChange={(v) => setType(v as SkillType)}
          options={TYPE_OPTIONS}
        />
      </FormField>
      <FormField label="Skill body" required>
        <Textarea
          value={body}
          onChange={setBody}
          placeholder={"# Rule Name\n\nDescribe the rule as a directive…"}
          mono
          rows={12}
        />
      </FormField>
      <div style={{ display: "flex", gap: 10 }}>
        <Button kind="primary" size="sm" onClick={submit} disabled={!name.trim() || !body.trim() || create.isPending}>
          {create.isPending ? "Creating…" : "Create skill"}
        </Button>
        <Button kind="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  );
}
