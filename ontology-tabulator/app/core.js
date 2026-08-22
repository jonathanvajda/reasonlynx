// app/core.js
// Core ontology logic – ES modules, “mostly pure”, with logging & error handling.

/* eslint-disable no-console */
import {
  COMMON_NAMESPACE_IRIS,
  namespacePrefixMapFromRegistry
} from '../../packages/namespace-registry/src/namespace-registry.js';
import { isBlankNodeTerm } from '../../packages/ontology-utils/src/index.js';
import { compactIriToCurie, findLongestPrefixMatch } from '../../packages/namespace-registry/src/curie.js';
import {
  getFilenameExtension,
  getSupportedMimeTypeForFilename
} from '../../packages/format-registry/src/mime-registry.js';
import { parseRdfTextWithAdapters } from '../../packages/rdf-io/src/index.js';
import { createScopedConsoleLogger } from '../../packages/ui-feedback/src/index.js';

const REGISTERED_PREFIXES = namespacePrefixMapFromRegistry();
const coreLogger = createScopedConsoleLogger({ scope: 'ontology-tabulator' });

/**
 * Simple event logger for core functions.
 * @param {string} fnName
 * @param {string} message
 * @param {object} [data]
 */
export function logEvent(fnName, message, data) {
  coreLogger.info(`${fnName}.${message}`, data ?? '');
}

/**
 * Error logger for core functions.
 * @param {string} fnName
 * @param {Error} error
 * @param {object} [context]
 */
export function logError(fnName, error, context) {
  coreLogger.error(`${fnName}.error`, { error, context });
}

/**
 * Guess RDF format from filename extension.
 * @param {string} filename
 * @returns {'text/turtle'|'application/n-triples'|'application/n-quads'|'application/trig'|'application/ld+json'|'application/rdf+xml'}
 */
export function detectRdfFormatFromFilename(filename) {
  const fnName = 'detectRdfFormatFromFilename';
  logEvent(fnName, 'start', { filename });

  try {
    const registryResult = getSupportedMimeTypeForFilename(filename);
    if (registryResult?.ok && registryResult.value.category === 'rdf') {
      return registryResult.value.mimeType;
    }

    // Ontology Tabulator treats plain .json uploads as JSON-LD for legacy
    // compatibility; the shared registry reserves .json for generic JSON.
    const registryExtension = getFilenameExtension(filename);
    if (registryExtension === 'json') {
      return 'application/ld+json';
    }

    const lower = (filename || '').toLowerCase();
    if (
      lower.endsWith('.ttl') ||
      lower.endsWith('.turtle') ||
      lower.endsWith('.n3')
    ) {
      return 'text/turtle';
    }
    if (lower.endsWith('.nt') || lower.endsWith('.ntriples')) {
      return 'application/n-triples';
    }
    if (lower.endsWith('.nq') || lower.endsWith('.nquads')) {
      return 'application/n-quads';
    }
    if (lower.endsWith('.trig')) {
      return 'application/trig';
    }
    if (
      lower.endsWith('.json') ||
      lower.endsWith('.jsonld') ||
      lower.endsWith('.json-ld')
    ) {
      return 'application/ld+json';
    }
    if (
      lower.endsWith('.rdf') ||
      lower.endsWith('.xml') ||
      lower.endsWith('.owl')
    ) {
      return 'application/rdf+xml';
    }
    // Fallback: Turtle
    return 'text/turtle';
  } catch (err) {
    logError(fnName, err, { filename });
    throw err;
  }
}

async function getN3Library() {
  return typeof window !== 'undefined' && window.N3
    ? window.N3
    : await import('n3'); // node / Jest
}

function getBrowserGlobal(name) {
  return typeof window !== 'undefined' ? window[name] : undefined;
}

/**
 * Parse RDF text into an N3 Store.
 * NOTE: N3 is preferred where it supports the syntax. JSON-LD is converted to
 * N-Quads first; RDF/XML and XML OWL are parsed with rdflib, then converted.
 * @param {string} text
 * @param {string} format
 * @returns {Promise<import('n3').Store>}
 */
export async function parseRdfTextToStore(text, format) {
  const fnName = 'parseRdfTextToStore';
  logEvent(fnName, 'start', { format });

  try {
    const parsed = await parseRdfTextWithAdapters(text, {
      format,
      runtime: {
        N3: await getN3Library(),
        jsonld: getBrowserGlobal('jsonld'),
        $rdf: getBrowserGlobal('$rdf')
      },
      baseIri: 'urn:ontology-tabulator:uploaded-document'
    });

    logEvent(fnName, 'parsed', { quadCount: parsed.quads.length });
    return parsed.dataset;
  } catch (err) {
    logError(fnName, err, { format });
    throw err;
  }
}


