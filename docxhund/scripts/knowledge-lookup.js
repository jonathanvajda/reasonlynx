import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { buildLabelIndex } from '../../packages/cytoscape-visualization/src/index.js';
import { createGraphTermId } from '../../packages/cytoscape-visualization/src/graph-ids.js';

const LABEL_PREDICATES = new Set([
  COMMON_NAMESPACE_IRIS.rdfs.label,
  COMMON_NAMESPACE_IRIS.skos.prefLabel,
  COMMON_NAMESPACE_IRIS.skos.altLabel,
  COMMON_NAMESPACE_IRIS.dcterms.title
].filter(Boolean));

const SCHEMA_TYPES = new Set([
  COMMON_NAMESPACE_IRIS.owl.Class,
  COMMON_NAMESPACE_IRIS.rdfs.Class,
  COMMON_NAMESPACE_IRIS.owl.ObjectProperty,
  COMMON_NAMESPACE_IRIS.owl.DatatypeProperty,
  COMMON_NAMESPACE_IRIS.owl.AnnotationProperty,
  COMMON_NAMESPACE_IRIS.owl.Ontology
].filter(Boolean));

/**
 * Build searchable labeled class/individual entries from RDF/JS quads.
 * @param {object[]} quads
 * @returns {object[]}
 */
export function buildKnowledgeLookupIndex(quads) {
  const source = Array.from(quads || []);
  const primaryLabels = buildLabelIndex(source);
  const typesByIri = new Map();
  const aliasesByIri = new Map();
  for (const item of source) {
    if (item.subject?.termType !== 'NamedNode') continue;
    const iri = item.subject.value;
    if (item.predicate?.value === COMMON_NAMESPACE_IRIS.rdf.type && item.object?.termType === 'NamedNode') {
      if (!typesByIri.has(iri)) typesByIri.set(iri, new Set());
      typesByIri.get(iri).add(item.object.value);
    }
    if (LABEL_PREDICATES.has(item.predicate?.value) && item.object?.termType === 'Literal') {
      if (!aliasesByIri.has(iri)) aliasesByIri.set(iri, new Set());
      aliasesByIri.get(iri).add(item.object.value);
    }
  }
  return Array.from(aliasesByIri, ([iri, aliases]) => {
    const typeIris = Array.from(typesByIri.get(iri) || []);
    const isClass = typeIris.includes(COMMON_NAMESPACE_IRIS.owl.Class) ||
      typeIris.includes(COMMON_NAMESPACE_IRIS.rdfs.Class);
    const isIndividual = typeIris.includes(COMMON_NAMESPACE_IRIS.owl.NamedIndividual) ||
      (typeIris.length > 0 && !typeIris.some((typeIri) => SCHEMA_TYPES.has(typeIri)));
    return {
      iri,
      label: primaryLabels.get(createGraphTermId({ termType: 'NamedNode', value: iri }))?.label || Array.from(aliases)[0],
      aliases: Array.from(aliases),
      kind: isClass ? 'class' : isIndividual ? 'individual' : 'resource',
      typeIris
    };
  }).sort((left, right) => left.label.localeCompare(right.label) || left.iri.localeCompare(right.iri));
}

/**
 * Find label/IRI matches appropriate to an annotation field.
 * @param {object[]} entries
 * @param {string} query
 * @param {'class'|'individual'|'resource'} kind
 * @param {number} [limit=20]
 * @returns {object[]}
 */
export function searchKnowledgeLookup(entries, query, kind, limit = 20) {
  const needle = String(query || '').trim().toLocaleLowerCase();
  return (entries || [])
    .filter((entry) => kind === 'resource' || entry.kind === kind)
    .map((entry) => {
      const values = [entry.label, entry.iri, ...(entry.aliases || [])].map((value) => String(value).toLocaleLowerCase());
      const exact = values.some((value) => value === needle);
      const prefix = values.some((value) => value.startsWith(needle));
      const contains = !needle || values.some((value) => value.includes(needle));
      return { entry, rank: exact ? 0 : prefix ? 1 : contains ? 2 : 3 };
    })
    .filter((candidate) => candidate.rank < 3)
    .sort((left, right) => left.rank - right.rank || left.entry.label.localeCompare(right.entry.label))
    .slice(0, limit)
    .map((candidate) => candidate.entry);
}
