import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StatusMessages } from "./StatusMessages";

describe("StatusMessages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when no messages", () => {
    const { container } = render(<StatusMessages />);
    expect(container).toBeEmptyDOMElement();
  });

  it("displays error message", () => {
    render(<StatusMessages saveError="Failed to save" />);
    expect(screen.getByText("Failed to save")).toBeInTheDocument();
  });

  it("displays saved message", () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();
    render(<StatusMessages savedAt={savedAt} />);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("auto-dismisses saved message after 5 seconds", async () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();
    render(<StatusMessages savedAt={savedAt} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration (300ms)
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    // Check that message is no longer in the document
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("does not dismiss saved message before 5 seconds", () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();
    render(<StatusMessages savedAt={savedAt} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();

    // Fast-forward 3 seconds (less than 5)
    vi.advanceTimersByTime(3000);

    expect(screen.getByText("Saved")).toBeInTheDocument();
  });

  it("displays version created message", () => {
    render(<StatusMessages versionCreated={true} versionNumber={5} />);
    expect(screen.getByText("Version 5 created")).toBeInTheDocument();
  });

  it("auto-dismisses version created message after 5 seconds", async () => {
    render(<StatusMessages versionCreated={true} versionNumber={5} />);

    expect(screen.getByText("Version 5 created")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    // Check that message is no longer in the document
    expect(screen.queryByText("Version 5 created")).not.toBeInTheDocument();
  });

  it("does not dismiss version created message before 5 seconds", () => {
    render(<StatusMessages versionCreated={true} versionNumber={5} />);

    expect(screen.getByText("Version 5 created")).toBeInTheDocument();

    // Fast-forward 3 seconds (less than 5)
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText("Version 5 created")).toBeInTheDocument();
  });

  it("displays config created message", () => {
    render(<StatusMessages configCreated={true} />);
    expect(screen.getByText("New configuration created")).toBeInTheDocument();
  });

  it("displays import success message", () => {
    render(<StatusMessages importSuccess={true} />);
    expect(screen.getByText("Configuration imported")).toBeInTheDocument();
  });

  it("displays restored message", () => {
    render(<StatusMessages restoredVersion={3} />);
    expect(screen.getByText("Restored to version 3")).toBeInTheDocument();
  });

  it("auto-dismisses restored message after 5 seconds", async () => {
    render(<StatusMessages restoredVersion={3} />);

    expect(screen.getByText("Restored to version 3")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    // Check that message is no longer in the document
    expect(screen.queryByText("Restored to version 3")).not.toBeInTheDocument();
  });

  it("does not show saved message when importSuccess is true", () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();

    render(
      <StatusMessages
        savedAt={savedAt}
        importSuccess={true}
      />
    );

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Configuration imported")).toBeInTheDocument();
  });

  it("does not show saved message when versionCreated is true", () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();

    render(
      <StatusMessages
        savedAt={savedAt}
        versionCreated={true}
        versionNumber={2}
      />
    );

    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
    expect(screen.getByText("Version 2 created")).toBeInTheDocument();
  });

  it("shows config created instead of version created when both are true", () => {
    render(
      <StatusMessages
        versionCreated={true}
        versionNumber={1}
        configCreated={true}
      />
    );

    expect(screen.queryByText(/^Version \d+ created$/)).not.toBeInTheDocument();
    expect(screen.getByText("New configuration created")).toBeInTheDocument();
  });

  it("displays multiple non-conflicting messages simultaneously", () => {
    render(
      <StatusMessages
        saveError="Error occurred"
        restoredVersion={2}
      />
    );

    expect(screen.getByText("Error occurred")).toBeInTheDocument();
    expect(screen.getByText("Restored to version 2")).toBeInTheDocument();
  });

  it("cleans up timer on unmount", () => {
    const savedAt = new Date("2026-01-31T12:00:00").toISOString();
    const { unmount } = render(<StatusMessages savedAt={savedAt} />);

    expect(screen.getByText("Saved")).toBeInTheDocument();

    unmount();

    // Advance timers after unmount - should not cause errors
    vi.advanceTimersByTime(5300);
  });

  it("auto-dismisses error message after 5 seconds", async () => {
    render(<StatusMessages saveError="Test error" />);

    expect(screen.getByText("Test error")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText("Test error")).not.toBeInTheDocument();
  });

  it("auto-dismisses import success message after 5 seconds", async () => {
    render(<StatusMessages importSuccess={true} />);

    expect(screen.getByText("Configuration imported")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText("Configuration imported")).not.toBeInTheDocument();
  });

  it("auto-dismisses config created message after 5 seconds", async () => {
    render(<StatusMessages configCreated={true} />);

    expect(screen.getByText("New configuration created")).toBeInTheDocument();

    // Fast-forward 5 seconds + fade duration
    act(() => {
      vi.advanceTimersByTime(5300);
    });

    expect(screen.queryByText("New configuration created")).not.toBeInTheDocument();
  });
});
