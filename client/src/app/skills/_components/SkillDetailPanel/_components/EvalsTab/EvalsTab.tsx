"use client";

import React from "react";
import { EmptyState } from "@devdigest/ui";

export function EvalsTab() {
  return (
    <div style={{ padding: "24px 28px" }}>
      <EmptyState
        icon="ListChecks"
        title="Evals coming soon"
        body="Skill-level eval cases will be available in a future lesson."
      />
    </div>
  );
}
