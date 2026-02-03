# API Versioning Strategy Guide

## Executive Summary

This document outlines the **recommended API versioning strategy** for the Home Screen Editor application and provides implementation guidance for future API evolution.

**Current Recommendation: Hybrid Approach**
- ✅ **Schema Versioning** (Already Implemented) - For data structure evolution
- ✅ **Semantic Versioning for OpenAPI Spec** - For API contract changes
- 🔄 **URL-Based Versioning** (Future) - Only if breaking API changes are needed

---

## Current Implementation

### ✅ Schema Versioning (v1.0 - Already Implemented)

**Location:** `app/lib/schema-migrations.server.ts`

**What we have:**
```typescript
export const CURRENT_SCHEMA_VERSION = 1;
export const MIN_SUPPORTED_SCHEMA_VERSION = 1;
```

**How it works:**
- Configuration data includes `schemaVersion` field
- Migrations applied automatically during import
- Backwards compatibility for old configurations
- Version validation prevents incompatible imports

**Example:**
```json
{
  "config_id": "mobile",
  "schemaVersion": 1,
  "updatedAt": "2026-01-31T12:00:00.000Z",
  "data": {
    "carousel": { ... },
    "textSection": { ... },
    "cta": { ... }
  }
}
```

**Benefits:**
- ✅ Already implemented and working
- ✅ Handles data structure evolution
- ✅ No API endpoint changes needed
- ✅ Perfect for single-user, self-hosted apps
- ✅ Users can upgrade without breaking old exports

**When to increment schema version:**
- Adding new required fields to configuration
- Changing field types (string → number, etc.)
- Renaming fields
- Removing fields
- Changing validation rules significantly

---

## Recommended API Versioning Approaches

### 1. Current Approach (Recommended for Now): No API Versioning

**Why this works:**

This is a **self-hosted, single-user application** with:
- Schema versioning handles data evolution ✅
- All clients are controlled (same deployment) ✅
- No external API consumers ✅
- Breaking changes can be deployed atomically ✅

**Advantages:**
- ✅ Simplest approach
- ✅ No URL/header complexity
- ✅ Easy to maintain
- ✅ Perfect for current use case

**Continue this approach until:**
- Multiple client applications need to connect
- Mobile apps with slow update cycles
- External integrations are added
- Need to support multiple API versions simultaneously

---

### 2. URL-Based Versioning (Future: If Needed)

**Pattern:** `/api/v1/config`, `/api/v2/config`

**When to use:**
- Multiple client applications exist
- Mobile apps in the wild with different versions
- External API consumers
- Need to deprecate old endpoints gradually

**Implementation Example:**

```typescript
// app/routes/api.v1.config.ts
export async function loader() {
  // V1 API implementation
  return ok({ schemaVersion: 1, data: config });
}

// app/routes/api.v2.config.ts
export async function loader() {
  // V2 API implementation with new features
  return ok({ schemaVersion: 2, data: enhancedConfig });
}
```

**Advantages:**
- ✅ Most RESTful and explicit
- ✅ Easy to understand and discover
- ✅ Cache-friendly
- ✅ Can run multiple versions simultaneously

**Disadvantages:**
- ❌ URL duplication
- ❌ More code to maintain
- ❌ Need strategy for deprecation

**Deprecation Strategy:**
```typescript
// After 6 months, add deprecation warning
export async function loader() {
  return ok(data, {
    headers: {
      "Warning": '299 - "API v1 is deprecated. Please migrate to v2 by 2026-12-31"',
      "Sunset": "Sun, 31 Dec 2026 23:59:59 GMT",
    },
  });
}
```

---

### 3. Header-Based Versioning (Alternative)

**Pattern:** `Accept: application/vnd.home-editor.v1+json`

**When to use:**
- Want semantic URLs without version numbers
- Need content negotiation
- RESTful purists
- Multiple representations of same resource

**Implementation Example:**

```typescript
export async function loader({ request }: Route.LoaderArgs) {
  const accept = request.headers.get("Accept");
  const version = parseAcceptHeader(accept); // Extract version

  switch (version) {
    case 1:
      return respondV1(config);
    case 2:
      return respondV2(config);
    default:
      return respondLatest(config);
  }
}
```

**Advantages:**
- ✅ Clean URLs
- ✅ Standard HTTP content negotiation
- ✅ Flexible versioning per endpoint

**Disadvantages:**
- ❌ Harder to test/debug
- ❌ Not browser-friendly
- ❌ Requires header parsing logic
- ❌ Less discoverable

---

### 4. Query Parameter Versioning (Not Recommended)

**Pattern:** `/api/config?version=1`

**Why not recommended:**
- ❌ Breaks HTTP caching
- ❌ Optional parameter = unclear default
- ❌ Less RESTful
- ❌ Harder to deprecate

**Only consider if:**
- Need to support legacy clients that can't change URLs
- Temporary migration strategy

---

## Recommended Strategy for This Application

