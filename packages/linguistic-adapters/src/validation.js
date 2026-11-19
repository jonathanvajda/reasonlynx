/** @file Shared validation for portable linguistic records. No I/O or ontology imports. */

/** Stable error codes let callers supply their own UI or logging policy. */
export class LinguisticAdapterError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'LinguisticAdapterError';
    this.code = code;
    this.details = details;
  }
}

/** @param {boolean} condition @param {string} code @param {string} message */
export function assertLinguisticCondition(condition, code, message) {
  if (!condition) throw new LinguisticAdapterError(code, message);
}

/** Validate identifiers without normalizing, trimming, or transliterating them. */
export function requireLinguisticString(value, field) {
  assertLinguisticCondition(typeof value === 'string' && value.trim().length > 0,
    'INVALID_STRING', `${field} must be a nonempty string.`);
  return value;
}

/** Clone JSON-compatible metadata; reject values that JSON would silently lose.
 * @param {*} value Data to detach from caller-owned objects.
 * @returns {*} Detached JSON-compatible data.
 */
export function copyLinguisticData(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  assertLinguisticCondition(typeof value === 'object' && value !== null &&
    (Array.isArray(value) || isPlainLinguisticRecord(value)),
  'NON_PORTABLE_DATA', 'Metadata and annotation values must be JSON-compatible data.');
  assertLinguisticCondition(!ancestors.has(value), 'CYCLIC_DATA', 'Metadata cannot contain cycles.');
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) return value.map(item => copyLinguisticData(item, next));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyLinguisticData(item, next)]));
}

/** Accept plain records from another realm, including structured-cloned storage data. */
function isPlainLinguisticRecord(value) {
  const prototype = Object.getPrototypeOf(value);
  return prototype !== null && Object.getPrototypeOf(prototype) === null && prototype.constructor?.name === 'Object';
}

/** @param {string} language Basic BCP-47-shaped language tag; no registry lookup. */
export function requireLinguisticLanguage(language) {
  requireLinguisticString(language, 'language');
  assertLinguisticCondition(/^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language),
    'INVALID_LANGUAGE', 'Use a language tag such as en, grc, hbo, or arc.');
  return language;
}

/** Prevent token/selection offsets from splitting Unicode grapheme clusters.
 * Offsets are half-open UTF-16 indices, matching JavaScript and DocxHund.
 * @param {string} text Exact source text.
 * @param {number} start Inclusive index.
 * @param {number} end Exclusive index.
 */
export function validateLinguisticTextRange(text, start, end) {
  assertLinguisticCondition(typeof text === 'string' && Number.isInteger(start) && Number.isInteger(end) &&
    start >= 0 && start < end && end <= text.length,
  'INVALID_TEXT_RANGE', 'Text ranges must be nonempty half-open UTF-16 ranges within source text.');
  const boundaries = new Set([text.length]);
  for (const segment of new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(text)) boundaries.add(segment.index);
  assertLinguisticCondition(boundaries.has(start) && boundaries.has(end),
    'SPLIT_GRAPHEME', 'Text ranges must not split a Unicode grapheme cluster.');
  return { start, end, unit: 'utf16' };
}