/**
 * Pick the ontology subject (IRI) from a store.
 * Strategy: any subject with rdf:type owl:Ontology.
 * @param {import('n3').Store} store
 * @returns {string|null} ontologyIri
 */
export function getOntologySubjectIri(store) {
  const fnName = 'getOntologySubjectIri';
  logEvent(fnName, 'start');

  try {
    const all = store.getQuads(null, null, null, null);
    const candidate = all.find(q =>
      q.predicate.termType === 'NamedNode' &&
      q.predicate.value === COMMON_NAMESPACE_IRIS.rdf.type &&
      q.object.termType === 'NamedNode' &&
      q.object.value === COMMON_NAMESPACE_IRIS.owl.Ontology
    );

    if (!candidate) {
      logEvent(fnName, 'no ontology subject found');
      return null;
    }

    const iri = candidate.subject.value;
    logEvent(fnName, 'ontology subject found', { iri });
    return iri;
  } catch (err) {
    logError(fnName, err);
    throw err;
  }
}

/**
 * Pick best literal from a list of literals, preferring 'en' then no language, then others.
 * @param {import('n3').Literal[]} literals
 * @returns {import('n3').Literal|null}
 */
export function pickBestLiteral(literals) {
  const fnName = 'pickBestLiteral';
  logEvent(fnName, 'start', { count: literals?.length ?? 0 });

  try {
    if (!literals || literals.length === 0) return null;

    const withLang = literals.filter(l => l.language);
    const en = withLang.find(l => l.language.toLowerCase() === 'en');
    if (en) return en;

    const noLang = literals.find(l => !l.language);
    if (noLang) return noLang;

    return literals[0];
  } catch (err) {
    logError(fnName, err);
    throw err;
  }
}

/**
 * Get all quads whose subject matches the given IRI string.
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @returns {import('n3').Quad[]}
 */
export function getQuadsForSubject(store, subjectIri) {
  const fnName = 'getQuadsForSubject';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const all = store.getQuads(null, null, null, null);
    return all.filter(q =>
      q.subject.termType === 'NamedNode' &&
      q.subject.value === subjectIri
    );
  } catch (err) {
    logError(fnName, err, { subjectIri });
    throw err;
  }
}

/**
 * Helper: get single preferred literal value for subject & predicate.
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris ordered by preference
 * @returns {string|null}
 */
export function getPreferredLiteralForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getPreferredLiteralForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);

    for (const p of predicateIris) {
      const literals = subjectQuads
        .filter(q =>
          q.predicate.termType === 'NamedNode' &&
          q.predicate.value === p &&
          q.object.termType === 'Literal'
        )
        .map(q => q.object);

      const best = pickBestLiteral(literals);
      if (best) return best.value;
    }

    return null;
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}


/**
 * Helper: get preferred IRI/URI object for predicates (e.g. versionIRI, license).
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string|null}
 */
export function getPreferredIriForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getPreferredIriForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);

    for (const p of predicateIris) {
      const iriObj = subjectQuads
        .filter(q =>
          q.predicate.termType === 'NamedNode' &&
          q.predicate.value === p &&
          q.object.termType === 'NamedNode'
        )
        .map(q => q.object)[0];

      if (iriObj) return iriObj.value;
    }

    return null;
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

export function getPreferredUriLikeForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getPreferredUriLikeForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);

    for (const p of predicateIris) {
      const match = subjectQuads.find(q => {
        if (q.predicate.termType !== 'NamedNode' || q.predicate.value !== p) {
          return false;
        }

        // Normal case: actual IRI node
        if (q.object.termType === 'NamedNode') {
          return true;
        }

        // Permissive case: typed URI literal
        if (
          q.object.termType === 'Literal' &&
          q.object.datatype &&
          q.object.datatype.value === COMMON_NAMESPACE_IRIS.xsd.anyURI
        ) {
          return true;
        }

        return false;
      });

      if (match) return match.object.value;
    }

    return null;
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

/**
 * Helper: get preferred displayable value for predicates.
 * Accepts either:
 *  - NamedNode IRIs
 *  - Literal values (including xsd:anyURI or plain strings)
 * Returns the first matching value in predicate preference order.
 *
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string|null}
 */
