import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

// Global error handlers for graceful error handling

// Handle unhandled promise rejections
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    event.preventDefault();

    // You could send to error tracking service here
    // Example: sendToErrorTracker(event.reason);
  });

  // Handle uncaught errors
  window.addEventListener("error", (event) => {
    console.error("Uncaught error:", event.error);

    // You could send to error tracking service here
    // Example: sendToErrorTracker(event.error);
  });
}

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <HydratedRouter />
    </StrictMode>
  );
});
