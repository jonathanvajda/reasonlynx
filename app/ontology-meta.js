import {
  ADDED_BY_USER_IRI,
  extractDocumentsFromJsonLd,
  mapByIri,
  parseGraphJsonLdText
} from './rdf_extract.js';
import { readFileAsText } from '../packages/browser-file-io/src/index.js';
import { getSupportedMimeTypeForFilename } from '../packages/format-registry/src/index.js';
import {
  parseRdfTextWithAdapters,
  rdfDatasetToJsonLdGraph
} from '../packages/rdf-io/src/index.js';
import {
  COMMON_NAMESPACE_REGISTRY
} from '../packages/namespace-registry/src/index.js';
import {
  getJsonLdGraphNodes,
  readOntologyRecordsFromJsonLd
} from '../packages/ontology-metadata/src/index.js';
import {
  listOntologyDatasetMeta,
  getOntologyDatasetMeta,
  deleteOntoEagleAppSetting,
  getOntoEagleAppSetting,
  listEnabledOntologyDocuments,
  openOntoEagleProjectDatabase,
  setOntoEagleAppSetting,
  storeOntologyDatasetMeta,
  storeOntologyDatasetDocuments,
  storeOntoEagleRunRecord
} from './ontoeagle-indexeddb-store.js';

const NAMESPACE = Object.freeze({
  obo: COMMON_NAMESPACE_REGISTRY.obo.namespaceIri
});
const DATASET_SCHEMA_VERSION = 2;
const REGISTRY_STORAGE_KEY = 'ontoeagle:ontologyRegistryOverrides';
const ONTOLOGY_SNAPSHOT_KEY = 'ontoeagle:ontologyMetadataSnapshot:v1';
const USER_ONTOLOGY_RECORDS_KEY = 'ontoeagle:userOntologyRecords:v1';
const ONTOLOGY_SNAPSHOT_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const ONTOLOGY_LEVELS = Object.freeze([
  { key: 'top', label: 'Top-Level Ontologies' },
  { key: 'mid', label: 'Mid-Level Ontologies' },
  { key: 'dom', label: 'Domain Ontologies' },
  { key: 'app', label: 'Application Ontologies' },
  { key: 'kg', label: 'Knowledge Graphs' },
  { key: 'unsorted', label: 'Unsorted Ontologies' }
]);

function normalizeLogo(value) {
  const v = String(value || '').toLowerCase();
  if (v === 'github' || v === 'gitlab' || v === 'git') return v;
  return 'git';
}

function normalizeRegistryEntry(entry) {
  if (!entry || typeof entry !== 'object' || !entry.iri) return null;
  return {
    iri: String(entry.iri),
    ontology_level: String(entry.ontology_level || 'unsorted').toLowerCase(),
    git_repo_url: String(entry.git_repo_url || ''),
    git_logo: normalizeLogo(entry.git_logo),
    issue_tracker_url: String(entry.issue_tracker_url || ''),
    file: String(entry.file || '')
  };
}

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) return String(text.length);
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function annotateDocs(docs, meta) {
  return docs.map((doc) => ({
    ...doc,
    datasetId: meta.datasetId,
    source: meta.source,
    ontologyName: meta.ontologyName,
    fileName: meta.fileName,
    addedByUser: meta.source === 'user' || !!doc.addedByUser
  }));
}

function stableDatasetId(fileName, fingerprint) {
  const safeName = String(fileName || 'ontology')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'ontology';
  return `user:${safeName}:${fingerprint.slice(0, 16)}`;
}

function annotateUserJsonLd(jsonld) {
  for (const node of getJsonLdGraphNodes(jsonld)) {
    if (node && typeof node === 'object' && typeof node['@id'] === 'string' && node['@id'].startsWith('http')) {
      node[ADDED_BY_USER_IRI] = [{ '@value': 'TRUE' }];
    }
  }
  return jsonld;
}

