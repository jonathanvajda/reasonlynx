// app/engine.js
// @ts-check

/**
 * OCQ query evaluation engine.
 *
 * Responsibilities:
 * - Parse ontology text into an RDF/JS store
 * - Load the manifest and SPARQL query text files
 * - Execute SELECT and ASK queries via Comunica
 * - Normalize rows into a stable result shape
 */

/** @typedef {import('./types.js').Manifest} Manifest */
/** @typedef {import('./types.js').ManifestQuery} ManifestQuery */
/** @typedef {import('./types.js').PreflightSummary} PreflightSummary */
/** @typedef {import('./types.js').OntologyMetadata} OntologyMetadata */
/** @typedef {import('./types.js').QueryResultRow} QueryResultRow */
/** @typedef {import('./types.js').QueryResultStatus} QueryResultStatus */
/** @typedef {import('./types.js').QueryScope} QueryScope */
/** @typedef {import('./types.js').ResourceDetail} ResourceDetail */
/** @typedef {import('./types.js').ResourceDetailField} ResourceDetailField */
/** @typedef {import('./types.js').Severity} Severity */

import {
  SUPPORTED_MIME_DESCRIPTORS,
  getSupportedMimeTypeForFilename,
  normalizeSupportedMimeType
} from '../../packages/format-registry/src/mime-registry.js';
import {
  parseRdfTextWithAdapters,
  serializeRdfDatasetWithAdapters
} from '../../packages/rdf-io/src/index.js';
import {
  COMMON_NAMESPACE_IRIS,
  namespacePrefixMapFromRegistry
} from '../../packages/namespace-registry/src/namespace-registry.js';
import {
  classifyOntologyInput,
  isBlankNodeTerm,
  isIriInNamespace
} from '../../packages/ontology-utils/src/index.js';
import {
  readOntologyMetadataRecordFromQuads
} from '../../packages/ontology-metadata/src/index.js';
import {
  getCurationStatusLabel,
  getCurationStatusRank
} from './grader.js';

/**
 * @typedef {Object} EvaluateAllQueriesOptions
 * @property {string} [manifestUrl]
 * @property {string} [queryBasePath]
 * @property {Manifest | null | undefined} [manifest]
 * @property {string[] | Set<string> | null | undefined} [resultResourceFilter]
 * @property {string[] | null | undefined} [resourceInventory]
 * @property {any} [resourceDetailsStore]
 * @property {any} [ontologyMetadataStore]
 * @property {(progress: { fileName: string, queryId: string, completedQueries: number, totalQueries: number }) => void} [onQueryProgress]
 */

/**
 * @typedef {Object} EvaluateAllQueriesOutput
 * @property {QueryResultRow[]} results
 * @property {string[]} resources
 * @property {Record<string, ResourceDetail>} resourceDetails
 * @property {string} ontologyIri
 * @property {OntologyMetadata} ontologyMetadata
 */

/** @type {(Window & typeof globalThis & { Comunica?: any, N3?: object, jsonld?: object, $rdf?: object }) | typeof globalThis} */
const runtimeWindow = typeof window !== 'undefined' ? window : globalThis;

/** @type {{ newEngine?: Function, QueryEngine?: any }} */
const COMUNICA_GLOBAL = runtimeWindow.Comunica || {};

/** @type {any | null} */
let cachedComunicaEngine = null;

export const DEFAULT_MANIFEST_URL = './queries/manifest.json';
export const DEFAULT_QUERY_BASE_PATH = 'queries/';
export const DEFAULT_STANDARDS_MANIFEST_URL = './queries/standards-manifest.json';

export const UNKNOWN_ONTOLOGY_IRI = 'urn:ontology:unknown';

const CCEO_CURATED_IN_ONTOLOGY_LOCAL_NAME = 'is_curated_in_ontology';
const STANDARD_PREFIXES = namespacePrefixMapFromRegistry();

/** @type {ReadonlyArray<{ namespace: string, curatedIn: string }>} */
const KNOWN_VOCABULARY_CURATED_IN_FALLBACKS = Object.freeze([
  {
    namespace: STANDARD_PREFIXES.rdf,
    curatedIn: STANDARD_PREFIXES.rdf
  },
  {
    namespace: STANDARD_PREFIXES.rdfs,
    curatedIn: STANDARD_PREFIXES.rdfs
  },
  {
    namespace: STANDARD_PREFIXES.owl,
    curatedIn: STANDARD_PREFIXES.owl
  },
  {
    namespace: STANDARD_PREFIXES.skos,
    curatedIn: STANDARD_PREFIXES.skos
  },
  {
    namespace: STANDARD_PREFIXES.dc,
    curatedIn: STANDARD_PREFIXES.dc
  },
  {
    namespace: STANDARD_PREFIXES.dcterms,
    curatedIn: STANDARD_PREFIXES.dcterms
  }
]);

/** @type {ReadonlySet<string>} */
const BUILT_IN_DEPENDENCY_IRI_EXCLUSIONS = Object.freeze(new Set([
  COMMON_NAMESPACE_IRIS.rdf.nil
]));

