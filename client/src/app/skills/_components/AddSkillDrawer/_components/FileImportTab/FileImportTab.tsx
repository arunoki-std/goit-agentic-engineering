"use client";

import React from "react";
import { Button, Badge } from "@devdigest/ui";
import { useParseImport, useImportSkill } from "@/lib/hooks/skills";

export function FileImportTab({ onDone }: { onDone: () => void }) {
  const parse = useParseImport();
  const importSkill = useImportSkill();
  const [preview, setPreview] = React.useState<{ name: string; body: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500_000) { setError("File too large (>500 KB)"); return; }
    setError(null);
    setPreview(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const result = await parse.mutateAsync({ body: text }).catch((err) => { setError(String(err.message)); return null; });
      if (result) setPreview(result);
    };
    reader.readAsText(file);
  };

  const confirm = async () => {
    if (!preview) return;
    await importSkill.mutateAsync({ body: preview.body, name: preview.name, source: "manual" });
    onDone();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "4px 0" }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
        Upload a <code>.md</code> or <code>.txt</code> file. The first{" "}
        <code># Heading</code> becomes the skill name. Content is stored as-is.
      </p>

      <div>
        <Button kind="secondary" size="sm" icon="Upload" onClick={() => inputRef.current?.click()}>
          Choose file…
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.txt,.markdown"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>

      {error && <p style={{ color: "var(--sev-critical)", fontSize: 13, margin: 0 }}>{error}</p>}

      {parse.isPending && <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Parsing…</p>}

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
            <Badge color="var(--text-muted)">preview</Badge>
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
          <Button kind="secondary" size="sm" onClick={() => { setPreview(null); if (inputRef.current) inputRef.current.value = ""; }}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
