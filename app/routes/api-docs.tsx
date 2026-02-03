/**
 * Swagger UI API Documentation Route
 *
 * Displays interactive API documentation using Swagger UI
 */

import { openApiSpec } from "../lib/openapi-spec";

export async function loader() {
  // Return HTML page with Swagger UI
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation - Home Screen Editor</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #fafafa;
    }
    .topbar {
      display: none;
    }
    /* Back to app button */
    .back-to-app {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
      background: #1976d2;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      text-decoration: none;
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .back-to-app:hover {
      background: #1565c0;
    }
    /* Override language-json color to wheat */
    .language-json,
    .language-json span,
    code.language-json,
    code.language-json span,
    .swagger-ui .language-json,
    .swagger-ui .language-json span,
    .swagger-ui code.language-json,
    .swagger-ui code.language-json span,
    .swagger-ui pre code.language-json,
    .swagger-ui pre code.language-json span,
    .swagger-ui .highlight-code code.language-json,
    .swagger-ui .highlight-code code.language-json span,
    .swagger-ui .microlight code.language-json,
    .swagger-ui .microlight code.language-json span,
    .swagger-ui pre.microlight code.language-json,
    .swagger-ui pre.microlight code.language-json span {
      color: wheat !important;
    }
  </style>
</head>
<body>
  <a href="/" class="back-to-app">
    <span>←</span>
    <span>Back to App</span>
  </a>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.openapiSpec = ${JSON.stringify(JSON.stringify(openApiSpec))};
  </script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        spec: JSON.parse(window.openapiSpec),
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
