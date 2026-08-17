/* docs/sw.js */
/* Offline-first-ish SW:
   - app/documents/assets: network-first
   - graph.jsonld: stale-while-revalidate
*/

const SW_VERSION = 'reasonlynx-monorepo-v7';
const CACHE_SHELL = `ontoeagle-shell-${SW_VERSION}`;
const CACHE_DATA = `ontoeagle-data-${SW_VERSION}`;

// Keep this list tight and explicit.
const SHELL_ASSETS = [
  './about/',
  './admin/',
  './bundler/',
  './cq-ferret/',
  './onto-eagle/',
  './ontology-viewer/',
  './styles/app-base.css',
  './styles/bundler.css',
  './styles/ontology-pages.css',
  './styles/search-app.css',
  './styles/site-header.css',
  './styles/skeleton.css',
  './styles/tabulator.min.css',
  './app/catalog-data-manager.js',
  './cq-ferret/cq-ferret-indexeddb-store.js',
  './onto-eagle/namespaces.js',
  './onto-eagle/normalize.js',
  './app/ontoeagle-indexeddb-store.js',
  './app/ontology-icons.js',
  './app/ontology-meta.js',
  './app/rdf_extract.js',
  './app/site-header.js',
  './bundler/slim-core.js',
  './app/types.js',
  './cq-ferret/vocab-extract-core.js',
  './bundler/bundler-core.js',
  './bundler/bundler-ui.js',
  './cq-ferret/extracted-vocabulary-tabulator.js',
  './cq-ferret/ferret.js',
  './onto-eagle/ontology-catalog.js',
  './onto-eagle/search-main.js',
  './onto-eagle/search.js',
  './ontology-viewer/ontology-viewer.js',
  './packages/browser-file-io/src/create-accept-attribute.js',
  './packages/browser-file-io/src/create-text-blob.js',
  './packages/browser-file-io/src/download-blob.js',
  './packages/browser-file-io/src/download-text-file.js',
  './packages/browser-file-io/src/filename-utils.js',
  './packages/browser-file-io/src/index.js',
  './packages/browser-file-io/src/read-file-as-array-buffer.js',
  './packages/browser-file-io/src/read-file-as-text.js',
  './packages/format-registry/src/index.js',
  './packages/format-registry/src/mime-registry.js',
  './packages/format-registry/src/rdf-content-detection.js',
  './packages/format-registry/src/rdf-parser-formats.js',
  './packages/indexeddb-data-management/src/file-system-access.js',
  './packages/indexeddb-data-management/src/graph-operations.js',
  './packages/indexeddb-data-management/src/id-generation.js',
  './packages/indexeddb-data-management/src/index.js',
  './packages/indexeddb-data-management/src/indexeddb-adapter.js',
  './packages/indexeddb-data-management/src/legacy-migration.js',
  './packages/indexeddb-data-management/src/project-export.js',
  './packages/indexeddb-data-management/src/project-file-locks.js',
  './packages/indexeddb-data-management/src/project-file-paths.js',
  './packages/indexeddb-data-management/src/project-folder-handle-store.js',
  './packages/indexeddb-data-management/src/project-folder-sync.js',
  './packages/indexeddb-data-management/src/project-manifest.js',
  './packages/indexeddb-data-management/src/project-portfolio-store.js',
  './packages/indexeddb-data-management/src/rdfjs-quad-rows.js',
  './packages/indexeddb-data-management/src/record-jsonld.js',
  './packages/indexeddb-data-management/src/record-store.js',
  './packages/indexeddb-data-management/src/records.js',
  './packages/indexeddb-data-management/src/run-output-export.js',
  './packages/indexeddb-data-management/src/storage-error.js',
  './packages/namespace-registry/src/curie.js',
  './packages/namespace-registry/src/index.js',
  './packages/namespace-registry/src/namespace-registry.js',
  './packages/namespace-registry/src/namespace-stems.js',
  './packages/namespace-registry/src/prefix-map.js',
  './packages/namespace-registry/src/rdf-prefixes.js',
  './packages/namespace-registry/src/rdf-serialization-prefixes.js',
  './packages/normalization-utils/src/case-conversion.js',
  './packages/normalization-utils/src/date-parts.js',
  './packages/normalization-utils/src/filename-timestamps.js',
  './packages/normalization-utils/src/index.js',
  './packages/ontology-metadata/src/import-target.js',
  './packages/ontology-metadata/src/index.js',
  './packages/ontology-metadata/src/jsonld-metadata.js',
  './packages/ontology-metadata/src/rdf-metadata.js',
  './packages/ontology-metadata/src/settings.js',
  './packages/ontology-utils/src/identifiers.js',
  './packages/ontology-utils/src/index.js',
  './packages/ontology-utils/src/iri.js',
  './packages/ontology-utils/src/ontology-input.js',
  './packages/ontology-utils/src/ontology-namespace.js',
  './packages/ontology-utils/src/rdf-terms.js',
  './packages/ontology-utils/src/xsd-datatypes.js',
  './packages/rdf-io/src/graph-export.js',
  './packages/rdf-io/src/index.js',
  './packages/rdf-io/src/jsonld-adapter.js',
  './packages/rdf-io/src/n3-adapter.js',
  './packages/rdf-io/src/object-to-rdf.js',
  './packages/rdf-io/src/rdf-model.js',
  './packages/rdf-io/src/rdflib-adapter.js',
  './packages/rdf-io/src/runtime.js',
  './packages/rdf-io/src/serialize-rdf.js',
  './packages/report-export/src/export-descriptor.js',
  './packages/report-export/src/html-document.js',
  './packages/report-export/src/index.js',
  './packages/report-export/src/print-document.js',
  './packages/report-export/src/report-error.js',
  './packages/report-export/src/yaml-document.js',
  './packages/sparql-utils/src/index.js',
  './packages/sparql-utils/src/iri-rewrite.js',
  './packages/sparql-utils/src/lexical-scan.js',
  './packages/sparql-utils/src/prologue.js',
  './packages/sparql-utils/src/query-kind.js',
  './packages/sparql-utils/src/query-patterns.js',
  './packages/sparql-utils/src/update-patterns.js',
  './packages/tabular-io/src/delimited-text.js',
  './packages/tabular-io/src/index.js',
  './packages/tabular-io/src/iri-mapping.js',
  './packages/tabular-io/src/query-records.js',
  './packages/tabular-io/src/table-shape.js',
  './packages/ui-feedback/src/feedback-error.js',
  './packages/ui-feedback/src/index.js',
  './packages/ui-feedback/src/logger.js',
  './packages/ui-feedback/src/status.js',
  './packages/ui-feedback/src/theme.js',
  './packages/ui-feedback/src/toast.js',
  './vendor/jsonld.min.js',
  './vendor/mermaid.min.js',
  './vendor/n3.min.js',
  './vendor/rdflib.min.js',
  './vendor/tabulator.min.js',
  './images/add-to-cart.svg',
  './images/block-logo.png',
  './images/default-logo.png',
];

// Single consolidated dataset produced by Python
const DATA_ASSETS = [
  './data/graph.jsonld',
  './data/ontology-registry.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(CACHE_SHELL);
    await shell.addAll(SHELL_ASSETS);

    const data = await caches.open(CACHE_DATA);
    await data.addAll(DATA_ASSETS);

    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => ![CACHE_SHELL, CACHE_DATA].includes(k))
        .map((k) => caches.delete(k))
    );

    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GET requests
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Dataset: stale-while-revalidate
  if (path.endsWith('/data/graph.jsonld') || path.endsWith('/data/ontology-registry.json')) {
    event.respondWith(staleWhileRevalidate(req, CACHE_DATA));
    return;
  }

  // Everything else: network-first
  event.respondWith(networkFirst(req, CACHE_SHELL));
});

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);

  const fetchPromise = fetch(req)
    .then(async (res) => {
      if (res && res.ok) {
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);

  return hit || (await fetchPromise) || new Response('Offline', { status: 503 });
}
