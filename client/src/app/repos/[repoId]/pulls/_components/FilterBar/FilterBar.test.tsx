import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/prReview.json";
import { FilterBar } from "./FilterBar";

afterEach(cleanup);

function renderFilterBar(overrides: Partial<Parameters<typeof FilterBar>[0]> = {}) {
  const props = {
    active: "needs_review",
    onActive: vi.fn(),
    query: "",
    onQuery: vi.fn(),
    sort: "newest",
    onSort: vi.fn(),
    onRefresh: vi.fn(),
    refreshing: false,
    ...overrides,
  };
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FilterBar {...props} />
    </NextIntlClientProvider>,
  );
}

describe("FilterBar", () => {
  it("renders filter chips and search input", () => {
    renderFilterBar();
    expect(screen.getByPlaceholderText("Filter pull requests…")).toBeInTheDocument();
    expect(screen.getByText("Needs review")).toBeInTheDocument();
    expect(screen.getByText("All")).toBeInTheDocument();
  });

  it("calls onActive when a chip is clicked", () => {
    const onActive = vi.fn();
    renderFilterBar({ onActive });
    fireEvent.click(screen.getByText("All"));
    expect(onActive).toHaveBeenCalledWith("all");
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    renderFilterBar({ onRefresh });
    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("disables the refresh button while refreshing", () => {
    renderFilterBar({ refreshing: true });
    expect(screen.getByRole("button", { name: /refreshing/i })).toBeDisabled();
  });
});
