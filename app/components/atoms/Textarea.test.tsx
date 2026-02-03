import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./Textarea";

describe("Textarea", () => {
  it("renders textarea element", () => {
    render(<Textarea />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("applies base styling classes", () => {
    render(<Textarea />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("w-full");
    expect(textarea).toHaveClass("px-2");
    expect(textarea).toHaveClass("py-1.5");
    expect(textarea).toHaveClass("border");
    expect(textarea).toHaveClass("rounded");
    expect(textarea).toHaveClass("resize-y");
  });

  it("applies normal border styling when no error", () => {
    render(<Textarea />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("border-gray-300");
  });

  it("applies error styling when error prop is true", () => {
    render(<Textarea error={true} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("border-red-400");
    expect(textarea).toHaveClass("focus:border-red-500");
    expect(textarea).toHaveClass("focus:ring-red-500");
  });

  it("handles value changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Textarea onChange={onChange} />);
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "test content");

    expect(onChange).toHaveBeenCalled();
    expect(textarea).toHaveValue("test content");
  });

  it("respects disabled state", () => {
    render(<Textarea disabled />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeDisabled();
  });

  it("respects required state", () => {
    render(<Textarea required />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeRequired();
  });

  it("accepts custom className", () => {
    render(<Textarea className="custom-class" />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("custom-class");
  });

  it("forwards HTML textarea attributes", () => {
    render(
      <Textarea
        id="test-textarea"
        name="test-name"
        placeholder="Enter description"
        rows={5}
        maxLength={500}
      />
    );

    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("id", "test-textarea");
    expect(textarea).toHaveAttribute("name", "test-name");
    expect(textarea).toHaveAttribute("placeholder", "Enter description");
    expect(textarea).toHaveAttribute("rows", "5");
    expect(textarea).toHaveAttribute("maxLength", "500");
  });

  it("displays placeholder text", () => {
    render(<Textarea placeholder="Enter your message" />);
    expect(screen.getByPlaceholderText("Enter your message")).toBeInTheDocument();
  });

  it("supports controlled textarea", () => {
    const { rerender } = render(<Textarea value="initial" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("initial");

    rerender(<Textarea value="updated" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("updated");
  });

  it("supports autoFocus", () => {
    render(<Textarea autoFocus />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveFocus();
  });

  it("supports readOnly state", () => {
    render(<Textarea readOnly />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("readOnly");
  });

  it("allows vertical resizing", () => {
    render(<Textarea />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveClass("resize-y");
  });

  it("handles multiline text", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Textarea onChange={onChange} />);
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "Line 1{Enter}Line 2{Enter}Line 3");

    expect(textarea).toHaveValue("Line 1\nLine 2\nLine 3");
  });
});
