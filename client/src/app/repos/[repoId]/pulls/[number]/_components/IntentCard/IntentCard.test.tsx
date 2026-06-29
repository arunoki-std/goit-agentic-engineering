import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { PrIntentRecord } from "@devdigest/shared";

vi.mock("../../../../../../../lib/hooks/reviews", () => ({
  usePrIntent: vi.fn(),
  useRecalcIntent: vi.fn(),
}));

import { IntentCard } from "./IntentCard";
import * as reviewHooks from "../../../../../../../lib/hooks/reviews";

afterEach(cleanup);

const RECORD: PrIntentRecord = {
  pr_id: "pr-1",
  intent: "This PR adds intent analysis to the PR detail view.",
  in_scope: ["Frontend hook", "IntentCard component"],
  out_of_scope: ["Database schema changes", "Backend service logic"],
};

function mockHooks({
  isLoading = false,
  data = undefined as PrIntentRecord | null | undefined,
  isPending = false,
} = {}) {
  vi.mocked(reviewHooks.usePrIntent).mockReturnValue({
    isLoading,
    data,
  } as ReturnType<typeof reviewHooks.usePrIntent>);
  vi.mocked(reviewHooks.useRecalcIntent).mockReturnValue({
    mutate: vi.fn(),
    isPending,
  } as unknown as ReturnType<typeof reviewHooks.useRecalcIntent>);
}

describe("IntentCard", () => {
  it("renders skeleton while loading", () => {
    mockHooks({ isLoading: true, data: undefined });
    const { container } = render(<IntentCard prId="pr-1" />);
    // Skeletons render as .skeleton divs — no section labels visible yet
    expect(screen.queryByText("Intent Analysis")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
  });

  it("shows empty state when data is null", () => {
    mockHooks({ isLoading: false, data: null });
    render(<IntentCard prId="pr-1" />);
    expect(screen.getByText("No intent analyzed yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Analyze intent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Recalculate/i })).toBeInTheDocument();
  });

  it("renders intent summary and scope lists when data is present", () => {
    mockHooks({ isLoading: false, data: RECORD });
    render(<IntentCard prId="pr-1" />);
    expect(
      screen.getByText("This PR adds intent analysis to the PR detail view."),
    ).toBeInTheDocument();
    expect(screen.getByText("Frontend hook")).toBeInTheDocument();
    expect(screen.getByText("IntentCard component")).toBeInTheDocument();
    expect(screen.getByText("Database schema changes")).toBeInTheDocument();
    expect(screen.getByText("Backend service logic")).toBeInTheDocument();
  });

  it("shows Recalculate button in data state", () => {
    mockHooks({ isLoading: false, data: RECORD });
    render(<IntentCard prId="pr-1" />);
    expect(screen.getByRole("button", { name: /Recalculate/i })).toBeInTheDocument();
  });

  it("Recalculate button is disabled while mutation is pending", () => {
    mockHooks({ isLoading: false, data: RECORD, isPending: true });
    render(<IntentCard prId="pr-1" />);
    const btn = screen.getByRole("button", { name: /Recalculate/i });
    expect(btn).toBeDisabled();
  });
});
