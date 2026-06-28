import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/conventions.json";
import { ConventionRow } from "./ConventionsView";

afterEach(cleanup);

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  rule: "Always use const for immutable bindings",
  evidence_path: "src/utils.ts",
  evidence_snippet: "const x = 1;",
  confidence: 0.92,
  accepted: false,
};

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("ConventionRow (smoke)", () => {
  it("renders rule text, evidence path, and confidence percentage", () => {
    renderWithProviders(
      <ConventionRow candidate={CANDIDATE} onToggle={() => {}} toggling={false} />,
    );
    expect(screen.getByText("Always use const for immutable bindings")).toBeInTheDocument();
    expect(screen.getByText("src/utils.ts")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
  });

  it("shows the evidence snippet", () => {
    renderWithProviders(
      <ConventionRow candidate={CANDIDATE} onToggle={() => {}} toggling={false} />,
    );
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("shows Accept button for unaccepted candidates", () => {
    renderWithProviders(
      <ConventionRow candidate={CANDIDATE} onToggle={() => {}} toggling={false} />,
    );
    expect(screen.getByRole("button", { name: /accept as skill/i })).toBeInTheDocument();
  });

  it("shows accepted badge and hides Accept button for accepted candidates", () => {
    renderWithProviders(
      <ConventionRow candidate={{ ...CANDIDATE, accepted: true }} onToggle={() => {}} toggling={false} />,
    );
    expect(screen.getByText("Accepted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept as skill/i })).toBeNull();
  });

  it("disables the button while toggling", () => {
    renderWithProviders(
      <ConventionRow candidate={CANDIDATE} onToggle={() => {}} toggling={true} />,
    );
    expect(screen.getByRole("button", { name: /accepting/i })).toBeDisabled();
  });
});
