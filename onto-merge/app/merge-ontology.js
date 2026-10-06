import { COMMON_NAMESPACE_IRIS, namespacePrefixMapFromRegistry } from '../../packages/namespace-registry/src/index.js';
import { quad } from '../../packages/rdf-io/src/index.js';
import {
  createOntologyImportDecisionRows,
  ONTOLOGY_IMPORT_ACTIONS
} from '../../packages/rdf-graph-operations/src/index.js';

const DEFAULT_PREFIXES = Object.freeze(namespacePrefixMapFromRegistry());

/**
 * Builds the merged ontology quad set after applying import choices.
 *
 * @param {ReadonlyArray<object>} sources - Loaded ontology source records.
 * @param {object} options - Merge options.
 * @param {ReadonlyArray<string>} options.rootSourceIds - Sources selected as root ontologies.
 * @param {Record<string, string>} [options.actionsByIri] - Import action by target IRI.
 * @param {string} [options.headerOntologyIri] - Ontology IRI whose old header quads should be replaced.
 * @returns {Readonly<{quads: object[], includedSourceIds: string[], importedIris: string[]}>}
 */
export function buildMergedOntologyQuads(sources, options = {}) {
  const sourceList = sources || [];
  const rootSourceIds = new Set(options.rootSourceIds || sourceList.map((source) => source.id));
  const sourceByIri = new Map(sourceList.filter((source) => source.ontologyIri).map((source) => [source.ontologyIri, source]));
  const includedIds = new Set([...rootSourceIds]);
  const importedIris = new Set();

  for (const row of createOntologyImportDecisionRows(sourceList, options.actionsByIri || {})) {
    if (!rootSourceIds.has(row.sourceId)) continue;
    if (row.action === ONTOLOGY_IMPORT_ACTIONS.MERGE && row.availableSourceId) includedIds.add(row.availableSourceId);
    if (row.action === ONTOLOGY_IMPORT_ACTIONS.IMPORT) importedIris.add(row.targetIri);
  }

  const includedOntologyIris = new Set([...includedIds]
    .map((sourceId) => sourceList.find((candidate) => candidate.id === sourceId)?.ontologyIri)
    .filter(Boolean));
  if (options.headerOntologyIri) includedOntologyIris.add(options.headerOntologyIri);

  const mergedQuads = [];
  for (const source of sourceList) {
    if (!includedIds.has(source.id)) continue;
    for (const item of source.quads) {
      if (shouldDropQuadForMerge(item, {
        mergedImportIris: includedOntologyIris,
        headerOntologyIris: includedOntologyIris
      })) continue;
      mergedQuads.push(item);
    }
  }

  return Object.freeze({
    quads: Object.freeze(dedupeQuads(mergedQuads)),
    includedSourceIds: Object.freeze([...includedIds]),
    importedIris: Object.freeze([...importedIris].filter((iri) => !sourceByIri.has(iri) || !includedIds.has(sourceByIri.get(iri).id)).sort())
  });
}

/**
 * Builds a prefix map for serialization and header templates.
 *
 * @param {ReadonlyArray<object>} sources - Loaded ontology source records.
 * @param {Record<string, string>} [extraPrefixes] - User or app prefixes.
 * @returns {Readonly<Record<string, string>>} Prefix map.
 */
export function buildMergedPrefixMap(sources, extraPrefixes = {}) {
  return Object.freeze({
    ...DEFAULT_PREFIXES,
    ...(sources || []).reduce((prefixes, source) => ({ ...prefixes, ...(source.prefixes || {}) }), {}),
    ...extraPrefixes
  });
}

/**
 * Creates editable Turtle header text for the merged ontology.
 *
 * @param {object} options - Header options.
 * @param {string} options.templateId - Header template id.
 * @param {string} options.ontologyIri - Merged ontology IRI.
 * @param {Record<string, string>} [options.prefixes] - Prefix map.
 * @param {ReadonlyArray<string>} [options.importedIris] - owl:imports targets to retain.
 * @param {string} [options.annotationText] - Manually edited annotation block.
 * @returns {string} Turtle header snippet.
 */
