/* hooks/skills.ts — React Query hooks for the A1 Skills module. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  Skill,
  SkillType,
  SkillSource,
  CommunitySkill,
  AgentSkillLink,
} from "@devdigest/shared";

// ---- Skill CRUD ----

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export interface SkillVersion {
  skill_id: string;
  version: number;
  body: string;
  created_at: string;
  token_count: number;
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

export interface CreateSkillInput {
  name: string;
  description?: string;
  type: SkillType;
  body: string;
  enabled?: boolean;
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">>;
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
    },
  });
}

// ---- Import ----

export interface ParseImportResult {
  name: string;
  body: string;
}

export function useParseImport() {
  return useMutation({
    mutationFn: (input: { body: string; name?: string }) =>
      api.post<ParseImportResult>("/skills/parse-import", input),
  });
}

export function useParseUrl() {
  return useMutation({
    mutationFn: (url: string) =>
      api.post<ParseImportResult>("/skills/import-url", { url }),
  });
}

export interface ImportSkillInput {
  body: string;
  name?: string;
  source: SkillSource;
  description?: string;
  type?: SkillType;
}

export function useImportSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportSkillInput) => api.post<Skill>("/skills/import", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

// ---- Community catalog ----

export function useCommunitySkills(q?: string) {
  return useQuery({
    queryKey: ["skills-community", q ?? ""],
    queryFn: () =>
      api.get<CommunitySkill[]>(`/skills/community${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    staleTime: 5 * 60_000,
  });
}

// ---- Agent skill links ----

export function useAgentSkillLinks(agentId: string | null | undefined) {
  return useQuery({
    queryKey: ["agent-skills", agentId],
    queryFn: () => api.get<AgentSkillLink[]>(`/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export function useSetAgentSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, skillIds }: { agentId: string; skillIds: string[] }) =>
      api.post<AgentSkillLink[]>(`/agents/${agentId}/skills`, { skill_ids: skillIds }),
    onSuccess: (_d, { agentId }) => {
      qc.invalidateQueries({ queryKey: ["agent-skills", agentId] });
    },
  });
}
