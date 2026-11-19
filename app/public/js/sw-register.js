// Registers the service worker (public/sw.js; phase 6.10). Loaded by every
// page: it only hands the browser the worker, and draws nothing.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Without it FlowHow works the same, online; nothing to tell the user.
  });
}
