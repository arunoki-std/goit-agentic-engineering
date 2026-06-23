"use client";

import React from "react";
import { Markdown } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";

export function PreviewTab({ skill }: { skill: Skill }) {
  return (
    <div style={{ padding: "24px 28px" }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Preview</h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, marginTop: 0 }}>
        Rendered as the reviewing agent receives it.
      </p>
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "24px 28px",
          fontSize: 14,
          lineHeight: 1.7,
          color: "var(--text-primary)",
        }}
      >
        <Markdown>{skill.body}</Markdown>
      </div>
    </div>
  );
}
