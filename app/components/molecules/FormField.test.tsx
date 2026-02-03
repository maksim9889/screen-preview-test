import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormField } from "./FormField";

describe("FormField", () => {
  it("should render label", () => {
    render(<FormField label="Test Label" value="" onChange={() => {}} />);
    expect(screen.getByText("Test Label")).toBeInTheDocument();
  });

  it("should render input by default", () => {
    render(<FormField label="Test" value="test value" onChange={() => {}} />);
    const input = screen.getByDisplayValue("test value");
    expect(input.tagName).toBe("INPUT");
  });

  it("should render textarea when fieldType is textarea", () => {
    render(
      <FormField
        label="Test"
        fieldType="textarea"
        value="test value"
        onChange={() => {}}
      />
    );
    const textarea = screen.getByDisplayValue("test value");
    expect(textarea.tagName).toBe("TEXTAREA");
  });

  it("should call onChange when value changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<FormField label="Test" value="" onChange={onChange} />);
    const input = screen.getByRole("textbox");

    await user.type(input, "new value");

    expect(onChange).toHaveBeenCalled();
  });

  it("should show error message when error prop is provided", () => {
    render(
      <FormField
        label="Test"
        value=""
        onChange={() => {}}
        error="This field is required"
      />
    );
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("should apply error styles when error exists", () => {
    render(
      <FormField
        label="Test"
        value=""
        onChange={() => {}}
        error="Error"
      />
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-red-400");
  });

  it("should show required indicator when required is true", () => {
    render(
      <FormField label="Test" value="" onChange={() => {}} required />
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("should apply placeholder", () => {
    render(
      <FormField
        label="Test"
        value=""
        onChange={() => {}}
        placeholder="Enter text"
      />
    );
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });

  it("should set autoFocus when prop is true", () => {
    render(
      <FormField label="Test" value="" onChange={() => {}} autoFocus />
    );
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
  });

  it("should apply different input sizes", () => {
    const { rerender } = render(
      <FormField label="Test" value="" onChange={() => {}} inputSize="sm" />
    );
    let input = screen.getByRole("textbox");
    expect(input).toHaveClass("text-xs");

    rerender(
      <FormField label="Test" value="" onChange={() => {}} inputSize="lg" />
    );
    input = screen.getByRole("textbox");
    expect(input).toHaveClass("text-base");
  });
});
