import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/index.js';

/** @file Pure projection and merge functions for term-list and ontology-table representations. */

/**
 * Maps an RDF element type IRI to TOM's established display value.
 *
 * @param {string} elementType Element type IRI or existing display value.
 * @returns {string} TOM element type value.
 */
export function getOntologyTableElementType(elementType) {
  if (elementType === COMMON_NAMESPACE_IRIS.owl.Class) return 'Class';
  if (elementType === COMMON_NAMESPACE_IRIS.owl.ObjectProperty) return 'Object Property';
  if (elementType === COMMON_NAMESPACE_IRIS.owl.DatatypeProperty) return 'Data Property';
  if (elementType === COMMON_NAMESPACE_IRIS.owl.AnnotationProperty) return 'Annotation Property';
  if (elementType === COMMON_NAMESPACE_IRIS.owl.NamedIndividual) return 'Named Individual';
  return String(elementType || 'Class');
}

/**
 * Projects a portable term-list payload into TOM's six canonical base columns.
 *
 * @param {{terms?:object[]}|object[]} termList Term-list payload or term array.
 * @returns {string[][]} New ontology-table rows.
 */
export function createOntologyTableRowsFromTermList(termList) {
  const terms = Array.isArray(termList) ? termList : termList?.terms;
  return (Array.isArray(terms) ? terms : []).map((term) => [
    String(term?.iri || ''),
    String(term?.label || ''),
    getOntologyTableElementType(term?.elementType),
    String(term?.definition || ''),
    String(term?.broaderLabel || term?.isA || ''),
    String(term?.definedBy || term?.isCuratedInOntology || '')
  ]);
}

function getOntologyTableRowKey(row) {
  const iri = String(row?.[0] || '').trim().toLowerCase();
  const label = String(row?.[1] || '').trim().toLowerCase();
  return iri ? `iri:${iri}` : (label ? `label:${label}` : '');
}

function mergeOntologyTableRow(existingRow, incomingRow) {
  const length = Math.max(existingRow.length, incomingRow.length, 6);
  return Array.from({ length }, (_, index) => {
    const incomingValue = String(incomingRow[index] ?? '').trim();
    return incomingValue || String(existingRow[index] ?? '');
  });
}

/**
 * Applies append or replace semantics without mutating either input array.
 * Appending merges rows with the same IRI (or label when no IRI exists).
 *
 * @param {object[]} existingRows Current ontology-table rows.
 * @param {object[]} incomingRows Projected term-list rows.
 * @param {{mode?:'append'|'replace'}} [options] Combination mode.
 * @returns {{rows:string[][],addedCount:number,updatedCount:number}} Combined rows and counts.
 */
export function combineOntologyTableRows(existingRows, incomingRows, { mode = 'append' } = {}) {
  const incoming = (Array.isArray(incomingRows) ? incomingRows : []).map((row) => [...row]);
  if (mode === 'replace') return { rows: incoming, addedCount: incoming.length, updatedCount: 0 };

  const rows = (Array.isArray(existingRows) ? existingRows : []).map((row) => [...row]);
  const rowIndexByKey = new Map(rows.map((row, index) => [getOntologyTableRowKey(row), index]).filter(([key]) => key));
  let addedCount = 0;
  let updatedCount = 0;
  for (const row of incoming) {
    const key = getOntologyTableRowKey(row);
    const existingIndex = key ? rowIndexByKey.get(key) : undefined;
    if (existingIndex === undefined) {
      rows.push(row);
      if (key) rowIndexByKey.set(key, rows.length - 1);
      addedCount += 1;
    } else {
      rows[existingIndex] = mergeOntologyTableRow(rows[existingIndex], row);
      updatedCount += 1;
    }
  }
  return { rows, addedCount, updatedCount };
}
