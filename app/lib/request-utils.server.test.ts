import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the config module before importing getClientIp
vi.mock("./config.server", () => ({
  config: {
    proxy: {
      trustProxy: true, // Default to true for backward-compatible tests
    },
  },
}));

import { getClientIp, sanitizeFilename } from "./request-utils.server";
import { config } from "./config.server";

describe("getClientIp", () => {
  describe("when TRUST_PROXY is enabled", () => {
    beforeEach(() => {
      // Enable proxy trust for these tests
      vi.mocked(config.proxy).trustProxy = true;
    });

    it("should extract IP from X-Forwarded-For header", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      expect(getClientIp(request)).toBe("192.168.1.1");
    });

    it("should take first IP from X-Forwarded-For with multiple IPs", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Forwarded-For": "192.168.1.1, 10.0.0.1, 172.16.0.1" },
      });
      expect(getClientIp(request)).toBe("192.168.1.1");
    });

    it("should trim whitespace from X-Forwarded-For", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Forwarded-For": "  192.168.1.1  ,  10.0.0.1  " },
      });
      expect(getClientIp(request)).toBe("192.168.1.1");
    });

    it("should extract IP from X-Real-IP header", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Real-IP": "192.168.1.2" },
      });
      expect(getClientIp(request)).toBe("192.168.1.2");
    });

    it("should extract IP from CF-Connecting-IP header (Cloudflare)", () => {
      const request = new Request("http://localhost", {
        headers: { "CF-Connecting-IP": "192.168.1.3" },
      });
      expect(getClientIp(request)).toBe("192.168.1.3");
    });

    it("should prefer X-Forwarded-For over X-Real-IP", () => {
      const request = new Request("http://localhost", {
        headers: {
          "X-Forwarded-For": "192.168.1.1",
          "X-Real-IP": "192.168.1.2",
        },
      });
      expect(getClientIp(request)).toBe("192.168.1.1");
    });

    it("should prefer X-Real-IP over CF-Connecting-IP", () => {
      const request = new Request("http://localhost", {
        headers: {
          "X-Real-IP": "192.168.1.2",
          "CF-Connecting-IP": "192.168.1.3",
        },
      });
      expect(getClientIp(request)).toBe("192.168.1.2");
    });

    it("should return 'unknown' when no IP headers present", () => {
      const request = new Request("http://localhost");
      expect(getClientIp(request)).toBe("unknown");
    });

    it("should handle lowercase header names (case-insensitive)", () => {
      const request = new Request("http://localhost", {
        headers: { "x-forwarded-for": "192.168.1.1" },
      });
      expect(getClientIp(request)).toBe("192.168.1.1");
    });

    it("should skip empty X-Forwarded-For and fall back to X-Real-IP", () => {
      const request = new Request("http://localhost", {
        headers: {
          "X-Forwarded-For": "",
          "X-Real-IP": "192.168.1.2",
        },
      });
      expect(getClientIp(request)).toBe("192.168.1.2");
    });
  });

  describe("when TRUST_PROXY is disabled (security)", () => {
    beforeEach(() => {
      // Disable proxy trust - headers should be ignored
      vi.mocked(config.proxy).trustProxy = false;
    });

    it("should ignore X-Forwarded-For header when TRUST_PROXY is false", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Forwarded-For": "192.168.1.1" },
      });
      // Should NOT trust the header, return "unknown" instead
      expect(getClientIp(request)).toBe("unknown");
    });

    it("should ignore X-Real-IP header when TRUST_PROXY is false", () => {
      const request = new Request("http://localhost", {
        headers: { "X-Real-IP": "192.168.1.2" },
      });
      expect(getClientIp(request)).toBe("unknown");
    });

    it("should ignore CF-Connecting-IP header when TRUST_PROXY is false", () => {
      const request = new Request("http://localhost", {
        headers: { "CF-Connecting-IP": "192.168.1.3" },
      });
      expect(getClientIp(request)).toBe("unknown");
    });

    it("should ignore all proxy headers when TRUST_PROXY is false", () => {
      const request = new Request("http://localhost", {
        headers: {
          "X-Forwarded-For": "192.168.1.1",
          "X-Real-IP": "192.168.1.2",
          "CF-Connecting-IP": "192.168.1.3",
        },
      });
      // All headers should be ignored - prevents IP spoofing attacks
      expect(getClientIp(request)).toBe("unknown");
    });
  });
});

describe("sanitizeFilename", () => {
  describe("safe characters (should remain unchanged)", () => {
    it("should allow alphanumeric characters", () => {
      expect(sanitizeFilename("abc123XYZ")).toBe("abc123XYZ");
    });

    it("should allow underscores", () => {
      expect(sanitizeFilename("file_name")).toBe("file_name");
    });

    it("should allow hyphens", () => {
      expect(sanitizeFilename("file-name")).toBe("file-name");
    });

    it("should allow periods", () => {
      expect(sanitizeFilename("file.json")).toBe("file.json");
    });

    it("should allow typical export filename", () => {
      expect(sanitizeFilename("config-export-user123-default-2024-01-15.json"))
        .toBe("config-export-user123-default-2024-01-15.json");
    });
  });

  describe("dangerous characters (should be replaced)", () => {
    it("should replace double quotes (Content-Disposition injection)", () => {
      expect(sanitizeFilename('file"name')).toBe("file_name");
    });

    it("should replace single quotes", () => {
      expect(sanitizeFilename("file'name")).toBe("file_name");
    });

    it("should replace CRLF (HTTP header injection)", () => {
      expect(sanitizeFilename("file\r\nname")).toBe("file__name");
    });

    it("should replace carriage return", () => {
      expect(sanitizeFilename("file\rname")).toBe("file_name");
    });

    it("should replace newline", () => {
      expect(sanitizeFilename("file\nname")).toBe("file_name");
    });

    it("should replace spaces", () => {
      expect(sanitizeFilename("file name")).toBe("file_name");
    });

    it("should replace forward slash (path traversal)", () => {
      // Dots remain, slashes become underscores
      expect(sanitizeFilename("../../../etc/passwd")).toBe(".._.._.._etc_passwd");
    });

    it("should replace backslash (Windows path traversal)", () => {
      // Backslashes become underscores
      expect(sanitizeFilename("..\\..\\file")).toBe(".._.._file");
      expect(sanitizeFilename("file\\name")).toBe("file_name");
    });

    it("should replace shell metacharacters", () => {
      expect(sanitizeFilename("file;rm -rf /")).toBe("file_rm_-rf__");
    });

    it("should replace @ symbol", () => {
      expect(sanitizeFilename("user@evil.com")).toBe("user_evil.com");
    });

    it("should replace multiple dangerous characters", () => {
      expect(sanitizeFilename('user"name\r\nContent-Type: text/html'))
        .toBe("user_name__Content-Type__text_html");
    });
  });

  describe("edge cases", () => {
    it("should handle empty string", () => {
      expect(sanitizeFilename("")).toBe("");
    });

    it("should return 'invalid' for non-string input", () => {
      expect(sanitizeFilename(null as unknown as string)).toBe("invalid");
      expect(sanitizeFilename(undefined as unknown as string)).toBe("invalid");
      expect(sanitizeFilename(123 as unknown as string)).toBe("invalid");
    });

    it("should handle string with only dangerous characters", () => {
      expect(sanitizeFilename('"\r\n<>')).toBe("_____");
    });
  });
});
