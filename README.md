# Mobile App Home Screen Editor

A full-stack web application that allows users to preview and modify a mobile app home screen in real time. Users can configure a screen with an image carousel, a text section, and a call-to-action (CTA) button. The configuration is persisted via a private REST API and restored on page reload.

## Features

### Core Functionality
- **Live Preview** - Real-time mobile phone mockup that updates instantly as you edit
- **Image Carousel** - Add, remove, reorder images with drag-and-drop; supports portrait/landscape/square aspect ratios
- **Text Section** - Editable title and description with customizable hex colors
- **Call-to-Action** - Configurable button label, URL, and colors (background + text)
- **Import/Export** - Backup and restore configurations via JSON files
- **Version History** - Save snapshots and restore previous versions
- **Multiple Configurations** - Create and switch between different configurations
- **API Token Management** - Generate and revoke API tokens via the Settings page for programmatic access

### Technical Features
- 🚀 Server-side rendering with React Router 7
- 🔒 Private authentication (PBKDF2 password hashing, HttpOnly cookies)
- 🛡️ CSRF protection (double-submit cookie pattern)
- ⏱️ Rate limiting (login attempts + API requests)
- 📏 Request size limits (DoS protection)
- 📝 Structured JSON logging (Pino)
- ✅ Comprehensive test suite (577+ tests)
- 🎨 Responsive UI with TailwindCSS

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                  BROWSER                                     │
│  ┌─────────────────────┐    ┌─────────────────────┐                         │
│  │      Editor         │    │      Preview        │                         │
│  │  ┌───────────────┐  │    │  ┌───────────────┐  │                         │
│  │  │ CarouselSection│  │    │  │    Phone      │  │                         │
│  │  │ TextSection   │  │◄───┤  │    Mockup     │  │  Real-time updates      │
│  │  │ CTASection    │  │    │  │               │  │                         │
│  │  └───────────────┘  │    │  └───────────────┘  │                         │
│  └─────────────────────┘    └─────────────────────┘                         │
│            │                                                                 │
│            │ useFetcher (form submissions)                                   │
│            ▼                                                                 │
└────────────┬────────────────────────────────────────────────────────────────┘
             │ HTTP (cookies: auth_token, csrf_token)
             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REACT ROUTER SERVER                                │
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │     Loaders      │    │     Actions      │    │   API Routes     │       │
│  │  (GET requests)  │    │ (POST/PUT/PATCH) │    │  /api/v1/*       │       │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘       │
│           │                       │                       │                  │
│           └───────────────────────┼───────────────────────┘                  │
│                                   │                                          │
│                                   ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        SERVER-ONLY MODULES                            │   │
│  │   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │   │
│  │   │auth.server │  │csrf.server │  │rate-limit  │  │ db.server  │     │   │
│  │   │    .ts     │  │    .ts     │  │ .server.ts │  │    .ts     │     │   │
│  │   └────────────┘  └────────────┘  └────────────┘  └─────┬──────┘     │   │
│  │   (tokens,        (CSRF          (in-memory             │            │   │
│  │    passwords)     validation)     counters)             │            │   │
│  └─────────────────────────────────────────────────────────┼────────────┘   │
│                                                            │                 │
└────────────────────────────────────────────────────────────┼─────────────────┘
                                                             │
                                                             ▼
                                               ┌─────────────────────────┐
                                               │    SQLite Database      │
                                               │   ./data/database.db    │
                                               │                         │
                                               │  ┌─────────────────┐    │
                                               │  │     users       │    │
                                               │  ├─────────────────┤    │
                                               │  │   auth_tokens   │    │
                                               │  ├─────────────────┤    │
                                               │  │ configurations  │    │
                                               │  ├─────────────────┤    │
                                               │  │config_versions  │    │
                                               │  └─────────────────┘    │
                                               └─────────────────────────┘
```

### Key Architectural Decisions

1. **Server-Side Mediation via Loaders/Actions**: The browser never directly calls `/api/v1/*` endpoints. Instead:
   - **Loaders** (GET requests): Fetch initial data server-side before page renders
   - **Actions** (POST/PUT/PATCH): Handle form submissions and mutations server-side
   - Both directly access `db.server.ts` - no HTTP calls to API routes

2. **`.server.ts` Convention**: Files ending in `.server.ts` are never bundled to the client, ensuring secrets (passwords, tokens, env vars) stay server-side.

3. **Stateful Authentication**: Opaque tokens stored in SQLite (not JWTs) allow instant revocation and server-side session management.

4. **Real-time Preview**: Local React state provides instant UI updates; server persistence happens via form submissions.

5. **Intent-Based Actions**: The `/home` action handler uses an `intent` field to multiplex operations:
   ```typescript
   // Browser sends: { intent: "save", configId: "default", config: "{...}" }
   // Action routes to appropriate handler based on intent
   ```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Create new user account |
| POST | `/api/v1/auth/login` | Authenticate and receive token |
| POST | `/api/v1/auth/logout` | Invalidate auth token |

### Configurations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/configs` | List all user's configurations |
| POST | `/api/v1/configs` | Create new configuration |
| GET | `/api/v1/configs/:configId` | Get configuration by ID |
| PUT | `/api/v1/configs/:configId` | Update configuration |
| GET | `/api/v1/configs/:configId/export` | Export as JSON file |
| POST | `/api/v1/configs/import` | Import from JSON file |

### Version History
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/configs/:configId/versions` | List version history |
| POST | `/api/v1/configs/:configId/versions` | Create version snapshot |
| GET | `/api/v1/configs/:configId/versions/:version` | Get specific version |
| POST | `/api/v1/versions/:version/restore` | Restore a version |

### User Preferences
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/v1/user/preferences` | Update last viewed config |

### API Tokens
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/api-tokens` | List all API tokens (masked) |
| POST | `/api/v1/api-tokens` | Create new API token (browser auth only) |
| DELETE | `/api/v1/api-tokens/:tokenId` | Revoke an API token |

### Settings Page
The `/settings` page provides a UI for managing API tokens:
- Create tokens with custom names
- View existing tokens with masked previews
- Copy newly created tokens (shown only once)
- Revoke tokens when no longer needed

### Import/Export JSON Schema

The import/export feature uses a standardized JSON format for configuration backup and restore.

**Export Format** (returned by `GET /api/v1/configs/:configId/export`):

```json
{
  "id": 42,
  "user_id": 1,
  "config_id": "my-config",
  "schemaVersion": 1,
  "updatedAt": "2024-01-15T10:30:00.000Z",
  "data": {
    "carousel": {
      "images": [
        "https://example.com/image1.jpg",
        "https://example.com/image2.jpg"
      ],
      "aspectRatio": "landscape"
    },
    "textSection": {
      "title": "Welcome",
      "titleColor": "#000000",
      "description": "Your description here",
      "descriptionColor": "#666666"
    },
    "cta": {
      "label": "Get Started",
      "url": "https://example.com",
      "backgroundColor": "#007AFF",
      "textColor": "#FFFFFF"
    },
    "sectionOrder": ["carousel", "textSection", "cta"]
  }
}
```

**Import Requirements** (for `POST /api/v1/configs/import`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `config_id` | string | ✓ | Configuration identifier (alphanumeric, hyphens, underscores, 1-50 chars) |
| `schemaVersion` | number | ✓ | Schema version (currently `1`) |
| `updatedAt` | string | ✓ | ISO 8601 timestamp |
| `data` | object | ✓ | Configuration payload (see below) |
| `id` | number | | Ignored on import |
| `user_id` | number | | Ignored on import (uses authenticated user) |

**Configuration Payload (`data`):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `carousel.images` | string[] | ✓ | Array of valid image URLs (max 50) |
| `carousel.aspectRatio` | string | ✓ | `"portrait"`, `"landscape"`, or `"square"` |
| `textSection.title` | string | ✓ | Title text |
| `textSection.titleColor` | string | ✓ | Hex color (`#RGB` or `#RRGGBB`) |
| `textSection.description` | string | ✓ | Description text |
| `textSection.descriptionColor` | string | ✓ | Hex color (`#RGB` or `#RRGGBB`) |
| `cta.label` | string | ✓ | Button label |
| `cta.url` | string | ✓ | Valid URL (http/https/mailto/tel) |
| `cta.backgroundColor` | string | ✓ | Hex color (`#RGB` or `#RRGGBB`) |
| `cta.textColor` | string | ✓ | Hex color (`#RGB` or `#RRGGBB`) |
| `sectionOrder` | string[] | | Custom section ordering (defaults to `["carousel", "textSection", "cta"]`) |

**Schema Migration:**

The import endpoint automatically migrates older schema versions to the current version. The `schemaVersion` field tracks the data structure version for backward compatibility.

## Storage Tradeoffs

### Why SQLite?

| Factor | SQLite | PostgreSQL/MySQL | File-based JSON |
|--------|--------|------------------|-----------------|
| **Setup complexity** | Zero config, single file | Requires server setup | Zero config |
| **Deployment** | Just copy the file | Separate service needed | Just copy files |
| **Concurrent writes** | WAL mode handles well | Excellent | Poor (race conditions) |
| **Querying** | Full SQL support | Full SQL support | Must load entire file |
| **Transactions** | ACID compliant | ACID compliant | Manual implementation |
| **Scalability** | Single server | Horizontal scaling | Single server |
| **Backup** | Copy single file | pg_dump/mysqldump | Copy files |

**Decision**: SQLite was chosen because:
1. **Simplicity** - No separate database server to configure or maintain
2. **Portability** - Single file can be easily backed up or moved
3. **Performance** - WAL mode provides excellent read/write concurrency for this use case
4. **ACID compliance** - Full transaction support for data integrity
5. **Sufficient scale** - Handles thousands of configurations easily; most take-home projects don't need horizontal scaling

**When to migrate to PostgreSQL**:
- Multiple application servers need to write simultaneously
- Dataset grows beyond ~100GB
- Need advanced features (full-text search, JSON operators, pub/sub)

## Notable Tradeoffs & Assumptions

### Design Decisions

| Decision | Tradeoff | Rationale |
|----------|----------|-----------|
| **Opaque tokens vs JWT** | Requires database lookup on every request | Enables instant revocation, no token expiry race conditions |
| **In-memory rate limiting** | Resets on server restart, not shared across instances | Simple implementation; Redis recommended for production clusters |
| **Manual validation vs Zod** | More verbose code | Zero bundle size impact, custom error messages, stable schema |
| **Embedded schema vs migrations** | Less flexible for complex changes | Simpler deployment, automatic on startup |
| **SQLite vs PostgreSQL** | Single-server only | Zero configuration, portable, sufficient for project scope |
| **JSON.stringify for change detection** | O(n) serialization on config changes | Simple, accurate detection of any change including "undo to original" |

### Change Detection (hasUnsavedChanges)

The editor tracks unsaved changes by comparing JSON-serialized configs:

```typescript
const [lastSavedConfig, setLastSavedConfig] = useState<string>(JSON.stringify(serverConfig));

const hasUnsavedChanges = useMemo(() => {
  return JSON.stringify(config) !== lastSavedConfig;
}, [config, lastSavedConfig]);
```

**Why this approach?**

| Approach | Pros | Cons |
|----------|------|------|
| **JSON.stringify (current)** | Accurate; detects "undo to original"; no dependencies | O(n) serialization per change |
| Dirty flag on input | O(1) performance | Can't detect if user reverts to original state |
| Deep equality library | Faster than stringify for nested objects | Extra dependency (~2KB) |
| Hash comparison | Smaller comparison string | Still requires O(n) serialization |

**Why it's acceptable for this app:**
- `useMemo` prevents recomputation on re-renders where config hasn't changed
- Home screen configs are small (typically <10KB)
- `JSON.stringify` is highly optimized in modern JS engines
- The benefit of accurate change detection (including detecting "undo") outweighs the cost

**When to reconsider:**
- Configs grow beyond 100KB
- Profiling shows stringify as a bottleneck
- Need to track which specific fields changed

### Assumptions

1. **Single-tenant per browser session** - Users don't share browser sessions
2. **Moderate traffic** - Rate limits tuned for typical usage, not high-scale
3. **Modern browsers** - No IE11 support; uses modern CSS and JS features
4. **Server-side rendering** - Initial page load comes from server, then hydrates
5. **English only** - No internationalization implemented

### Security Assumptions

1. **HTTPS in production** - Cookies use `Secure` flag; assumes TLS termination
2. **Trusted reverse proxy** - Rate limiting by IP assumes proxy sets `X-Forwarded-For` correctly
3. **Server-side secrets** - Environment variables are not exposed to client bundle

## Quick Start

1. **Install dependencies**: `npm install`
2. **Start the app**: `npm run dev`
3. **Open browser**: Navigate to `http://localhost:5173`
4. **Create account**: Follow the setup wizard (first run only)
5. **Edit the preview**: Use the editor panel to modify carousel, text, and CTA
6. **Save changes**: Click "Save" or wait for autosave (3 seconds)
7. **Refresh**: Changes persist across page reloads

**Optional enhancements implemented:**
- ✅ Autosave (3-second debounce)
- ✅ Multiple configurations
- ✅ Version history with restore

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Configuration

Create a `.env` file in the root directory based on `.env.example`:

```bash
cp .env.example .env
```

#### Environment Variables

| Variable | Description | Default | Recommended |
|----------|-------------|---------|-------------|
| `DATABASE_PATH` | Path to SQLite database file | `./data/database.db` | - |
| `AUTH_TOKEN_COOKIE_NAME` | Name of the authentication token cookie | `auth_token` | - |
| `AUTH_TOKEN_DURATION_DAYS` | Token expiration in days | `7` | `7-30` |
| `PASSWORD_HASH_ITERATIONS` | PBKDF2 iterations for password hashing | `100000` | `100000-600000` |
| `CSRF_TOKEN_LENGTH` | CSRF token length in bytes | `32` | `32-64` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `900000` (15 min) | `300000-1800000` |
| `RATE_LIMIT_MAX_LOGIN_ATTEMPTS` | Max login attempts per window | `5` | `3-10` |
| `RATE_LIMIT_MAX_API_REQUESTS` | Max API requests per window | `100` | `50-1000` |
| `MAX_REQUEST_SIZE_AUTH` | Max request size for auth endpoints (bytes) | `10240` (10 KB) | `5120-20480` |
| `MAX_REQUEST_SIZE_CONFIG` | Max request size for config save (bytes) | `102400` (100 KB) | `51200-204800` |
| `MAX_REQUEST_SIZE_DEFAULT` | Default max request size (bytes) | `1048576` (1 MB) | `524288-5242880` |
| `LOG_LEVEL` | Log level (debug, info, warn, error, fatal) | `debug` (dev) / `info` (prod) | `info` |
| `LOG_TO_CONSOLE` | Enable console logging | `true` | `true` |
| `LOG_TO_FILE` | Enable file logging (`logs/app.log`) | `true` | `true` |
| `AUDIT_LOG_TO_DATABASE` | Enable audit logging to SQLite database | `true` | `true` |
| `AUDIT_LOG_TO_FILE` | Enable audit logging to file (`logs/audit.log`) | `true` | `true` |

**Configuration Validation:**
The application uses a centralized configuration module (`app/lib/config.server.ts`) that:
- ✅ Validates all environment variables on startup using [Zod](https://zod.dev/)
- ✅ Provides type-safe access to configuration throughout the app
- ✅ Fails fast with clear error messages if configuration is invalid
- ✅ Includes sensible defaults for all values

**Validation Rules:**
- `AUTH_TOKEN_DURATION_DAYS`: Must be between 1-365 days
- `PASSWORD_HASH_ITERATIONS`: Must be between 10,000-1,000,000 iterations
- `AUTH_TOKEN_COOKIE_NAME`: Must be at least 1 character
- `CSRF_TOKEN_LENGTH`: Must be between 16-64 bytes
- `RATE_LIMIT_WINDOW_MS`: Must be between 60,000-3,600,000 ms (1-60 minutes)
- `RATE_LIMIT_MAX_LOGIN_ATTEMPTS`: Must be between 1-100
- `RATE_LIMIT_MAX_API_REQUESTS`: Must be between 10-10,000
- `MAX_REQUEST_SIZE_AUTH`: Must be between 1,024-102,400 bytes (1 KB-100 KB)
- `MAX_REQUEST_SIZE_CONFIG`: Must be between 10,240-1,048,576 bytes (10 KB-1 MB)
- `MAX_REQUEST_SIZE_DEFAULT`: Must be between 102,400-10,485,760 bytes (100 KB-10 MB)

### Security Features

**🔐 Authentication:**
This application uses **opaque token-based authentication** (stateful tokens):
- Session tokens are cryptographically secure random strings (32 bytes)
- **Tokens are hashed with SHA-256 before storage** - plaintext tokens are never persisted
- Tokens are sent to the client as HttpOnly cookies for security
- Each token has an expiration time for automatic logout
- Tokens can be revoked instantly by deleting from the database
- If the database is compromised, attackers cannot recover session tokens from hashes

**🛡️ CSRF Protection:**
Double Submit Cookie pattern:
- Generates cryptographically secure CSRF tokens (32 bytes by default)
- Validates tokens on all state-changing operations (POST requests)
- Protects against Cross-Site Request Forgery attacks
- Tokens are rotated and validated using constant-time comparison

**⏱️ Rate Limiting:**
In-memory rate limiting to prevent abuse:
- **Login attempts**: 5 per 15 minutes per IP+username (stricter protection against brute force)
- **API requests**: 100 per 15 minutes per IP (all API and auth endpoints)
- All endpoints are protected:
  - `/api/v1/auth/*` (login, logout, register)
  - `/api/v1/configs/*` (all configuration endpoints)
  - `/api/v1/api-tokens/*` (token management)
  - `/api/v1/user/*` (user preferences)
  - `/home` action (editor saves)
- Returns `429 Too Many Requests` with `Retry-After` header
- Automatic cleanup of expired entries
- For production multi-server deployments, consider Redis

**📏 Request Size Limits:**
Prevents DoS attacks and resource exhaustion:
- **Authentication endpoints** (login/register): 10 KB limit (configurable)
- **Config save operations**: 100 KB limit (configurable)
- **Default for all endpoints**: 1 MB limit (configurable)
- Validates both `Content-Length` header and actual body size
- **Streaming validation**: Reads body in chunks and aborts early when limit exceeded (prevents memory exhaustion)
- Returns `413 Payload Too Large` with helpful error messages
- OWASP recommended baseline security practice

**Production hardening**: For defense-in-depth, also enforce limits at the reverse proxy layer:
```nginx
# nginx.conf - reject oversized requests before they reach Node.js
client_max_body_size 1m;
```

**🔑 Token Storage Security:**
Both session tokens (cookies) and API tokens use the same secure storage pattern (similar to GitHub):
- Tokens are hashed with SHA-256 before storage (only the hash is persisted)
- A non-sensitive 8-character prefix is stored for debugging/identification
- Plaintext tokens are returned to the client once and cannot be recovered from the database
- **Database breach protection**: Even if the database is compromised, attackers cannot:
  - Recover session tokens to impersonate users
  - Recover API tokens to access the API
  - Perform offline brute-force attacks (SHA-256 hashes don't reveal token patterns)

**🔒 Additional Security:**
- Password hashing with PBKDF2-HMAC-SHA512 (100,000+ iterations)
- Secure cookie flags (HttpOnly, SameSite=Strict, Secure in production)
- Constant-time comparisons to prevent timing attacks
- Environment variable validation on startup

**🌐 Proxy Trust Configuration:**
Client IP extraction is protected against header spoofing:
- By default (`TRUST_PROXY=false`), proxy headers are **ignored** to prevent IP spoofing attacks
- When enabled (`TRUST_PROXY=true`), trusts `X-Forwarded-For`, `X-Real-IP`, and `CF-Connecting-IP`
- **Only enable when behind a trusted reverse proxy** (nginx, Cloudflare, AWS ALB, etc.)
- Prevents attackers from bypassing rate limits or IP-bound session checks by injecting fake headers

**🛡️ Content Security Policy (CSP):**
Mitigates XSS and controls resource loading:

| Directive | Value | Purpose |
|-----------|-------|---------|
| `default-src` | `'self'` | Default fallback for all resource types |
| `script-src` | `'self' 'unsafe-inline'` | Scripts from same origin (inline needed for React) |
| `style-src` | `'self' 'unsafe-inline' fonts.googleapis.com` | Styles + Google Fonts |
| `img-src` | `'self' https: data: blob:` | **Allows user-provided image URLs** (HTTPS only) |
| `font-src` | `'self' fonts.gstatic.com` | Fonts from same origin + Google |
| `connect-src` | `'self'` | XHR/Fetch to same origin only |
| `frame-ancestors` | `'none'` | Prevents clickjacking (no iframes) |
| `form-action` | `'self'` | Forms submit to same origin only |
| `base-uri` | `'self'` | Prevents base tag injection |
| `object-src` | `'none'` | Disables plugins (Flash, etc.) |

Additional security headers:
- `Strict-Transport-Security` (HSTS) - Forces HTTPS in production
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-Frame-Options: DENY` - Legacy clickjacking protection
- `X-XSS-Protection: 1; mode=block` - Legacy XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer info
- `Permissions-Policy` - Disables geolocation, microphone, camera

**Note on user-provided images:** The `img-src https:` directive allows loading images from any HTTPS URL, which is required for the carousel feature. Images are rendered in `<img>` tags (not executed), and the CSP prevents any script injection via image URLs.

**Security Notes:**
- Higher `PASSWORD_HASH_ITERATIONS` = more secure but slower login/registration
- Adjust `AUTH_TOKEN_DURATION_DAYS` based on your security requirements
- Lower `RATE_LIMIT_MAX_LOGIN_ATTEMPTS` for higher security (may impact UX)
- Stricter `MAX_REQUEST_SIZE_*` limits = better DoS protection (may reject legitimate large requests)
- The `.env` file is gitignored and should never be committed
- Use different values for development, staging, and production environments

### Database Schema

The application uses SQLite with automatic schema initialization. The database is created automatically on first run.

**Schema Management Script:** `scripts/db-init.ts`

A CLI utility for database initialization, inspection, and reset. The script provides three main functions:

| Command | Description |
|---------|-------------|
| `npx tsx scripts/db-init.ts` | Initialize database - creates tables and applies migrations if needed |
| `npx tsx scripts/db-init.ts --status` | Show schema status - displays tables, columns, row counts, and indexes |
| `npx tsx scripts/db-init.ts --reset` | Reset database - **DESTRUCTIVE** - deletes database files completely |

**Script Functions:**

| Function | Purpose |
|----------|---------|
| `ensureDataDir()` | Creates the `data/` directory if it doesn't exist |
| `initializeDatabase()` | Opens SQLite connection, enables WAL mode, applies schema |
| `applyMigrations(db)` | Adds missing columns to existing databases (e.g., `loaded_version`, `api_version`) |
| `showStatus(db)` | Displays all tables, their columns with types, row counts, and indexes |
| `resetDatabase()` | Removes database file and WAL/SHM files for clean slate |

**Example Output (`--status`):**

```
📊 Database Status
──────────────────────────────────────────────────
Path: /path/to/data/database.db

Tables (4):

  users (10 rows)
    - id: INTEGER
    - username: TEXT
    - passwordHash: TEXT
    - salt: TEXT
    - createdAt: TEXT
    - last_config_id: TEXT

  auth_tokens (8 rows)
    - token: TEXT
    - user_id: INTEGER
    - createdAt: TEXT
    - expiresAt: TEXT

  configurations (14 rows)
    - id: INTEGER
    - user_id: INTEGER
    - config_id: TEXT
    - schemaVersion: INTEGER
    - api_version: TEXT
    - updatedAt: TEXT
    - data: TEXT
    - loaded_version: INTEGER

  configuration_versions (325 rows)
    - id: INTEGER
    - configuration_id: INTEGER
    - version: INTEGER
    - createdAt: TEXT
    - data: TEXT

Indexes (4):
  - idx_auth_tokens_user_id on auth_tokens
  - idx_auth_tokens_expiresAt on auth_tokens
  - idx_configurations_user_id on configurations
  - idx_configuration_versions_configuration_id on configuration_versions

Journal mode: wal
```

**Table Details:**

| Table | Column | Type | Description |
|-------|--------|------|-------------|
| `users` | `id` | INTEGER | Auto-increment primary key |
| | `username` | TEXT | Unique username |
| | `passwordHash` | TEXT | PBKDF2-HMAC-SHA512 hash |
| | `salt` | TEXT | Random salt for password hashing |
| | `createdAt` | TEXT | ISO 8601 timestamp |
| | `last_config_id` | TEXT | Last accessed configuration ID |
| `auth_tokens` | `token` | TEXT | Primary key - cryptographically secure random string |
| | `user_id` | INTEGER | Foreign key to users |
| | `createdAt` | TEXT | ISO 8601 timestamp |
| | `expiresAt` | TEXT | ISO 8601 expiration timestamp |
| `api_tokens` | `id` | INTEGER | Auto-increment primary key |
| | `token` | TEXT | Cryptographically secure API token |
| | `user_id` | INTEGER | Foreign key to users |
| | `name` | TEXT | User-defined token name |
| | `createdAt` | TEXT | ISO 8601 timestamp |
| | `lastUsedAt` | TEXT | ISO 8601 timestamp (nullable) |
| `configurations` | `id` | INTEGER | Auto-increment primary key |
| | `user_id` | INTEGER | Foreign key to users |
| | `config_id` | TEXT | User-defined name (e.g., "default", "mobile") |
| | `schemaVersion` | INTEGER | Config data schema version for migrations |
| | `api_version` | TEXT | API version used to save (e.g., "v1") |
| | `updatedAt` | TEXT | ISO 8601 timestamp (for optimistic concurrency) |
| | `data` | TEXT | JSON stringified AppConfig |
| | `loaded_version` | INTEGER | Currently loaded version number (nullable) |
| `configuration_versions` | `id` | INTEGER | Auto-increment primary key |
| | `configuration_id` | INTEGER | Foreign key to configurations |
| | `version` | INTEGER | Sequential version number (1, 2, 3...) |
| | `createdAt` | TEXT | ISO 8601 timestamp |
| | `data` | TEXT | JSON stringified AppConfig snapshot |

**Schema Migrations:**

- **Database schema**: Handled automatically via `ALTER TABLE` migrations in `db.server.ts`
- **Config data schema**: Handled via version migrations in `schema-migrations.server.ts`

The schema is embedded in the application code, not in separate migration files, because:
- Single SQLite file = simple deployment
- Schema is stable (not frequently changing)
- Automatic migrations on startup = zero manual steps

**Migration Note:**
If you're upgrading from a session-based version, run:
```bash
npx tsx migrate-to-tokens.ts
```

### API Data Validation

**Why Manual Validation Instead of Zod?**

This project uses manual runtime validation for API request/response data (`app/lib/validation.ts`) rather than schema validation libraries like Zod, Yup, or io-ts. Here's the reasoning:

| Factor | Our Situation | Decision |
|--------|---------------|----------|
| Schema complexity | ~15 fields, 3 nested objects | Manual is manageable |
| Change frequency | Schema is stable | Low maintenance burden |
| Bundle size | Manual = 0 KB, Zod = ~12 KB | Smaller client bundle |
| Error messages | Custom, user-friendly messages | Full control over UX |
| Type inference | Types defined separately in `types.ts` | Explicit is acceptable |

**What Manual Validation Provides:**
- ✅ Runtime type checking (`typeof`, `Array.isArray`)
- ✅ Format validation (hex colors, URLs, aspect ratios)
- ✅ Business rules (max 50 images, required fields)
- ✅ Multiple errors returned at once
- ✅ Custom error messages for each field
- ✅ Hex color normalization (#RGB → #RRGGBB)

**When to Reconsider (migrate to Zod):**
- Schema grows beyond 30+ fields
- Multiple endpoints need overlapping validation
- Frequent schema changes cause type/validation drift
- Need automatic TypeScript type inference from schemas
- Need coercion (string → number, string → boolean)

**Note:** Environment variables DO use Zod (`app/lib/config.server.ts`) because:
- Fail-fast on startup is critical
- Coercion is needed (env vars are always strings)
- Schema is separate from main application types

**API Response Consistency:**
All error responses include:
- `error`: Human-readable message
- `code`: Machine-readable error code (e.g., `VALIDATION_ERROR`, `STALE_DATA`)
- `details`: Optional additional context
- `requestId`: UUID for tracing/debugging

### OpenAPI Documentation

The API is documented using OpenAPI 3.0 specification (`app/lib/openapi-spec.ts`), served at `/api-docs`.

**Documentation Architecture:**

| File | Purpose |
|------|---------|
| `api-types.ts` | TypeScript interfaces (source of truth for code) |
| `openapi-spec.ts` | OpenAPI 3.0 spec (source of truth for documentation) |
| `validation.ts` | Runtime validation logic |
| `openapi-sync.test.ts` | Validates spec matches types |

**Keeping Docs in Sync:**

The OpenAPI spec is manually maintained alongside TypeScript types. A sync validation test ensures they don't drift:

```bash
# Run sync validation
npm test -- openapi-sync
```

The test validates:
- All error codes in `api-types.ts` are documented in OpenAPI
- All required schema fields are present
- All API endpoints are documented
- Security schemes are correctly defined

**Why Manual OpenAPI Instead of Generation?**

| Approach | Pros | Cons |
|----------|------|------|
| **Manual (current)** | Full control, custom descriptions, no build step | Can drift, requires discipline |
| **Generate from Zod** | Auto-sync with validation | Requires Zod adoption |
| **Generate from TypeScript** | Auto-sync with types | Limited customization, complex setup |

**Future Consideration:** If schema changes become frequent, consider adopting `zod` + `zod-to-openapi` for automatic generation. The current approach works well for a stable schema with infrequent changes.

### Private API Architecture

**Per the spec requirements (Sections 5 & 6):**

> "The browser should communicate only with your app's server layer, not directly with the configuration service."
> "Direct client-side calls from the browser to the configuration service using credentials are not allowed."

This application implements a **strict server-side mediation pattern**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                     │
│                                                                          │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │                    React Components                           │      │
│   │                                                               │      │
│   │   useLoaderData()          useFetcher()                      │      │
│   │        │                        │                             │      │
│   │        │ (reads server data)    │ (submits forms)             │      │
│   │        ▼                        ▼                             │      │
│   │   config, versions,        fetcher.submit({                   │      │
│   │   csrfToken, etc.            intent: "save",                  │      │
│   │                               configId: "...",                │      │
│   │                               config: "..."                   │      │
│   │                             })                                │      │
│   └──────────────────────────────────────────────────────────────┘      │
│                                                                          │
│   ✗ NO fetch() calls to /api/v1/*                                       │
│   ✗ NO API keys or secrets in browser                                   │
│                                                                          │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTP (cookies only: auth_token, csrf_token)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PAGE ROUTES (/home)                              │
│                                                                          │
│   export async function loader() {                                       │
│     // Runs on SERVER before page renders                                │
│     const { getConfig, getConfigVersions } = await import("db.server"); │
│     return { config, versions, csrfToken, ... };                        │
│   }                                                                      │
│                                                                          │
│   export async function action() {                                       │
│     // Runs on SERVER when form submitted                                │
│     const { intent } = Object.fromEntries(await request.formData());    │
│     switch (intent) {                                                    │
│       case "save": saveConfig(...); break;                              │
│       case "saveVersion": createConfigVersion(...); break;              │
│       case "restoreVersion": restoreConfigVersion(...); break;          │
│       // ... etc                                                         │
│     }                                                                    │
│   }                                                                      │
│                                                                          │
│                    │                                                     │
│                    ▼ Direct function calls (no HTTP)                     │
│              db.server.ts (SQLite)                                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                      API ROUTES (/api/v1/*)                              │
│                                                                          │
│   Protected by Bearer token authentication                               │
│                                                                          │
│   For programmatic/external use:                                         │
│    - External service integrations                                       │
│    - CLI tools and scripts                                               │
│    - Automated testing                                                   │
│    - Future mobile app backends                                          │
│                                                                          │
│                    │                                                     │
│                    ▼ Direct function calls (no HTTP)                     │
│              db.server.ts (SQLite)  ◄── Same functions as page routes    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Data Flow Examples:**

| User Action | Browser | Server (loader/action) | Database |
|-------------|---------|------------------------|----------|
| Page load | `useLoaderData()` | `loader()` → `getConfig()` | SELECT |
| Save config | `fetcher.submit({intent:"save"})` | `action()` → `saveConfig()` | UPDATE |
| Create version | `fetcher.submit({intent:"saveVersion"})` | `action()` → `createConfigVersion()` | INSERT |
| Restore version | `fetcher.submit({intent:"restoreVersion"})` | `action()` → `restoreConfigVersion()` | UPDATE |
| Import config | `fetcher.submit({intent:"import"})` | `action()` → `importConfigRecord()` | UPSERT |

**Key Implementation Details:**

1. **Browser → Page Routes Only**: All browser interactions go through `/home` loader/action
2. **API uses Bearer Tokens**: `/api/v1/*` endpoints use `Authorization: Bearer <token>`
3. **Separate Auth Methods**: Browser uses cookies, API uses Bearer tokens

**Service Layer Architecture:**

Both page routes and API routes call the same `db.server.ts` functions, which serve as the application's service layer:

```
┌─────────────────────┐     ┌─────────────────────┐
│   Page Routes       │     │    API Routes       │
│  (cookie + CSRF)    │     │   (Bearer token)    │
│                     │     │                     │
│  /home action       │     │  /api/v1/configs    │
│  /settings action   │     │  /api/v1/api-tokens │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           │    Same function calls    │
           ▼                           ▼
┌─────────────────────────────────────────────────┐
│              db.server.ts (Service Layer)       │
│                                                 │
│  saveConfig(), getConfig(), createConfigVersion │
│  generateApiToken(), listApiTokens(), etc.      │
│                                                 │
│  • Contains all business logic                  │
│  • Single source of truth for data operations   │
│  • Ensures consistent behavior across all paths │
└─────────────────────────────────────────────────┘
                        │
                        ▼
                   SQLite Database
```

This design ensures:
- **Consistency**: Browser UI and API always behave identically
- **Performance**: No HTTP overhead for browser operations
- **Maintainability**: Business logic lives in one place
- **Testability**: Service functions can be unit tested directly

The routes are thin controllers that handle:
1. Authentication (cookies vs Bearer tokens)
2. Input parsing (form data vs JSON)
3. Authorization checks
4. Response formatting

**Using the API Externally:**

```bash
# 1. Login to get a token
curl -X POST http://localhost:5173/api/v1/auth/login \
  -d "username=myuser&password=mypassword"
# Response: { "success": true, "token": "abc123...", ... }

# 2. Use token for subsequent requests
curl -H "Authorization: Bearer abc123..." \
  http://localhost:5173/api/v1/configs

# 3. Logout (invalidate token)
curl -X POST http://localhost:5173/api/v1/auth/logout \
  -H "Authorization: Bearer abc123..."
```

### Server-Side Boundaries

**How Secrets Stay on the Server:**

This application uses React Router's server/client boundary conventions to ensure sensitive code and data never reach the browser:

| Secret/Sensitive Data | Location | Protection |
|----------------------|----------|------------|
| Password hashes | SQLite database | Never exposed via API |
| Auth tokens | `auth.server.ts` | HttpOnly cookies (browser), Bearer tokens (API) |
| CSRF tokens | `csrf.server.ts` | Double-submit cookie pattern (browser only) |
| Environment variables | `config.server.ts` | `.server.ts` suffix = server-only |
| Database connection | `db.server.ts` | Never bundled to client |
| Rate limit state | `rate-limit.server.ts` | In-memory, server-only |

**The `.server.ts` Convention:**

Files ending in `.server.ts` are **never included in the client bundle**. This is enforced by React Router's Vite plugin:

```
app/lib/
├── auth.server.ts        ← Server-only (auth logic, token validation)
├── config.server.ts      ← Server-only (env vars, Zod validation)
├── csrf.server.ts        ← Server-only (CSRF generation/validation)
├── db.server.ts          ← Server-only (SQLite, better-sqlite3)
├── rate-limit.server.ts  ← Server-only (rate limiting state)
├── api-responses.server.ts ← Server-only (response helpers)
├── types.ts              ← Shared (TypeScript types only)
├── validation.ts         ← Shared (runtime validation, no secrets)
└── api-types.ts          ← Shared (API type definitions)
```

**Dynamic Imports in Routes:**

Route loaders/actions use dynamic imports to access server modules:

```typescript
// In api.v1.configs.$configId.tsx
export async function loader({ request }: Route.LoaderArgs) {
  // Dynamic import - only executed on server
  const { validateAuthToken } = await import("../lib/auth.server");
  const { getConfig } = await import("../lib/db.server");
  // ...
}
```

This pattern ensures:
- ✅ Server modules are tree-shaken from client bundle
- ✅ No accidental imports in components (verified: 0 matches)
- ✅ Secrets in env vars stay server-side
- ✅ Database driver (better-sqlite3) never bundled to browser

**Verification:**

You can verify no server code leaks to the client:
```bash
# Build and check client bundle for server imports
npm run build
grep -r "better-sqlite3\|PBKDF2\|process\.env" build/client/ || echo "✓ No server code in client bundle"
```

### Observability & Logging

The application uses structured JSON logging via [pino](https://getpino.io/) for production-ready observability.

**Logger Module:** `app/lib/logger.server.ts`

**Log Levels:**

| Level | Usage |
|-------|-------|
| `fatal` | Application crash, unrecoverable errors |
| `error` | Operation failed (5xx responses) |
| `warn` | Client errors (4xx responses), potential issues |
| `info` | Normal operations (successful CRUD, auth events) |
| `debug` | Detailed debugging (disabled in production) |

**What Gets Logged:**

| Event | Fields Logged |
|-------|---------------|
| API errors | `requestId`, `status`, `error`, `errorCode`, `method`, `path`, `userId`, `configId`, `durationMs`, `outcome` |
| API success | `status`, `method`, `path`, `userId`, `configId`, `durationMs`, `outcome` |
| Auth events | `requestId`, `operation`, `username`, `userId`, `durationMs`, `outcome` |

**Example Log Output (JSON):**

```json
{"level":"info","time":"2024-01-15T10:30:45.123Z","service":"screen-preview-api","component":"api","status":200,"method":"GET","path":"/api/v1/configs/default","userId":1,"configId":"default","durationMs":12,"outcome":"success","msg":"API success 200: GET /api/v1/configs/default"}
```

```json
{"level":"warn","time":"2024-01-15T10:30:46.456Z","service":"screen-preview-api","component":"api","requestId":"550e8400-e29b-41d4-a716-446655440000","status":404,"error":"Configuration not found","errorCode":"CONFIG_NOT_FOUND","method":"GET","path":"/api/v1/configs/missing","userId":1,"configId":"missing","durationMs":5,"outcome":"client_error","msg":"API error 404: Configuration not found"}
```

**Environment Behavior:**

| Environment | Log Level | Console Output | File Output |
|-------------|-----------|----------------|-------------|
| Development | `debug` | Pretty-printed (colorized) | `logs/app.log` (JSON) |
| Production | `info` | JSON to stdout | `logs/app.log` (JSON) |
| Test | `silent` | None | None |

**Log File Location:** `logs/app.log`

The `logs/` directory is created automatically on first run and is gitignored.

**Viewing Logs:**

```bash
# Watch log file in real-time
tail -f logs/app.log

# Parse JSON logs with jq
tail -f logs/app.log | jq '.'

# Filter by level
tail -f logs/app.log | jq 'select(.level == "error")'

# Filter by configId
tail -f logs/app.log | jq 'select(.configId == "default")'
```

**Request Tracing:**

Every error response includes a `requestId` (UUID) that is:
- Returned to the client in the response body
- Logged server-side for correlation
- Useful for debugging user-reported issues

### Audit Logging

The application implements **dual-channel audit logging** for security-critical operations, following security best practices for compliance and tamper-resistance.

**Architecture Decision: Why Dual Logging?**

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Database only** | Queryable, joins with user data | Can be modified if DB compromised | Development, simple apps |
| **File only** | Append-only, tamper-resistant | Hard to query, analyze | High-security, compliance |
| **Dual (current)** | Best of both worlds | Slightly more storage | Production recommended |

We chose dual logging because:
1. **Database** provides queryable audit trail for admin dashboards and reporting
2. **File** provides tamper-resistant log that can be shipped to external SIEM systems
3. **Configurable channels** allow disabling either based on deployment needs

**Audited Events:**

| Action | Resource | Details Logged |
|--------|----------|----------------|
| `LOGIN_SUCCESS` | Session | User ID, IP address |
| `LOGIN_FAILED` | Session | Attempted username, reason, IP address |
| `LOGOUT` | Session | User ID, IP address |
| `REGISTER` | User | New user ID, username, IP address |
| `SESSION_IP_MISMATCH` | Session | User ID, stored IP, attempted IP (potential hijacking) |
| `API_TOKEN_CREATED` | API Token | User ID, token name, IP address |
| `API_TOKEN_DELETED` | API Token | User ID, token ID, IP address |
| `API_TOKEN_DELETED_ALL` | API Token | User ID, count deleted, IP address |

**Log Destinations:**

| Channel | Location | Format | Purpose |
|---------|----------|--------|---------|
| Database | `audit_logs` table | Structured rows | Querying, reporting, admin UI |
| File | `logs/audit.log` | JSON (one per line) | Tamper-resistance, SIEM shipping |

**Configuration:**

```bash
# In .env file
AUDIT_LOG_TO_DATABASE=true   # Enable/disable database logging
AUDIT_LOG_TO_FILE=true       # Enable/disable file logging
```

**Querying Audit Logs:**

```bash
# Query database audit logs
sqlite3 data/database.db "SELECT * FROM audit_logs WHERE action = 'LOGIN_FAILED' ORDER BY createdAt DESC LIMIT 10"

# View file audit logs
tail -f logs/audit.log | jq '.'

# Filter by action type
tail -f logs/audit.log | jq 'select(.action == "SESSION_IP_MISMATCH")'

# Filter by user
tail -f logs/audit.log | jq 'select(.userId == 1)'
```

**Database Schema (audit_logs):**

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Auto-increment primary key |
| `user_id` | INTEGER | User who performed action (NULL for failed logins) |
| `action` | TEXT | Action type (e.g., `LOGIN_SUCCESS`) |
| `resource_type` | TEXT | Resource affected (e.g., `SESSION`, `API_TOKEN`) |
| `resource_id` | TEXT | ID of affected resource (nullable) |
| `ip_address` | TEXT | Client IP address |
| `details` | TEXT | JSON with additional context |
| `createdAt` | TEXT | ISO 8601 timestamp |

**Production Recommendations:**

1. **Ship file logs externally** - Configure log rotation and ship `logs/audit.log` to a SIEM (Splunk, ELK, CloudWatch) for tamper-proof storage
2. **Restrict database write access** - Application should have INSERT-only access to `audit_logs` table in production
3. **Monitor for anomalies** - Set up alerts for `SESSION_IP_MISMATCH` and `LOGIN_FAILED` spikes
4. **Retention policy** - Implement log rotation for file logs; consider archiving old database entries

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Testing

This project has a comprehensive test suite covering all major functionality.

### Running Tests

Run all tests once:

```bash
npm test
```

Run tests in watch mode (automatically re-runs on file changes):

```bash
npm run test:watch
```

Run tests with an interactive UI:

```bash
npm run test:ui
```

Generate code coverage report:

```bash
npm run test:coverage
```

### Test Coverage

The test suite includes:

- **Unit Tests** for utility functions:
  - Validation functions (config validation, URL validation, hex color validation)
  - API response helpers (ok, badRequest, unauthorized, etc.)
  - Schema migrations

- **Component Tests** for UI components:
  - Atom components (Button, Input, Label, Select, etc.)
  - Molecule components (FormField, Modal, StatusMessage, etc.)
  - Organism components (AlertDialog, ConfirmDialog, ConfigHeader, etc.)

- **Hook Tests** for custom React hooks:
  - useSidebarResize - sidebar resize and collapse functionality

### Test Framework

- **Vitest** - Fast unit test framework with Vite integration
- **React Testing Library** - Testing React components
- **@testing-library/user-event** - Simulating user interactions
- **jsdom** - Browser environment simulation

### Writing New Tests

Test files should be placed next to the code they test with a `.test.ts` or `.test.tsx` extension:

```
app/
  lib/
    validation.ts
    validation.test.ts    ← Test file
  components/
    atoms/
      Button.tsx
      Button.test.tsx     ← Test file
```

Example test:

```typescript
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("should render children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });
});
```

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
