# Error Handling & Logging Guide

This guide shows you how to view and test error logs in your application.

## Where Logs Appear

### Development Mode (`npm run dev`)

| Error Type | Log Location | How to View |
|------------|--------------|-------------|
| **Database errors** | Terminal (server) | Look at terminal where `npm run dev` is running |
| **JSON parse errors** | Terminal (server) | Look at terminal where `npm run dev` is running |
| **FileReader errors** | Browser Console | Press F12 → Console tab |
| **Client-side errors** | Browser Console | Press F12 → Console tab |
| **Unhandled promises (client)** | Browser Console | Press F12 → Console tab |
| **Unhandled promises (server)** | Terminal (server) | Look at terminal where `npm run dev` is running |

### Production Mode (`npm start`)

| Error Type | Log Location |
|------------|--------------|
| **All server errors** | Terminal or log file (depends on process manager) |
| **All client errors** | Browser Console (users won't see these) |

---

## How to Test Error Logging

### 1. Test Database JSON Parse Error

**Simulate corrupted database data:**

```bash
# Stop your dev server first
# Open SQLite database
sqlite3 data/app.db

# Corrupt a config's JSON data
UPDATE configurations SET data = '{invalid json' WHERE config_id = 'default' LIMIT 1;

# Exit SQLite
.quit

# Start dev server and try to load config
npm run dev
```

**Expected log in terminal:**
```
Failed to parse config data for user 1, config default: SyntaxError: Unexpected token...
```

**To fix:**
```bash
sqlite3 data/app.db
UPDATE configurations SET data = '{"carousel":{"images":[],"aspectRatio":"landscape"},"textSection":{"title":"Test","titleColor":"#000000","description":"Test","descriptionColor":"#666666"},"cta":{"label":"Click","url":"https://example.com","backgroundColor":"#007AFF","textColor":"#FFFFFF"}}' WHERE config_id = 'default';
.quit
```

---

### 2. Test FileReader Error

**Steps:**
1. Start dev server: `npm run dev`
2. Open browser and login
3. Open Browser Console (F12 → Console tab)
4. Click "Import" button and select a very large file (>100MB) or binary file
5. Try to import it

**Expected log in browser console:**
```
Failed to read import file: DOMException: ...
```

---

### 3. Test Unhandled Promise Rejection (Client-Side)

**Temporary test code** - Add to `app/components/Editor/Editor.tsx`:

```typescript
// Add this inside the Editor component, after useState declarations
useEffect(() => {
  // This will trigger after 3 seconds
  setTimeout(() => {
    Promise.reject(new Error("Test unhandled rejection"));
  }, 3000);
}, []);
```

**Expected log in browser console after 3 seconds:**
```
Unhandled promise rejection: Error: Test unhandled rejection
```

**Don't forget to remove this test code!**

---

### 4. Test Database Operation Error

**Force a database constraint violation:**

You can test this by trying to create a user that already exists. The error will be logged in the terminal.

---

## Recommended Log Viewing Setup

### During Development:

**Split Terminal Setup:**
```
┌─────────────────────┬─────────────────────┐
│  Terminal 1         │  Terminal 2         │
│                     │                     │
│  npm run dev        │  sqlite3 data/app.db│
│  (watch server logs)│  (inspect database) │
└─────────────────────┴─────────────────────┘
```

**Browser Setup:**
- Keep DevTools Console open (F12)
- Filter by "error" to see only errors
- Enable "Preserve log" so logs don't clear on navigation

### Example Development Workflow:

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Watch for specific errors (optional)
npm run dev 2>&1 | grep -i "error\|failed"

# Browser: Open DevTools Console and enable filters
```

---

## Production Log Management

### Option 1: PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "home-editor" -- start

# View logs in real-time
pm2 logs home-editor

# View only errors
pm2 logs home-editor --err

# Clear logs
pm2 flush
```

### Option 2: Redirect to Log Files

```bash
# Start and redirect stdout and stderr to files
npm start > logs/app.log 2> logs/error.log

# Watch error log in real-time
tail -f logs/error.log

# Search for specific errors
grep "Failed to parse" logs/error.log
```

### Option 3: systemd Service (Linux)

Create `/etc/systemd/system/home-editor.service`:
```ini
[Service]
ExecStart=/usr/bin/npm start
WorkingDirectory=/path/to/home_editor_remix
StandardOutput=journal
StandardError=journal
```

View logs:
```bash
journalctl -u home-editor -f
```

---

## Error Tracking Services (Recommended for Production)

For production, consider integrating an error tracking service:

### Sentry Integration Example:

1. Install Sentry:
```bash
npm install @sentry/remix
```

2. Update `app/entry.client.tsx`:
```typescript
import * as Sentry from "@sentry/remix";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: process.env.NODE_ENV,
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  Sentry.captureException(event.reason); // Send to Sentry
  event.preventDefault();
});
```

3. Update `app/entry.server.tsx`:
```typescript
import * as Sentry from "@sentry/remix";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled promise rejection:", reason);
  Sentry.captureException(reason); // Send to Sentry
});
```

**Benefits:**
- Real-time error notifications
- Stack traces with source maps
- User context and session replay
- Error trends and analytics
- Automatic error grouping

---

## Quick Reference: Common Log Locations

| Scenario | Command to View Logs |
|----------|---------------------|
| Dev server running | Look at terminal |
| Browser errors | F12 → Console |
| PM2 production | `pm2 logs` |
| Docker container | `docker logs <container>` |
| systemd service | `journalctl -u <service> -f` |
| Log files | `tail -f logs/error.log` |

---

## Tips for Better Logging

### 1. Add Log Levels

Consider adding log levels to distinguish severity:

```typescript
const logger = {
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  info: (...args: any[]) => console.log('[INFO]', ...args),
  debug: (...args: any[]) => console.debug('[DEBUG]', ...args),
};

// Use it:
logger.error('Database error:', error);
```

### 2. Add Timestamps

```typescript
const timestamp = () => new Date().toISOString();
console.error(`[${timestamp()}] Failed to parse config:`, error);
```

### 3. Add User Context

```typescript
console.error(`[User ${userId}] Failed to save config ${configId}:`, error);
```

---

## Need Help?

If you're not seeing logs:
1. Check if dev server is running
2. Check browser console is open (F12)
3. Check log filters aren't hiding messages
4. Try `console.log("TEST")` to verify logging works
5. Check file permissions on log directories
