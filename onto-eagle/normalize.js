/**
 * docs/app/normalize.js
 * Pure functions for text normalization and tokenization.
 *
 * Goals:
 * - Make search case-insensitive and punctuation-tolerant.
 * - Preserve ontology-friendly tokens (CURIEs, IRIs, IDs like IAO_0000115).
 * - Support quoted phrases: vehicle "act of location change" -> ["vehicle", "act of location change"]
 *
 * No DOM. No IndexedDB. Deterministic functions only.
 */

/**
 * Normalize text for indexing/search:
 * - lowercases
 * - converts “smart quotes” to straight quotes
 * - replaces most punctuation with spaces but keeps: _ : / - . ' "
 * - collapses whitespace
 *
 * @param {string} s
 * @returns {string}
 */
export function normalizeText(s) {
  if (typeof s !== 'string') return '';

  return s
    .toLowerCase()
    .replace(/[\u201C\u201D]/g, '"')  // “ ”
    .replace(/[\u2018\u2019]/g, "'")  // ‘ ’
    // Keep letters/numbers + ontology-friendly symbols; replace others with space
    .replace(/[^\p{L}\p{N}_:\/\-\.\s"'@#]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split a normalized string into whitespace-separated tokens.
 * Intended for building an inverted index (labels, defs, etc.).
 *
 * @param {string} text
 * @returns {string[]}
 */
export function tokenizeForIndex(text) {
  const n = normalizeText(text);
  if (!n) return [];
  return n.split(' ').filter(Boolean);
}

/**
 * Tokenize a query string, respecting quoted phrases.
 *
 * Example:
 *   vehicle "act of location change" IAO_0000115
 * -> ["vehicle", "act of location change", "iao_0000115"]
 *
 * @param {string} query
 * @returns {string[]}
 */
export function tokenizeQuery(query) {
  const q = normalizeText(query);
  if (!q) return [];

  /** @type {string[]} */
  const tokens = [];

  // Captures either "quoted phrase" or a single non-space token.
  const re = /"([^"]+)"|(\S+)/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    const phrase = (m[1] || m[2] || '').trim();
    if (phrase) tokens.push(phrase);
  }

  return tokens;
}

/**
 * Normalize a query into a unique set of tokens.
 * Currently:
 * - keeps quoted phrases as single tokens
 * - dedupes tokens
 *
 * Later you can extend with:
 * - stemming/lemmatization
 * - stopwords
 * - prefix matching
 * - n-grams
 *
 * @param {string} query
 * @returns {string[]}
 */
export function normalizeQuery(query) {
  const toks = tokenizeQuery(query);
  const out = [];
  for (const t of toks) {
    const n = normalizeText(t);
    if (n) out.push(n);
  }
  return Array.from(new Set(out));
}