export function buildTurtleHeaderTemplate(options = {}) {
  const ontologyIri = String(options.ontologyIri || 'https://example.org/merged-ontology').trim();
  const prefixes = options.prefixes || DEFAULT_PREFIXES;
  const prefixLines = Object.entries(prefixes)
    .filter(([prefix, iri]) => isValidPrefix(prefix) && isAbsoluteIri(iri))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([prefix, iri]) => `@prefix ${prefix}: <${iri}> .`);
  const annotationLines = normalizeAnnotationText(options.annotationText || defaultAnnotationBlock(options.templateId));
  const imports = (options.importedIris || [])
    .filter(isAbsoluteIri)
    .map((iri) => `  owl:imports <${iri}> ;`);

  return [
    ...prefixLines,
    '',
    `<${ontologyIri}> a owl:Ontology ;`,
    ...imports,
    annotationLines
  ].filter((line) => line !== null).join('\n').replace(/;\s*\.\s*$/m, '.');
}

/**
 * Composes a final RDF file from an editable Turtle header and body text.
 *
 * @param {string} headerText - Turtle header text.
 * @param {string} bodyText - Serialized RDF body text.
 * @returns {string} Final merged file text.
 */
export function composeMergedOntologyText(headerText, bodyText) {
  return `${String(headerText || '').trim()}\n\n${stripRepeatedPrefixDeclarations(bodyText).trim()}\n`;
}

/**
 * Derives an export filename from the ontology IRI and output format.
 *
 * @param {string} ontologyIri - Merged ontology IRI.
 * @param {string} extension - File extension.
 * @returns {string} Suggested filename.
 */
export function createMergedOntologyFilename(ontologyIri, extension = 'ttl') {
  const candidate = String(ontologyIri || '').split(/[\/#]/).filter(Boolean).pop() || 'merged-ontology';
  const base = candidate.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'merged-ontology';
  return `${base}.${String(extension || 'ttl').replace(/^\./, '')}`;
}

function shouldDropQuadForMerge(item, options) {
  if (options.headerOntologyIris.has(item.subject?.value)) return true;
  return item.predicate?.value === COMMON_NAMESPACE_IRIS.owl.imports &&
    item.object?.termType === 'NamedNode' &&
    options.mergedImportIris.has(item.object.value);
}

function dedupeQuads(quads) {
  const seen = new Set();
  return quads.filter((item) => {
    const key = quadKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function quadKey(item) {
  return [item.subject, item.predicate, item.object, item.graph].map(termKey).join('\u0000');
}

function termKey(term) {
  if (!term) return '';
  const suffix = term.termType === 'Literal'
    ? `${term.language || ''}\u0001${term.datatype?.value || ''}`
    : '';
  return `${term.termType || ''}\u0001${term.value || ''}\u0001${suffix}`;
}

function normalizeAnnotationText(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return '.';
  const lastIndex = lines.length - 1;
  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (index === lastIndex) return trimmed.endsWith('.') ? trimmed : `${trimmed.replace(/[;,]\s*$/, '')} .`;
    return trimmed.endsWith(';') ? `  ${trimmed}` : `  ${trimmed.replace(/[.]\s*$/, '')} ;`;
  }).join('\n');
}

function defaultAnnotationBlock(templateId) {
  if (templateId === 'obo') {
    return [
      'dcterms:title "Merged ontology" ;',
      'dcterms:description "Merged ontology generated from local source files." ;',
      'owl:versionInfo "Unversioned merge" .'
    ].join('\n');
  }
  if (templateId === 'minimal') return 'rdfs:label "Merged ontology" .';
  return [
    'dcterms:title "Merged ontology" ;',
    'dcterms:creator "" ;',
    'dcterms:description "" ;',
    'owl:versionInfo "" .'
  ].join('\n');
}

function stripRepeatedPrefixDeclarations(text) {
  return String(text || '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(?:@prefix|PREFIX)\s+/i.test(line))
    .join('\n');
}

function isAbsoluteIri(value) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(String(value || '').trim());
}

function isValidPrefix(value) {
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(String(value || '').trim());
}