/** @type {ReadonlyArray<{ id: string, predicateIri: string, label: string }>} */
const RESOURCE_DETAIL_PREDICATES = Object.freeze([
  { id: 'rdfType', predicateIri: COMMON_NAMESPACE_IRIS.rdf.type, label: 'RDF type' },
  { id: 'label', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.label, label: 'Label' },
  { id: 'definitionSkos', predicateIri: COMMON_NAMESPACE_IRIS.skos.definition, label: 'Definition' },
  { id: 'definitionIao', predicateIri: COMMON_NAMESPACE_IRIS.iao.definition, label: 'Definition (IAO:0000115)' },
  { id: 'altLabelSkos', predicateIri: COMMON_NAMESPACE_IRIS.skos.altLabel, label: 'Alternative label' },
  { id: 'altTermIao', predicateIri: COMMON_NAMESPACE_IRIS.iao.alternativeTerm, label: 'Alternative term (IAO:0000118)' },
  { id: 'acronym', predicateIri: COMMON_NAMESPACE_IRIS.cceo.acronym, label: 'Acronym' },
  { id: 'exampleSkos', predicateIri: COMMON_NAMESPACE_IRIS.skos.example, label: 'Example' },
  { id: 'exampleIao', predicateIri: COMMON_NAMESPACE_IRIS.iao.exampleOfUsage, label: 'Example of usage (IAO:0000112)' },
  { id: 'scopeNote', predicateIri: COMMON_NAMESPACE_IRIS.skos.scopeNote, label: 'Scope note' },
  { id: 'bibliographicCitation', predicateIri: COMMON_NAMESPACE_IRIS.dcterms.bibliographicCitation, label: 'Bibliographic citation' },
  { id: 'definitionSource', predicateIri: COMMON_NAMESPACE_IRIS.iao.definitionSource, label: 'Definition source (IAO:0000119)' },
  { id: 'isDefinedBy', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy, label: 'Is defined by' },
  { id: 'curatedInOntology', predicateIri: COMMON_NAMESPACE_IRIS.cceo.curatedIn, label: 'Is curated in ontology' },
  { id: 'curationStatus', predicateIri: COMMON_NAMESPACE_IRIS.iao.curationStatus, label: 'Has curation status' },
  { id: 'obsolescenceReason', predicateIri: COMMON_NAMESPACE_IRIS.iao.obsolescenceReason, label: 'Has obsolescence reason' },
  { id: 'curatorNote', predicateIri: COMMON_NAMESPACE_IRIS.iao.curatorNote, label: 'Curator note' },
  { id: 'termReplacedBy', predicateIri: COMMON_NAMESPACE_IRIS.iao.termReplacedBy, label: 'Term replaced by' },
  { id: 'subClassOf', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.subClassOf, label: 'SubClassOf' },
  { id: 'subPropertyOf', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.subPropertyOf, label: 'SubPropertyOf' },
  { id: 'inverseOf', predicateIri: COMMON_NAMESPACE_IRIS.owl.inverseOf, label: 'Inverse property' },
  { id: 'domain', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.domain, label: 'Domain' },
  { id: 'range', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.range, label: 'Range' },
  { id: 'comment', predicateIri: COMMON_NAMESPACE_IRIS.rdfs.comment, label: 'Comment' }
]);

/** @type {Readonly<Record<string, string>>} */
const KNOWN_IRI_LABELS = Object.freeze({
  [COMMON_NAMESPACE_IRIS.owl.Class]: 'owl:Class',
  [COMMON_NAMESPACE_IRIS.owl.NamedIndividual]: 'owl:NamedIndividual',
  [COMMON_NAMESPACE_IRIS.owl.ObjectProperty]: 'owl:ObjectProperty',
  [COMMON_NAMESPACE_IRIS.owl.DatatypeProperty]: 'owl:DatatypeProperty',
  [COMMON_NAMESPACE_IRIS.owl.AnnotationProperty]: 'owl:AnnotationProperty'
});

/** @type {Readonly<Record<string, string>>} */
const RESOURCE_DETAIL_LABELS_BY_PREDICATE = Object.freeze(
  RESOURCE_DETAIL_PREDICATES.reduce((accumulator, descriptor) => {
    accumulator[descriptor.predicateIri] = descriptor.label;
    return accumulator;
  }, /** @type {Record<string, string>} */ ({}))
);

export const SUPPORTED_RDF_FORMATS = Object.freeze({
  TURTLE: SUPPORTED_MIME_DESCRIPTORS.turtle.mimeType,
  N_TRIPLES: SUPPORTED_MIME_DESCRIPTORS.nTriples.mimeType,
  N_QUADS: SUPPORTED_MIME_DESCRIPTORS.nQuads.mimeType,
  TRIG: SUPPORTED_MIME_DESCRIPTORS.trig.mimeType,
  N3: SUPPORTED_MIME_DESCRIPTORS.n3.mimeType,
  JSON_LD: SUPPORTED_MIME_DESCRIPTORS.jsonLd.mimeType,
  RDF_XML: SUPPORTED_MIME_DESCRIPTORS.rdfXml.mimeType
});

export const SUPPORTED_RDF_EXTENSIONS = Object.freeze(
  Object.values(SUPPORTED_MIME_DESCRIPTORS)
    .filter((descriptor) => descriptor.category === 'rdf')
    .flatMap((descriptor) => descriptor.extensions.map((extension) => `.${extension}`))
);

function getRdfRuntimeLibraries() {
  return {
    N3: runtimeWindow.N3,
    jsonld: runtimeWindow.jsonld,
    $rdf: runtimeWindow.$rdf
  };
}

/**
 * Creates a Comunica engine using the browser bundle shape available at runtime.
 *
 * @returns {any}
 */
export function createComunicaEngine() {
  if (typeof COMUNICA_GLOBAL.newEngine === 'function') {
    console.info('[Comunica] Using Comunica.newEngine()');
    return COMUNICA_GLOBAL.newEngine();
  }

  if (typeof COMUNICA_GLOBAL.QueryEngine === 'function') {
    console.info('[Comunica] Using new Comunica.QueryEngine()');
    return new COMUNICA_GLOBAL.QueryEngine();
  }

  throw new Error(
    'No supported Comunica constructor found on window.Comunica.'
  );
}

/**
 * Returns a cached Comunica engine instance.
 *
 * @returns {any}
 */
export function getComunicaEngine() {
  if (!cachedComunicaEngine) {
    cachedComunicaEngine = createComunicaEngine();
  }
  return cachedComunicaEngine;
}

/**
 * Guesses an RDF syntax from the file name.
 *
 * @param {string} [fileName]
 * @returns {string}
 */
export function guessRdfFormatFromFilename(fileName) {
  const detected = getSupportedMimeTypeForFilename(fileName);
  return detected?.ok && detected.value.category === 'rdf'
    ? detected.value.mimeType
    : SUPPORTED_RDF_FORMATS.TURTLE;
}

/**
 * Throws if the file extension suggests a syntax this module does not support.
 *
 * @param {string} [fileName]
 * @returns {void}
 */
export function assertSupportedOntologyFile(fileName) {
  if (!fileName) {
    return;
  }

  const classification = classifyOntologyInput({ filename: fileName });
  if (!classification.isOntologyCandidate) {
    throw new Error(
      'Unsupported ontology file type. Supported inputs are Turtle, N-Triples, N-Quads, TriG, N3, JSON-LD, and RDF/XML.'
    );
  }
}

