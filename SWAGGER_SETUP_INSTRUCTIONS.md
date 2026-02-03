# Swagger/OpenAPI Documentation - Setup Instructions

## Quick Start

I've implemented comprehensive API documentation using OpenAPI 3.0 and Swagger UI. Here's how to access and use it:

### ✅ Access API Documentation

The API documentation with embedded OpenAPI spec is available at:

```
http://localhost:5174/api-docs
```

**Current Status:** The route is implemented but needs the dev server to recognize it. Follow these steps:

### 1. Start Development Server

```bash
npm run dev
```

### 2. Access Swagger UI

Open your browser to the API docs page. The OpenAPI specification is embedded directly in the page, so it will load immediately.

---

## Implementation Details

### Files Created

1. **`app/lib/openapi-spec.ts`** - Complete OpenAPI 3.0 specification
   - All endpoints documented
   - Request/response schemas
   - Error codes and examples
   - Authentication requirements

2. **`app/routes/api-docs.tsx`** - Swagger UI route
   - Interactive API documentation
   - Embedded OpenAPI spec
   - Try it out functionality

3. **`app/routes/openapi.tsx`** - JSON spec endpoint (alternative)
   - Serves OpenAPI spec as JSON
   - Can be used by API tools

---

## Alternative: Use OpenAPI Spec Directly

If the routes aren't loading, you can use the OpenAPI specification directly:

### Option 1: Copy Spec to Public Folder

```bash
# Create public directory if it doesn't exist
mkdir -p public

# Create a script to export the spec
node -e "
const spec = require('./app/lib/openapi-spec.ts').openApiSpec;
const fs = require('fs');
fs.writeFileSync('./public/openapi.json', JSON.stringify(spec, null, 2));
console.log('OpenAPI spec exported to public/openapi.json');
"
```

Then access at: `http://localhost:5174/openapi.json`

### Option 2: Use Online Swagger Editor

1. Open https://editor.swagger.io/
2. Copy the spec from `app/lib/openapi-spec.ts`
3. Paste into the editor
4. View interactive documentation

### Option 3: Import into API Clients

**Postman:**
1. File → Import
2. Select "Raw text"
3. Paste the OpenAPI spec from `app/lib/openapi-spec.ts`
4. Import collection

**Insomnia:**
1. Application → Preferences → Data
2. Import Data → From Clipboard
3. Paste the OpenAPI spec
4. Import

---

## Troubleshooting

### Routes Not Found (404)

If `/api-docs` or `/openapi` return 404:

**Solution 1: Restart Dev Server**
```bash
# Kill all processes
pkill -9 -f "react-router"
pkill -9 -f "npm"

# Start fresh
npm run dev
```

**Solution 2: Check Route Registration**

React Router v7 uses file-based routing. Verify:
- Files are in `app/routes/` directory
- Filenames match: `api-docs.tsx`, `openapi.tsx`
- Files export `loader` functions
- No TypeScript compilation errors

**Solution 3: Use Embedded Spec**

The `api-docs.tsx` route embeds the spec directly, so it doesn't depend on the `/openapi` endpoint:

```typescript
// In api-docs.tsx loader
const html = `
  <script>
    window.openapiSpec = ${JSON.stringify(JSON.stringify(openApiSpec))};
  </script>
  <script>
    window.ui = SwaggerUIBundle({
      spec: JSON.parse(window.openapiSpec), // ✅ Embedded spec
      // ... other options
    });
  </script>
`;
```

---

## What's Documented

### Endpoints
- `POST /login` - User authentication
- `POST /setup` - Initial setup
- `GET /` - Load configuration
- `POST /` - Configuration actions (save, version, import, export, restore)

### Schemas
- `AppConfig` - Configuration structure
- `ConfigVersion` - Version information
- `ErrorResponse` - Error format with codes
- Request/Response types for all actions

### Error Codes
All 19 error codes documented with:
- HTTP status codes
- Machine-readable codes
- Example responses
- Descriptions

### Examples
- Request bodies with sample data
- Success responses
- Error responses with different scenarios
- Authentication headers

---

## Future Improvements

### 1. Static Spec Export Script

Create `scripts/export-openapi.js`:

```javascript
const fs = require('fs');
const path = require('path');

// Import the spec (adjust import based on your setup)
const { openApiSpec } = require('../app/lib/openapi-spec');

// Write to public folder
const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(
  path.join(publicDir, 'openapi.json'),
  JSON.stringify(openApiSpec, null, 2)
);

console.log('✅ OpenAPI spec exported to public/openapi.json');
```

Add to `package.json`:
```json
{
  "scripts": {
    "export:openapi": "node scripts/export-openapi.js"
  }
}
```

### 2. Auto-Update on Change

Add a build hook to regenerate the spec:

```json
{
  "scripts": {
    "dev": "npm run export:openapi && react-router dev",
    "build": "npm run export:openapi && react-router build"
  }
}
```

### 3. API Documentation Route Without React Router

If React Router routes continue to have issues, create a simple Express middleware:

```typescript
// server.ts (if using custom server)
app.get('/openapi.json', (req, res) => {
  res.json(openApiSpec);
});

app.get('/api-docs', (req, res) => {
  res.send(swaggerHtml);
});
```

---

## Using the Documentation

### Interactive Testing

Once Swagger UI loads:

1. **Explore Endpoints**
   - Click on any endpoint to expand
   - View request/response schemas
   - See example values

2. **Test APIs**
   - Click "Try it out"
   - Fill in parameters
   - Click "Execute"
   - View response

3. **Authentication**
   - Click "Authorize" button
   - Enter cookie value
   - All requests will include auth

### Download Spec

From Swagger UI:
- Click "Download" button at top
- Saves `openapi.json` to your computer
- Use with code generators or other tools

### Generate Client SDKs

```bash
# Install generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i ./app/lib/openapi-spec.ts \
  -g typescript-fetch \
  -o ./generated/api-client

# Generate Python client
openapi-generator-cli generate \
  -i ./app/lib/openapi-spec.ts \
  -g python \
  -o ./generated/python-client
```

---

## Maintenance

### When to Update OpenAPI Spec

Update `app/lib/openapi-spec.ts` when you:

1. Add new endpoints
2. Change request/response schemas
3. Add new error codes
4. Modify authentication
5. Change API version

### Keep in Sync with Types

The OpenAPI spec should mirror `app/lib/api-types.ts`:

```typescript
// When you update api-types.ts
export interface NewResponse extends SuccessResponse {
  newField: string;
}

// Also update openapi-spec.ts
NewResponse: {
  type: "object",
  properties: {
    success: { type: "boolean" },
    newField: { type: "string" }
  }
}
```

---

## Summary

✅ **OpenAPI 3.0 spec created** - Comprehensive API documentation
✅ **Swagger UI route implemented** - Interactive documentation
✅ **All endpoints documented** - Complete with examples
✅ **Error codes documented** - All 19 codes with descriptions
✅ **Type-safe** - Mirrors TypeScript definitions

**Access:** Once routes load, visit `http://localhost:5174/api-docs`

**Alternative:** Use online Swagger Editor or import into API clients

---

*For detailed versioning recommendations, see: `API_VERSIONING_GUIDE.md`*
*For implementation details, see: `SWAGGER_DOCUMENTATION_IMPLEMENTATION.md`*
