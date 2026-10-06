import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';
import { readOntologyMetadataRecordFromQuads } from '../../ontology-metadata/src/index.js';
import { datasetToQuads } from '../../rdf-io/src/index.js';

/** Import-handling decisions understood by ontology merge planning. */
export const ONTOLOGY_IMPORT_ACTIONS = Object.freeze({
  IMPORT: 'import',
  MERGE: 'merge',
  IGNORE: 'ignore'
});

/**
 * Creates a runtime-neutral ontology source for import and merge planning.
 *
 * Ontology identity and `owl:imports` values are read through the canonical
 * ontology-metadata package. The source contains no browser `File`, DOM, or
 * storage references.
 *
 * @param {object} input Parsed ontology source details.
 * @param {string} [input.id] Stable source identifier.
 * @param {string} [input.name] Human-readable source name.
 * @param {unknown} [input.dataset] RDF dataset-like input.
 * @param {unknown} [input.quads] RDF quad iterable used when dataset is absent.
 * @param {Record<string,string>} [input.prefixes] Prefixes captured by the parser.
 * @param {string} [input.mimeType] Source RDF MIME type.
 * @returns {Readonly<{
 *   id:string,
 *   name:string,
 *   ontologyIri:string,
 *   quads:ReadonlyArray<object>,
 *   prefixes:Readonly<Record<string,string>>,
 *   mimeType:string,
 *   imports:ReadonlyArray<string>
 * }>} Normalized merge-planning source.
 */
export function createOntologyMergeSource(input = {}) {
  if (!input || typeof input !== 'object') {
    throw new TypeError('createOntologyMergeSource() expected an input object.');
  }

  const quads = datasetToQuads(input.dataset ?? input.quads ?? []);
  const metadata = readOntologyMetadataRecordFromQuads(quads);
  const ontologyIri = String(metadata?.['@id'] || '').trim();
  const imports = extractNodeIris(metadata?.[COMMON_NAMESPACE_IRIS.owl.imports]);
  const id = String(input.id || input.name || ontologyIri || '').trim();

  if (!id) {
    throw new TypeError('createOntologyMergeSource() requires id, name, or an owl:Ontology IRI.');
  }

  return Object.freeze({
    id,
    name: String(input.name || input.id || ontologyIri || 'ontology').trim(),
    ontologyIri,
    quads: Object.freeze(quads),
    prefixes: Object.freeze({ ...(input.prefixes || {}) }),
    mimeType: String(input.mimeType || '').trim(),
    imports: Object.freeze(imports)
  });
}

/**
 * Creates deterministic rows describing how direct ontology imports should be
 * handled by a merge operation.
 *
 * Locally available imports default to `merge`; unavailable imports default to
 * `import`. Explicit valid decisions override those defaults. This function
 * plans actions only and does not fetch, parse, merge, or persist RDF.
 *
 * @param {ReadonlyArray<object>} sources Ontology merge sources.
 * @param {Record<string,string>} [actionsByIri] Explicit action by import IRI.
 * @returns {ReadonlyArray<Readonly<{
 *   sourceId:string,
 *   sourceName:string,
 *   targetIri:string,
 *   availableSourceId:string,
 *   availableSourceName:string,
 *   action:'import'|'merge'|'ignore'
 * }>>} Import decision rows in source/import order.
 */
export function createOntologyImportDecisionRows(sources, actionsByIri = {}) {
  if (!Array.isArray(sources)) {
    throw new TypeError('createOntologyImportDecisionRows() expected a source array.');
  }
  if (!actionsByIri || typeof actionsByIri !== 'object' || Array.isArray(actionsByIri)) {
    throw new TypeError('createOntologyImportDecisionRows() expected actionsByIri to be an object.');
  }

  const byOntologyIri = new Map(sources
    .filter((source) => source?.ontologyIri)
    .map((source) => [source.ontologyIri, source]));
  const rows = [];
  const seen = new Set();

  for (const source of sources) {
    if (!source || typeof source !== 'object') continue;
    for (const targetIri of source.imports || []) {
      const key = `${source.id}\u0000${targetIri}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const availableSource = byOntologyIri.get(targetIri) || null;
      const requestedAction = normalizeOntologyImportAction(actionsByIri[targetIri]);
      rows.push(Object.freeze({
        sourceId: String(source.id || ''),
        sourceName: String(source.name || source.id || ''),
        targetIri,
        availableSourceId: String(availableSource?.id || ''),
        availableSourceName: String(availableSource?.name || ''),
        action: requestedAction || (availableSource
          ? ONTOLOGY_IMPORT_ACTIONS.MERGE
          : ONTOLOGY_IMPORT_ACTIONS.IMPORT)
      }));
    }
  }

  return Object.freeze(rows);
}

function extractNodeIris(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((value) => String(value?.['@id'] || '').trim())
    .filter(Boolean))]
    .sort();
}

function normalizeOntologyImportAction(value) {
  return Object.values(ONTOLOGY_IMPORT_ACTIONS).includes(value) ? value : '';
}