export function getPreferredDisplayValueForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getPreferredDisplayValueForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);

    for (const p of predicateIris) {
      const match = subjectQuads.find(q =>
        q.predicate.termType === 'NamedNode' &&
        q.predicate.value === p &&
        (q.object.termType === 'NamedNode' || q.object.termType === 'Literal')
      );

      if (match) return match.object.value;
    }

    return null;
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

/**
 * Get all literal values for any of the given predicates.
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string[]}
 */
export function getLiteralArrayForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getLiteralArrayForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);
    const values = new Set();

    subjectQuads.forEach(q => {
      if (
        q.predicate.termType === 'NamedNode' &&
        predicateIris.includes(q.predicate.value) &&
        q.object.termType === 'Literal'
      ) {
        values.add(q.object.value);
      }
    });

    return Array.from(values);
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

/**
 * Get all IRI values (NamedNodes, non-blank) for any of the given predicates.
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string[]}
 */
export function getIriArrayForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getIriArrayForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);
    const values = new Set();

    subjectQuads.forEach(q => {
      if (
        q.predicate.termType === 'NamedNode' &&
        predicateIris.includes(q.predicate.value) &&
        q.object.termType === 'NamedNode' &&
        !isBlankNodeTerm(q.object)
      ) {
        values.add(q.object.value);
      }
    });

    return Array.from(values);
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

/**
 * Get all values (literal or IRI) for any of the given predicates.
 * @param {import('n3').Store} store
 * @param {string} subjectIri
 * @param {string[]} predicateIris
 * @returns {string[]}
 */
export function getAnyArrayForPredicates(store, subjectIri, predicateIris) {
  const fnName = 'getAnyArrayForPredicates';
  logEvent(fnName, 'start', { subjectIri });

  try {
    const subjectQuads = getQuadsForSubject(store, subjectIri);
    const values = new Set();

    subjectQuads.forEach(q => {
      if (
        q.predicate.termType === 'NamedNode' &&
        predicateIris.includes(q.predicate.value)
      ) {
        if (q.object.termType === 'Literal' || q.object.termType === 'NamedNode') {
          values.add(q.object.value);
        }
      }
    });

    return Array.from(values);
  } catch (err) {
    logError(fnName, err, { subjectIri, predicateIris });
    throw err;
  }
}

/**
 * Extract ontology-level metadata according to your preference rules.
 * @param {import('n3').Store} store
 * @returns {{
 *   ontologyIri: string|null,
 *   ontologyName: string|null,
 *   versionIri: string|null,
 *   versionInfo: string|null,
 *   description: string|null,
 *   license: string|null,
 *   rightsHolder: string|null
 * }}
 */
export function extractOntologyMetadata(store) {
  const fnName = 'extractOntologyMetadata';
  logEvent(fnName, 'start');

  try {
    const ontologyIri = getOntologySubjectIri(store);
    if (!ontologyIri) {
      return {
        ontologyIri: null,
        ontologyName: null,
        versionIri: null,
        versionInfo: null,
        description: null,
        license: null,
        rightsHolder: null
      };
    }

    const S = ontologyIri;
    const meta = {
      ontologyIri: S,
      ontologyName: getPreferredLiteralForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.rdfs.label,
        COMMON_NAMESPACE_IRIS.dcterms.title,
        COMMON_NAMESPACE_IRIS.dc.title
      ]),
      versionIri: getPreferredDisplayValueForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.owl.versionIRI,
        COMMON_NAMESPACE_IRIS.dcterms.hasVersion
      ]),
      versionInfo: getPreferredLiteralForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.owl.versionInfo,
        COMMON_NAMESPACE_IRIS.dcterms.hasVersion
      ]),
      description: getPreferredLiteralForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.skos.definition,
        COMMON_NAMESPACE_IRIS.dcterms.description,
        COMMON_NAMESPACE_IRIS.dc.description
      ]),
      license: getPreferredLiteralForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.dc.rights,
        COMMON_NAMESPACE_IRIS.dc.accessRights,
        COMMON_NAMESPACE_IRIS.dcterms.license,
        COMMON_NAMESPACE_IRIS.dcterms.rights,
        COMMON_NAMESPACE_IRIS.dcterms.accessRights
      ]),
      rightsHolder: getPreferredLiteralForPredicates(store, S, [
        COMMON_NAMESPACE_IRIS.dc.rightsHolder,
        COMMON_NAMESPACE_IRIS.dcterms.rightsHolder
      ])
    };
    logEvent(fnName, 'metadata extracted', meta);
    return meta;
  } catch (err) {
    logError(fnName, err);
    throw err;
  }
}

