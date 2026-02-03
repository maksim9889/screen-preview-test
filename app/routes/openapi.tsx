/**
 * OpenAPI Specification JSON Endpoint
 *
 * Serves the OpenAPI 3.0 specification as JSON
 */

import { openApiSpec } from "../lib/openapi-spec";

export async function loader() {
  return new Response(JSON.stringify(openApiSpec, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*", // Allow CORS for API doc tools
    },
  });
}
