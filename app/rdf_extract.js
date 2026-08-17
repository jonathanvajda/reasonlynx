/**
 * docs/app/rdf_extract.js
 * Pure functions:
 * - parseGraphJsonLdText(text) -> json object
 * - extractDocumentsFromJsonLd(json) -> OntologyDocument[]
 *
 * This is a pragmatic extractor that works on:
 * - JSON-LD with @graph
 * - compacted keys (rdfs:label) OR full IRI keys
 * - values as strings, {"@value": "..."} objects, or arrays of those
 */

import {
  COMMON_NAMESPACE_IRIS,
  deriveNamespaceStemFromIri,
} from '../packages/namespace-registry/src/index.js';

export const ADDED_BY_USER_IRI = 'https://jonathanvajda.github.io/OntoEagle/added_by_user';

/** Common predicate keys (full IRIs + compact forms) */
const P = Object.freeze({
  type: [COMMON_NAMESPACE_IRIS.rdf.type, 'rdf:type', '@type'],
  label: [COMMON_NAMESPACE_IRIS.rdfs.label, 'rdfs:label', 'label'],
  prefLabel: [COMMON_NAMESPACE_IRIS.skos.prefLabel, 'skos:prefLabel', 'prefLabel'],
  altLabel: [COMMON_NAMESPACE_IRIS.skos.altLabel, 'skos:altLabel', 'altLabel'],
  definition: [COMMON_NAMESPACE_IRIS.skos.definition, 'skos:definition', 'definition', COMMON_NAMESPACE_IRIS.iao.definition, 'obo:IAO_0000115', 'IAO_0000115', COMMON_NAMESPACE_IRIS.cceo.definition],
  citation: [COMMON_NAMESPACE_IRIS.dcterms.bibliographicCitation, 'dcterms:bibliographicCitation'],
  definitionSource: [COMMON_NAMESPACE_IRIS.cceo.definitionSource, COMMON_NAMESPACE_IRIS.cco2.definitionSource, COMMON_NAMESPACE_IRIS.iao.definitionSource, 'cceo:definition_source', 'cco2:ont00001754', 'obo:IAO_0000119', 'IAO_0000119'],
  example: [COMMON_NAMESPACE_IRIS.skos.example, COMMON_NAMESPACE_IRIS.iao.exampleOfUsage, COMMON_NAMESPACE_IRIS.cceo.exampleOfUsage, 'skos:example', 'example', 'obo:IAO_0000112', 'IAO_0000112', 'cceo:example_of_usage'],
  note: [COMMON_NAMESPACE_IRIS.skos.scopeNote, COMMON_NAMESPACE_IRIS.iao.elucidation, COMMON_NAMESPACE_IRIS.cceo.elucidation, 'skos:scopeNote', 'scopeNote', 'obo:IAO_0000600', 'IAO_0000600', 'cceo:elucidation'],
  comment: [COMMON_NAMESPACE_IRIS.rdfs.comment, 'rdfs:comment', 'comment'],
  curatorNote: [COMMON_NAMESPACE_IRIS.iao.curatorNote, 'obo:IAO_0000232', 'IAO_0000232'],
  curated_in: [COMMON_NAMESPACE_IRIS.cceo.curatedIn, COMMON_NAMESPACE_IRIS.rdfs.isDefinedBy, COMMON_NAMESPACE_IRIS.cco2.curatedIn],
  subClassOf: [COMMON_NAMESPACE_IRIS.rdfs.subClassOf, 'rdfs:subClassOf'],
  subPropertyOf: [COMMON_NAMESPACE_IRIS.rdfs.subPropertyOf, 'rdfs:subPropertyOf'],
  disjointWith: [COMMON_NAMESPACE_IRIS.owl.disjointWith, 'owl:disjointWith'],
  equivalentClass: [COMMON_NAMESPACE_IRIS.owl.equivalentClass, 'owl:equivalentClass'],
  domain: [COMMON_NAMESPACE_IRIS.rdfs.domain, 'rdfs:domain'],
  range: [COMMON_NAMESPACE_IRIS.rdfs.range, 'rdfs:range'],
  broader: [COMMON_NAMESPACE_IRIS.skos.broader, 'skos:broader'],
  narrower: [COMMON_NAMESPACE_IRIS.skos.narrower, 'skos:narrower'],
  addedByUser: [ADDED_BY_USER_IRI, 'added_by_user'],
});

/**
 * @param {string} text
 * @returns {any}
 */
export function parseGraphJsonLdText(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  return JSON.parse(text);
}

/**
 * Safely get a value from a node using multiple possible keys.
 * @param {any} node
 * @param {string[]} keys
 * @returns {any}
 */
function getAny(node, keys) {
  if (!node || typeof node !== 'object') return undefined;
  for (const k of keys) {
    if (k in node) return node[k];
  }
  return undefined;
}

/**
 * Convert JSON-LD value(s) to string array.
 * Handles:
 * - "str"
 * - {"@value":"str"}
 * - {"@id":"..."} (ignored unless you want IRIs as strings)
 * - arrays of any of the above
 *
 * @param {any} v
 * @returns {string[]}
 */
