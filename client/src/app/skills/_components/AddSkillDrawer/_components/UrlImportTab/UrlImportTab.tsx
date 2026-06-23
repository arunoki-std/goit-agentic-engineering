"use client";

import React from "react";
import { FormField, TextInput, Button, Badge } from "@devdigest/ui";
import { useParseUrl, useImportSkill } from "@/lib/hooks/skills";

export function UrlImportTab({ onDone }: { onDone: () => void }) {
  const parseUrl = useParseUrl();
  const importSkill = useImportSkill();
  const [url, setUrl] = React.useState("");
  const [preview, setPreview] = React.useState<{ name: string; body: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetch = async () => {
    if (!url.trim()) return;
    setError(null);
    setPreview(null);
    const result = await parseUrl.mutateAsync(url.trim()).catch((err) => { setError(String(err.message)); return null; });
    if (result) setPreview(result);
  };

  const confirm = async () => {
    if (!preview) return;
    await importSkill.mutateAsync({ body: preview.body, name: preview.name, source: "imported_url" });
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
        The URL is fetched server-side and stored as data. Imported skills start{" "}
        <strong>disabled</strong> — vet before enabling.
      </p>

      <FormField label="Skill URL" hint="Only https:// — fetched server-side, up to 100 KB">
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <TextInput
              value={url}
              onChange={setUrl}
              placeholder="https://example.com/skills/security.md"
            />
          </div>
          <Button
            kind="secondary"
            size="sm"
            onClick={fetch}
            disabled={!url.trim() || parseUrl.isPending}
          >
            {parseUrl.isPending ? "Fetching…" : "Fetch"}
          </Button>
        </div>
      </FormField>

      {error && <p style={{ color: "var(--sev-critical)", fontSize: 13, margin: 0 }}>{error}</p>}

      {preview && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 16,
            background: "var(--bg-elevated)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{preview.name}</span>
            <Badge color="var(--sev-warning)" bg="#e09a0014">untrusted source</Badge>
          </div>
          <pre
            style={{
              margin: 0,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              color: "var(--text-secondary)",
              maxHeight: 200,
              overflow: "auto",
            }}
          >
            {preview.body.slice(0, 600)}{preview.body.length > 600 ? "\n…" : ""}
          </pre>
        </div>
      )}

      {preview && (
        <div style={{ display: "flex", gap: 10 }}>
          <Button kind="primary" size="sm" onClick={confirm} disabled={importSkill.isPending}>
            {importSkill.isPending ? "Importing…" : "Import skill"}
          </Button>
          <Button kind="secondary" size="sm" onClick={() => { setPreview(null); setUrl(""); }}>Clear</Button>
        </div>
      )}
    </div>
  );
}
