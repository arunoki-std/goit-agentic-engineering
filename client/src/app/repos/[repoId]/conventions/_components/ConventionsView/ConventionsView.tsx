"use client";

import React from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import type { ConventionCandidate } from "@devdigest/shared";
import { useConventions, useExtractConventions, useUpdateConvention } from "@/lib/hooks/conventions";

// ---- ConventionRow -------------------------------------------------------

export interface ConventionRowProps {
  candidate: ConventionCandidate;
  onToggle: () => void;
  toggling: boolean;
}

export function ConventionRow({ candidate, onToggle, toggling }: ConventionRowProps) {
  const t = useTranslations("conventions");
  const pct = Math.round(candidate.confidence * 100);

  return (
    <div
      style={{
        padding: "14px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <span
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-primary)",
            lineHeight: 1.4,
          }}
        >
          {candidate.rule}
        </span>
        {candidate.accepted && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-success, #22c55e)",
              background: "color-mix(in srgb, var(--color-success, #22c55e) 12%, transparent)",
              padding: "2px 8px",
              borderRadius: 999,
            }}
          >
            {t("card.accepted")}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>
          {candidate.evidence_path}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {t("card.confidence")}: <strong>{pct}%</strong>
        </span>
      </div>

      {candidate.evidence_snippet && (
        <pre
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--text-secondary)",
            background: "var(--bg-subtle)",
            padding: "6px 10px",
            borderRadius: 4,
            overflowX: "auto",
            maxHeight: 64,
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {candidate.evidence_snippet}
        </pre>
      )}

      {!candidate.accepted && (
        <div style={{ marginTop: 4 }}>
          <Button kind="secondary" size="sm" disabled={toggling} onClick={onToggle}>
            {toggling ? t("card.accepting") : t("card.acceptAsSkill")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---- ConventionsView -----------------------------------------------------

export function ConventionsView() {
  const t = useTranslations("conventions");
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;

  const { data: candidates, isLoading, isError, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbConventions") },
  ];

  return (
    <AppShell crumb={crumb}>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 52px)" }}>
        {/* Toolbar */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
              {t("page.subtitle")}
            </div>
            {candidates && candidates.length > 0 && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                {t("page.candidateCount", { count: candidates.length })}
              </div>
            )}
          </div>
          <Button
            kind="primary"
            size="sm"
            icon="RefreshCw"
            disabled={extract.isPending}
            onClick={() => extract.mutate()}
          >
            {extract.isPending
              ? t("page.scanning")
              : candidates && candidates.length > 0
                ? t("page.rescan")
                : t("page.runExtraction")}
          </Button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {extract.isError && (
            <div style={{ padding: "12px 20px" }}>
              <ErrorState body={t("page.extractionFailed")} onRetry={() => extract.mutate()} />
            </div>
          )}

          {isLoading && (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={96} />
              ))}
            </div>
          )}

          {isError && !isLoading && (
            <div style={{ padding: "16px 20px" }}>
              <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />
            </div>
          )}

          {!isLoading && !isError && (!candidates || candidates.length === 0) && (
            <div style={{ padding: "48px 20px" }}>
              <EmptyState
                icon="ListChecks"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => extract.mutate()}
              />
            </div>
          )}

          {!isLoading && !isError && candidates && candidates.length > 0 && (
            <div>
              {candidates.map((c) => (
                <ConventionRow
                  key={c.id}
                  candidate={c}
                  toggling={update.isPending && update.variables?.id === c.id}
                  onToggle={() => update.mutate({ id: c.id, patch: { accepted: true } })}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