export function valueToStrings(v) {
  if (v == null) return [];
  if (typeof v === 'string') return [v];

  if (Array.isArray(v)) {
    return v.flatMap(valueToStrings).filter(Boolean);
  }

  if (typeof v === 'object') {
    if (typeof v['@value'] === 'string') return [v['@value']];
    // If you want @id values as strings, uncomment:
    // if (typeof v['@id'] === 'string') return [v['@id']];
  }

  return [];
}

/**
 * Convert JSON-LD value(s) to named IRI strings.
 *
 * @param {any} v
 * @returns {string[]}
 */
export function valueToIris(v) {
  if (v == null) return [];
  if (typeof v === 'string' && /^(https?:|urn:)/i.test(v)) return [v];
  if (Array.isArray(v)) return v.flatMap(valueToIris).filter(Boolean);
  if (typeof v === 'object' && typeof v['@id'] === 'string' && !v['@id'].startsWith('_:')) {
    return [v['@id']];
  }
  return [];
}

/**
 * Convert JSON-LD value(s) into displayable objects while preserving typed URI literals.
 *
 * @param {any} v
 * @returns {Array<{value:string, iri?:string, datatype?:string, language?:string}>}
 */
export function valueToDisplayValues(v) {
  if (v == null) return [];
  if (typeof v === 'string') return [{ value: v }];
  if (Array.isArray(v)) return v.flatMap(valueToDisplayValues).filter((item) => item.value);
  if (typeof v === 'object') {
    if (typeof v['@value'] === 'string') {
      const out = { value: v['@value'] };
      if (typeof v['@type'] === 'string') out.datatype = v['@type'];
      if (typeof v['@language'] === 'string') out.language = v['@language'];
      return [out];
    }
    if (typeof v['@id'] === 'string' && !v['@id'].startsWith('_:')) {
      return [{ value: v['@id'], iri: v['@id'] }];
    }
  }
  return [];
}

function valueToTypeIris(v) {
  if (v == null) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(valueToTypeIris).filter(Boolean);
  if (typeof v === 'object' && typeof v['@id'] === 'string') return [v['@id']];
  return [];
}

function ensureArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function cloneJsonLdValue(v) {
  if (v == null || typeof v !== 'object') return v;
  return JSON.parse(JSON.stringify(v));
}

/**
 * Determine a normalized OntologyElementType from JSON-LD @type values.
 * @param {any} typeValue
 * @returns {import('./types.js').OntologyElementType}
 */
export function inferElementType(typeValue) {
  const types = valueToTypeIris(typeValue);

  // types might be CURIE-like or full IRIs.
  const has = (t) => types.includes(t) || types.includes(`owl:${t}`) || types.includes(COMMON_NAMESPACE_IRIS.owl[t]);

  if (has('Ontology')) return 'Ontology';
  if (has('Class')) return 'Class';
  if (has('ObjectProperty')) return 'ObjectProperty';
  if (has('DatatypeProperty')) return 'DatatypeProperty';
  if (has('AnnotationProperty')) return 'AnnotationProperty';
  if (has('NamedIndividual')) return 'NamedIndividual';

  // Sometimes RDFLib JSON-LD uses full IRIs only; this still catches them.
  if (types.some(t => t === COMMON_NAMESPACE_IRIS.owl.Ontology)) return 'Ontology';
  if (types.some(t => t === COMMON_NAMESPACE_IRIS.owl.Class)) return 'Class';

  return 'Other';
}

/**
 * Compute a namespace token from an IRI.
 * @param {string} iri
 * @returns {string}
 */
export function computeNamespace(iri) {
  const result = deriveNamespaceStemFromIri(iri);
  return result.ok ? result.value : String(iri || '');
}

/**
 * Extract OntologyDocument[] from consolidated JSON-LD object.
 *
 * @param {any} jsonld
 * @returns {import('./types.js').OntologyDocument[]}
 */
