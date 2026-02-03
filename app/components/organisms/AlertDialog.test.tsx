import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertDialog } from "./AlertDialog";

describe("AlertDialog", () => {
  it("should not render when isOpen is false", () => {
    render(
      <AlertDialog
        isOpen={false}
        onClose={() => {}}
        title="Test"
        message="Test message"
      />
    );
    expect(screen.queryByText("Test")).not.toBeInTheDocument();
  });

  it("should render title and message when open", () => {
    render(
      <AlertDialog
        isOpen={true}
        onClose={() => {}}
        title="Alert Title"
        message="Alert message content"
      />
    );
    expect(screen.getByText("Alert Title")).toBeInTheDocument();
    expect(screen.getByText("Alert message content")).toBeInTheDocument();
  });

  it("should call onClose when OK button is clicked", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(
      <AlertDialog
        isOpen={true}
        onClose={onClose}
        title="Test"
        message="Test"
      />
    );

    await user.click(screen.getByText("OK"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should show appropriate icon for error variant", () => {
    const { container } = render(
      <AlertDialog
        isOpen={true}
        onClose={() => {}}
        title="Error"
        message="Error message"
        variant="error"
      />
    );
    const icon = container.querySelector(".text-red-600");
    expect(icon).toBeInTheDocument();
  });

  it("should show appropriate icon for success variant", () => {
    const { container } = render(
      <AlertDialog
        isOpen={true}
        onClose={() => {}}
        title="Success"
        message="Success message"
        variant="success"
      />
    );
    const icon = container.querySelector(".text-green-600");
    expect(icon).toBeInTheDocument();
  });

  it("should show appropriate icon for warning variant", () => {
    const { container } = render(
      <AlertDialog
        isOpen={true}
        onClose={() => {}}
        title="Warning"
        message="Warning message"
        variant="warning"
      />
    );
    const icon = container.querySelector(".text-orange-600");
    expect(icon).toBeInTheDocument();
  });

  it("should show appropriate icon for info variant by default", () => {
    const { container } = render(
      <AlertDialog
        isOpen={true}
        onClose={() => {}}
        title="Info"
        message="Info message"
      />
    );
    const icon = container.querySelector(".text-blue-600");
    expect(icon).toBeInTheDocument();
  });
});