/**
 * Decide if a subject should be included as an "ontology element".
 * We include owl:Class, owl:NamedIndividual, owl:ObjectProperty, owl:DatatypeProperty, owl:AnnotationProperty.
 * Skip blank nodes.
 * @param {import('n3').Store} store
 * @param {import('n3').Term} subject
 * @returns {boolean}
 */
export function shouldIncludeElementSubject(store, subject) {
  const fnName = 'shouldIncludeElementSubject';
  logEvent(fnName, 'start', { subject: subject?.value });

  try {
    if (!subject || subject.termType !== 'NamedNode') return false;

    const interestingTypes = [
      COMMON_NAMESPACE_IRIS.owl.Class,
      COMMON_NAMESPACE_IRIS.owl.NamedIndividual,
      COMMON_NAMESPACE_IRIS.owl.ObjectProperty,
      COMMON_NAMESPACE_IRIS.owl.DatatypeProperty,
      COMMON_NAMESPACE_IRIS.owl.DatatypeProperty,
      COMMON_NAMESPACE_IRIS.owl.AnnotationProperty
    ];

    const quadsForSubject = store.getQuads(subject, null, null, null);

    const types = quadsForSubject
      .filter(q =>
        q.predicate.termType === 'NamedNode' &&
        q.predicate.value === COMMON_NAMESPACE_IRIS.rdf.type &&
        q.object.termType === 'NamedNode'
      )
      .map(q => q.object.value);

    const include = types.some(t => interestingTypes.includes(t));
    return include;
  } catch (err) {
    logError(fnName, err, { subject });
    throw err;
  }
}

/**
 * Shorten IRI to CURIE using the promoted namespace registry if possible.
 * @param {string} iri
 * @returns {string}
 */
export function iriToCurieIfCommon(iri) {
  const fnName = 'iriToCurieIfCommon';
  logEvent(fnName, 'start', { iri });

  try {
    const compacted = compactIriToCurie(iri, REGISTERED_PREFIXES);
    if (compacted.ok) return compacted.value;

    const match = findLongestPrefixMatch(iri, REGISTERED_PREFIXES);
    if (match.ok) {
      return `${match.prefix}:${String(iri || '').slice(match.namespaceIri.length)}`;
    }
    return iri;
  } catch (err) {
    logError(fnName, err, { iri });
    throw err;
  }
}

/**
 * Build a fixed-column table model for ontology elements.
 *
 * Columns (headers / keys):
 *  - iri                / iri
 *  - label              / label
 *  - type               / type              (array of rdf:type IRIs, joined with "; ")
 *  - definition         / definition
 *  - preferred label    / preferredLabel
 *  - alternative label  / alternativeLabel  (array, joined)
 *  - acronym            / acronym           (array, joined)
 *  - rdfs:subClassOf    / subClassOf        (array, joined)
 *  - rdfs:subPropertyOf / subPropertyOf     (array, joined)
 *  - definition source  / definitionSource  (array, joined)
 *  - is curated in      / isCuratedIn
 *
 * Columns with no values across all rows are removed (except "iri").
 *
 * @param {import('n3').Store} store
 * @returns {{
 *   headers: string[],
 *   keys: string[],
 *   rows: Array<Record<string, string>>
 * }}
 */
