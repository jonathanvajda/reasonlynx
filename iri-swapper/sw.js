/* sw.js - Offline-capable cache. Works on https:// or localhost. */

const CACHE_VERSION = "myna-sparql-utils-v1";
const CACHE_SHELL = `${CACHE_VERSION}-shell`;
const CACHE_RUNTIME = `${CACHE_VERSION}-runtime`;

// Keep this list aligned with your local files if you vendor libraries.
const SHELL_ASSETS = [
  "./",
  "./index.html",
  './sparql-iri-swapper.html',
  "../styles/normalize.css",
  "../styles/skeleton.css",
  "../styles/tabulator.min.css",
  "./styles/iri-swapper.css",
  "../vendor/tabulator.min.js",
  "../vendor/n3.min.js",
  "../vendor/jsonld.min.js",
  "../vendor/xlsx.full.min.js",
  "../vendor/rdflib.min.js",
  "./app/ont-iri-swapper.js",
  './app/sparql-iri-swapper.js',
  './app/iri-swapper-run-store.js',
  "../packages/namespace-registry/src/prefix-map.js",
  "../packages/namespace-registry/src/rdf-prefixes.js",
  "../packages/namespace-registry/src/rdf-serialization-prefixes.js",
  "../packages/namespace-registry/src/curie.js",
  "../packages/namespace-registry/src/namespace-registry.js",
  "../packages/sparql-utils/src/index.js",
  "../packages/sparql-utils/src/iri-rewrite.js",
  "../packages/sparql-utils/src/lexical-scan.js",
  "../packages/sparql-utils/src/prologue.js",
  "../packages/sparql-utils/src/query-patterns.js",
  "../packages/sparql-utils/src/query-kind.js",
  "../packages/sparql-utils/src/update-patterns.js",
  "../packages/format-registry/src/mime-registry.js",
  "../packages/format-registry/src/rdf-parser-formats.js",
  "../packages/browser-file-io/src/index.js",
  "../packages/browser-file-io/src/create-accept-attribute.js",
  "../packages/browser-file-io/src/create-text-blob.js",
  "../packages/browser-file-io/src/download-blob.js",
  "../packages/browser-file-io/src/download-text-file.js",
  "../packages/browser-file-io/src/filename-utils.js",
  "../packages/browser-file-io/src/read-file-as-array-buffer.js",
  "../packages/browser-file-io/src/read-file-as-text.js",
  "../packages/rdf-io/src/index.js",
  "../packages/rdf-io/src/graph-export.js",
  "../packages/rdf-io/src/jsonld-adapter.js",
  "../packages/rdf-io/src/n3-adapter.js",
  "../packages/rdf-io/src/object-to-rdf.js",
  "../packages/rdf-io/src/rdf-model.js",
  "../packages/rdf-io/src/rdflib-adapter.js",
  "../packages/rdf-io/src/runtime.js",
  "../packages/rdf-io/src/serialize-rdf.js",
  "../packages/tabular-io/src/delimited-text.js",
  "../packages/tabular-io/src/index.js",
  "../packages/tabular-io/src/iri-mapping.js",
  "../packages/tabular-io/src/query-records.js",
  "../packages/indexeddb-data-management/src/file-system-access.js",
  "../packages/indexeddb-data-management/src/graph-operations.js",
  "../packages/indexeddb-data-management/src/id-generation.js",
  "../packages/indexeddb-data-management/src/index.js",
  "../packages/indexeddb-data-management/src/indexeddb-adapter.js",
  "../packages/indexeddb-data-management/src/legacy-migration.js",
  "../packages/indexeddb-data-management/src/project-export.js",
  "../packages/indexeddb-data-management/src/project-file-locks.js",
  "../packages/indexeddb-data-management/src/project-file-paths.js",
  "../packages/indexeddb-data-management/src/project-folder-handle-store.js",
  "../packages/indexeddb-data-management/src/project-folder-sync.js",
  "../packages/indexeddb-data-management/src/project-manifest.js",
  "../packages/indexeddb-data-management/src/project-portfolio-store.js",
  "../packages/indexeddb-data-management/src/rdfjs-quad-rows.js",
  "../packages/indexeddb-data-management/src/record-jsonld.js",
  "../packages/indexeddb-data-management/src/record-store.js",
  "../packages/indexeddb-data-management/src/records.js",
  "../packages/indexeddb-data-management/src/run-output-export.js",
  "../packages/indexeddb-data-management/src/storage-error.js",
  "./manifest.webmanifest",
  "./icon.svg",
  "./sw.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);

    // Avoid “install fails entirely” if a single asset 404s.
    for (const url of SHELL_ASSETS) {
      try {
        await cache.add(url);
      } catch (e) {
        // Non-fatal; app can still work online
        console.warn("[myna:sw] cache add failed:", url, e);
      }
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => {
      if (!k.startsWith(CACHE_VERSION)) return caches.delete(k);
    }));
    self.clients.claim();
  })());
});

// Cache-first for same-origin shell; stale-while-revalidate-ish for others
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith((async () => {
    const url = new URL(req.url);

    // Same-origin: prefer shell cache
    if (url.origin === self.location.origin) {
      const cached = await caches.match(req);
      if (cached) return cached;

      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_SHELL);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    }

    // Cross-origin (CDNs): runtime cache (available offline after first load)
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_RUNTIME);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch {
      return cached || Response.error();
    }
  })());
});
