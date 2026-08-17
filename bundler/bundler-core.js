// docs/app/bundler-core.js
import { inferElementType } from '../app/rdf_extract.js';
import {
  COMMON_NAMESPACE_IRIS,
  namespacePrefixMapFromRegistry
} from '../packages/namespace-registry/src/index.js';
import {
  deleteOntoEagleAppSetting,
  getOntoEagleAppSetting,
  setOntoEagleAppSetting
} from '../app/ontoeagle-indexeddb-store.js';
import { createUuid } from '../packages/ontology-utils/src/index.js';

/**
 * Bundles are stored as JSON-LD in IndexedDB-backed project settings:
 * - Bundles are skos:Collection nodes with skos:member [{@id: ...}]
 * - Items are nodes keyed by @id with rdfs:label / skos:definition etc.
 */

export const BUNDLE_SETTING_KEY = 'onto.bundles.jsonld';

const COMMON_PREFIXES = namespacePrefixMapFromRegistry();

export const CONTEXT = Object.freeze({
  rdf: COMMON_PREFIXES.rdf,
  rdfs: COMMON_PREFIXES.rdfs,
  skos: COMMON_PREFIXES.skos,
  owl: COMMON_PREFIXES.owl
});

export function emptyDoc() {
  return { '@context': { ...CONTEXT }, '@graph': [] };
}

export function safeParseJson(text, fallback) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function normalizeBundleDoc(doc) {
  if (!doc || typeof doc !== 'object') return emptyDoc();
  if (!Array.isArray(doc['@graph'])) doc['@graph'] = [];
  if (!doc['@context']) doc['@context'] = { ...CONTEXT };
  return doc;
}

export async function loadDoc() {
  const stored = await getOntoEagleAppSetting(BUNDLE_SETTING_KEY, null);
  const doc = typeof stored === 'string'
    ? safeParseJson(stored, emptyDoc())
    : stored;
  return normalizeBundleDoc(doc);
}

/**
 * Reads current member count from IndexedDB-backed bundle storage.
 *
 * @returns {Promise<number>} Current bundle member count.
 */