/**
 * Parses ontology text into the retained app-level ontology state shape.
 *
 * @param {string} ontologyText
 * @param {string} [fileName='ontology.ttl']
 * @param {{ baseIri?: string | null, runtime?: object }} [options]
 * @returns {Promise<{ store: any, prefixes: Record<string, string>, sourceFormat: string, baseIri: string | null }>}
 */
export async function parseOntologyInput(ontologyText, fileName = 'ontology.ttl', options = {}) {
  if (typeof ontologyText !== 'string') {
    throw new TypeError('parseOntologyInput() requires ontologyText to be a string.');
  }

  assertSupportedOntologyFile(fileName);
  const sourceFormat = guessRdfFormatFromFilename(fileName);
  const baseIri = typeof options.baseIri === 'string' && options.baseIri.trim()
    ? options.baseIri.trim()
    : null;
  const parsed = await parseRdfTextWithAdapters(ontologyText, {
    format: sourceFormat,
    baseIri,
    runtime: options.runtime || getRdfRuntimeLibraries()
  });

  return {
    store: parsed.dataset,
    prefixes: parsed.prefixes || {},
    sourceFormat,
    baseIri
  };
}

/**
 * Serializes one RDF/JS-compatible store for ontology export.
 *
 * @param {any} store
 * @param {string} format
 * @param {{ prefixes?: Record<string, string>, baseIri?: string | null, runtime?: object }} [options]
 * @returns {Promise<string>}
 */
export async function serializeOntologyStore(store, format, options = {}) {
  if (!store || typeof store.getQuads !== 'function') {
    throw new TypeError('serializeOntologyStore() requires an RDF/JS-compatible store.');
  }

  const normalized = normalizeSupportedMimeType(format);
  if (!normalized?.ok || normalized.value.category !== 'rdf') {
    throw new Error(`Unsupported RDF serialization format: ${String(format)}`);
  }

  const baseIri = typeof options.baseIri === 'string' && options.baseIri.trim()
    ? options.baseIri.trim()
    : null;
  const serialized = await serializeRdfDatasetWithAdapters(store, {
    format: normalized.value.mimeType,
    prefixes: options.prefixes || {},
    baseIri,
    runtime: options.runtime || getRdfRuntimeLibraries()
  });
  return serialized.text;
}

/**
 * Loads ontology text into an N3 store.
 *
 * @param {string} ontologyText
 * @param {string} [fileName='ontology.ttl']
 * @returns {Promise<any>}
 */
export async function loadOntologyIntoStore(ontologyText, fileName = 'ontology.ttl') {
  if (typeof ontologyText !== 'string') {
    throw new TypeError('loadOntologyIntoStore() requires ontologyText to be a string.');
  }

  assertSupportedOntologyFile(fileName);
  const parsed = await parseOntologyInput(ontologyText, fileName);
  return parsed.store;
}

/**
 * Collects all rows from a Comunica bindings stream.
 *
 * Supports either an async iterator or an EventEmitter-like stream.
 *
 * @param {any} stream
 * @returns {Promise<any[]>}
 */
export async function collectBindingsStream(stream) {
  if (stream && typeof stream.toArray === 'function') {
    return stream.toArray();
  }

  if (stream && typeof stream.on === 'function') {
    return new Promise(
      /**
       * @param {(value: any[]) => void} resolve
       * @param {(reason?: unknown) => void} reject
       */
      (resolve, reject) => {
        /** @type {any[]} */
        const rows = [];
        stream.on('data', /** @param {any} row */ (row) => rows.push(row));
        stream.on('end', () => resolve(rows));
        stream.on('error', /** @param {unknown} error */ (error) => reject(error));
      }
    );
  }

  if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
    const rows = [];
    for await (const row of stream) {
      rows.push(row);
    }
    return rows;
  }

  throw new Error('Unsupported bindings stream shape returned by Comunica.');
}

