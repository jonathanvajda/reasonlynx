// docs/app/types.js

/**
 * Central typedefs + defaults for the OntoEagle search app.
 * This file should be import-safe in both browser + Jest (Node).
 */

/**
 * @typedef {'Ontology'|'Class'|'ObjectProperty'|'DatatypeProperty'|'AnnotationProperty'|'NamedIndividual'|'Other'} OntologyElementType
 */

/**
 * A normalized “card” representing an ontology element.
 *
 * @typedef {Object} OntologyDocument
 * @property {string} iri
 * @property {OntologyElementType} type
 * @property {string} label
 * @property {string[]} altLabels
 * @property {string} namespace
 *
 * @property {string=} definition
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} citations
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} definitionSources
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} examples
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} clarifications
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} comments
 * @property {{value:string, iri?:string, datatype?:string, language?:string}[]=} curatorNotes
 * @property {string[]=} typeIris
 * @property {string[]=} additionalTypes
 * @property {string[]=} parents
 * @property {string[]=} children
 * @property {string[]=} hierarchyPredicates
 * @property {string[]=} subClassOf
 * @property {string[]=} subPropertyOf
 * @property {string[]=} disjointWith
 * @property {string[]=} equivalentClasses
 * @property {string[]=} domains
 * @property {string[]=} ranges
 * @property {any[]=} subClassOfAxioms
 * @property {any[]=} subPropertyOfAxioms
 * @property {Record<string, any>=} blankNodeMap
 * @property {boolean=} addedByUser
 * @property {('builtin'|'user')=} source
 * @property {string=} ontologyName
 * @property {string=} fileName
 *
 * // Stage F+ (multi-dataset foundation; safe to ignore for now)
 * @property {string=} datasetId
 *
 * // Optional convenience for search/index (not required)
 * @property {string=} text
 */

/**
 * Search options selected by the user (persisted in IndexedDB).
 *
 * @typedef {Object} SearchOptions
 * @property {boolean} exact
 * @property {boolean} wildcard
 * @property {OntologyElementType[]} types
 * @property {string[]} namespaces
 *
 * @property {boolean} includeDefinition
 * @property {boolean} includeCitation
 * @property {boolean} includeExamples
 * @property {boolean} includeClarifications
 */

/**
 * Default element types to include in search.
 * Exported separately so UI and tests can reuse it.
 *
 * @type {OntologyElementType[]}
 */
export const ALL_ELEMENT_TYPES = Object.freeze([
  'Ontology',
  'Class',
  'ObjectProperty',
  'DatatypeProperty',
  'AnnotationProperty',
  'NamedIndividual',
  'Other'
]);

/**
 * Default search options used at first-run and on reset.
 *
 * NOTE:
 * - wildcard: true by default for usability
 * - exact: false by default
 * - includeDefinition: true by default (definitions are high value)
 * - citations/examples/clarifications default off (noise + speed)
 *
 * @type {SearchOptions}
 */
export const defaultSearchOptions = Object.freeze({
  exact: false,
  wildcard: true,
  types: [...ALL_ELEMENT_TYPES],
  namespaces: [],
  includeDefinition: true,
  includeCitation: true,
  includeExamples: true,
  includeClarifications: true
});

/**
 * @typedef {Object} SearchResult
 * @property {OntologyDocument} doc
 * @property {number} score
 * @property {number} matchedTokenCount
 * @property {number=} labelHits
 * @property {number=} defOnlyHits
 * @property {string[]=} reasons
 */

/**
 * @typedef {Object} DatasetMeta
 * @property {string} datasetId
 * @property {string=} name
 * @property {('builtin'|'user')=} source
 * @property {boolean=} enabled
 * @property {number=} updatedAt
 * @property {string=} fingerprint
 * @property {number=} documentCount
 * @property {string=} fileName
 * @property {string=} ontologyName
 */