export function buildElementTableModel(store) {
  const fnName = 'buildElementTableModel';
  logEvent(fnName, 'start');

  try {
    const allQuads = store.getQuads(null, null, null, null);

    // collect NamedNode subjects (non-blank)
    const subjectTermMap = new Map(); // IRI -> Term
    allQuads.forEach(q => {
      if (!isBlankNodeTerm(q.subject) && q.subject.termType === 'NamedNode') {
        subjectTermMap.set(q.subject.value, q.subject);
      }
    });

    // Filter to ontology elements
    const elementSubjects = Array.from(subjectTermMap.values())
      .filter(subj => shouldIncludeElementSubject(store, subj));

    const rows = [];

    for (const subj of elementSubjects) {
      const iri = subj.value;

      const label = getPreferredLiteralForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.rdfs.label,
        COMMON_NAMESPACE_IRIS.dcterms.title,
        COMMON_NAMESPACE_IRIS.dc.title
      ]);

      const typeArr = getIriArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.rdf.type
      ]);

      const definition = getPreferredLiteralForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.skos.definition,
        COMMON_NAMESPACE_IRIS.iao.definition,
        COMMON_NAMESPACE_IRIS.cceo.definition
      ]);

      const preferredLabel = getPreferredLiteralForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.skos.prefLabel,
        COMMON_NAMESPACE_IRIS.iao.preferredTerm
      ]);

      const alternativeLabelArr = getLiteralArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.skos.altLabel,
        COMMON_NAMESPACE_IRIS.iao.alternativeTerm,
        COMMON_NAMESPACE_IRIS.cceo.alternativeLabel
      ]);

      const acronymArr = getLiteralArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.cceo.acronym,
        COMMON_NAMESPACE_IRIS.iao.acronym,
        COMMON_NAMESPACE_IRIS.cco2.acronym
      ]);

      const subClassOfArr = getIriArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.rdfs.subClassOf
      ]);

      const subPropertyOfArr = getIriArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.rdfs.subPropertyOf
      ]);

      const definitionSourceArr = getAnyArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.dcterms.bibliographicCitation,
        COMMON_NAMESPACE_IRIS.dc.bibliographicCitation,
        COMMON_NAMESPACE_IRIS.iao.definitionSource,
        COMMON_NAMESPACE_IRIS.cco2.definitionSource,
        COMMON_NAMESPACE_IRIS.cceo.definitionSource,
        COMMON_NAMESPACE_IRIS.cco2.doctrinalSource,
        COMMON_NAMESPACE_IRIS.cceo.doctrinalSource
      ]);

      const isCuratedInArr = getLiteralArrayForPredicates(store, iri, [
        COMMON_NAMESPACE_IRIS.cco2.curatedIn,
        COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy
      ]);

      const row = {
        iri,
        label: label || '',
        type: typeArr.join('; '),
        definition: definition || '',
        preferredLabel: preferredLabel || '',
        alternativeLabel: alternativeLabelArr.join('; '),
        acronym: acronymArr.join('; '),
        subClassOf: subClassOfArr.join('; '),
        subPropertyOf: subPropertyOfArr.join('; '),
        definitionSource: definitionSourceArr.join('; '),
        isCuratedIn: isCuratedInArr.join('; ')
      };

      rows.push(row);
    }

    // Fixed columns
    const allHeaders = [
      'iri',
      'label',
      'type',
      'definition',
      'preferred label',
      'alternative label',
      'acronym',
      'rdfs:subClassOf',
      'rdfs:subPropertyOf',
      'definition source',
      'is curated in'
    ];

    const allKeys = [
      'iri',
      'label',
      'type',
      'definition',
      'preferredLabel',
      'alternativeLabel',
      'acronym',
      'subClassOf',
      'subPropertyOf',
      'definitionSource',
      'isCuratedIn'
    ];

    // Remove columns that are completely empty across rows (except iri)
    const keepFlags = allKeys.map((key, idx) => {
      if (key === 'iri') return true;
      return rows.some(r => (r[key] ?? '').trim() !== '');
    });

    const headers = allHeaders.filter((_, i) => keepFlags[i]);
    const keys = allKeys.filter((_, i) => keepFlags[i]);

    logEvent(fnName, 'built', {
      rowCount: rows.length,
      columnCount: headers.length
    });

    // prune unused keys from rows
    const prunedRows = rows.map(r => {
      const obj = {};
      keys.forEach(k => {
        obj[k] = r[k] ?? '';
      });
      return obj;
    });

    return {
      headers,
      keys,
      rows: prunedRows
    };
  } catch (err) {
    logError(fnName, err);
    throw err;
  }
}

/**
 * Filter & sort rows for the fixed-column model.
 * @param {{
 *   headers: string[],
 *   keys: string[],
 *   rows: Array<Record<string, string>>
 * }} model
 * @param {string} query
 * @param {number|null} sortIndex
 * @param {'asc'|'desc'} sortDirection
 * @returns {Array<Record<string, string>>}
 */
export function filterAndSortRows(model, query, sortIndex, sortDirection = 'asc') {
  const fnName = 'filterAndSortRows';
  logEvent(fnName, 'start', { query, sortIndex, sortDirection });

  try {
    const q = (query || '').toLowerCase();

    let filtered = model.rows;
    if (q) {
      filtered = filtered.filter(row =>
        Object.values(row).some(v => String(v).toLowerCase().includes(q))
      );
    }

    if (sortIndex == null || sortIndex < 0 || sortIndex >= model.headers.length) {
      return filtered;
    }

    const key = model.keys[sortIndex];
    if (!key) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const va = String(a[key] ?? '');
      const vb = String(b[key] ?? '');
      const cmp = va.localeCompare(vb);
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  } catch (err) {
    logError(fnName, err, { query, sortIndex, sortDirection });
    throw err;
  }
}