/**
 * Executes a SELECT query against an RDF/JS store and normalizes the bindings.
 *
 * @param {any} store
 * @param {string} sparql
 * @param {any} [engine]
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function runSelect(store, sparql, engine = getComunicaEngine()) {
  if (!store) {
    throw new TypeError('runSelect() requires a store.');
  }
  if (!sparql) {
    throw new TypeError('runSelect() requires SPARQL text.');
  }

  let bindingsStream;

  if (typeof engine.queryBindings === 'function') {
    bindingsStream = await engine.queryBindings(sparql, {
      sources: [{ type: 'rdfjsSource', value: store }]
    });
  } else if (typeof engine.query === 'function') {
    const result = await engine.query(sparql, {
      sources: [{ type: 'rdfjsSource', value: store }]
    });

    if (!result || typeof result.bindings !== 'function') {
      throw new Error('Comunica query() result does not expose a bindings() method.');
    }

    bindingsStream = await result.bindings();
  } else {
    throw new Error('Comunica engine supports neither queryBindings() nor query().');
  }

  const bindings = await collectBindingsStream(bindingsStream);
  /** @type {Array<Record<string, string>>} */
  const rows = [];

  for (const binding of bindings) {
    /** @type {Record<string, string>} */
    const row = {};

    if (typeof binding.entries === 'function') {
      for (const [variable, term] of binding.entries()) {
        row[String(variable)] = term?.value ?? '';
      }
    } else if (typeof binding.forEach === 'function') {
        binding.forEach(
          /** @type {(term: { value?: string } | null | undefined, variable: string) => void} */
          ((term, variable) => {
            row[String(variable)] = term?.value ?? '';
          })
        );
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Executes an ASK query against an RDF/JS store.
 *
 * @param {any} store
 * @param {string} sparql
 * @param {any} [engine]
 * @returns {Promise<boolean>}
 */
export async function runAsk(store, sparql, engine = getComunicaEngine()) {
  if (!store) {
    throw new TypeError('runAsk() requires a store.');
  }
  if (!sparql) {
    throw new TypeError('runAsk() requires SPARQL text.');
  }

  if (typeof engine.queryBoolean === 'function') {
    return engine.queryBoolean(sparql, {
      sources: [{ type: 'rdfjsSource', value: store }]
    });
  }

  if (typeof engine.query === 'function') {
    const result = await engine.query(sparql, {
      sources: [{ type: 'rdfjsSource', value: store }]
    });

    if (!result || !('booleanResult' in result)) {
      throw new Error('Comunica query() result does not expose booleanResult for ASK.');
    }

    return Boolean(await result.booleanResult);
  }

  throw new Error('Comunica engine supports neither queryBoolean() nor query().');
}

/**
 * Loads and validates the manifest JSON.
 *
 * @param {string} [manifestUrl=DEFAULT_MANIFEST_URL]
 * @returns {Promise<Manifest>}
 */
export async function loadManifest(manifestUrl = DEFAULT_MANIFEST_URL) {
  const response = await fetch(manifestUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch manifest: ${response.status} ${response.statusText}`);
  }

  /** @type {unknown} */
  const rawManifest = await response.json();

  /** @type {{ queries?: unknown }} */
  const manifestLike =
    rawManifest && typeof rawManifest === 'object'
      ? /** @type {{ queries?: unknown }} */ (rawManifest)
      : {};

  if (!Array.isArray(manifestLike.queries)) {
    throw new Error('Manifest JSON is invalid: expected an object with a queries array.');
  }

  /** @type {Manifest} */
  const manifest = /** @type {Manifest} */ (rawManifest);
  const standardsUrl = typeof manifest.standardsUrl === 'string' && manifest.standardsUrl.trim()
    ? manifest.standardsUrl.trim()
    : (
      !Array.isArray(manifest.standards)
        ? DEFAULT_STANDARDS_MANIFEST_URL
        : ''
    );

  if (standardsUrl) {
    const resolvedUrl = new URL(standardsUrl, new URL(manifestUrl, window.location.href)).toString();
    const standardsResponse = await fetch(resolvedUrl);

    if (!standardsResponse.ok) {
      throw new Error(
        `Failed to fetch standards manifest: ${standardsResponse.status} ${standardsResponse.statusText}`
      );
    }

    /** @type {unknown} */
    const rawStandardsManifest = await standardsResponse.json();
    /** @type {{ standards?: unknown }} */
    const standardsManifestLike =
      rawStandardsManifest && typeof rawStandardsManifest === 'object'
        ? /** @type {{ standards?: unknown }} */ (rawStandardsManifest)
        : {};

    if (!Array.isArray(standardsManifestLike.standards)) {
      throw new Error('Standards manifest JSON is invalid: expected an object with a standards array.');
    }

    manifest.standards = standardsManifestLike.standards;
  }

  return manifest;
}

/**
 * Loads SPARQL query text for one manifest query definition.
 *
 * @param {ManifestQuery} queryDefinition
 * @param {string} [queryBasePath=DEFAULT_QUERY_BASE_PATH]
 * @returns {Promise<string>}
 */
export async function loadQueryText(
  queryDefinition,
  queryBasePath = DEFAULT_QUERY_BASE_PATH
) {
  if (!queryDefinition || !queryDefinition.file || !queryDefinition.id) {
    throw new Error('Invalid query definition: missing id or file.');
  }

  const url = `${queryBasePath}${queryDefinition.file}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch query ${queryDefinition.id} from ${url}: ${response.status} ${response.statusText}`
    );
  }

  return response.text();
}

/**
 * Guesses the ontology IRI by locating a subject typed owl:Ontology.
 *
 * @param {any} store
 * @returns {string}
 */
export function guessOntologyIri(store) {
  const quads = store.getQuads(null, null, null, null);

  for (const quad of quads) {
    if (
      quad?.predicate?.value === COMMON_NAMESPACE_IRIS.rdf.type &&
      quad?.object?.value === COMMON_NAMESPACE_IRIS.owl.Ontology
    ) {
      return quad.subject.value;
    }
  }

  return UNKNOWN_ONTOLOGY_IRI;
}

/**
 * Returns the first object value for one subject/predicate pair.
 *
 * @param {any} store
 * @param {string} subjectIri
 * @param {string} predicateIri
 * @returns {string | null}
 */
export function getFirstObjectValue(store, subjectIri, predicateIri) {
  const quad = store.getQuads(subjectIri, predicateIri, null, null)[0];
  return quad?.object?.value || null;
}

/**
 * Returns all object values for one subject/predicate pair.
 *
 * @param {any} store
 * @param {string} subjectIri
 * @param {string} predicateIri
 * @returns {string[]}
 */
export function getObjectValues(store, subjectIri, predicateIri) {
  return store
    .getQuads(subjectIri, predicateIri, null, null)
    .map(
      /** @param {{ object?: { value?: string } | null | undefined }} quad */
      (quad) => quad?.object?.value || ''
    )
    .filter(
      /** @param {string} value */
      (value) => value !== ''
    );
}

/**
 * Returns all normalized object values for one subject/predicate pair.
 *
 * @param {any} store
 * @param {string} subjectIri
 * @param {string} predicateIri
 * @returns {string[]}
 */
export function getNormalizedObjectValues(store, subjectIri, predicateIri) {
  const rawValues = getObjectValues(store, subjectIri, predicateIri);

  if (predicateIri === COMMON_NAMESPACE_IRIS.iao.curationStatus) {
    const normalizedStatuses = rawValues
      .map((value) => ({
        iri: value,
        label: getCurationStatusLabel(value)
      }))
      .filter((entry) => entry.iri !== '')
      .sort((a, b) => {
        const rankDiff = getCurationStatusRank(a.iri) - getCurationStatusRank(b.iri);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return a.label.localeCompare(b.label);
      });

    return Array.from(new Set(normalizedStatuses.map((entry) => entry.label)));
  }

  const values = rawValues
    .map((value) => KNOWN_IRI_LABELS[value] || value)
    .filter((value) => value !== '');

  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a readable label for one predicate IRI.
 *
 * @param {string} predicateIri
 * @returns {string}
 */
export function getPredicateLabel(predicateIri) {
  return RESOURCE_DETAIL_LABELS_BY_PREDICATE[predicateIri] || predicateIri;
}

/**
 * Returns a display value for one literal term.
 *
 * @param {any} term
 * @returns {string}
 */
function getLiteralDisplayValue(term) {
  const value = String(term?.value || '');
  const language = String(term?.language || '');
  const datatypeIri = String(term?.datatype?.value || '');

  if (language) {
    return `"${value}"@${language}`;
  }
  if (datatypeIri && datatypeIri !== COMMON_NAMESPACE_IRIS.xsd.string) {
    return `"${value}"^^${datatypeIri}`;
  }
  return value;
}

/**
 * Returns a display value for one named node.
 *
 * @param {any} store
 * @param {string} iri
 * @param {string} predicateIri
 * @returns {string}
 */
function getNamedNodeDisplayValue(store, iri, predicateIri) {
  if (!iri) {
    return '';
  }
  if (predicateIri === COMMON_NAMESPACE_IRIS.iao.curationStatus) {
    return getCurationStatusLabel(iri);
  }

  const label = getFirstObjectValue(store, iri, COMMON_NAMESPACE_IRIS.rdfs.label);
  return label || KNOWN_IRI_LABELS[iri] || iri;
}

/**
 * Converts one RDF/JS term to a stable assertion-object view model.
 *
 * @param {any} store
 * @param {string} predicateIri
 * @param {any} term
 * @returns {import('./types.js').ResourceAssertionObject}
 */
function toAssertionObject(store, predicateIri, term) {
  const termType = String(term?.termType || 'Literal');
  if (termType === 'NamedNode') {
    const value = String(term?.value || '');
    return {
      termType: 'NamedNode',
      value,
      displayValue: getNamedNodeDisplayValue(store, value, predicateIri)
    };
  }
  if (isBlankNodeTerm(term)) {
    const value = String(term?.value || '');
    return {
      termType: 'BlankNode',
      value,
      displayValue: `_:${value}`
    };
  }

  const value = String(term?.value || '');
  return {
    termType: 'Literal',
    value,
    displayValue: getLiteralDisplayValue(term),
    ...(term?.language ? { language: String(term.language) } : {}),
    ...(term?.datatype?.value ? { datatypeIri: String(term.datatype.value) } : {})
  };
}

/**
 * Sorts assertion rows in a stable display order.
 *
 * @param {import('./types.js').ResourceAssertion[]} assertions
 * @returns {import('./types.js').ResourceAssertion[]}
 */
function sortAssertions(assertions) {
  return assertions.sort((left, right) => {
    const predicateCompare = String(left.predicateLabel).localeCompare(String(right.predicateLabel));
    if (predicateCompare !== 0) {
      return predicateCompare;
    }
    return String(left.object.displayValue).localeCompare(String(right.object.displayValue));
  });
}

/**
 * Extracts all outgoing assertions for one resource.
 *
 * @param {any} store
 * @param {string} resourceIri
 * @returns {import('./types.js').ResourceAssertion[]}
 */
export function extractOutgoingAssertions(store, resourceIri) {
  const quads = store?.getQuads ? store.getQuads(resourceIri, null, null, null) : [];
  /** @type {import('./types.js').ResourceAssertion[]} */
  const assertions = [];

  for (const quad of quads) {
    assertions.push({
      subject: resourceIri,
      predicateIri: String(quad?.predicate?.value || ''),
      predicateLabel: getPredicateLabel(String(quad?.predicate?.value || '')),
      object: toAssertionObject(store, String(quad?.predicate?.value || ''), quad?.object),
      direction: 'outgoing'
    });
  }

  return sortAssertions(assertions);
}

/**
 * Extracts all incoming assertions for one resource.
 *
 * @param {any} store
 * @param {string} resourceIri
 * @returns {import('./types.js').ResourceAssertion[]}
 */
export function extractIncomingAssertions(store, resourceIri) {
  const quads = store?.getQuads ? store.getQuads(null, null, resourceIri, null) : [];
  /** @type {import('./types.js').ResourceAssertion[]} */
  const assertions = [];

  for (const quad of quads) {
    const subject = String(quad?.subject?.value || '');
    assertions.push({
      subject,
      predicateIri: String(quad?.predicate?.value || ''),
      predicateLabel: getPredicateLabel(String(quad?.predicate?.value || '')),
      object: {
        termType: 'NamedNode',
        value: resourceIri,
        displayValue: getNamedNodeDisplayValue(store, resourceIri, String(quad?.predicate?.value || ''))
      },
      direction: 'incoming'
    });
  }

  return sortAssertions(assertions);
}

/**
 * Extracts compact resource details for one resource IRI.
 *
 * @param {any} store
 * @param {string} resourceIri
 * @returns {ResourceDetail}
 */
export function extractResourceDetail(store, resourceIri) {
  /** @type {ResourceDetailField[]} */
  const fields = [];

  for (const descriptor of RESOURCE_DETAIL_PREDICATES) {
    const values = getNormalizedObjectValues(store, resourceIri, descriptor.predicateIri);
    if (!values.length) {
      continue;
    }

    fields.push({
      id: descriptor.id,
      label: descriptor.label,
      values
    });
  }

  return {
    resource: resourceIri,
    fields,
    recognizedFields: fields,
    outgoingAssertions: extractOutgoingAssertions(store, resourceIri),
    incomingAssertions: extractIncomingAssertions(store, resourceIri)
  };
}

/**
 * Extracts compact resource details for all relevant resources in the store.
 *
 * @param {any} store
 * @param {string[]} resources
 * @param {QueryResultRow[]} [results=[]]
 * @returns {Record<string, ResourceDetail>}
 */
export function extractResourceDetails(store, resources, results = []) {
  /** @type {Set<string>} */
  const resourceSet = new Set(Array.isArray(resources) ? resources.filter(Boolean) : []);

  for (const row of Array.isArray(results) ? results : []) {
    if (row?.resource) {
      resourceSet.add(row.resource);
    }
  }

  /** @type {Record<string, ResourceDetail>} */
  const detailsByResource = {};

  for (const resourceIri of resourceSet) {
    detailsByResource[resourceIri] = extractResourceDetail(store, resourceIri);
  }

  return detailsByResource;
}

/**
 * Returns the set of labeled resources based on rdfs:label.
 *
 * @param {any} store
 * @returns {string[]}
 */
export function collectLabeledResources(store) {
  const labeled = new Set();
  const quads = store.getQuads(null, COMMON_NAMESPACE_IRIS.rdfs.label, null, null);

  for (const quad of quads) {
    if (quad?.subject?.value) {
      labeled.add(quad.subject.value);
    }
  }

  return Array.from(labeled);
}

/**
 * Returns named resources directly asserted as subjects in the supplied store.
 *
 * @param {any} store
 * @returns {string[]}
 */
export function collectAssertedNamedResources(store) {
  const resources = new Set();
  const quads = store?.getQuads ? store.getQuads(null, null, null, null) : [];

  for (const quad of quads) {
    if (quad?.subject?.termType === 'NamedNode' && quad.subject.value) {
      resources.add(quad.subject.value);
    }
  }

  return Array.from(resources).sort((left, right) => left.localeCompare(right));
}

/**
 * Extracts ontology metadata and simple run facts from the loaded store.
 *
 * @param {any} store
 * @param {string} fileName
 * @returns {OntologyMetadata}
 */
export function extractOntologyMetadata(store, fileName) {
  const metadataRecord = readOntologyMetadataRecordFromQuads(store);
  const ontologyIri = metadataRecord?.['@id'] || guessOntologyIri(store);
  const labeledResources = collectLabeledResources(store);
  const quads = store.getQuads(null, null, null, null);

  return {
    fileName: fileName || 'ontology.ttl',
    ontologyIri,
    title:
      readFirstJsonLdValue(metadataRecord, COMMON_NAMESPACE_IRIS.dcterms.title) ||
      getFirstObjectValue(store, ontologyIri, COMMON_NAMESPACE_IRIS.rdfs.label),
    description: readFirstJsonLdValue(metadataRecord, COMMON_NAMESPACE_IRIS.dcterms.description),
    versionIri: readFirstJsonLdValue(metadataRecord, COMMON_NAMESPACE_IRIS.owl.versionIRI),
    versionInfo: readFirstJsonLdValue(metadataRecord, COMMON_NAMESPACE_IRIS.owl.versionInfo),
    license: readFirstJsonLdValue(metadataRecord, COMMON_NAMESPACE_IRIS.dcterms.license),
    accessRights: getFirstObjectValue(store, ontologyIri, COMMON_NAMESPACE_IRIS.dcterms.accessRights),
    imports: readJsonLdValues(metadataRecord, COMMON_NAMESPACE_IRIS.owl.imports).sort(),
    tripleCount: quads.length,
    labeledResourceCount: labeledResources.length
  };
}

/**
 * Reads the first string or IRI value for a full-IRI key in a JSON-LD metadata record.
 *
 * @param {object|null} metadataRecord
 * @param {string} predicateIri
 * @returns {string|null}
 */
function readFirstJsonLdValue(metadataRecord, predicateIri) {
  return readJsonLdValues(metadataRecord, predicateIri)[0] || null;
}

/**
 * Reads all string or IRI values for a full-IRI key in a JSON-LD metadata record.
 *
 * @param {object|null} metadataRecord
 * @param {string} predicateIri
 * @returns {string[]}
 */
function readJsonLdValues(metadataRecord, predicateIri) {
  const values = metadataRecord?.[predicateIri];
  const list = Array.isArray(values) ? values : values == null ? [] : [values];
  return list
    .map((value) => {
      if (value && typeof value === 'object' && '@id' in value) return String(value['@id'] || '');
      if (value && typeof value === 'object' && '@value' in value) return String(value['@value'] || '');
      return value == null ? '' : String(value);
    })
    .filter(Boolean);
}

/**
 * Returns the first display literal for one resource from the preferred predicate list.
 *
 * @param {any} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string | null}
 */
function getFirstPreferredLiteralValue(store, subjectIri, predicateIris) {
  for (const predicateIri of predicateIris) {
    const quads = store?.getQuads ? store.getQuads(subjectIri, predicateIri, null, null) : [];
    const literalQuad = quads.find((/** @type {any} */ quad) => quad?.object?.termType === 'Literal' && quad.object.value);
    if (literalQuad?.object?.value) {
      return String(literalQuad.object.value);
    }
  }

  return null;
}

/**
 * Returns the first named-node object for one resource from the preferred predicate list.
 *
 * @param {any} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string | null}
 */
function getFirstPreferredNamedNodeValue(store, subjectIri, predicateIris) {
  for (const predicateIri of predicateIris) {
    const quads = store?.getQuads ? store.getQuads(subjectIri, predicateIri, null, null) : [];
    const namedNodeQuad = quads.find((/** @type {any} */ quad) => quad?.object?.termType === 'NamedNode' && quad.object.value);
    if (namedNodeQuad?.object?.value) {
      return String(namedNodeQuad.object.value);
    }
  }

  return null;
}

/**
 * Finds one CCEO-style curation predicate by local name without binding the app
 * to one namespace spelling.
 *
 * @param {any} store
 * @returns {string[]}
 */
function getCceoCuratedInOntologyPredicateIris(store) {
  const predicateIris = new Set();
  const quads = store?.getQuads ? store.getQuads(null, null, null, null) : [];

  for (const quad of quads) {
    const predicateIri = String(quad?.predicate?.value || '');
    if (predicateIri.endsWith(`#${CCEO_CURATED_IN_ONTOLOGY_LOCAL_NAME}`) ||
      predicateIri.endsWith(`/${CCEO_CURATED_IN_ONTOLOGY_LOCAL_NAME}`)
    ) {
      predicateIris.add(predicateIri);
    }
  }

  return Array.from(predicateIris).sort((left, right) => left.localeCompare(right));
}

/**
 * Returns the best available ontology-curation value for a dependency IRI.
 *
 * @param {any} lookupStore
 * @param {string} iri
 * @param {string[]} [cceoFallbackPredicates=[]]
 * @returns {string}
 */
function getDependencyCuratedInValue(lookupStore, iri, cceoFallbackPredicates = []) {
  const curatedIn = getFirstPreferredNamedNodeValue(lookupStore, iri, [
    COMMON_NAMESPACE_IRIS.cceo.curatedIn,
    COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy,
    ...cceoFallbackPredicates
  ]);

  if (curatedIn) {
    return curatedIn;
  }

  const knownVocabularyMatch = KNOWN_VOCABULARY_CURATED_IN_FALLBACKS.find(
    (entry) => iri.startsWith(entry.namespace)
  );
  return knownVocabularyMatch?.curatedIn || '';
}

/**
 * Extracts candidate external IRI dependencies used by a primary ontology.
 *
 * The extraction intentionally favors recall over precision:
 * - every named predicate in the primary ontology is a candidate;
 * - every named object in the primary ontology is a candidate;
 * - named subjects outside the ontology namespace are also candidates.
 *
 * The lookup store may include import closure data and is used only for labels
 * and curation-source annotations.
 *
 * @param {any} primaryStore
 * @param {any} [lookupStore=primaryStore]
 * @returns {import('./types.js').ExternalIriDependency[]}
 */
export function extractExternalIriDependencies(primaryStore, lookupStore = primaryStore) {
  if (!primaryStore || typeof primaryStore.getQuads !== 'function') {
    return [];
  }

  const ontologyIri = guessOntologyIri(primaryStore);
  const ontologyNamespace = getNamespaceFromIri(ontologyIri);
  const quads = primaryStore.getQuads(null, null, null, null);
  const dependencies = new Map();

  /**
   * @param {string} iri
   * @param {string} reason
   * @returns {void}
   */
  function addDependency(iri, reason) {
    if (!iri || iri === ontologyIri || BUILT_IN_DEPENDENCY_IRI_EXCLUSIONS.has(iri)) {
      return;
    }

    const existing = dependencies.get(iri) || { iri, reasons: new Set() };
    existing.reasons.add(reason);
    dependencies.set(iri, existing);
  }

  for (const quad of quads) {
    if (quad?.predicate?.termType === 'NamedNode') {
      addDependency(String(quad.predicate.value || ''), 'predicate');
    }

    if (quad?.object?.termType === 'NamedNode') {
      addDependency(String(quad.object.value || ''), 'object');
    }

    if (
      quad?.subject?.termType === 'NamedNode' &&
      !isIriInNamespace(String(quad.subject.value || ''), ontologyNamespace)
    ) {
      addDependency(String(quad.subject.value || ''), 'external-subject');
    }
  }

  const cceoFallbackPredicates = getCceoCuratedInOntologyPredicateIris(lookupStore);

  return Array.from(dependencies.values())
    .map((entry) => {
      const label = getFirstPreferredLiteralValue(lookupStore, entry.iri, [
        COMMON_NAMESPACE_IRIS.rdfs.label,
        COMMON_NAMESPACE_IRIS.skos.prefLabel
      ]) || '';
      return {
        iri: entry.iri,
        label,
        curatedIn: getDependencyCuratedInValue(lookupStore, entry.iri, cceoFallbackPredicates),
        reasons: Array.from(entry.reasons).sort((left, right) => left.localeCompare(right))
      };
    })
    .sort((left, right) => left.iri.localeCompare(right.iri));
}

/**
 * Derives a namespace stem from an IRI.
 *
 * @param {string} iri
 * @returns {string | null}
 */
export function getNamespaceFromIri(iri) {
  if (typeof iri !== 'string' || !/^https?:|^urn:/.test(iri)) {
    return null;
  }

  const hashIndex = iri.lastIndexOf('#');
  if (hashIndex >= 0) {
    return iri.slice(0, hashIndex + 1);
  }

  const slashIndex = iri.lastIndexOf('/');
  if (slashIndex >= 0) {
    return iri.slice(0, slashIndex + 1);
  }

  return null;
}

/**
 * Extracts namespace candidates from RDF terms present in the store.
 *
 * @param {any} store
 * @returns {string[]}
 */
export function extractNamespacesFromStore(store) {
  const namespaces = new Set();
  const quads = store?.getQuads ? store.getQuads(null, null, null, null) : [];

  for (const quad of quads) {
    const values = [
      quad?.subject?.termType === 'NamedNode' ? quad.subject.value : null,
      quad?.predicate?.termType === 'NamedNode' ? quad.predicate.value : null,
      quad?.object?.termType === 'NamedNode' ? quad.object.value : null
    ];

    for (const value of values) {
      const namespace = getNamespaceFromIri(value || '');
      if (namespace) {
        namespaces.add(namespace);
      }
    }
  }

  return Array.from(namespaces).sort((a, b) => a.localeCompare(b));
}

/**
 * Derives default included namespaces for one ontology summary.
 *
 * @param {PreflightSummary} summary
 * @returns {string[]}
 */
export function deriveDefaultIncludedNamespaces(summary) {
  const ontologyNamespace = getNamespaceFromIri(summary?.ontologyIri || '');

  if (ontologyNamespace) {
    return [ontologyNamespace];
  }

  return Array.isArray(summary?.discoveredNamespaces)
    ? summary.discoveredNamespaces.slice(0, 3)
    : [];
}

/**
 * Builds a lightweight preflight summary from an already-loaded store.
 *
 * @param {any} store
 * @param {string} [fileName='ontology.ttl']
 * @returns {PreflightSummary}
 */
export function buildPreflightSummaryFromStore(store, fileName = 'ontology.ttl') {
  const metadata = extractOntologyMetadata(store, fileName);
  const discoveredNamespaces = extractNamespacesFromStore(store);

  return {
    fileName: fileName || 'ontology.ttl',
    ontologyIri: metadata.ontologyIri,
    metadata,
    imports: Array.isArray(metadata.imports) ? metadata.imports : [],
    discoveredNamespaces,
    resourceCountEstimate: metadata.labeledResourceCount || 0
  };
}

/**
 * Builds a lightweight preflight summary from ontology text.
 *
 * @param {string} ontologyText
 * @param {string} [fileName='ontology.ttl']
 * @returns {Promise<PreflightSummary>}
 */
export async function buildPreflightSummary(ontologyText, fileName = 'ontology.ttl') {
  const store = await loadOntologyIntoStore(ontologyText, fileName);
  return buildPreflightSummaryFromStore(store, fileName);
}

/**
 * Maps SELECT polarity to result status.
 *
 * @param {ManifestQuery['polarity']} polarity
 * @param {string} queryId
 * @returns {QueryResultStatus}
 */
export function getSelectStatusFromPolarity(polarity, queryId) {
  switch (polarity) {
    case 'matchMeansFail':
      return 'fail';
    case 'matchMeansPass':
      return 'pass';
    default:
      throw new Error(`Unsupported SELECT polarity for ${queryId}: ${String(polarity)}`);
  }
}

/**
 * Maps ASK polarity and boolean result to result status.
 *
 * @param {ManifestQuery['polarity']} polarity
 * @param {boolean} askResult
 * @param {string} queryId
 * @returns {QueryResultStatus}
 */
export function getAskStatusFromPolarity(polarity, askResult, queryId) {
  switch (polarity) {
    case 'trueMeansPass':
      return askResult ? 'pass' : 'fail';
    case 'trueMeansFail':
      return askResult ? 'fail' : 'pass';
    case 'falseMeansPass':
      return askResult ? 'fail' : 'pass';
    case 'falseMeansFail':
      return askResult ? 'pass' : 'fail';
    default:
      throw new Error(`Unsupported ASK polarity for ${queryId}: ${String(polarity)}`);
  }
}

/**
 * Picks the resource IRI for a SELECT result row.
 *
 * @param {Record<string, string>} row
 * @param {string} resourceVar
 * @returns {string | null}
 */
export function getResourceFromSelectRow(row, resourceVar) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  if (row[resourceVar]) {
    return row[resourceVar];
  }

  if (row.resource) {
    return row.resource;
  }

  const firstValue = Object.values(row)[0];
  return typeof firstValue === 'string' ? firstValue : null;
}