### Phase 1: Current (v1.0) - No API Versioning ✅

**Status:** Implemented

**What to do:**
- ✅ Keep using schema versioning for data
- ✅ Make additive changes only (no breaking changes)
- ✅ Document all API changes in OpenAPI spec
- ✅ Use semantic versioning for OpenAPI spec itself

**Additive changes (safe, no version needed):**
- Adding optional fields
- Adding new endpoints
- Adding new query parameters (with defaults)
- Adding new error codes
- Expanding enums

**Example - Safe additive change:**
```typescript
// V1 schema
interface AppConfig {
  carousel: { ... };
  textSection: { ... };
  cta: { ... };
}

// V1.1 schema - SAFE (optional field)
interface AppConfig {
  carousel: { ... };
  textSection: { ... };
  cta: { ... };
  footer?: { // ✅ Optional - backwards compatible
    text: string;
    backgroundColor: string;
  };
}
```

---

### Phase 2: If External Consumers Appear - Add URL Versioning

**Trigger:** When any of these happen:
- Mobile app released (slower update cycle)
- External integrations requested
- Partner API access granted
- Need to support multiple versions simultaneously

**Implementation Steps:**

1. **Restructure routes with versioning:**
```
app/routes/
  api.v1.config.ts
  api.v1.versions.ts
  api.v1.import.ts
  api.v1.export.ts
```

2. **Update OpenAPI spec:**
```typescript
servers: [
  {
    url: "http://localhost:5175/api/v1",
    description: "API Version 1 (Current)",
  },
],
```

3. **Implement version detection:**
```typescript
// app/lib/api-version.server.ts
export function getApiVersion(request: Request): number {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v(\d+)/);
  return match ? parseInt(match[1], 10) : 1; // Default to v1
}
```

4. **Add deprecation timeline:**
```typescript
// Support matrix
const API_SUPPORT = {
  v1: {
    introduced: "2026-01-31",
    deprecated: null, // Still active
    sunset: null,
  },
  v2: {
    introduced: "2026-06-01", // When v2 is added
    deprecated: null,
    sunset: null,
  },
};
```

---

### Phase 3: Deprecation and Sunset

**Policy Recommendation:**

1. **Support Window:** Maintain old version for **6 months** after new version release
2. **Deprecation Notice:** 3 months before sunset
3. **Sunset Date:** Clearly communicate removal date

**Communication Strategy:**

1. **In API Response Headers:**
```typescript
{
  "Warning": "299 - API v1 is deprecated. Migrate to v2 by 2026-12-31",
  "Sunset": "Sun, 31 Dec 2026 23:59:59 GMT",
  "Link": "</api-docs/migration-guide>; rel=\"deprecation\""
}
```

2. **In API Documentation:**
```markdown
## ⚠️ Deprecation Notice

API v1 will be sunset on **December 31, 2026**.

- **What this means:** v1 endpoints will stop working
- **What you need to do:** Migrate to v2 before sunset date
- **Migration guide:** [See migration guide](/api-docs/migration-guide)
```

3. **In Application Logs:**
```typescript
if (apiVersion === 1 && isSunsetApproaching()) {
  logger.warn("Client using deprecated API v1", {
    clientIp: getClientIp(request),
    sunsetDate: "2026-12-31",
  });
}
```

---

## Versioning Best Practices

### DO ✅

1. **Use Schema Versioning for Data**
   - Already implemented
   - Perfect for configuration evolution
   - Automatic migrations

2. **Make Additive Changes When Possible**
   - Add optional fields, not change existing ones
   - Add new endpoints, don't break old ones
   - Backwards compatibility first

3. **Document Everything**
   - Update OpenAPI spec with every change
   - Include migration guides for breaking changes
   - Changelog for every release

4. **Version the API Spec Itself**
   ```json
   {
     "openapi": "3.0.0",
     "info": {
       "version": "1.2.0"  // ✅ Semantic versioning
     }
   }
   ```

5. **Test Backwards Compatibility**
   - Run old client tests against new API
   - Automated compatibility checks
   - Don't break old exports

### DON'T ❌

1. **Don't Version Too Early**
   - Current approach (no API versioning) is fine
   - Add versioning only when needed
   - Avoid premature complexity

2. **Don't Support Versions Forever**
   - Maintain deprecation policy
   - Sunset old versions
   - Limit to 2-3 active versions max

3. **Don't Change Existing Fields**
   ```typescript
   // ❌ BAD - Breaking change
   interface AppConfig {
     carousel: {
       imageUrl: string; // Changed from images: string[]
     };
   }

   // ✅ GOOD - Additive change
   interface AppConfig {
     carousel: {
       images: string[]; // Keep existing
       imageUrls: string[]; // Add new (optional)
     };
   }
   ```

4. **Don't Use Multiple Versioning Schemes**
   - Pick one: URL, header, or query param
   - Don't mix approaches
   - Consistency matters

5. **Don't Skip Documentation**
   - Every API change → OpenAPI spec update
   - Breaking changes → Migration guide
   - Deprecations → Sunset timeline

