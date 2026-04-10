// Minimal service worker — required for PWA install prompt
// No caching, just satisfies Chrome's installability check
self.addEventListener('fetch', () => {});
