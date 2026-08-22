/**
 * @file Serialize RDFJS datasets into Turtle/TriG/N-Triples/N-Quads/JSON-LD.
 */
import {
  parseRdfTextWithAdapters,
  serializeRdfDatasetWithAdapters
} from '../../../packages/rdf-io/src/index.js';

/**
 * Resolve required globals once at module load.
 * Throws early with a clear message if script order / globals are wrong.
 */
const N3 = /** @type {any} */ (globalThis).N3;
if (!N3) {
  throw new Error(
    'Global N3 not found. Ensure ./app/shared/vendor/n3.min.js is loaded BEFORE your module scripts (e.g., main.js). Expected globalThis.N3.'
  );
}

const JSONLD = /** @type {any} */ (globalThis).jsonld;
if (!JSONLD) {
  throw new Error(
    'Global jsonld not found. Ensure ./app/shared/vendor/jsonld.min.js is loaded BEFORE your module scripts (e.g., main.js). Expected globalThis.jsonld.'
  );
}

if (typeof JSONLD.fromRDF !== 'function') {
  throw new Error(
    'Global jsonld.fromRDF is not a function. Your jsonld.min.js build may not expose fromRDF(). Use a jsonld build that attaches globalThis.jsonld with fromRDF().'
  );
}

/**
 * Serializes a dataset into multiple syntaxes.
 * @param {{
 *   dataset: any,
 *   graphIri: string,
 *   prefixes: Record<string, string>
 * }} params
 * @returns {Promise<{
 *   turtle: string,
 *   trig: string,
 *   ntriples: string,
 *   nquads: string,
 *   jsonldTriples: string,
 *   jsonldGraph: string
 * }>}
 */
export async function datasetToSerializations({ dataset, graphIri, prefixes }) {
  const { DataFactory, Store } = N3;

  // Split into "triples view" (default graph) vs "graph view" (named graph).
  const quads = dataset.getQuads(null, null, null, null);

  const triplesStore = new Store();
  for (const q of quads) {
    triplesStore.addQuad(DataFactory.quad(q.subject, q.predicate, q.object));
  }

  const turtle = await serializeRdfDatasetText(triplesStore, { format: 'Turtle', prefixes });
  const ntriples = await serializeRdfDatasetText(triplesStore, { format: 'N-Triples' });

  const trig = await serializeRdfDatasetText(dataset, { format: 'application/trig', prefixes });
  const nquads = await serializeRdfDatasetText(dataset, { format: 'N-Quads' });

  const jsonldTriples = await serializeRdfDatasetToJsonLdText(triplesStore);
  const jsonldGraph = await serializeRdfDatasetToJsonLdText(dataset, graphIri);

  return { turtle, trig, ntriples, nquads, jsonldTriples, jsonldGraph };
}

/**
 * Serializes an RDF/JS dataset/store with the promoted RDF adapter layer.
 * @param {any} store
 * @param {{format: string, prefixes?: Record<string, string>}} options
 * @returns {Promise<string>}
 */
export function serializeRdfDatasetText(store, options) {
  return serializeRdfDatasetWithAdapters(store, {
    format: options.format,
    prefixes: options.prefixes || {},
    runtime: { N3, jsonld: JSONLD }
  }).then((result) => result.text);
}

/**
 * Serializes an RDF/JS dataset/store to JSON-LD without reparsing an
 * intermediate N-Triples/N-Quads string.
 * @param {any} store
 * @param {string} [graphIri]
 * @returns {Promise<string>}
 */
export function serializeRdfDatasetToJsonLdText(store, graphIri) {
  return serializeRdfDatasetWithAdapters(store, {
    format: 'jsonld',
    runtime: { N3, jsonld: JSONLD },
    ...(graphIri ? { baseIri: graphIri } : {})
  }).then((result) => result.text);
}

/**
 * Converts N-Triples or N-Quads string to JSON-LD using jsonld.js.
 * @param {string} nquadsOrNtriples
 * @param {boolean} isDataset
 * @param {string} [graphIri]
 * @returns {Promise<string>}
 */
export async function rdfToJsonLd(nquadsOrNtriples, isDataset, graphIri) {
  // jsonld.fromRDF expects N-Quads. For N-Triples, it still works (subset).
  const parsed = await parseRdfTextWithAdapters(String(nquadsOrNtriples || ''), {
    format: isDataset ? 'nquads' : 'ntriples',
    runtime: { N3, jsonld: JSONLD }
  });
  const serialized = await serializeRdfDatasetWithAdapters(parsed.dataset, {
    format: 'jsonld',
    runtime: { N3, jsonld: JSONLD },
    ...(graphIri ? { baseIri: graphIri } : {})
  });
  return serialized.text;
}
