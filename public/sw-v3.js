importScripts('/uv/uv.bundle.js?v=3');
importScripts('/uv.config.js?v=3');
importScripts('/uv/uv.sw.js?v=3');

const uv = new UVServiceWorker();

self.addEventListener('install', event => {
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            try {
                if (uv.route(event)) {
                    return await uv.fetch(event);
                }
                return await fetch(event.request);
            } catch (err) {
                return new Response(
                    `Service Worker Error: ${err.message}\nStack: ${err.stack}`,
                    { status: 500, headers: { 'Content-Type': 'text/plain' } }
                );
            }
        })()
    );
});
