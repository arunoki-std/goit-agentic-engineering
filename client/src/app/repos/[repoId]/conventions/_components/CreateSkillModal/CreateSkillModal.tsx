"use client";

import React from "react";
import {
  Modal,
  Toggle,
  FormField,
  TextInput,
  SelectInput,
  Skeleton,
  Button,
} from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import {
  useConventionSkillPreview,
  useCreateConventionSkill,
} from "@/lib/hooks/conventions";
import { useAgents } from "@/lib/hooks/agents";
import { useToast } from "@/lib/toast";

const TYPE_OPTIONS: { value: SkillType; label: string }[] = [
  { value: "rubric",     label: "rubric" },
  { value: "convention", label: "convention" },
  { value: "security",   label: "security" },
  { value: "custom",     label: "custom" },
];

function approxTokens(text: string) {
  return Math.ceil(text.length / 4);
}

interface Props {
  repoId: string;
  repoName: string;
  acceptedCount: number;
  onClose: () => void;
}

export function CreateSkillModal({ repoId, repoName, acceptedCount, onClose }: Props) {
  const preview = useConventionSkillPreview(repoId);
  const create = useCreateConventionSkill(repoId);
  const { data: agents } = useAgents();
  const toast = useToast();

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("convention");
  const [enabled, setEnabled] = React.useState(true);
  const [body, setBody] = React.useState("");
  const [originalBody, setOriginalBody] = React.useState("");
  const [apiTokenCount, setApiTokenCount] = React.useState<number | null>(null);
  const [agentId, setAgentId] = React.useState("");

  React.useEffect(() => {
    preview.mutate(undefined, {
      onSuccess: (data) => {
        setName(data.name);
        setDescription(data.description);
        setType(data.type);
        setEnabled(data.enabled);
        setBody(data.body);
        setOriginalBody(data.body);
        setApiTokenCount(data.token_count);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tokenCount =
    apiTokenCount !== null && body === originalBody
      ? apiTokenCount
      : approxTokens(body);

  const canSubmit = !!name.trim() && !!body.trim() && !create.isPending;

  const agentOptions = React.useMemo(
    () => [
      { value: "", label: "— no agent —" },
      ...(agents ?? []).map((a) => ({ value: a.id, label: a.name })),
    ],
    [agents],
  );

  const handleCreate = async () => {
    if (!canSubmit) return;
    await create.mutateAsync({
      name: name.trim(),
      description,
      type,
      enabled,
      body,
      agent_id: agentId || undefined,
    });
    const linkedAgent = agentId ? agents?.find((a) => a.id === agentId) : undefined;
    const msg = linkedAgent
      ? `Skill "${name.trim()}" created and linked to agent "${linkedAgent.name}"`
      : `Skill "${name.trim()}" created and added to Skills Lab`;
    toast.success(msg);
    onClose();
  };

  return (
    <Modal
      title="Create skill from conventions"
      subtitle={name || undefined}
      onClose={onClose}
      width={680}
      footer={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ flex: 1, fontSize: 12, color: "var(--text-muted)" }}>
            → Saved as v1 · added to Skills Lab
          </span>
          <Button kind="secondary" size="sm" onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button kind="primary" size="sm" onClick={handleCreate} disabled={!canSubmit}>
            {create.isPending ? "Creating…" : "Create skill"}
          </Button>
        </div>
      }
    >
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Info banner */}
        <div
          style={{
            padding: "10px 14px",
            background: "var(--accent-bg)",
            border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
            borderRadius: 8,
            fontSize: 13,
            color: "var(--text-secondary)",
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ flexShrink: 0, marginTop: 1 }}>⚡</span>
          <span>
            Merged from <strong>{acceptedCount}</strong> accepted conventions in{" "}
            <strong>{repoName}</strong>. Everything below is editable before you save.
          </span>
        </div>

        {preview.isPending ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={40} />
            <Skeleton height={200} />
          </div>
        ) : (
          <>
            <FormField label="Name" required>
              <TextInput
                value={name}
                onChange={setName}
                placeholder="my-repo-conventions"
              />
            </FormField>

            <FormField label="Description">
              <TextInput
                value={description}
                onChange={setDescription}
                placeholder="Convention rules extracted from…"
              />
            </FormField>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <FormField label="Type">
                  <SelectInput
                    value={type}
                    onChange={(v) => setType(v as SkillType)}
                    options={TYPE_OPTIONS}
                  />
                </FormField>
              </div>
              <div>
                <FormField label="Enabled">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                    <Toggle on={enabled} onChange={setEnabled} />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      Whether this block is added to agents&apos; prompts.
                    </span>
                  </div>
                </FormField>
              </div>
            </div>

            <FormField label="Link to agent">
              <SelectInput
                value={agentId}
                onChange={setAgentId}
                options={agentOptions}
                mono={false}
              />
            </FormField>

            <FormField label="Skill body" required>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "var(--bg-base)",
                }}
              >
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
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span style={{ opacity: 0.5 }}>□</span>
                    <span className="mono">{name || "skill"}.md</span>
                  </span>
                  {body !== originalBody && (
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
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  spellCheck={false}
                  style={{
                    width: "100%",
                    minHeight: 240,
                    padding: "14px",
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
            </FormField>
          </>
        )}
      </div>
    </Modal>
  );
}
