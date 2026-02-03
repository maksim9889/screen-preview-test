import { describe, it, expect } from "vitest";
import { loader } from "./api-docs";

describe("GET /api-docs", () => {
  it("returns HTML page with Swagger UI", async () => {
    const response = await loader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("swagger-ui");
    expect(html).toContain("API Documentation");
  });
});
