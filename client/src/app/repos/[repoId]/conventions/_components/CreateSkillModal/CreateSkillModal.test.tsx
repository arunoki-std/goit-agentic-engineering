import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreateSkillModal } from "./CreateSkillModal";

const mockMutateAsync = vi.fn().mockResolvedValue({ id: "skill-1" });

vi.mock("@/lib/hooks/conventions", () => ({
  useConventionSkillPreview: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useCreateConventionSkill: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
}));

vi.mock("@/lib/hooks/agents", () => ({
  useAgents: () => ({
    data: [
      { id: "agent-1", name: "PR Reviewer" },
      { id: "agent-2", name: "Security Agent" },
    ],
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

  it("shows link-to-agent select with no-agent default option", () => {
    renderModal();
    const select = screen.getByDisplayValue("— no agent —");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "PR Reviewer" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Security Agent" })).toBeInTheDocument();
  });

  it("passes agent_id when agent selected and skill created", async () => {
    mockMutateAsync.mockResolvedValue({ id: "skill-1" });
    renderModal();

    // Fill required fields so the button becomes enabled
    const nameInput = screen.getByPlaceholderText("my-repo-conventions");
    fireEvent.change(nameInput, { target: { value: "test-conventions" } });

    const bodyArea = document.querySelector("textarea")!;
    fireEvent.change(bodyArea, { target: { value: "# Rules\n- Use const" } });

    // Select an agent
    const select = screen.getByDisplayValue("— no agent —");
    fireEvent.change(select, { target: { value: "agent-1" } });

    fireEvent.click(screen.getByRole("button", { name: "Create skill" }));

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ agent_id: "agent-1" }),
      ),
    );
  });
});
