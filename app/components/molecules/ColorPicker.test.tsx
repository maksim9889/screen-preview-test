import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPicker } from "./ColorPicker";

describe("ColorPicker", () => {
  it("renders label and inputs", () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Test Color" value="#FF0000" onChange={onChange} />);

    expect(screen.getByText("Test Color")).toBeInTheDocument();
    expect(screen.getByDisplayValue("#FF0000")).toBeInTheDocument();
  });

  it("displays the current color value", () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPicker label="Background Color" value="#123456" onChange={onChange} />);

    const textInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(textInput.value).toBe("#123456");
  });

  it("calls onChange when color picker changes", () => {
    const onChange = vi.fn();
    const { container } = render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const colorPicker = container.querySelector('input[type="color"]') as HTMLInputElement;

    // Simulate color change by firing change event
    fireEvent.change(colorPicker, { target: { value: "#00FF00" } });

    expect(onChange).toHaveBeenCalledWith("#00ff00");
  });

  it("calls onChange when text input changes with valid color", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    await user.clear(textInput);
    await user.type(textInput, "#00FF00");

    expect(onChange).toHaveBeenCalledWith("#00FF00");
  });

  it("automatically adds # prefix if missing", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    await user.clear(textInput);
    await user.type(textInput, "00FF00");

    expect(onChange).toHaveBeenCalledWith("#00FF00");
  });

  it("shows validation error for invalid color", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    await user.clear(textInput);
    await user.type(textInput, "#GGGGGG");

    expect(screen.getByText("Invalid hex color")).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalledWith("#GGGGGG");
  });

  it("does not show error for empty input", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    await user.clear(textInput);

    expect(screen.queryByText("Invalid hex color")).not.toBeInTheDocument();
  });

  it("applies error styling to text input when invalid", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    await user.clear(textInput);
    await user.type(textInput, "#INVALID");

    expect(textInput).toHaveClass("border-red-400");
  });

  it("applies normal styling to text input when valid", () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000");
    expect(textInput).toHaveClass("border-gray-300");
    expect(textInput).not.toHaveClass("border-red-400");
  });

  it("updates when value prop changes", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ColorPicker label="Color" value="#FF0000" onChange={onChange} />
    );

    expect(screen.getByDisplayValue("#FF0000")).toBeInTheDocument();

    rerender(<ColorPicker label="Color" value="#00FF00" onChange={onChange} />);

    expect(screen.getByDisplayValue("#00FF00")).toBeInTheDocument();
  });

  it("limits text input to 7 characters", () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Color" value="#FF0000" onChange={onChange} />);

    const textInput = screen.getByDisplayValue("#FF0000") as HTMLInputElement;
    expect(textInput).toHaveAttribute("maxLength", "7");
  });

  it("displays placeholder in text input", () => {
    const onChange = vi.fn();
    render(<ColorPicker label="Color" value="" onChange={onChange} />);

    const textInput = screen.getByPlaceholderText("#000000");
    expect(textInput).toBeInTheDocument();
  });
});
