import { normalizeText } from './normalize.js';
import {
  expandCurieToIri,
  namespacePrefixMapFromRegistry
} from '../packages/namespace-registry/src/index.js';

const PREFIXES = namespacePrefixMapFromRegistry();

export function namespaceFilterCandidates(value) {
  const raw = String(value || '').trim();
  if (!raw) return [];

  const prefixToken = normalizeText(raw.replace(/:$/, ''));
  const candidates = [];
  if (PREFIXES[prefixToken]) candidates.push(PREFIXES[prefixToken]);
  candidates.push(raw);

  if (/^[a-z][\w.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    const expanded = expandCurieToIri(raw, PREFIXES, { allowEmptyLocalName: true });
    if (expanded.ok) candidates.push(expanded.value);
  }

  return Array.from(new Set(candidates.map((s) => normalizeText(s)).filter(Boolean)));
}

export function normalizeNamespaceFilters(values) {
  return (values || []).flatMap(namespaceFilterCandidates);
}

export function docMatchesNamespaceFilter(doc, filter) {
  const f = normalizeText(filter);
  if (!f) return true;

  const ns = normalizeText(doc.namespace || '');
  const iri = normalizeText(doc.iri || '');
  const dataset = normalizeText(doc.datasetId || '');
  const ontologyName = normalizeText(doc.ontologyName || '');

  return ns === f || ns.startsWith(f) || iri === f || iri.startsWith(f) || dataset === f || ontologyName === f;
}
