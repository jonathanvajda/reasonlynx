// app/shared.js
// @ts-check

/** @typedef {import('./types.js').OntologyReport} OntologyReport */
/** @typedef {import('./types.js').OntologyReportStandardRow} OntologyReportStandardRow */

/**
 * Escapes text for safe HTML insertion.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value == null) {
    return '';
  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escapes a value for use in a CSS attribute selector.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cssEscapeAttr(value) {
  return String(value == null ? '' : value).replace(/"/g, '\\"');
}

/**
 * Returns the standards array from an ontology report.
 *
 * @param {OntologyReport | null | undefined} report
 * @returns {OntologyReportStandardRow[]}
 */
export function getReportStandards(report) {
  return Array.isArray(report?.standards) ? report.standards : [];
}