/**
 * Evaluates a single manifest query definition against the store.
 *
 * @param {any} store
 * @param {ManifestQuery} queryDefinition
 * @param {string} queryText
 * @returns {Promise<QueryResultRow[]>}
 */
export async function evaluateSingleQuery(store, queryDefinition, queryText) {
  const criterionId = queryDefinition.checksCriterion || null;
  /** @type {Severity} */
  const severity = queryDefinition.severity || 'info';
  /** @type {QueryScope} */
  const scope = queryDefinition.scope || 'resource';

  if (queryDefinition.kind === 'SELECT') {
    const rows = await runSelect(store, queryText);
    const resourceVar = queryDefinition.resourceVar || 'resource';
    const status = getSelectStatusFromPolarity(queryDefinition.polarity, queryDefinition.id);

    return rows.map((row) => {
      const resource = getResourceFromSelectRow(row, resourceVar);

      return {
        resource,
        queryId: queryDefinition.id,
        criterionId,
        status,
        severity,
        scope,
        details: row
      };
    });
  }

  if (queryDefinition.kind === 'ASK') {
    const askResult = await runAsk(store, queryText);
    const status = getAskStatusFromPolarity(
      queryDefinition.polarity,
      askResult,
      queryDefinition.id
    );
    const ontologyIri = guessOntologyIri(store);

    return [
      {
        resource: ontologyIri,
        queryId: queryDefinition.id,
        criterionId,
        status,
        severity,
        scope,
        details: { askResult }
      }
    ];
  }

  throw new Error(
    `Unsupported query kind for ${queryDefinition.id}: ${String(queryDefinition.kind)}`
  );
}

