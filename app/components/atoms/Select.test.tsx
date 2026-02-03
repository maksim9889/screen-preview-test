import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

describe("Select", () => {
  it("renders with options", () => {
    render(
      <Select>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </Select>
    );

    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText("Option 1")).toBeInTheDocument();
    expect(screen.getByText("Option 2")).toBeInTheDocument();
  });

  it("applies base styling classes", () => {
    render(
      <Select>
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("w-full");
    expect(select).toHaveClass("px-3");
    expect(select).toHaveClass("py-2.5");
    expect(select).toHaveClass("border");
    expect(select).toHaveClass("rounded-lg");
  });

  it("applies normal border styling when no error", () => {
    render(
      <Select>
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("border-gray-200");
    expect(select).toHaveClass("hover:border-gray-300");
  });

  it("applies error styling when error prop is true", () => {
    render(
      <Select error={true}>
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("border-red-400");
    expect(select).toHaveClass("focus:border-red-500");
    expect(select).toHaveClass("focus:ring-red-500");
  });

  it("handles value changes", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <Select onChange={onChange} defaultValue="1">
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    await user.selectOptions(select, "2");

    expect(onChange).toHaveBeenCalled();
    expect(select).toHaveValue("2");
  });

  it("respects disabled state", () => {
    render(
      <Select disabled>
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toBeDisabled();
  });

  it("accepts custom className", () => {
    render(
      <Select className="custom-class">
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveClass("custom-class");
  });

  it("forwards HTML select attributes", () => {
    render(
      <Select id="test-select" name="test-name" required>
        <option>Test</option>
      </Select>
    );

    const select = screen.getByRole("combobox");
    expect(select).toHaveAttribute("id", "test-select");
    expect(select).toHaveAttribute("name", "test-name");
    expect(select).toBeRequired();
  });

  it("displays selected value", () => {
    render(
      <Select value="2">
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </Select>
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("2");
  });

  it("handles multiple selection when multiple prop is set", async () => {
    const user = userEvent.setup();

    render(
      <Select multiple>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
        <option value="3">Option 3</option>
      </Select>
    );

    const select = screen.getByRole("listbox");
    expect(select).toHaveAttribute("multiple");
  });
});
