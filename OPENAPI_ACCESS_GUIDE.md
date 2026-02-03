# OpenAPI Documentation - Access Guide

## ✅ Working Solution

Your API documentation is now fully accessible! Here's how to use it:

---

## 📚 Access Interactive API Documentation

### **Swagger UI (Recommended)**

```
http://localhost:5174/api-docs.html
```

This page provides:
- ✅ **Interactive API explorer** - Test endpoints directly
- ✅ **Complete documentation** - All endpoints, schemas, examples
- ✅ **Try it out** - Execute API calls from the browser
- ✅ **Authentication support** - Add cookies for protected endpoints
- ✅ **Download spec** - Export OpenAPI JSON

**Screenshot of what you'll see:**
- All endpoints listed (Login, Setup, Configuration)
- Request/response schemas
- Error codes and examples
- Try it out buttons
- Authentication section

---

## 📄 Access OpenAPI Specification (JSON)

### **Direct JSON Access**

```
http://localhost:5174/openapi.json
```

Use this URL to:
- Import into Postman/Insomnia
- Generate client SDKs
- Validate against spec
- Use with OpenAPI tools

**Example: Import into Postman**
```
1. Open Postman
2. File → Import
3. Select "Link" tab
4. Enter: http://localhost:5174/openapi.json
5. Click Import
```

**Example: Generate TypeScript Client**
```bash
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:5174/openapi.json \
  -g typescript-fetch \
  -o ./generated/api-client
```

---

## 🔄 Update OpenAPI Spec

If you make changes to the API, regenerate the spec:

```bash
npm run export:openapi
```

This command:
1. Reads `app/lib/openapi-spec.ts`
2. Exports to `public/openapi.json`
3. Makes it accessible at `/openapi.json`

**When to run:**
- After adding new endpoints
- After changing request/response schemas
- After modifying error codes
- Before deploying

---

## 📖 What's Documented

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | User authentication |
| POST | `/setup` | Initial admin user creation |
| GET | `/` | Load configuration |
| POST | `/` | Configuration actions (save, version, import, export, restore) |

### Request Types

All configuration actions documented:
- **save** - Save current configuration
- **saveVersion** - Save as new version
- **saveAsNewConfig** - Create new configuration
- **import** - Import configuration
- **export** - Export configuration
- **restoreVersion** - Restore previous version

### Response Types

Every response documented with:
- Success responses (200)
- Error responses (400, 401, 403, 404, 413, 500)
- Example payloads
- Field descriptions

### Error Codes

All 19 error codes documented:
```typescript
UNAUTHORIZED, INVALID_TOKEN, SESSION_EXPIRED,
FORBIDDEN, INVALID_CSRF, VALIDATION_ERROR,
INVALID_CONFIG_ID, INVALID_CONFIG_DATA,
INVALID_VERSION_NUMBER, INVALID_IMPORT_FILE,
MISSING_FIELD, CONFIG_NOT_FOUND, VERSION_NOT_FOUND,
USER_NOT_FOUND, CONFIG_ALREADY_EXISTS,
USERNAME_TAKEN, PAYLOAD_TOO_LARGE,
INTERNAL_ERROR, UNKNOWN_ACTION
```

---

## 🎯 Using Swagger UI

### 1. Explore Endpoints

- Click any endpoint to expand
- View request parameters
- See response schemas
- Check required vs optional fields

### 2. Test APIs

1. Click "Try it out" button
2. Fill in request parameters
3. Click "Execute"
4. View response

**Example: Test Login**
```
1. Navigate to POST /login
2. Click "Try it out"
3. Fill in:
   username: "admin"
   password: "your_password"
   csrf_token: "token_from_cookie"
4. Click "Execute"
5. See response (302 redirect or 400 error)
```

### 3. Authenticate

For protected endpoints:

1. Get authentication cookie from successful login
2. Click "Authorize" button in Swagger UI
3. Enter cookie value: `auth_token=abc123...`
4. Click "Authorize"
5. All requests will now include auth cookie

### 4. Download Spec

- Click "Download" button at top right
- Saves `openapi.json` to your computer
- Use with code generators or other tools

---

## 🔧 Technical Details

