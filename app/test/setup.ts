import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.DATA_DIR = "./test-data";
process.env.DB_PATH = ":memory:";

/**
 * Helper to create route args for loader/action tests
 * Adds required React Router properties like unstable_pattern
 */
export function createRouteArgs<P extends Record<string, string> = Record<string, string>>(
  request: Request,
  params: P = {} as P
) {
  return {
    request,
    params,
    context: {},
    unstable_pattern: "",
  };
}