---

## OpenAPI Spec Semantic Versioning

**Current:** `1.0.0`

**Versioning Scheme:**
- **Major** (1.x.x): Breaking changes to API contract
- **Minor** (x.1.x): Additive changes (new endpoints, optional fields)
- **Patch** (x.x.1): Bug fixes, documentation updates

**Examples:**

```typescript
// Version 1.0.0 → 1.1.0 (Minor)
// Added optional field
interface AppConfig {
  carousel: { ... };
  textSection: { ... };
  cta: { ... };
  footer?: { ... }; // ✅ New optional field
}

// Version 1.1.0 → 2.0.0 (Major)
// Removed required field (breaking)
interface AppConfig {
  carousel: { ... };
  textSection: { ... };
  // cta removed ❌ Breaking change
}

// Version 1.1.0 → 1.1.1 (Patch)
// Fixed error response documentation
// No API contract changes
```

---

## Migration Guide Template

When introducing breaking changes:

```markdown
# Migration Guide: API v1 → v2

## Overview
API v2 introduces enhanced configuration capabilities and removes deprecated endpoints.

## Breaking Changes

### 1. Configuration Schema
**Before (v1):**
\`\`\`json
{
  "carousel": {
    "images": ["url1", "url2"]
  }
}
\`\`\`

**After (v2):**
\`\`\`json
{
  "carousel": {
    "slides": [
      { "imageUrl": "url1", "caption": "Caption 1" },
      { "imageUrl": "url2", "caption": "Caption 2" }
    ]
  }
}
\`\`\`

**Migration Code:**
\`\`\`typescript
function migrateV1toV2(configV1: AppConfigV1): AppConfigV2 {
  return {
    carousel: {
      slides: configV1.carousel.images.map(url => ({
        imageUrl: url,
        caption: "",
      })),
    },
    // ... rest of migration
  };
}
\`\`\`

## Timeline
- **v2 Release:** June 1, 2026
- **v1 Deprecation Notice:** September 1, 2026
- **v1 Sunset:** December 31, 2026

## Testing
Test your integration:
\`\`\`bash
curl -X POST http://localhost:5175/api/v2/config \\
  -H "Content-Type: application/json" \\
  -d @config-v2.json
\`\`\`
```

---

## Comparison: Versioning Approaches

| Approach | Current Fit | Complexity | Discoverability | Caching | RESTful |
|----------|-------------|------------|-----------------|---------|---------|
| **None (Current)** | ✅ Excellent | ⭐ Very Low | ⭐⭐⭐ High | ✅ Yes | ✅ Yes |
| **Schema Only** | ✅ Excellent | ⭐⭐ Low | ⭐⭐⭐ High | ✅ Yes | ✅ Yes |
| **URL Versioning** | 🔄 Future | ⭐⭐⭐ Medium | ⭐⭐⭐ High | ✅ Yes | ✅ Yes |
| **Header Versioning** | ❌ Not needed | ⭐⭐⭐⭐ High | ⭐ Low | ⚠️ Complex | ✅ Yes |
| **Query Param** | ❌ Not recommended | ⭐⭐ Low | ⭐⭐ Medium | ❌ No | ❌ No |

---

## Decision Tree

```
Do you need API versioning?
│
├─ No external consumers? → ✅ Use current approach (schema versioning only)
│  └─ All clients controlled by you
│  └─ Can deploy breaking changes atomically
│
├─ External consumers but all can update quickly?
│  └─ ✅ Use schema versioning + deprecation warnings
│  └─ Give 30-day notice for breaking changes
│
├─ External consumers with slow update cycles?
│  └─ 🔄 Add URL-based versioning (/api/v1/...)
│  └─ Support old versions for 6 months
│  └─ Clear deprecation timeline
│
└─ Need multiple representations of same resource?
   └─ Consider header-based versioning
   └─ Use content negotiation
```

---

## Conclusion

### Current Recommendation ✅

**For this application:**
1. ✅ **Continue using schema versioning** (already implemented)
2. ✅ **Version the OpenAPI spec semantically** (1.0.0, 1.1.0, 2.0.0)
3. ✅ **Make additive changes only** (avoid breaking changes)
4. 🔄 **Add URL versioning later** (only if external consumers appear)

**Why this works:**
- Self-hosted, single-user application
- Schema versioning handles data evolution elegantly
- All clients are controlled (same deployment)
- Simplest approach until complexity is needed
- Easy to add URL versioning later if required

### Future Evolution Path

```
Phase 1 (Current): Schema Versioning Only
  ↓
Phase 2 (If Needed): Schema + URL Versioning
  ↓
Phase 3 (Complex): Multiple API versions with deprecation
```

Start simple, add complexity only when needed. The current approach is **perfect for now** and leaves the door open for future evolution.

---

*Document Version: 1.0.0*
*Last Updated: 2026-01-31*
*Status: Current Recommendation ✅*
