importScripts('/uv/uv.bundle.js?v=2');
importScripts('/uv.config.js?v=2');
importScripts('/uv/uv.sw.js?v=2');

const uv = new UVServiceWorker();

self.addEventListener('install', event => {
    self.skipWaiting(); // Force the new service worker to activate immediately
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim()); // Claim clients immediately
});

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            if (uv.route(event)) {
                return await uv.fetch(event);
            }
            return await fetch(event.request);
        })()
    );
});
