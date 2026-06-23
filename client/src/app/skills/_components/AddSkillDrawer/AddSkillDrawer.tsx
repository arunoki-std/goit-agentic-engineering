"use client";

import React from "react";
import { Drawer } from "@devdigest/ui";
import { CreateTab } from "./_components/CreateTab/CreateTab";
import { FileImportTab } from "./_components/FileImportTab/FileImportTab";
import { UrlImportTab } from "./_components/UrlImportTab/UrlImportTab";
import { CommunityTab } from "./_components/CommunityTab/CommunityTab";

const TABS = [
  { key: "create",    label: "Create new" },
  { key: "file",      label: "From file" },
  { key: "url",       label: "From URL" },
  { key: "community", label: "Community" },
];

export function AddSkillDrawer({
  initialTab = "create",
  onClose,
}: {
  initialTab?: "create" | "file" | "url" | "community";
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<string>(initialTab);

  return (
    <Drawer
      width={680}
      title="Add a skill"
      subtitle="Create a new skill or import from a file, URL, or community catalog."
      onClose={onClose}
    >
      {/* Negative margins cancel the Drawer's 24px padding so tab bar goes edge-to-edge */}
      <div style={{ margin: "-24px" }}>
        {/* Tab bar */}
        <div style={{ borderBottom: "1px solid var(--border)", display: "flex", gap: 2, padding: "0 24px" }}>
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: "2px solid " + (active ? "var(--accent)" : "transparent"),
                  marginBottom: -1,
                  padding: "10px 14px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ padding: 24 }}>
          {tab === "create"    && <CreateTab    onDone={onClose} />}
          {tab === "file"      && <FileImportTab onDone={onClose} />}
          {tab === "url"       && <UrlImportTab  onDone={onClose} />}
          {tab === "community" && <CommunityTab  onDone={onClose} />}
        </div>
      </div>
    </Drawer>
  );
}