### File Structure

```
app/
├── lib/
│   └── openapi-spec.ts         # Source specification (TypeScript)
├── routes/
│   ├── api-docs.tsx            # Swagger UI route (future)
│   └── openapi.tsx             # JSON endpoint route (future)
public/
├── openapi.json                # Generated spec (JSON)
└── api-docs.html               # Swagger UI page (HTML)
scripts/
└── export-openapi.cjs          # Export script
```

### How It Works

1. **Source of Truth**: `app/lib/openapi-spec.ts`
   - Complete OpenAPI 3.0 specification
   - Type-safe TypeScript export
   - All endpoints, schemas, examples

2. **Export Script**: `scripts/export-openapi.cjs`
   - Reads TypeScript spec
   - Converts to JSON
   - Writes to `public/openapi.json`

3. **Static Files**: `public/` directory
   - Served directly by dev server
   - No routing issues
   - Always accessible

4. **Swagger UI**: `public/api-docs.html`
   - Standalone HTML page
   - Loads spec from `/openapi.json`
   - Interactive documentation

---

## 🚀 Quick Start Checklist

- [x] OpenAPI spec created: `app/lib/openapi-spec.ts`
- [x] Export script created: `scripts/export-openapi.cjs`
- [x] Spec exported to public folder: `public/openapi.json`
- [x] Swagger UI page created: `public/api-docs.html`
- [x] Package.json script added: `npm run export:openapi`

**To access documentation:**
1. Ensure dev server is running: `npm run dev`
2. Open browser to: `http://localhost:5174/api-docs.html`
3. Start exploring the API!

---

## 📦 Additional Tools

### Postman Collection

Import into Postman for organized API testing:

```
File → Import → Link
URL: http://localhost:5174/openapi.json
```

### Insomnia Workspace

Import into Insomnia:

```
Application → Preferences → Data
Import Data → From URL
URL: http://localhost:5174/openapi.json
```

### VS Code REST Client

Create a `.http` file:

```http
### Get OpenAPI Spec
GET http://localhost:5174/openapi.json

### Test Login
POST http://localhost:5174/login
Content-Type: application/x-www-form-urlencoded

username=admin&password=yourpass&csrf_token=token
```

### cURL Examples

```bash
# Get OpenAPI spec
curl http://localhost:5174/openapi.json | jq

# Test endpoint (example)
curl -X POST http://localhost:5174/login \
  -d "username=admin&password=pass&csrf_token=token"
```

---

## 🔄 Workflow

### Development Workflow

1. Make API changes (add endpoint, modify schema)
2. Update `app/lib/openapi-spec.ts`
3. Run `npm run export:openapi`
4. Refresh Swagger UI to see changes
5. Test new endpoints

### CI/CD Integration

Add to your build process:

```json
{
  "scripts": {
    "prebuild": "npm run export:openapi",
    "build": "react-router build"
  }
}
```

This ensures the spec is always up-to-date in production.

---

## 📖 Further Reading

- **API Best Practices**: `API_BEST_PRACTICES_IMPLEMENTATION.md`
- **API Versioning**: `API_VERSIONING_GUIDE.md`
- **Implementation Details**: `SWAGGER_DOCUMENTATION_IMPLEMENTATION.md`
- **Setup Instructions**: `SWAGGER_SETUP_INSTRUCTIONS.md`

---

## ✅ Summary

**Working URLs:**
- 📚 **Swagger UI**: `http://localhost:5174/api-docs.html`
- 📄 **OpenAPI JSON**: `http://localhost:5174/openapi.json`

**Update Command:**
```bash
npm run export:openapi
```

**Benefits:**
- ✅ Interactive API documentation
- ✅ Test endpoints from browser
- ✅ Import into API tools
- ✅ Generate client SDKs
- ✅ Single source of truth
- ✅ Always up-to-date

**Next Steps:**
1. Open `http://localhost:5174/api-docs.html`
2. Explore the API documentation
3. Try testing some endpoints
4. Import into your favorite API client

Enjoy your fully documented API! 🎉

---

*Last updated: 2026-01-31*
*OpenAPI Version: 3.0.0*
*API Version: 1.0.0*
