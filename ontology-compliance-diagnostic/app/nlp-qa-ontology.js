// app/nlp-qa-ontology.js
// @ts-check

import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import {
  buildNlpQaLexicon,
  checkTextFieldWithNlpQa,
  deriveNlpQaStatusFromIssues,
  normalizeNlpQaCheckModes,
  tokenizeTextIntoNlpQaTokens
} from './nlp-qa-model.js';

/** @typedef {{ getQuads: (subject?: any, predicate?: any, object?: any, graph?: any) => any[] }} RdfJsStore */
/** @typedef {import('./nlp-qa-model.js').NlpQaIssue} NlpQaIssue */
/** @typedef {import('./nlp-qa-model.js').NlpQaStatus} NlpQaStatus */
/** @typedef {import('./nlp-qa-model.js').NlpQaCheckModes} NlpQaCheckModes */

/**
 * @typedef {Object} NlpQaOntologyRow
 * @property {string} iri
 * @property {string} type
 * @property {string} label
 * @property {string} prefLabel
 * @property {string} definition
 * @property {string} example
 * @property {string} scopeNote
 * @property {string} acronym
 * @property {boolean} modified
 */

/**
 * @typedef {Object} NlpQaCheckedOntologyRow
 * @property {NlpQaOntologyRow} row
 * @property {NlpQaStatus} status
 * @property {NlpQaIssue[]} issues
 */

export const NLP_QA_CHECKED_FIELD_NAMES = Object.freeze([
  'label',
  'prefLabel',
  'definition',
  'example',
  'scopeNote'
]);

const FIELD_PREDICATES = Object.freeze({
  label: [COMMON_NAMESPACE_IRIS.rdfs.label],
  prefLabel: [COMMON_NAMESPACE_IRIS.skos.prefLabel],
  definition: [COMMON_NAMESPACE_IRIS.skos.definition, COMMON_NAMESPACE_IRIS.iao.definition],
  example: [COMMON_NAMESPACE_IRIS.skos.example],
  scopeNote: [COMMON_NAMESPACE_IRIS.skos.scopeNote],
  acronym: [COMMON_NAMESPACE_IRIS.cco2.acronym, COMMON_NAMESPACE_IRIS.cceo.acronym]
});

export const NLP_QA_FIELD_CHECK_MODE_NORMS = Object.freeze({
  label: Object.freeze({ spelling: true, grammar: false, aristotelian: false }),
  prefLabel: Object.freeze({ spelling: true, grammar: false, aristotelian: false }),
  definition: Object.freeze({ spelling: true, grammar: true, aristotelian: true }),
  example: Object.freeze({ spelling: true, grammar: true, aristotelian: false }),
  scopeNote: Object.freeze({ spelling: true, grammar: true, aristotelian: false })
});

export const DEFAULT_NLP_QA_ONTOLOGY_CHECK_MODES = Object.freeze({
  spelling: true,
  grammar: true,
  aristotelian: true
});

/**
 * Returns a readable literal string for the first matching predicate.
 *
 * @param {RdfJsStore} store
 * @param {string} subjectIri
 * @param {readonly string[]} predicateIris
 * @returns {string}
 */
export function readFirstLiteralValueForNlpQaPredicates(store, subjectIri, predicateIris) {
  for (const predicateIri of predicateIris) {
    const quads = store?.getQuads ? store.getQuads(subjectIri, predicateIri, null, null) : [];
    const literalQuad = quads.find((quad) => quad?.object?.termType === 'Literal');
    if (literalQuad?.object?.value) {
      return String(literalQuad.object.value);
    }
  }
  return '';
}

/**
 * Extracts annotation rows from an RDF/JS store without depending on rendered table cells.
 *
 * @param {RdfJsStore} store
 * @returns {NlpQaOntologyRow[]}
 */
export function extractNlpQaOntologyRowsFromRdfStore(store) {
  const subjectIris = new Set();
  const quads = store?.getQuads ? store.getQuads(null, null, null, null) : [];
  const annotationPredicates = new Set(Object.values(FIELD_PREDICATES).flat());

  for (const quad of quads) {
    if (
      quad?.subject?.termType === 'NamedNode' &&
      quad?.predicate?.termType === 'NamedNode' &&
      annotationPredicates.has(String(quad.predicate.value))
    ) {
      subjectIris.add(String(quad.subject.value));
    }
  }

  return Array.from(subjectIris)
    .sort((left, right) => left.localeCompare(right))
    .map((iri) => ({
      iri,
      type: readFirstObjectValueForNlpQaPredicate(store, iri, COMMON_NAMESPACE_IRIS.rdf.type),
      label: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.label),
      prefLabel: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.prefLabel),
      definition: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.definition),
      example: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.example),
      scopeNote: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.scopeNote),
      acronym: readFirstLiteralValueForNlpQaPredicates(store, iri, FIELD_PREDICATES.acronym),
      modified: false
    }));
}

/**
 * Intersects global check modes with field-specific ontology norms.
 *
 * @param {string} fieldName
 * @param {Partial<NlpQaCheckModes> | null | undefined} globalModes
 * @returns {NlpQaCheckModes}
 */
