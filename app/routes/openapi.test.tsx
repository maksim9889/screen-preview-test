import { describe, it, expect } from "vitest";
import { loader } from "./openapi";

describe("GET /openapi", () => {
  it("returns OpenAPI spec as JSON", async () => {
    const response = await loader();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const data = await response.json();
    expect(data.openapi).toBeDefined();
    expect(data.info).toBeDefined();
    expect(data.paths).toBeDefined();
  });
});
