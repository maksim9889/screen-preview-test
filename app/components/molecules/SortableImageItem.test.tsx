import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SortableImageItem } from "./SortableImageItem";

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

// Mock @dnd-kit/utilities
vi.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: () => undefined,
    },
  },
}));

describe("SortableImageItem", () => {
  const defaultProps = {
    id: "image-0-https://example.com/image.jpg",
    url: "https://example.com/image.jpg",
    index: 0,
    onRemove: vi.fn(),
    onEdit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the image URL", () => {
    render(<SortableImageItem {...defaultProps} />);
    expect(screen.getByText("https://example.com/image.jpg")).toBeInTheDocument();
  });

  it("shows edit button when onEdit is provided", () => {
    render(<SortableImageItem {...defaultProps} />);
    expect(screen.getByLabelText("Edit image 1 URL")).toBeInTheDocument();
  });

  it("does not show edit button when onEdit is not provided", () => {
    render(<SortableImageItem {...defaultProps} onEdit={undefined} />);
    expect(screen.queryByLabelText("Edit image 1 URL")).not.toBeInTheDocument();
  });

  it("calls onRemove when delete button is clicked", async () => {
    const user = userEvent.setup();
    render(<SortableImageItem {...defaultProps} />);

    await user.click(screen.getByLabelText("Remove image 1"));
    expect(defaultProps.onRemove).toHaveBeenCalledWith(0);
  });

  describe("inline editing", () => {
    it("enters edit mode when edit button is clicked", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("https://example.com/image.jpg");
    });

    it("shows save and cancel buttons in edit mode", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      expect(screen.getByLabelText("Save URL")).toBeInTheDocument();
      expect(screen.getByLabelText("Cancel edit")).toBeInTheDocument();
    });

    it("calls onEdit with new URL when saved", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "https://example.com/new-image.jpg");
      await user.click(screen.getByLabelText("Save URL"));

      expect(defaultProps.onEdit).toHaveBeenCalledWith(0, "https://example.com/new-image.jpg");
    });

    it("saves on Enter key", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "https://example.com/new-image.jpg{Enter}");

      expect(defaultProps.onEdit).toHaveBeenCalledWith(0, "https://example.com/new-image.jpg");
    });

    it("cancels on Escape key", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "https://example.com/new-image.jpg");
      fireEvent.keyDown(input, { key: "Escape" });

      // Should exit edit mode without calling onEdit
      expect(defaultProps.onEdit).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("cancels when cancel button is clicked", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));
      await user.click(screen.getByLabelText("Cancel edit"));

      expect(defaultProps.onEdit).not.toHaveBeenCalled();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("shows error for empty URL", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.click(screen.getByLabelText("Save URL"));

      expect(screen.getByText("URL is required")).toBeInTheDocument();
      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });

    it("shows error for invalid URL", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "not-a-valid-url");
      await user.click(screen.getByLabelText("Save URL"));

      expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });

    it("does not call onEdit if URL unchanged", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));
      await user.click(screen.getByLabelText("Save URL"));

      expect(defaultProps.onEdit).not.toHaveBeenCalled();
    });

    it("clears error when typing", async () => {
      const user = userEvent.setup();
      render(<SortableImageItem {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.click(screen.getByLabelText("Save URL"));

      expect(screen.getByText("URL is required")).toBeInTheDocument();

      await user.type(input, "h");
      expect(screen.queryByText("URL is required")).not.toBeInTheDocument();
    });
  });

  describe("broken image handling", () => {
    it("shows broken image icon when image fails to load", () => {
      render(<SortableImageItem {...defaultProps} />);

      const img = screen.getByAltText("Slide 1");
      fireEvent.error(img);

      expect(screen.queryByAltText("Slide 1")).not.toBeInTheDocument();
      // The broken_image icon should be rendered
    });
  });
});