/**
 * Evaluates all manifest queries against an already-loaded RDF store.
 *
 * @param {any} store
 * @param {string} [fileName='ontology.ttl']
 * @param {EvaluateAllQueriesOptions & { manifest?: Manifest | null | undefined }} [options]
 * @returns {Promise<EvaluateAllQueriesOutput>}
 */
export async function evaluateQueriesAgainstStore(
  store,
  fileName = 'ontology.ttl',
  options = {}
) {
  if (!store || typeof store.getQuads !== 'function') {
    throw new TypeError('evaluateQueriesAgainstStore() requires an RDF/JS-compatible store.');
  }

  const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL;
  const queryBasePath = options.queryBasePath || DEFAULT_QUERY_BASE_PATH;
  const manifest = options.manifest || await loadManifest(manifestUrl);
  const ontologyMetadataStore = options.ontologyMetadataStore || store;
  const resourceDetailsStore = options.resourceDetailsStore || store;
  const ontologyMetadata = extractOntologyMetadata(ontologyMetadataStore, fileName);
  const totalQueries = Array.isArray(manifest.queries) ? manifest.queries.length : 0;
  const resources = Array.isArray(options.resourceInventory)
    ? Array.from(new Set(options.resourceInventory.filter(Boolean))).sort((left, right) => left.localeCompare(right))
    : collectLabeledResources(resourceDetailsStore);
  const resultResourceFilter = options.resultResourceFilter instanceof Set
    ? options.resultResourceFilter
    : Array.isArray(options.resultResourceFilter)
      ? new Set(options.resultResourceFilter.filter(Boolean))
      : null;

  /** @type {QueryResultRow[]} */
  const allResults = [];
  let completedQueries = 0;

  for (const queryDefinition of manifest.queries) {
    try {
      console.time(queryDefinition.id);
      const queryText = await loadQueryText(queryDefinition, queryBasePath);
      const rows = await evaluateSingleQuery(store, queryDefinition, queryText);
      console.timeEnd(queryDefinition.id);
      const filteredRows = filterResultsByResourceSet(rows, resultResourceFilter);
      allResults.push(...filteredRows);
    } catch (error) {
      console.error(`Error evaluating query ${queryDefinition.id}:`, error);
    } finally {
      completedQueries += 1;
      if (typeof options.onQueryProgress === 'function') {
        options.onQueryProgress({
          fileName,
          queryId: queryDefinition.id,
          completedQueries,
          totalQueries
        });
      }
    }
  }

  const resourceDetails = extractResourceDetails(resourceDetailsStore, resources, allResults);

  return {
    results: allResults,
    resources,
    resourceDetails,
    ontologyIri: ontologyMetadata.ontologyIri,
    ontologyMetadata
  };
}

