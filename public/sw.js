const CACHE_NAME = "mercado-alternativo-pix-v6";
const APP_ROUTES = [
  "/adm",
  "/caixa",
  "/display",
  "/manifest.json",
  "/manifest-adm.json",
  "/manifest-caixa.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(APP_ROUTES.map(async (route) => {
        try {
          const response = await fetch(route, { cache: "reload" });
          if (response.ok) await cache.put(route, response);
        } catch {
          // A instalação do app não depende de o servidor estar acessível.
        }
      }));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          const containsCredential = url.searchParams.has("acesso") || url.searchParams.has("instalacao");
          const isDynamicManifest = url.pathname === "/api/pwa/manifest";
          if (!containsCredential && !isDynamicManifest) {
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const fallbackRoute = url.pathname === "/display"
            ? "/display"
            : url.pathname === "/adm" || url.pathname === "/"
              ? "/adm"
              : "/caixa";
          const fallback = await caches.match(fallbackRoute);
          if (fallback) return fallback;
        }
        return new Response("Você está offline e este conteúdo ainda não foi salvo neste dispositivo.", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }),
  );
});
