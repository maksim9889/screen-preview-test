# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mobile App Home Screen Editor - a full-stack web application for previewing and modifying a mobile app home screen in real time with configuration persistence.

**Stack:** React 19 + React Router 7 (SSR) + TailwindCSS | Node.js + SQLite | TypeScript

## Build & Development Commands

```bash
npm run dev              # Development server with HMR (http://localhost:5173)
npm run build            # Production build
npm start                # Start production server
npm run typecheck        # TypeScript type checking + React Router type generation
```

## Testing Commands

```bash
npm test                 # Run all tests once (577+ tests)
npm run test:watch       # Watch mode for development
npm run test:ui          # Interactive Vitest UI
npm run test:coverage    # Generate coverage reports
```

Test files are co-located with source files (e.g., `Button.tsx` and `Button.test.tsx`).

## Database Commands

```bash
npx tsx scripts/db-init.ts              # Initialize database
npx tsx scripts/db-init.ts --status     # Show schema status
npx tsx scripts/db-init.ts --reset      # Reset database (DESTRUCTIVE)
```

## Architecture

### Server/Client Boundary Pattern

Files ending in `.server.ts` are **never bundled to the client**. All secrets, database access, and sensitive logic live in these files:
- `app/lib/db.server.ts` - Data access layer (single source of truth for all data operations)
- `app/lib/auth.server.ts` - Authentication logic
- `app/lib/csrf.server.ts` - CSRF token validation
- `app/lib/config.server.ts` - Environment configuration (Zod-validated)
- `app/lib/rate-limit.server.ts` - In-memory rate limiting

### Server-Side Mediation

Browser never calls `/api/v1/*` endpoints directly. All browser interactions go through React Router loaders/actions:

```
Browser → useLoaderData()/useFetcher() → Page Routes (loader/action) → db.server.ts → SQLite
```

- **Loaders** handle GET requests (data fetching)
- **Actions** handle mutations via intent-based routing (e.g., `intent: "save"`, `intent: "restoreVersion"`)

### API Routes vs Page Routes

- **Page routes** (`app/routes/home.tsx`, etc.) - Browser access via sessions (HttpOnly cookies)
- **API routes** (`app/routes/api-v1-*.tsx`) - External/programmatic access via Bearer tokens

Both use the same `db.server.ts` service functions for consistent behavior.

### Component Architecture (Atomic Design)

```
app/components/atoms/       # Basic building blocks (Button, Input, Label)
app/components/molecules/   # Simple compositions (FormField, Modal, ColorPicker)
app/components/organisms/   # Complex compositions (ConfigHeader, CarouselSection)
app/components/layouts/     # Page structure wrappers
```

## Key Files

- `app/lib/db.server.ts` - All database operations and business logic
- `app/routes/home.tsx` - Main editor UI with loader/action
- `app/lib/types.ts` - Shared TypeScript types
- `app/lib/validation.ts` - Runtime validation functions
- `app/routes.ts` - Route definitions

## Path Alias

Use `~/` to import from `app/`:
```typescript
import { Button } from '~/components/atoms/Button';
```

## Environment Configuration

Copy `.env.example` to `.env` for local development. Key variables:
- `DATABASE_PATH` - SQLite file location (default: `./data/database.db`)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

See `.env.example` for full configuration reference with defaults.

## Security Considerations

- Passwords: PBKDF2-HMAC-SHA512 hashing
- Tokens: SHA-256 hashed before database storage (8-char prefix kept for debugging)
- CSRF: Double-submit cookie pattern
- Rate limiting: In-memory (resets on restart)
- All auth tokens are opaque (not JWTs) for instant revocation capability
