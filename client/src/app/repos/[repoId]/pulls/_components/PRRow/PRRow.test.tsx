import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(cleanup);

const BASE_PR: PrMeta = {
  id: "pr-1",
  number: 42,
  title: "Fix auth token expiry",
  author: "alice",
  branch: "fix/auth",
  base: "main",
  head_sha: "abc123",
  additions: 30,
  deletions: 10,
  files_count: 3,
  status: "needs_review",
  opened_at: "2026-06-01T12:00:00Z",
  updated_at: "2026-06-02T10:00:00Z",
  score: null,
  total_cost_usd: null,
  findings_summary: null,
};

function renderPRRow(pr: PrMeta = BASE_PR) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={pr} repoId="repo-1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow", () => {
  it("renders PR title and number", () => {
    renderPRRow();
    expect(screen.getByText("Fix auth token expiry")).toBeInTheDocument();
    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("renders author name", () => {
    renderPRRow();
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("renders score when reviewed", () => {
    renderPRRow({
      ...BASE_PR,
      score: 72,
      findings_summary: { CRITICAL: 1, WARNING: 2, SUGGESTION: 3 },
    });
    expect(screen.getByText("72")).toBeInTheDocument();
  });
});
