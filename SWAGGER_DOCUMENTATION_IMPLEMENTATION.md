# Swagger/OpenAPI Documentation Implementation

## Overview

This document summarizes the implementation of comprehensive API documentation using OpenAPI 3.0 specification and Swagger UI for the Home Screen Editor application.

**Implementation Date:** 2026-01-31
**OpenAPI Version:** 3.0.0
**API Version:** 1.0.0

---

## What Was Implemented

### 1. ✅ OpenAPI 3.0 Specification

**File:** `app/lib/openapi-spec.ts`

**Features:**
- Complete API specification in OpenAPI 3.0 format
- All endpoints documented (Login, Setup, Configuration Management)
- Request/response schemas with examples
- Error responses with status codes
- Security scheme definitions (cookie authentication)
- Type-safe TypeScript export

**Endpoints Documented:**
- `POST /login` - User authentication
- `POST /setup` - Initial setup (create admin user)
- `GET /` - Load configuration
- `POST /` - Configuration actions (save, version, import, export, restore)

**Components:**
- AppConfig schema (carousel, textSection, cta)
- ConfigVersion schema
- Error responses with machine-readable codes
- Request/response types for all actions

---

### 2. ✅ Swagger UI Route

**File:** `app/routes/api-docs.tsx`

**What it does:**
- Serves interactive Swagger UI documentation
- Loads OpenAPI spec from `/openapi` endpoint
- Provides "Try it out" functionality
- Displays request/response examples
- Shows authentication requirements

**Access:** `http://localhost:5177/api-docs`

**Features:**
- Interactive API explorer
- Request testing directly from browser
- Schema visualization
- Example values
- HTTP status code explanations
- Download spec button

---

### 3. ✅ OpenAPI Spec JSON Endpoint

**File:** `app/routes/openapi.tsx`

**What it does:**
- Serves OpenAPI specification as JSON
- CORS enabled for API documentation tools
- Used by Swagger UI
- Can be imported into Postman, Insomnia, etc.

**Access:** `http://localhost:5177/openapi`

**Example Output:**
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Home Screen Editor API",
    "version": "1.0.0",
    "description": "REST API for managing home screen configurations..."
  },
  "servers": [
    {
      "url": "http://localhost:5175",
      "description": "Development server"
    }
  ],
  "paths": {
    "/login": { ... },
    "/": { ... }
  },
  "components": { ... }
}
```

---

## API Documentation Highlights

### Authentication

```yaml
Security Scheme: cookieAuth
Type: API Key
In: cookie
Name: auth_token
Description: Authentication cookie set during login
```

All protected endpoints require authentication cookie.

### Error Responses

All errors follow consistent format:

```typescript
{
  error: string;         // Human-readable message
  code: ErrorCodeType;   // Machine-readable code
  details?: string;      // Optional additional info
}
```

**Error Codes Documented:**
- UNAUTHORIZED (401)
- INVALID_CSRF (403)
- VALIDATION_ERROR (400)
- INVALID_CONFIG_ID (400)
- CONFIG_NOT_FOUND (404)
- VERSION_NOT_FOUND (404)
- PAYLOAD_TOO_LARGE (413)
- INTERNAL_ERROR (500)
- [... 19 total error codes]

### Request/Response Examples

Every endpoint includes:
- ✅ Request body schema with examples
- ✅ Response schema for success cases
- ✅ Error response examples with status codes
- ✅ Parameter descriptions
- ✅ Required/optional field indicators

**Example - Save Configuration:**

```yaml
POST /
Request:
  intent: "save"
  config: '{"carousel":{"images":[...],"aspectRatio":"landscape"},...}'
  currentConfigId: "mobile"
  csrf_token: "abc123"

Response 200:
  {
    "success": true,
    "savedAt": "2026-01-31T12:00:00.000Z"
  }

Response 400:
  {
    "error": "Configuration ID must contain only letters, numbers, hyphens, and underscores (1-50 characters)",
    "code": "INVALID_CONFIG_ID"
  }
```

---

## How to Use

### 1. Access Swagger UI

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open browser to:
   ```
   http://localhost:5177/api-docs
   ```

3. Explore endpoints:
   - Click on endpoint to expand
   - Click "Try it out" to test
   - Fill in parameters
   - Click "Execute"
   - View response

### 2. Import into API Clients

**Postman:**
1. File → Import
2. Enter URL: `http://localhost:5177/openapi`
3. Import collection

**Insomnia:**
1. Application → Preferences → Data
2. Import Data → From URL
3. Enter: `http://localhost:5177/openapi`

**VS Code REST Client:**
```http
### GET OpenAPI Spec
GET http://localhost:5177/openapi
```

### 3. Generate Client SDKs

Use OpenAPI Generator to create client libraries:

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:5177/openapi \
  -g typescript-fetch \
  -o ./generated/api-client

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:5177/openapi \
  -g python \
  -o ./generated/python-client