async function parseOntologyRdfTextToJsonLd(text, fileName, options = {}) {
  const detected = getSupportedMimeTypeForFilename(fileName);
  if (!detected.ok || detected.value.category !== 'rdf') {
    throw new Error(`Unsupported RDF file type: ${String(fileName || '') || '(unknown filename)'}`);
  }

  const parsed = await parseRdfTextWithAdapters(text, {
    format: detected.value.mimeType,
    baseIri: options.baseIRI || options.baseIri || null,
    runtime: options.runtime || {
      N3: globalThis.N3,
      jsonld: globalThis.jsonld,
      $rdf: globalThis.$rdf
    }
  });

  return {
    '@graph': rdfDatasetToJsonLdGraph(parsed.dataset)
      .sort((a, b) => String(a['@id']).localeCompare(String(b['@id'])))
  };
}

async function loadStoredUserOntologyRecords() {
  const records = await getOntoEagleAppSetting(USER_ONTOLOGY_RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

async function saveStoredUserOntologyRecords(records) {
  await setOntoEagleAppSetting(USER_ONTOLOGY_RECORDS_KEY, Array.isArray(records) ? records : []);
}

async function upsertStoredUserOntologyRecords(datasetId, records) {
  const existing = (await loadStoredUserOntologyRecords()).filter((record) => record.datasetId !== datasetId);
  const next = [
    ...existing,
    ...records.map((record) => ({ ...record, datasetId, source: 'user', addedByUser: true }))
  ];
  await saveStoredUserOntologyRecords(next);
}

export async function removeStoredUserOntologyRecordsForDataset(datasetId) {
  const next = (await loadStoredUserOntologyRecords()).filter((record) => record.datasetId !== datasetId);
  await saveStoredUserOntologyRecords(next);
  await clearOntologyMetadataSnapshot();
}

export async function clearOntologyMetadataSnapshot() {
  await deleteOntoEagleAppSetting(ONTOLOGY_SNAPSHOT_KEY);
}

export async function fetchGraphJsonLd() {
  const res = await fetch('../data/graph.jsonld', { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch graph.jsonld: ${res.status}`);
  const text = await res.text();
  return { text, jsonld: parseGraphJsonLdText(text), fingerprint: await sha256Hex(text) };
}

export async function ensureBuiltinDataset() {
  await openOntoEagleProjectDatabase();
  const cachedDocs = await listEnabledOntologyDocuments();
  const { text, jsonld, fingerprint } = await fetchGraphJsonLd();
  const meta = await getOntologyDatasetMeta('builtin');
  const stale = !meta || meta.fingerprint !== fingerprint || meta.schemaVersion !== DATASET_SCHEMA_VERSION;

  if (!cachedDocs.length || stale) {
    const docs = annotateDocs(extractDocumentsFromJsonLd(jsonld), {
      datasetId: 'builtin',
      source: 'builtin',
      ontologyName: 'OntoEagle built-in graph',
      fileName: 'graph.jsonld'
    });
    await storeOntologyDatasetDocuments('builtin', docs);
    await storeOntologyDatasetMeta('builtin', {
      fingerprint,
      enabled: true,
      source: 'builtin',
      ontologyName: 'OntoEagle built-in graph',
      fileName: 'graph.jsonld',
      documentCount: docs.length,
      schemaVersion: DATASET_SCHEMA_VERSION,
      updatedAt: Date.now()
    });
    await storeOntoEagleRunRecord({
      runKind: 'ontology-dataset-load',
      label: 'Loaded built-in OntoEagle graph',
      outputArtifactIds: ['artifact:ontoeagle:builtin:documents'],
      payload: {
        datasetId: 'builtin',
        documentCount: docs.length,
        fingerprint
      }
    });
  }

  return { text, jsonld, fingerprint };
}

export async function importUserOntologyFile(file) {
  if (!file) return null;
  const text = await readFileAsText(file);
  const fingerprint = await sha256Hex(text);
  const datasetId = stableDatasetId(file.name, fingerprint);
  const ontologyName = file.name.replace(/\.[^.]+$/, '');
  const jsonld = annotateUserJsonLd(await parseOntologyRdfTextToJsonLd(text, file.name, {
    baseIRI: `urn:ontoeagle:upload:${encodeURIComponent(file.name)}`
  }));
  const docs = annotateDocs(extractDocumentsFromJsonLd(jsonld), {
    datasetId,
    source: 'user',
    ontologyName,
    fileName: file.name
  });
  const ontologyRecords = readOntologyRecordsFromJsonLd(jsonld).records.map((record) => ({
    ...record,
    addedByUser: true,
    source: 'user',
    ontologyName,
    fileName: file.name
  }));

  await storeOntologyDatasetDocuments(datasetId, docs);
  await storeOntologyDatasetMeta(datasetId, {
    fingerprint,
    enabled: true,
    source: 'user',
    ontologyName,
    fileName: file.name,
    documentCount: docs.length,
    ontologyCount: ontologyRecords.length,
    schemaVersion: DATASET_SCHEMA_VERSION,
    updatedAt: Date.now()
  });
  await storeOntoEagleRunRecord({
    runKind: 'ontology-dataset-import',
    label: `Imported ${file.name}`,
    outputArtifactIds: [`artifact:ontoeagle:${datasetId}:documents`],
    payload: {
      datasetId,
      fileName: file.name,
      documentCount: docs.length,
      ontologyCount: ontologyRecords.length,
      fingerprint
    }
  });
  await upsertStoredUserOntologyRecords(datasetId, ontologyRecords);
  await clearOntologyMetadataSnapshot();
  return { datasetId, docs, ontologyRecords, documentCount: docs.length };
}

async function loadOntologySnapshot() {
  const snapshot = await getOntoEagleAppSetting(ONTOLOGY_SNAPSHOT_KEY, null);
  if (!snapshot || !Array.isArray(snapshot.records)) return null;
  if (Date.now() - Number(snapshot.updatedAt || 0) > ONTOLOGY_SNAPSHOT_MAX_AGE_MS) return null;
  const records = snapshot.records;
  return {
    records,
    byIri: new Map(records.map((record) => [record.iri, record])),
    versionToOntologyIri: new Map(Object.entries(snapshot.versionToOntologyIri || {})),
    fromSnapshot: true
  };
}

async function saveOntologySnapshot(ontologyIndex) {
  const versionToOntologyIri = {};
  for (const [versionIri, ontologyIri] of ontologyIndex.versionToOntologyIri.entries()) {
    versionToOntologyIri[versionIri] = ontologyIri;
  }
  await setOntoEagleAppSetting(ONTOLOGY_SNAPSHOT_KEY, {
    updatedAt: Date.now(),
    records: ontologyIndex.records,
    versionToOntologyIri
  });
}

export { readOntologyRecordsFromJsonLd as extractOntologyRecordsFromJsonLd };

export async function loadRegistryOverrides() {
  const parsed = await getOntoEagleAppSetting(REGISTRY_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed.map(normalizeRegistryEntry).filter(Boolean) : [];
}

export async function saveRegistryOverride(entry) {
  const normalized = normalizeRegistryEntry(entry);
  if (!normalized) return [];
  const existing = (await loadRegistryOverrides()).filter((item) => item.iri !== normalized.iri);
  const next = [...existing, normalized].sort((a, b) => a.iri.localeCompare(b.iri));
  await setOntoEagleAppSetting(REGISTRY_STORAGE_KEY, next);
  return next;
}

export function exportRegistryJson(entries) {
  return JSON.stringify((entries || []).map(normalizeRegistryEntry).filter(Boolean), null, 2);
}

export async function loadDefaultRegistry() {
  try {
    const res = await fetch('../data/ontology-registry.json', { cache: 'no-store' });
    if (!res.ok) return [];
    const parsed = await res.json();
    return Array.isArray(parsed) ? parsed.map(normalizeRegistryEntry).filter(Boolean) : [];
  } catch (_err) {
    return [];
  }
}

export function mergeRegistryEntries(defaultEntries, overrideEntries) {
  const byIri = new Map();
  for (const entry of defaultEntries || []) {
    const normalized = normalizeRegistryEntry(entry);
    if (normalized) byIri.set(normalized.iri, normalized);
  }
  for (const entry of overrideEntries || []) {
    const normalized = normalizeRegistryEntry(entry);
    if (normalized) byIri.set(normalized.iri, normalized);
  }
  return [...byIri.values()].sort((a, b) => a.iri.localeCompare(b.iri));
}

export function mergeOntologyRecordsWithRegistry(records, registryEntries) {
  const registryByIri = new Map((registryEntries || []).map((entry) => [entry.iri, entry]));
  return (records || []).map((record) => {
    const registry = registryByIri.get(record.iri) || null;
    return {
      ...record,
      registry,
      registered: !!registry,
      ontology_level: registry?.ontology_level || 'unsorted',
      git_repo_url: registry?.git_repo_url || '',
      git_logo: normalizeLogo(registry?.git_logo),
      issue_tracker_url: registry?.issue_tracker_url || '',
      file: registry?.file || ''
    };
  });
}

export function resolveOntologyIri(iri, ontologyIndex) {
  if (!iri) return '';
  if (ontologyIndex?.byIri?.has(iri)) return iri;
  return ontologyIndex?.versionToOntologyIri?.get(iri) || iri;
}

export function buildImportGraph(rootIri, ontologyIndex) {
  const edges = [];
  const visited = new Set();
  const nodes = new Set();

  function visit(iri) {
    const ontologyIri = resolveOntologyIri(iri, ontologyIndex);
    if (!ontologyIri || visited.has(ontologyIri)) return;
    visited.add(ontologyIri);
    nodes.add(ontologyIri);
    const record = ontologyIndex.byIri.get(ontologyIri);
    for (const imported of record?.imports || []) {
      const target = resolveOntologyIri(imported, ontologyIndex);
      nodes.add(target);
      edges.push({ source: ontologyIri, target, predicate: 'owl:imports', importedIri: imported });
      if (ontologyIndex.byIri.has(target)) visit(target);
    }
  }

  visit(rootIri);
  const uniqueEdges = [];
  const edgeKeys = new Set();
  for (const edge of edges) {
    const key = `${edge.source} -> ${edge.target}`;
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    uniqueEdges.push(edge);
  }
  return { nodes: [...nodes], edges: uniqueEdges };
}

export function buildMermaidImportSyntax(rootIri, ontologyIndex) {
  const graph = buildImportGraph(rootIri, ontologyIndex);
  const ids = new Map(graph.nodes.map((iri, index) => [iri, `node${index + 1}`]));
  const lines = ['flowchart BT;'];
  for (const edge of graph.edges) {
    const sourceLabel = ontologyIndex.byIri.get(edge.source)?.label || edge.source;
    const targetLabel = ontologyIndex.byIri.get(edge.target)?.label || edge.target;
    lines.push(`${ids.get(edge.source)}(${JSON.stringify(sourceLabel)}) -- "owl:imports" --> ${ids.get(edge.target)}(${JSON.stringify(targetLabel)});`);
  }
  for (const iri of graph.nodes) {
    if (!graph.edges.some((edge) => edge.source === iri || edge.target === iri)) {
      lines.push(`${ids.get(iri)}(${JSON.stringify(ontologyIndex.byIri.get(iri)?.label || iri)});`);
    }
  }
  return { syntax: lines.join('\n'), graph, ids };
}

export async function loadOntologyWorkspace(options = {}) {
  await openOntoEagleProjectDatabase();
  const includeDocs = options.includeDocs !== false;
  const includeUserOntologies = options.includeUserOntologies === true;
  let docs = includeDocs ? await listEnabledOntologyDocuments() : [];
  const snapshot = options.preferSnapshot ? await loadOntologySnapshot() : null;
  let ontologyIndex = snapshot;

  if (includeDocs && !docs.length) {
    await ensureBuiltinDataset();
    docs = await listEnabledOntologyDocuments();
  }

  if (!ontologyIndex) {
    const { jsonld } = await ensureBuiltinDataset();
    ontologyIndex = readOntologyRecordsFromJsonLd(jsonld);
    await saveOntologySnapshot(ontologyIndex);
  }

  const docsByIri = mapByIri(docs);
  const existingIris = new Set(ontologyIndex.records.map((record) => record.iri));

  if (includeUserOntologies) {
    for (const record of await loadStoredUserOntologyRecords()) {
      if (record?.iri && !existingIris.has(record.iri)) {
        ontologyIndex.records.push({ ...record, registered: false, ontology_level: 'unsorted' });
        existingIris.add(record.iri);
      }
    }

    const metas = await listOntologyDatasetMeta();
    if (metas.some((meta) => meta?.source === 'user' && meta.enabled !== false)) {
      const enabledDocs = includeDocs ? docs : await listEnabledOntologyDocuments();
      for (const doc of enabledDocs) {
        if (doc.addedByUser && doc.type === 'Ontology' && !existingIris.has(doc.iri)) {
          const record = {
            iri: doc.iri,
            label: doc.label || doc.iri,
            description: doc.definition || '',
            versionIri: '',
            versionIriCount: 0,
            versionInfo: [],
            imports: [],
            license: [],
            rightsHolder: [],
            creators: [],
            contributors: [],
            comments: doc.comments || [],
            registry: null,
            ontology_level: 'unsorted',
            registered: false,
            addedByUser: true,
            source: 'user',
            datasetId: doc.datasetId,
            fileName: doc.fileName
          };
          ontologyIndex.records.push(record);
          existingIris.add(doc.iri);
        }
      }
    }
  }

  for (const doc of docs) {
    if (doc.addedByUser && doc.type === 'Ontology' && !existingIris.has(doc.iri)) {
      const record = {
        iri: doc.iri,
        label: doc.label || doc.iri,
        description: doc.definition || '',
        versionIri: '',
        versionIriCount: 0,
        versionInfo: [],
        imports: [],
        license: [],
        rightsHolder: [],
        creators: [],
        contributors: [],
        comments: doc.comments || [],
        registry: null,
        ontology_level: 'unsorted',
        registered: false,
        addedByUser: true
      };
      ontologyIndex.records.push(record);
      existingIris.add(record.iri);
    }
  }

  const registry = mergeRegistryEntries(await loadDefaultRegistry(), await loadRegistryOverrides());
  const records = mergeOntologyRecordsWithRegistry(ontologyIndex.records, registry);
  ontologyIndex.records = records;
  ontologyIndex.byIri = new Map(records.map((record) => [record.iri, record]));
  return { records, registry, ontologyIndex, docs, docsByIri, fromSnapshot: !!snapshot };
}

function ontologyTermPrefixHints(ontologyIri) {
  const iri = String(ontologyIri || '');
  const hints = [iri];
  if (iri.endsWith('#') || iri.endsWith('/')) hints.push(iri);
  else hints.push(`${iri}#`, `${iri}/`);

  const oboMatch = iri.match(/^https?:\/\/purl\.obolibrary\.org\/obo\/([a-z0-9_-]+)\.owl$/i);
  if (oboMatch) hints.push(`${NAMESPACE.obo}${oboMatch[1].toUpperCase()}_`);

  return [...new Set(hints)];
}

export function termsForOntology(ontologyIri, docs) {
  const prefixHints = ontologyTermPrefixHints(ontologyIri);
  return (docs || [])
    .filter((doc) => doc.type !== 'Ontology')
    .filter((doc) => (doc.curated_in || []).includes(ontologyIri)
      || doc.ontologyName === ontologyIri
      || prefixHints.some((prefix) => String(doc.iri || '').startsWith(prefix)))
    .map((doc) => ({
      iri: doc.iri,
      type: (doc.typeIris?.length ? doc.typeIris : [doc.type]).join(', '),
      label: doc.label || '',
      synonym: (doc.altLabels || []).join('; '),
      definition: doc.definition || ''
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.iri.localeCompare(b.iri));
}

export function truncateText(text, maxWords = 300, maxChars = 500) {
  const raw = String(text || '').trim();
  const words = raw.split(/\s+/).filter(Boolean);
  if (raw.length <= maxChars && words.length <= maxWords) return { text: raw, truncated: false };
  const byChars = raw.slice(0, maxChars).trim();
  const byWords = words.slice(0, maxWords).join(' ');
  const preview = byChars.length <= byWords.length ? byChars : byWords;
  return { text: preview.replace(/[,\s;:.]+$/, ''), truncated: true };
}
