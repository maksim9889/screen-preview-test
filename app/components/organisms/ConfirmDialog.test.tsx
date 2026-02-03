import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  it("should not render when isOpen is false", () => {
    render(
      <ConfirmDialog
        isOpen={false}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Test"
        message="Test message"
      />
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("should render title and message when open", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Confirm Action"
        message="Are you sure?"
      />
    );
    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("should call onConfirm when confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={onConfirm}
        title="Test"
        message="Test"
      />
    );

    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("should call onClose when cancel button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        onClose={onClose}
        onConfirm={() => {}}
        title="Test"
        message="Test"
      />
    );

    await user.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should show custom button labels", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Test"
        message="Test"
        confirmLabel="Yes, delete"
        cancelLabel="No, keep it"
      />
    );
    expect(screen.getByText("Yes, delete")).toBeInTheDocument();
    expect(screen.getByText("No, keep it")).toBeInTheDocument();
  });

  it("should disable buttons when isProcessing is true", () => {
    render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Test"
        message="Test"
        isProcessing={true}
      />
    );
    expect(screen.getByText("Processing...")).toBeDisabled();
    expect(screen.getByText("Cancel")).toBeDisabled();
  });

  it("should show appropriate icon for danger variant", () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Delete"
        message="Delete item?"
        variant="danger"
      />
    );
    const icon = container.querySelector(".text-red-600");
    expect(icon).toBeInTheDocument();
  });

  it("should show appropriate icon for warning variant", () => {
    const { container } = render(
      <ConfirmDialog
        isOpen={true}
        onClose={() => {}}
        onConfirm={() => {}}
        title="Warning"
        message="Proceed?"
        variant="warning"
      />
    );
    const icon = container.querySelector(".text-orange-600");
    expect(icon).toBeInTheDocument();
  });
});
