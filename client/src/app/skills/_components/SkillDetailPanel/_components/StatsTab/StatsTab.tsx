"use client";

import React from "react";
import { EmptyState } from "@devdigest/ui";

export function StatsTab() {
  return (
    <div style={{ padding: "24px 28px" }}>
      <EmptyState
        icon="BarChart"
        title="Stats coming soon"
        body="Skill usage and acceptance metrics will be available in a future lesson."
      />
    </div>
  );
}
