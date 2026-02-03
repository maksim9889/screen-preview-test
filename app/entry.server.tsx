import { PassThrough } from "node:stream";
import type { AppLoadContext, EntryContext } from "react-router";
import { createReadableStreamFromReadable } from "@react-router/node";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";
import { config } from "./lib/config.server";

const ABORT_DELAY = 5_000;

// Global error handlers for server-side graceful error handling
if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled promise rejection at:", promise, "reason:", reason);
    // You could send to error tracking service here
  });

  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    // You could send to error tracking service here

    // Optionally exit the process after logging
    // process.exit(1);
  });
}

/**
 * Adds security headers to the response
 *
 * Includes HSTS, CSP, XSS protection, and other security-related headers
 * to protect against common web vulnerabilities.
 */
function addSecurityHeaders(responseHeaders: Headers): void {
  // HTTPS Strict Transport Security (HSTS) - only in production
  if (config.isProduction) {
    responseHeaders.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  // Content Security Policy (CSP) - prevents XSS attacks
  // Note: 'unsafe-inline' for scripts is required for React hydration
  // In production, consider using nonces for stricter CSP
  responseHeaders.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' https: data: blob:",  // https: allows user-provided image URLs
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",       // Restrict form submissions to same origin
      "base-uri 'self'",          // Prevent base tag injection
      "object-src 'none'",        // Disable plugins (Flash, etc.)
      "upgrade-insecure-requests", // Upgrade HTTP to HTTPS
    ].join('; ')
  );

  // Prevent MIME type sniffing
  responseHeaders.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  responseHeaders.set('X-Frame-Options', 'DENY');

  // XSS Protection (legacy browsers)
  responseHeaders.set('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  responseHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  responseHeaders.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext,
  loadContext: AppLoadContext
) {
  return isbot(request.headers.get("user-agent") || "")
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        entryContext
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        entryContext
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={entryContext} url={request.url} />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          // Add security headers
          addSecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  entryContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter context={entryContext} url={request.url} />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");

          // Add security headers
          addSecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
