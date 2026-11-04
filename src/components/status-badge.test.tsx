import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/status-badge";

describe("StatusBadge", () => {
  it("renders the russian label", () => {
    render(<StatusBadge status="in_progress" />);
    expect(screen.getByText("В работе")).toBeInTheDocument();
  });
});