export function extractDocumentsFromJsonLd(jsonld) {
  if (!jsonld) return [];

  const graph = Array.isArray(jsonld)
    ? jsonld
    : Array.isArray(jsonld['@graph'])
      ? jsonld['@graph']
      : [];

  /** @type {import('./types.js').OntologyDocument[]} */
  const docs = [];
  /** @type {Map<string, Set<string>>} */
  const skosNarrowerParentsByChild = new Map();
  const blankNodeMap = {};

  for (const node of graph) {
    if (node && typeof node === 'object' && typeof node['@id'] === 'string' && node['@id'].startsWith('_:')) {
      blankNodeMap[node['@id']] = cloneJsonLdValue(node);
    }
  }

  for (const node of graph) {
    if (!node || typeof node !== 'object') continue;

    const iri = node['@id'];
    if (typeof iri !== 'string' || !iri.startsWith('http')) continue; // keep it simple for now

    const type = inferElementType(getAny(node, P.type));

    const pref = valueToStrings(getAny(node, P.prefLabel));
    const lab = valueToStrings(getAny(node, P.label));
    const label = (pref[0] || lab[0] || iri);

    const altLabels = [
      ...valueToStrings(getAny(node, P.altLabel)),
      // Sometimes label appears multiple times; keep extras as alts
      ...lab.slice(1),
      ...pref.slice(1),
    ].filter(Boolean);

    const definition = valueToStrings(getAny(node, P.definition))[0];

    const citations = valueToDisplayValues(getAny(node, P.citation));
    const definitionSources = valueToDisplayValues(getAny(node, P.definitionSource));
    const examples = valueToDisplayValues(getAny(node, P.example));
    const clarifications = valueToDisplayValues(getAny(node, P.note));
    const comments = valueToDisplayValues(getAny(node, P.comment));
    const curatorNotes = valueToDisplayValues(getAny(node, P.curatorNote));
    const curated_in = valueToStrings(getAny(node, P.curated_in));
    const typeIris = valueToTypeIris(getAny(node, P.type));
    const subClassParents = valueToIris(getAny(node, P.subClassOf));
    const broaderParents = valueToIris(getAny(node, P.broader));
    const subPropertyParents = valueToIris(getAny(node, P.subPropertyOf));
    const disjointWith = valueToIris(getAny(node, P.disjointWith));
    const equivalentClasses = valueToIris(getAny(node, P.equivalentClass));
    const domains = valueToIris(getAny(node, P.domain));
    const ranges = valueToIris(getAny(node, P.range));
    const subClassOfAxioms = ensureArray(getAny(node, P.subClassOf)).map(cloneJsonLdValue);
    const subPropertyOfAxioms = ensureArray(getAny(node, P.subPropertyOf)).map(cloneJsonLdValue);
    const hierarchyPredicates = [];
    if (subClassParents.length) hierarchyPredicates.push('rdfs:subClassOf');
    if (broaderParents.length) hierarchyPredicates.push('skos:broader');
    if (subPropertyParents.length) hierarchyPredicates.push('rdfs:subPropertyOf');

    for (const child of valueToIris(getAny(node, P.narrower))) {
      if (!skosNarrowerParentsByChild.has(child)) skosNarrowerParentsByChild.set(child, new Set());
      skosNarrowerParentsByChild.get(child).add(iri);
    }

    const addedByUserValues = valueToStrings(getAny(node, P.addedByUser));
    const addedByUser = addedByUserValues.some((v) => String(v).toLowerCase() === 'true');

    docs.push({
      iri,
      type,
      label,
      altLabels,
      namespace: computeNamespace(iri),
      definition,
      typeIris: typeIris.length ? typeIris : undefined,
      additionalTypes: typeIris.length ? typeIris.filter((t) => ![`owl:${type}`, COMMON_NAMESPACE_IRIS.owl[type]].includes(t)) : undefined,
      citations: citations.length ? citations : undefined,
      definitionSources: definitionSources.length ? definitionSources : undefined,
      examples: examples.length ? examples : undefined,
      clarifications: clarifications.length ? clarifications : undefined,
      comments: comments.length ? comments : undefined,
      curatorNotes: curatorNotes.length ? curatorNotes : undefined,
      curated_in: curated_in.length ? curated_in : undefined,
      parents: Array.from(new Set([...subClassParents, ...broaderParents, ...subPropertyParents])),
      children: [],
      hierarchyPredicates,
      subClassOf: subClassParents.length ? subClassParents : undefined,
      subPropertyOf: subPropertyParents.length ? subPropertyParents : undefined,
      disjointWith: disjointWith.length ? disjointWith : undefined,
      equivalentClasses: equivalentClasses.length ? equivalentClasses : undefined,
      domains: domains.length ? domains : undefined,
      ranges: ranges.length ? ranges : undefined,
      subClassOfAxioms,
      subPropertyOfAxioms,
      blankNodeMap,
      addedByUser,
      // If you’re still carrying `text` elsewhere, you can omit it in Stage E.
      text: ''
    });
  }

  const byIri = new Map(docs.map((d) => [d.iri, d]));
  for (const [child, parents] of skosNarrowerParentsByChild.entries()) {
    const doc = byIri.get(child);
    if (!doc) continue;
    doc.parents = Array.from(new Set([...(doc.parents || []), ...parents]));
    doc.hierarchyPredicates = Array.from(new Set([...(doc.hierarchyPredicates || []), 'skos:narrower']));
  }

  for (const doc of docs) {
    for (const parent of doc.parents || []) {
      const parentDoc = byIri.get(parent);
      if (!parentDoc) continue;
      parentDoc.children = Array.from(new Set([...(parentDoc.children || []), doc.iri]));
    }
  }

  return docs;
}

/**
 * Convenience: Map docs by IRI.
 * @param {import('./types.js').OntologyDocument[]} docs
 * @returns {Map<string, import('./types.js').OntologyDocument>}
 */
export function mapByIri(docs) {
  const m = new Map();
  for (const d of docs) m.set(d.iri, d);
  return m;
}
