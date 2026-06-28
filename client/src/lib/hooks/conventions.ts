/* hooks/conventions.ts — React Query hooks for the Conventions module. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate, Skill, SkillType } from "@devdigest/shared";

export interface ConventionSkillPreview {
  name: string;
  description: string;
  type: "convention";
  enabled: true;
  body: string;
  token_count: number;
}

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  type: SkillType;
  enabled: boolean;
  body: string;
  agent_id?: string;
}

const conventionsKey = (repoId: string) => ["conventions", repoId] as const;

export function useConventions(repoId: string) {
  return useQuery({
    queryKey: conventionsKey(repoId),
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionCandidate[]>(`/repos/${repoId}/conventions/extract`),
    onSuccess: () => qc.invalidateQueries({ queryKey: conventionsKey(repoId) }),
  });
}

export function useUpdateConvention(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { accepted?: boolean; rule?: string } }) =>
      api.patch<ConventionCandidate>(`/repos/${repoId}/conventions/${id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: conventionsKey(repoId) }),
  });
}

export function useConventionSkillPreview(repoId: string) {
  return useMutation({
    mutationFn: (candidateIds?: string[]) =>
      api.post<ConventionSkillPreview>(`/repos/${repoId}/conventions/skill-preview`, {
        candidate_ids: candidateIds,
      }),
  });
}

export function useCreateConventionSkill(repoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conventionsKey(repoId) });
      qc.invalidateQueries({ queryKey: ["skills"] });
    },
  });
}
