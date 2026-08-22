// docs/scripts/utils.js

/**
 * Small shared helpers.
 */

import { createUuid } from '../../packages/ontology-utils/src/index.js';

/**
 * Ensure a base IRI ends with "/" or "#".
 * @param {string} baseIri
 * @returns {string}
 */
export function normalizeBaseIri(baseIri) {
  var trimmed = String(baseIri || '').trim();
  if (!trimmed) {
    return 'https://example.org/doc-inst/';
  }
  if (trimmed.endsWith('/') || trimmed.endsWith('#')) {
    return trimmed;
  }
  return trimmed + '/';
}

/**
 * Convert a document part type into a predictable local segment.
 * @param {string} value
 * @returns {string}
 */
export function normalizePartType(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Mint an instance IRI using the agreed pattern.
 * @param {string} baseIri
 * @param {string} partType
 * @returns {string}
 */
export function mintInstanceIri(baseIri, partType) {
  var safeBase = normalizeBaseIri(baseIri);
  var safeType = normalizePartType(partType);
  return safeBase + 'inst_' + safeType + '_' + createUuid({ removeHyphens: true });
}

/**
 * Escape HTML for preview rendering.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Build a simple label like "paragraph 3".
 * @param {string} partType
 * @param {number|string} ordinal
 * @returns {string}
 */
export function makeGeneratedLabel(partType, ordinal) {
  return partType + ' ' + ordinal;
}
