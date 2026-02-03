import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarResize } from "./useSidebarResize";

describe("useSidebarResize", () => {
  beforeEach(() => {
    // Mock window.innerWidth for desktop
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default width", () => {
    const { result } = renderHook(() => useSidebarResize(420));

    expect(result.current.sidebarWidth).toBe(420);
    expect(result.current.isCollapsed).toBe(false);
    expect(result.current.isResizing).toBe(false);
    expect(result.current.isMobile).toBe(false);
  });

  it("should detect mobile when window width is below 768px", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useSidebarResize(420));

    expect(result.current.isMobile).toBe(true);
  });

  it("should allow collapsing the sidebar", () => {
    const { result } = renderHook(() => useSidebarResize(420));

    act(() => {
      result.current.setIsCollapsed(true);
    });

    expect(result.current.isCollapsed).toBe(true);
  });

  it("should set isResizing to true when startResize is called", () => {
    const { result } = renderHook(() => useSidebarResize(420));

    act(() => {
      result.current.startResize();
    });

    expect(result.current.isResizing).toBe(true);
  });

  it("should respect min and max width constraints", () => {
    const { result } = renderHook(() => useSidebarResize(420));

    // Initial width should be within bounds
    expect(result.current.sidebarWidth).toBeGreaterThanOrEqual(320);
    expect(result.current.sidebarWidth).toBeLessThanOrEqual(800);
  });
});