```

---

## OpenAPI Spec Structure

### Information Block

```typescript
{
  title: "Home Screen Editor API",
  version: "1.0.0",  // Semantic versioning
  description: "REST API for managing home screen configurations...",
  contact: { ... },
  license: {
    name: "MIT",
    url: "https://opensource.org/licenses/MIT"
  }
}
```

### Servers

```typescript
servers: [
  {
    url: "http://localhost:5175",
    description: "Development server"
  }
]
```

Update this for production deployment.

### Tags

Endpoints are organized by tags:
- **Authentication** - Login and setup
- **Configuration** - Config management
- **Versioning** - Version control
- **Import/Export** - Data transfer

### Schemas

All TypeScript types from `app/lib/api-types.ts` are represented:

```typescript
components: {
  schemas: {
    ErrorResponse: { ... },
    AppConfig: { ... },
    ConfigVersion: { ... },
    SaveConfigRequest: { ... },
    SaveConfigResponse: { ... },
    // ... all request/response types
  }
}
```

---

## Maintenance

### When to Update OpenAPI Spec

Update `app/lib/openapi-spec.ts` when you:

1. **Add new endpoints**
   ```typescript
   paths: {
     "/new-endpoint": {
       post: { ... }
     }
   }
   ```

2. **Change request/response schemas**
   ```typescript
   // Add new field to AppConfig
   AppConfig: {
     properties: {
       newField: { type: "string" }  // Add this
     }
   }
   ```

3. **Add new error codes**
   ```typescript
   ErrorResponse: {
     properties: {
       code: {
         enum: [
           "EXISTING_CODE",
           "NEW_ERROR_CODE"  // Add this
         ]
       }
     }
   }
   ```

4. **Change status codes**
   ```typescript
   responses: {
     "404": {  // Was 400, now 404
       description: "Resource not found"
     }
   }
   ```

5. **Update API version**
   ```typescript
   info: {
     version: "1.1.0"  // Increment version
   }
   ```

### Versioning the OpenAPI Spec

Follow semantic versioning:

- **Major** (1.x.x → 2.x.x): Breaking API changes
- **Minor** (x.1.x → x.2.x): New endpoints, optional fields
- **Patch** (x.x.1 → x.x.2): Documentation fixes, examples

**Current Version:** 1.0.0

---

## Integration with TypeScript Types

The OpenAPI spec mirrors the TypeScript types in `app/lib/api-types.ts`:

```typescript
// TypeScript (Source of Truth)
export interface SaveConfigResponse {
  success: true;
  savedAt: string;
}

// OpenAPI (Documentation)
SaveConfigResponse: {
  type: "object",
  required: ["success", "savedAt"],
  properties: {
    success: { type: "boolean", enum: [true] },
    savedAt: { type: "string", format: "date-time" }
  }
}
```

**Best Practice:** When adding new types to `api-types.ts`, immediately update the corresponding OpenAPI schema.

---

## Testing the Documentation

### Manual Testing

1. **Visual Inspection:**
   - Open Swagger UI at `/api-docs`
   - Check all endpoints are listed
   - Verify examples are present
   - Ensure schemas are correct

2. **Try It Out:**
   - Test each endpoint using Swagger UI
   - Verify request validation
   - Check response format
   - Confirm error handling

3. **Schema Validation:**
   ```bash
   # Install validator
   npm install -g @apidevtools/swagger-cli

   # Validate spec
   swagger-cli validate app/lib/openapi-spec.ts
   ```

### Automated Testing

```typescript
// tests/api-spec.test.ts
import { openApiSpec } from '../app/lib/openapi-spec';
import { validate } from 'openapi-schema-validator';

describe('OpenAPI Specification', () => {
  it('should be valid OpenAPI 3.0', () => {
    const validator = new validate.OpenAPISchemaValidator({ version: 3 });
    const result = validator.validate(openApiSpec);
    expect(result.errors).toHaveLength(0);
  });

  it('should document all error codes', () => {
    const errorCodes = openApiSpec.components.schemas.ErrorResponse.properties.code.enum;
    const expectedCodes = Object.values(ErrorCode);
    expect(errorCodes).toEqual(expect.arrayContaining(expectedCodes));
  });
});
```

---

## Benefits

### For Developers

1. **✅ Single Source of Truth**
   - API contract clearly defined
   - No ambiguity about request/response formats
   - Easy to reference during development

2. **✅ Interactive Testing**
   - Test APIs without writing code
   - Experiment with different inputs
   - See immediate responses

3. **✅ Code Generation**
   - Generate client libraries automatically
   - Type-safe SDKs in multiple languages
   - Reduce boilerplate code

4. **✅ Documentation**
   - Self-documenting API
   - Always up-to-date (if maintained)
   - Searchable and filterable

### For API Consumers

1. **✅ Discovery**
   - See all available endpoints
   - Understand authentication requirements
   - Learn error handling

2. **✅ Examples**
   - Real-world request examples
   - Expected response formats
   - Error scenarios documented

3. **✅ Validation**
   - Know what's required vs optional
   - Understand field formats and constraints
   - See validation rules

### For QA/Testing

1. **✅ Contract Testing**
   - Verify API matches specification
   - Automated contract validation
   - Catch breaking changes early

2. **✅ Test Case Generation**
   - Generate test cases from spec
   - Cover all endpoints systematically
   - Validate error scenarios

---

## Future Enhancements

### 1. API Mocking

Generate mock server from OpenAPI spec:

```bash
# Using Prism
npm install -g @stoplight/prism-cli

