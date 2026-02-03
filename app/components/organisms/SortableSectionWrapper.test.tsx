import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DndContext } from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { SortableSectionWrapper } from "./SortableSectionWrapper";

describe("SortableSectionWrapper", () => {
  const renderWithDnd = (ui: React.ReactElement) => {
    return render(
      <DndContext>
        <SortableContext items={["test-section"]}>
          {ui}
        </SortableContext>
      </DndContext>
    );
  };

  it("should render section with title", () => {
    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should show drag indicator icon", () => {
    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    // Check for drag indicator (using text content from MaterialIcon)
    expect(screen.getByText("drag_indicator")).toBeInTheDocument();
  });

  it("should be expanded by default", () => {
    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    // Content should be visible
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Should show collapse icon (expand_less)
    expect(screen.getByText("expand_less")).toBeInTheDocument();
  });

  it("should collapse when clicking expand/collapse button", async () => {
    const user = userEvent.setup();

    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    // Initially expanded
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Click collapse button
    const collapseButton = screen.getByLabelText("Collapse section");
    await user.click(collapseButton);

    // Content should be hidden
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // Should show expand icon (expand_more)
    expect(screen.getByText("expand_more")).toBeInTheDocument();
  });

  it("should expand when clicking expand button", async () => {
    const user = userEvent.setup();

    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    // Click collapse button
    const collapseButton = screen.getByLabelText("Collapse section");
    await user.click(collapseButton);

    // Content hidden
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // Click expand button
    const expandButton = screen.getByLabelText("Expand section");
    await user.click(expandButton);

    // Content should be visible again
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("should toggle multiple times", async () => {
    const user = userEvent.setup();

    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    // Toggle collapse
    await user.click(screen.getByLabelText("Collapse section"));
    expect(screen.queryByText("Content")).not.toBeInTheDocument();

    // Toggle expand
    await user.click(screen.getByLabelText("Expand section"));
    expect(screen.getByText("Content")).toBeInTheDocument();

    // Toggle collapse again
    await user.click(screen.getByLabelText("Collapse section"));
    expect(screen.queryByText("Content")).not.toBeInTheDocument();
  });

  it("should render children inside padding container when expanded", () => {
    const { container } = renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div data-testid="child-content">Content</div>
      </SortableSectionWrapper>
    );

    const childContent = screen.getByTestId("child-content");
    const paddingContainer = childContent.parentElement;

    // Should have padding classes
    expect(paddingContainer).toHaveClass("px-5");
    expect(paddingContainer).toHaveClass("py-5");
  });

  it("should have hover effects on collapse/expand button", () => {
    renderWithDnd(
      <SortableSectionWrapper id="test-section" title="Test Section">
        <div>Content</div>
      </SortableSectionWrapper>
    );

    const button = screen.getByLabelText("Collapse section");

    // Check for hover class
    expect(button).toHaveClass("hover:bg-gray-100");
  });
});
