import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateSkillModal } from "./CreateSkillModal";

vi.mock("@/lib/hooks/conventions", () => ({
  useConventionSkillPreview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCreateConventionSkill: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

vi.mock("@/lib/toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

afterEach(cleanup);

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CreateSkillModal
        repoId="repo-1"
        repoName="payments-api"
        acceptedCount={3}
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
}

describe("CreateSkillModal", () => {
  it("renders modal title", () => {
    renderModal();
    expect(screen.getByText("Create skill from conventions")).toBeInTheDocument();
  });

  it("shows info banner with accepted count and repo name", () => {
    renderModal();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("payments-api")).toBeInTheDocument();
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables Create skill button when name and body are empty", () => {
    renderModal();
    expect(screen.getByRole("button", { name: "Create skill" })).toBeDisabled();
  });
});