/**
 * Returns true when the query scope should be filtered by resource ownership.
 *
 * @param {string | null | undefined} scope
 * @returns {boolean}
 */
function isResourceScopedQueryScope(scope) {
  return scope === 'resource' || scope === 'TBox';
}

/**
 * Filters resource/TBox query rows to a supplied owned-resource set.
 *
 * Ontology-scoped rows are preserved unchanged.
 *
 * @param {QueryResultRow[]} rows
 * @param {Set<string> | null | undefined} ownedResources
 * @returns {QueryResultRow[]}
 */
export function filterResultsByResourceSet(rows, ownedResources) {
  if (!(ownedResources instanceof Set)) {
    return Array.isArray(rows) ? rows : [];
  }

  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!row || !isResourceScopedQueryScope(row.scope)) {
      return true;
    }
    return !!row.resource && ownedResources.has(row.resource);
  });
}

/**
 * Evaluates all manifest queries against an ontology text input.
 *
 * @param {string} ontologyText
 * @param {string} [fileName='ontology.ttl']
 * @param {EvaluateAllQueriesOptions} [options]
 * @returns {Promise<EvaluateAllQueriesOutput>}
 */
export async function evaluateAllQueries(
  ontologyText,
  fileName = 'ontology.ttl',
  options = {}
) {
  const store = await loadOntologyIntoStore(ontologyText, fileName);
  return evaluateQueriesAgainstStore(store, fileName, options);
}