# Start mock server
prism mock app/lib/openapi-spec.ts
```

### 2. Automated Spec Generation

Consider tools that generate OpenAPI from TypeScript:

- **tsoa** - TypeScript decorators → OpenAPI
- **typescript-json-schema** - TS types → JSON Schema
- Custom generator using TypeScript Compiler API

### 3. API Versioning

When API v2 is needed:

```typescript
servers: [
  {
    url: "http://localhost:5175/api/v1",
    description: "API Version 1"
  },
  {
    url: "http://localhost:5175/api/v2",
    description: "API Version 2"
  }
]
```

### 4. Response Examples

Add more realistic examples:

```typescript
examples: {
  successfulSave: {
    summary: "Successful save",
    value: {
      success: true,
      savedAt: "2026-01-31T12:34:56.789Z"
    }
  },
  withVersion: {
    summary: "Save with version creation",
    value: {
      success: true,
      savedAt: "2026-01-31T12:34:56.789Z",
      versionCreated: true,
      versionNumber: 3
    }
  }
}
```

### 5. Webhooks Documentation

If webhooks are added later:

```typescript
webhooks: {
  configUpdated: {
    post: {
      requestBody: {
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ConfigUpdateEvent" }
          }
        }
      }
    }
  }
}
```

---

## Troubleshooting

### Swagger UI Not Loading

**Problem:** Blank page at `/api-docs`

**Solutions:**
1. Check browser console for errors
2. Verify `/openapi` endpoint returns JSON
3. Check CORS headers if accessing from different origin
4. Ensure Swagger UI CDN is accessible

### OpenAPI Spec Invalid

**Problem:** Validation errors

**Solutions:**
1. Use online validator: https://editor.swagger.io/
2. Check for typos in enum values
3. Ensure all $ref paths are correct
4. Validate required fields are present

### Routes Not Found (404)

**Problem:** `/api-docs` or `/openapi` returns 404

**Solutions:**
1. Restart dev server to rediscover routes
2. Check route file naming matches React Router conventions
3. Verify files are in `app/routes/` directory
4. Check for TypeScript compilation errors

### Spec Out of Sync

**Problem:** Documentation doesn't match actual API

**Solutions:**
1. Update OpenAPI spec when changing API
2. Add pre-commit hook to validate spec
3. Include spec updates in PR checklist
4. Automate spec generation if possible

---

## Comparison: Before vs After

### Before Implementation

- ❌ No centralized API documentation
- ❌ Developers had to read source code
- ❌ No way to test APIs without writing code
- ❌ Unclear what parameters are required
- ❌ Error responses undocumented
- ❌ No standard for API consumers

### After Implementation

- ✅ Interactive Swagger UI documentation
- ✅ Complete OpenAPI 3.0 specification
- ✅ Test APIs directly from browser
- ✅ All parameters, types, and constraints documented
- ✅ All error codes and responses documented
- ✅ Can generate client SDKs automatically
- ✅ Single source of truth for API contract
- ✅ Import into Postman/Insomnia

---

## Related Documentation

- **API Types:** `app/lib/api-types.ts`
- **API Best Practices:** `API_BEST_PRACTICES_IMPLEMENTATION.md`
- **API Versioning:** `API_VERSIONING_GUIDE.md`
- **OpenAPI Spec:** `app/lib/openapi-spec.ts`

---

## Conclusion

✅ **OpenAPI 3.0 Specification:** Complete and comprehensive
✅ **Swagger UI:** Interactive documentation at `/api-docs`
✅ **JSON Endpoint:** Spec available at `/openapi`
✅ **All Endpoints Documented:** Login, Setup, Configuration
✅ **Error Codes:** All 19 error codes documented
✅ **Examples:** Request/response examples for all operations
✅ **Type-Safe:** Mirrors TypeScript type definitions

The API is now fully documented with industry-standard OpenAPI specification, making it easy for developers to understand, test, and integrate with the Home Screen Editor API.

---

*Implementation completed: 2026-01-31*
*OpenAPI Version: 3.0.0*
*API Version: 1.0.0*
*Status: Complete ✅*