export async function getShoppingCartCountFromStorage() {
  try {
    const doc = await loadSlimBundleDoc();
    const col = doc['@graph']?.find((n) => n && n['@type'] === 'skos:Collection');
    const members = col?.['skos:member'];
    return Array.isArray(members) ? members.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Update header shopping cart count.
 * @param {number} n
 */
export function setShoppingCartCount(n) {
  const el = document.getElementById('ontShoppingCartCount');
  if (el) {
    const count = Number.isFinite(n) ? n : 0;
    el.textContent = String(count);
    el.setAttribute('aria-label', `${count} bundled item${count === 1 ? '' : 's'}`);
  }
}

/**
 * @returns {Promise<any>} JSON-LD object with @context + @graph
 */
export async function loadSlimBundleDoc() {
  return loadDoc();
}

export async function saveDoc(doc) {
  return setOntoEagleAppSetting(BUNDLE_SETTING_KEY, normalizeBundleDoc(doc));
}

export async function clearDoc() {
  await deleteOntoEagleAppSetting(BUNDLE_SETTING_KEY);
}

export function graph(doc) {
  return doc['@graph'];
}

export function nodeById(doc) {
  const map = new Map();
  for (const n of graph(doc)) {
    if (n && typeof n === 'object' && typeof n['@id'] === 'string') map.set(n['@id'], n);
  }
  return map;
}

export function isSkosCollection(n) {
  if (!n) return false;
  const t = n['@type'];
  if (t === 'skos:Collection') return true;
  if (Array.isArray(t) && t.includes('skos:Collection')) return true;
  return false;
}

export function listBundles(doc) {
  return graph(doc).filter(isSkosCollection).map(n => n['@id']);
}

export function ensureArray(v) { return Array.isArray(v) ? v : []; }

export function getMembers(doc, bundleId) {
  const idx = nodeById(doc);
  const b = idx.get(bundleId);
  if (!b) return [];
  const raw = ensureArray(b['skos:member']);
  return raw
    .map(m => (m && typeof m === 'object' && typeof m['@id'] === 'string') ? m['@id'] : null)
    .filter(Boolean);
}

export function setMembers(doc, bundleId, memberIds) {
  const idx = nodeById(doc);
  const b = idx.get(bundleId);
  if (!b) return;
  const uniq = Array.from(new Set(memberIds));
  b['skos:member'] = uniq.map(id => ({ '@id': id }));
}

export function upsertNode(doc, node) {
  const g = graph(doc);
  const i = g.findIndex(n => n && n['@id'] === node['@id']);
  if (i >= 0) g[i] = { ...g[i], ...node };
  else g.push(node);
}

export function deleteNode(doc, id) {
  doc['@graph'] = graph(doc).filter(n => !(n && n['@id'] === id));
}

export function mintBundleIri() {
  return `urn:uuid:${createUuid()}`;
}

export function createBundle(doc) {
  const id = mintBundleIri();
  upsertNode(doc, { '@id': id, '@type': 'skos:Collection', 'skos:member': [] });
  return id;
}

export function addMember(doc, bundleId, itemId) {
  const members = getMembers(doc, bundleId);
  if (!members.includes(itemId)) {
    members.push(itemId);
    setMembers(doc, bundleId, members);
  }
}

export function removeMember(doc, bundleId, itemId) {
  setMembers(doc, bundleId, getMembers(doc, bundleId).filter(x => x !== itemId));
}

export function copyMember(doc, fromBundleId, toBundleId, itemId) {
  addMember(doc, toBundleId, itemId);
}

export function moveMember(doc, fromBundleId, toBundleId, itemId) {
  addMember(doc, toBundleId, itemId);
  removeMember(doc, fromBundleId, itemId);
}

export function mergeBundles(doc, bundleIds) {
  const newId = createBundle(doc);
  const all = [];
  for (const bid of bundleIds) all.push(...getMembers(doc, bid));
  setMembers(doc, newId, all);
  for (const bid of bundleIds) deleteNode(doc, bid);
  return newId;
}

export function splitBundle(doc, bundleId, memberIdsToMove) {
  const newId = createBundle(doc);
  const fromMembers = getMembers(doc, bundleId);
  const moveSet = new Set(memberIdsToMove);

  setMembers(doc, bundleId, fromMembers.filter(id => !moveSet.has(id)));
  setMembers(doc, newId, memberIdsToMove);

  return newId;
}

/* ---------- Export helpers (labels / export formats) ---------- */

export function pickLabelValue(v) {
  if (typeof v === 'string') return v;

  if (Array.isArray(v)) {
    for (const x of v) {
      if (typeof x === 'string') return x;
      if (x && typeof x === 'object' && typeof x['@value'] === 'string') return x['@value'];
    }
  }

  if (v && typeof v === 'object') {
    if (typeof v['@value'] === 'string') return v['@value'];
    if (v.en && Array.isArray(v.en) && typeof v.en[0] === 'string') return v.en[0];
    const keys = Object.keys(v);
    if (keys.length > 0 && Array.isArray(v[keys[0]]) && typeof v[keys[0]][0] === 'string') return v[keys[0]][0];
  }

  return '';
}

export function getItemLabel(doc, itemId) {
  const idx = nodeById(doc);
  const n = idx.get(itemId);
  if (!n) return '';
  const rdfsLabel = pickLabelValue(n['rdfs:label']);
  if (rdfsLabel) return rdfsLabel;
  const skosPref = pickLabelValue(n['skos:prefLabel']);
  if (skosPref) return skosPref;
  return '';
}

export function toRobotSeedText(doc, bundleId, includeLabels) {
  const members = getMembers(doc, bundleId);
  const lines = [];

  for (const iri of members) {
    const label = includeLabels ? getItemLabel(doc, iri).trim() : '';
    if (includeLabels && label) lines.push(`${iri} # ${label}`);
    else lines.push(`${iri}`);
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}

export function shortId(iri) {
  const m = iri.match(/urn:uuid:([0-9a-f-]{8,})/i);
  return m ? m[1].slice(0, 8) : iri.slice(-10);
}

/* ---------- “loose” JSON-LD value helpers for UI ---------- */

export const RDFS_IS_DEFINED_BY_KEYS = Object.freeze([
  COMMON_NAMESPACE_IRIS.cco2.curatedIn,
  'cceo:ont00001760',
  COMMON_NAMESPACE_IRIS.cceo.curatedIn,
  'cceo:is_curated_in_ontology',
  'rdfs:isDefinedBy',
  COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy
]);

export const RDF_TYPE_KEYS = Object.freeze([
  '@type',
  'rdf:type',
  COMMON_NAMESPACE_IRIS.rdf.type
]);

export function getAnyKey(node, keys) {
  if (!node || typeof node !== 'object') return undefined;
  for (const k of keys) {
    if (k in node) return node[k];
  }
  return undefined;
}

export function valueToStringsLoose(v) {
  if (v == null) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(valueToStringsLoose).filter(Boolean);
  if (typeof v === 'object') {
    if (typeof v['@id'] === 'string') return [v['@id']];
    if (typeof v['@value'] === 'string') return [v['@value']];
  }
  return [];
}

export function getPrimaryTypePill(node) {
  const typeValue = getAnyKey(node, RDF_TYPE_KEYS);
  const inferred = inferElementType(typeValue);
  if (inferred && inferred !== 'Other') return inferred;

  const rawTypes = valueToStringsLoose(typeValue);
  if (rawTypes.length > 0) return 'NamedIndividual';

  return '';
}

export function getDefinedByIri(node) {
  const v = getAnyKey(node, RDFS_IS_DEFINED_BY_KEYS);
  const ids = valueToStringsLoose(v);
  return ids[0] || '';
}
