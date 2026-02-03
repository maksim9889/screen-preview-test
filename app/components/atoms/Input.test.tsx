import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input } from "./Input";

describe("Input", () => {
  it("renders input element", () => {
    render(<Input />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("applies base styling classes", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("w-full");
    expect(input).toHaveClass("border");
    expect(input).toHaveClass("rounded");
  });

  it("applies default medium size", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("px-3");
    expect(input).toHaveClass("py-2");
    expect(input).toHaveClass("text-sm");
  });

  it("applies small size when specified", () => {
    render(<Input inputSize="sm" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("px-2");
    expect(input).toHaveClass("py-1.5");
    expect(input).toHaveClass("text-xs");
  });

  it("applies large size when specified", () => {
    render(<Input inputSize="lg" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("px-4");
    expect(input).toHaveClass("py-2.5");
    expect(input).toHaveClass("text-base");
  });

  it("applies normal border styling when no error", () => {
    render(<Input />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-gray-300");
  });

  it("applies error styling when error prop is true", () => {
    render(<Input error={true} />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("border-red-400");
    expect(input).toHaveClass("focus:border-red-500");
    expect(input).toHaveClass("focus:ring-red-500");
  });

  it("handles value changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<Input onChange={onChange} />);
    const input = screen.getByRole("textbox");

    await user.type(input, "test");

    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveValue("test");
  });

  it("respects disabled state", () => {
    render(<Input disabled />);
    const input = screen.getByRole("textbox");
    expect(input).toBeDisabled();
  });

  it("respects required state", () => {
    render(<Input required />);
    const input = screen.getByRole("textbox");
    expect(input).toBeRequired();
  });

  it("accepts custom className", () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveClass("custom-class");
  });

  it("forwards HTML input attributes", () => {
    render(
      <Input
        id="test-input"
        name="test-name"
        placeholder="Enter text"
        type="email"
        maxLength={100}
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("id", "test-input");
    expect(input).toHaveAttribute("name", "test-name");
    expect(input).toHaveAttribute("placeholder", "Enter text");
    expect(input).toHaveAttribute("type", "email");
    expect(input).toHaveAttribute("maxLength", "100");
  });

  it("displays placeholder text", () => {
    render(<Input placeholder="Enter your name" />);
    expect(screen.getByPlaceholderText("Enter your name")).toBeInTheDocument();
  });

  it("supports controlled input", () => {
    const { rerender } = render(<Input value="initial" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("initial");

    rerender(<Input value="updated" onChange={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("updated");
  });

  it("supports password type", () => {
    const { container } = render(<Input type="password" />);
    const input = container.querySelector('input[type="password"]');
    expect(input).toHaveAttribute("type", "password");
  });

  it("supports autoFocus", () => {
    render(<Input autoFocus />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();
  });

  it("supports readOnly state", () => {
    render(<Input readOnly />);
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("readOnly");
  });
});
