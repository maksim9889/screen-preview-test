import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal } from "./Modal";

describe("Modal", () => {
  it("should not render when isOpen is false", () => {
    render(
      <Modal isOpen={false} onClose={() => {}} title="Test">
        <div>Content</div>
      </Modal>
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("should render when isOpen is true", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test Modal">
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.getByText("Test Modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Content")).toBeInTheDocument();
  });

  it("should call onClose when backdrop is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <div>Content</div>
      </Modal>
    );

    const backdrop = screen.getByText("Content").parentElement?.parentElement;
    if (backdrop) {
      await user.click(backdrop);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("should not call onClose when modal content is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <div>Content</div>
      </Modal>
    );

    await user.click(screen.getByText("Content"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("should show close button by default", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test">
        <div>Content</div>
      </Modal>
    );
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("should hide close button when showCloseButton is false", () => {
    render(
      <Modal isOpen={true} onClose={() => {}} title="Test" showCloseButton={false}>
        <div>Content</div>
      </Modal>
    );
    expect(screen.queryByLabelText("Close")).not.toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={onClose} title="Test">
        <div>Content</div>
      </Modal>
    );

    await user.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("should apply correct maxWidth classes", () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={() => {}} title="Test" maxWidth="sm">
        <div>Content</div>
      </Modal>
    );
    let modal = screen.getByText("Content").parentElement;
    expect(modal).toHaveClass("max-w-sm");

    rerender(
      <Modal isOpen={true} onClose={() => {}} title="Test" maxWidth="lg">
        <div>Content</div>
      </Modal>
    );
    modal = screen.getByText("Content").parentElement;
    expect(modal).toHaveClass("max-w-lg");
  });
});
