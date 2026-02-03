import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CarouselSection } from "./CarouselSection";
import type { AppConfig } from "../../lib/types";

// Mock @dnd-kit/core
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: () => [],
}));

// Mock @dnd-kit/sortable
vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  sortableKeyboardCoordinates: vi.fn(),
  verticalListSortingStrategy: "vertical",
  arrayMove: vi.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
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

describe("CarouselSection", () => {
  const createConfig = (images: string[] = []): AppConfig => ({
    carousel: {
      images,
      aspectRatio: "landscape",
    },
    textSection: {
      title: "Test Title",
      titleColor: "#000000",
      description: "Test Description",
      descriptionColor: "#666666",
    },
    cta: {
      label: "Test CTA",
      url: "https://example.com",
      backgroundColor: "#007bff",
      textColor: "#ffffff",
    },
    sectionOrder: ["carousel", "textSection", "cta"],
  });

  const defaultProps = {
    config: createConfig(["https://example.com/image1.jpg", "https://example.com/image2.jpg"]),
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders the aspect ratio selector", () => {
      render(<CarouselSection {...defaultProps} />);
      expect(screen.getByLabelText("Aspect Ratio")).toBeInTheDocument();
    });

    it("renders image count label", () => {
      render(<CarouselSection {...defaultProps} />);
      expect(screen.getByText("Images (2)")).toBeInTheDocument();
    });

    it("renders all images", () => {
      render(<CarouselSection {...defaultProps} />);
      expect(screen.getByText("https://example.com/image1.jpg")).toBeInTheDocument();
      expect(screen.getByText("https://example.com/image2.jpg")).toBeInTheDocument();
    });

    it("renders add image input and button", () => {
      render(<CarouselSection {...defaultProps} />);
      expect(screen.getByPlaceholderText("Image URL...")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
    });
  });

  describe("aspect ratio", () => {
    it("calls onUpdate when aspect ratio is changed", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const select = screen.getByLabelText("Aspect Ratio");
      await user.selectOptions(select, "portrait");

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        aspectRatio: "portrait",
      });
    });
  });

  describe("adding images", () => {
    it("adds a new image when valid URL is entered", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const input = screen.getByPlaceholderText("Image URL...");
      await user.type(input, "https://example.com/new-image.jpg");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        images: [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg",
          "https://example.com/new-image.jpg",
        ],
      });
    });

    it("adds image on Enter key", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const input = screen.getByPlaceholderText("Image URL...");
      await user.type(input, "https://example.com/new-image.jpg{Enter}");

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        images: [
          "https://example.com/image1.jpg",
          "https://example.com/image2.jpg",
          "https://example.com/new-image.jpg",
        ],
      });
    });

    it("shows error for empty URL", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByText("URL is required")).toBeInTheDocument();
      expect(defaultProps.onUpdate).not.toHaveBeenCalled();
    });

    it("shows error for invalid URL", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const input = screen.getByPlaceholderText("Image URL...");
      await user.type(input, "not-a-valid-url");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
      expect(defaultProps.onUpdate).not.toHaveBeenCalled();
    });

    it("clears input after successful add", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const input = screen.getByPlaceholderText("Image URL...");
      await user.type(input, "https://example.com/new-image.jpg");
      await user.click(screen.getByRole("button", { name: "Add" }));

      expect(input).toHaveValue("");
    });

    it("clears error when typing", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      await user.click(screen.getByRole("button", { name: "Add" }));
      expect(screen.getByText("URL is required")).toBeInTheDocument();

      const input = screen.getByPlaceholderText("Image URL...");
      await user.type(input, "h");

      expect(screen.queryByText("URL is required")).not.toBeInTheDocument();
    });
  });

  describe("removing images", () => {
    it("removes image when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      const deleteButtons = screen.getAllByLabelText(/Remove image/);
      await user.click(deleteButtons[0]);

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        images: ["https://example.com/image2.jpg"],
      });
    });
  });

  describe("editing images", () => {
    it("renders edit buttons for each image", () => {
      render(<CarouselSection {...defaultProps} />);

      expect(screen.getByLabelText("Edit image 1 URL")).toBeInTheDocument();
      expect(screen.getByLabelText("Edit image 2 URL")).toBeInTheDocument();
    });

    it("updates image URL when edited", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      // Click edit on first image
      await user.click(screen.getByLabelText("Edit image 1 URL"));

      // Get edit input (the one with the current URL value, not the empty "Add" input)
      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find(input => (input as HTMLInputElement).value === "https://example.com/image1.jpg");
      expect(editInput).toBeDefined();

      // Clear and type new URL
      await user.clear(editInput!);
      await user.type(editInput!, "https://example.com/edited-image.jpg");

      // Save
      await user.click(screen.getByLabelText("Save URL"));

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        images: ["https://example.com/edited-image.jpg", "https://example.com/image2.jpg"],
      });
    });

    it("updates second image URL when edited", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      // Click edit on second image
      await user.click(screen.getByLabelText("Edit image 2 URL"));

      // Get edit input (the one with the current URL value)
      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find(input => (input as HTMLInputElement).value === "https://example.com/image2.jpg");
      expect(editInput).toBeDefined();

      // Clear and type new URL
      await user.clear(editInput!);
      await user.type(editInput!, "https://example.com/edited-second.jpg");

      // Save
      await user.click(screen.getByLabelText("Save URL"));

      expect(defaultProps.onUpdate).toHaveBeenCalledWith({
        images: ["https://example.com/image1.jpg", "https://example.com/edited-second.jpg"],
      });
    });

    it("preserves other images when one is edited", async () => {
      const user = userEvent.setup();
      const props = {
        config: createConfig([
          "https://example.com/a.jpg",
          "https://example.com/b.jpg",
          "https://example.com/c.jpg",
        ]),
        onUpdate: vi.fn(),
      };
      render(<CarouselSection {...props} />);

      // Edit the middle image
      await user.click(screen.getByLabelText("Edit image 2 URL"));

      // Get edit input
      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find(input => (input as HTMLInputElement).value === "https://example.com/b.jpg");
      expect(editInput).toBeDefined();

      await user.clear(editInput!);
      await user.type(editInput!, "https://example.com/b-edited.jpg");
      await user.click(screen.getByLabelText("Save URL"));

      expect(props.onUpdate).toHaveBeenCalledWith({
        images: [
          "https://example.com/a.jpg",
          "https://example.com/b-edited.jpg",
          "https://example.com/c.jpg",
        ],
      });
    });

    it("does not call onUpdate when edit is cancelled", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      // Get edit input
      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find(input => (input as HTMLInputElement).value === "https://example.com/image1.jpg");
      expect(editInput).toBeDefined();

      await user.clear(editInput!);
      await user.type(editInput!, "https://example.com/cancelled.jpg");
      await user.click(screen.getByLabelText("Cancel edit"));

      expect(defaultProps.onUpdate).not.toHaveBeenCalled();
    });

    it("validates edited URL", async () => {
      const user = userEvent.setup();
      render(<CarouselSection {...defaultProps} />);

      await user.click(screen.getByLabelText("Edit image 1 URL"));

      // Get edit input
      const inputs = screen.getAllByRole("textbox");
      const editInput = inputs.find(input => (input as HTMLInputElement).value === "https://example.com/image1.jpg");
      expect(editInput).toBeDefined();

      await user.clear(editInput!);
      await user.type(editInput!, "invalid-url");
      await user.click(screen.getByLabelText("Save URL"));

      expect(screen.getByText("Please enter a valid URL")).toBeInTheDocument();
      expect(defaultProps.onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("empty state", () => {
    it("shows zero count when no images", () => {
      render(<CarouselSection config={createConfig([])} onUpdate={vi.fn()} />);
      expect(screen.getByText("Images (0)")).toBeInTheDocument();
    });
  });
});