export function deriveNlpQaCheckModesForOntologyField(fieldName, globalModes) {
  const normalizedGlobalModes = normalizeNlpQaCheckModes(globalModes, DEFAULT_NLP_QA_ONTOLOGY_CHECK_MODES);
  const fieldNorms = NLP_QA_FIELD_CHECK_MODE_NORMS[/** @type {keyof typeof NLP_QA_FIELD_CHECK_MODE_NORMS} */ (fieldName)] ||
    { spelling: false, grammar: false, aristotelian: false };
  return {
    spelling: normalizedGlobalModes.spelling && fieldNorms.spelling,
    grammar: normalizedGlobalModes.grammar && fieldNorms.grammar,
    aristotelian: normalizedGlobalModes.aristotelian && fieldNorms.aristotelian
  };
}

/**
 * Returns the first object value for a predicate.
 *
 * @param {RdfJsStore} store
 * @param {string} subjectIri
 * @param {string} predicateIri
 * @returns {string}
 */
export function readFirstObjectValueForNlpQaPredicate(store, subjectIri, predicateIri) {
  const quad = (store?.getQuads ? store.getQuads(subjectIri, predicateIri, null, null) : [])[0];
  return quad?.object?.value ? String(quad.object.value) : '';
}

/**
 * Builds an ontology-aware local lexicon from row text and acronyms.
 *
 * @param {NlpQaOntologyRow[]} rows
 * @param {{ words?: Iterable<string>, allowlist?: Iterable<string> }} [options]
 * @returns {Set<string>}
 */
export function buildNlpQaOntologyLexicon(rows, options = {}) {
  /** @type {string[]} */
  const ontologyWords = [];
  for (const row of rows) {
    for (const fieldName of ['label', 'prefLabel', 'acronym']) {
      const value = String(row[/** @type {keyof NlpQaOntologyRow} */ (fieldName)] || '');
      ontologyWords.push(...tokenizeTextIntoNlpQaTokens(value).map((token) => token.text));
    }
  }
  return buildNlpQaLexicon({
    words: options.words,
    allowlist: options.allowlist,
    ontologyWords
  });
}

/**
 * Checks all configured annotation fields for one row.
 *
 * @param {NlpQaOntologyRow} row
 * @param {Set<string>} lexicon
 * @param {{ fieldNames?: readonly string[], compromiseNlp?: ((text: string) => unknown) | null, checkModes?: Partial<NlpQaCheckModes> }} [options]
 * @returns {NlpQaCheckedOntologyRow}
 */
export function checkNlpQaOntologyRow(row, lexicon, options = {}) {
  const fieldNames = options.fieldNames || NLP_QA_CHECKED_FIELD_NAMES;
  const issues = fieldNames.flatMap((fieldName) => {
    const value = String(row[/** @type {keyof NlpQaOntologyRow} */ (fieldName)] || '');
    if (!value.trim()) {
      return [];
    }
    return checkTextFieldWithNlpQa(value, {
      lexicon,
      fieldName,
      iri: row.iri,
      compromiseNlp: options.compromiseNlp,
      checkModes: deriveNlpQaCheckModesForOntologyField(fieldName, options.checkModes)
    }).issues;
  });

  return {
    row,
    status: deriveNlpQaStatusFromIssues(issues),
    issues
  };
}

/**
 * Checks a full ontology table state from memory.
 *
 * @param {NlpQaOntologyRow[]} rows
 * @param {{ lexicon?: Set<string>, fieldNames?: readonly string[], words?: Iterable<string>, allowlist?: Iterable<string>, compromiseNlp?: ((text: string) => unknown) | null, checkModes?: Partial<NlpQaCheckModes> }} [options]
 * @returns {{ status: NlpQaStatus, rows: NlpQaCheckedOntologyRow[], issues: NlpQaIssue[], lexicon: Set<string> }}
 */
export function checkNlpQaOntologyTable(rows, options = {}) {
  const lexicon = options.lexicon || buildNlpQaOntologyLexicon(rows, options);
  const checkedRows = rows.map((row) => checkNlpQaOntologyRow(row, lexicon, options));
  const issues = checkedRows.flatMap((checkedRow) => checkedRow.issues);
  return {
    status: deriveNlpQaStatusFromIssues(issues),
    rows: checkedRows,
    issues,
    lexicon
  };
}

/**
 * Returns the next immutable row array after editing a field in memory.
 *
 * @param {NlpQaOntologyRow[]} rows
 * @param {string} iri
 * @param {string} fieldName
 * @param {string} newValue
 * @returns {NlpQaOntologyRow[]}
 */
export function updateNlpQaOntologyRowsWithEditedField(rows, iri, fieldName, newValue) {
  return rows.map((row) => {
    if (row.iri !== iri || !NLP_QA_CHECKED_FIELD_NAMES.includes(fieldName)) {
      return row;
    }
    return {
      ...row,
      [fieldName]: newValue,
      modified: true
    };
  });
}

/**
 * Filters checked rows for the current UI state.
 *
 * @param {NlpQaCheckedOntologyRow[]} checkedRows
 * @param {'all' | 'spelling' | 'grammar' | 'clean' | 'modified'} filter
 * @returns {NlpQaCheckedOntologyRow[]}
 */
export function filterNlpQaCheckedRowsForDisplay(checkedRows, filter) {
  switch (filter) {
    case 'spelling':
      return checkedRows.filter((checkedRow) => checkedRow.issues.some((issue) => issue.category === 'spelling'));
    case 'grammar':
      return checkedRows.filter((checkedRow) => checkedRow.issues.some((issue) => issue.category === 'grammar'));
    case 'clean':
      return checkedRows.filter((checkedRow) => checkedRow.status === 'pass');
    case 'modified':
      return checkedRows.filter((checkedRow) => checkedRow.row.modified);
    case 'all':
    default:
      return checkedRows;
  }
}
