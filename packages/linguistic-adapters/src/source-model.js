import { assertLinguisticCondition as assert, copyLinguisticData as copy,
  requireLinguisticString as string, requireLinguisticLanguage, validateLinguisticTextRange } from './validation.js';

/** @typedef {{sourceId:string, version:string, language:string, referenceScheme:string|null, provenance:object}} LinguisticSource */
/** @typedef {{id:string, sourceTokenId:string|null, unitId:string, index:number, text:string, language:string, range:object|null}} LinguisticToken */
/** @typedef {{id:string, source:LinguisticSource, unitKey:string, reference:object|null, text:string|null, tokens:LinguisticToken[], annotations:object[]}} LinguisticUnit */

/** Describe a Bible edition, document, or any other versioned text source.
 * @param {LinguisticSource} input Source identity and optional provenance.
 * @returns {LinguisticSource}
 */
export function createLinguisticSource({ sourceId, version, language, referenceScheme = null, provenance = {} }) {
  return { sourceId: string(sourceId, 'sourceId'), version: string(version, 'version'),
    language: requireLinguisticLanguage(language),
    referenceScheme: referenceScheme === null ? null : string(referenceScheme, 'referenceScheme'),
    provenance: copy(provenance) };
}

/** Scope identifiers to source/version/unit, preserving provider IDs separately.
 * @param {LinguisticSource} source Versioned source.
 * @param {string} unitKey Passage reference or document-part identifier.
 * @returns {string} Deterministic identifier; no clock or random source.
 */
export function createLinguisticUnitId(source, unitKey) {
  const parts = [source.sourceId, source.version, unitKey].map(value => encodeURIComponent(string(value, 'identity component')));
  return `urn:linguistic:${parts.join(':')}`;
}

/** Normalize already-tokenized text without reconstructing missing whitespace.
 * @param {object} input
 * @param {LinguisticSource} input.source Source descriptor.
 * @param {string} input.unitKey Stable passage or document-part key.
 * @param {string|null} [input.text] Exact source text, if supplied.
 * @param {object|null} [input.reference] Source-specific citation, not a universal verse ID.
 * @param {object[]} input.tokens Ordered tokens with text, optional sourceTokenId/language/start/end.
 * @returns {LinguisticUnit}
 */
export function createLinguisticUnit({ source: inputSource, unitKey, text = null, reference = null, tokens }) {
  const source = createLinguisticSource(inputSource);
  const id = createLinguisticUnitId(source, unitKey);
  assert(text === null || typeof text === 'string', 'INVALID_TEXT', 'Source text must be a string or explicitly unavailable.');
  assert(Array.isArray(tokens), 'INVALID_TOKENS', 'Provide an ordered token array.');
  const seen = new Set();
  const normalized = tokens.map((token, index) => {
    const sourceTokenId = token.sourceTokenId == null ? null : string(token.sourceTokenId, 'sourceTokenId');
    const key = sourceTokenId === null ? `position:${index}` : `provider:${encodeURIComponent(sourceTokenId)}`;
    assert(!seen.has(key), 'DUPLICATE_TOKEN_ID', `Duplicate provider token ID: ${sourceTokenId}`);
    seen.add(key);
    const tokenText = string(token.text, 'token.text');
    const hasRange = token.start != null || token.end != null;
    const range = hasRange ? validateLinguisticTextRange(text, token.start, token.end) : null;
    assert(!range || text.slice(range.start, range.end) === tokenText, 'TEXT_MISMATCH', 'Token range must match exact source text.');
    return { id: `${id}:token:${key}`, sourceTokenId, unitId: id, index, text: tokenText,
      language: requireLinguisticLanguage(token.language ?? source.language), range };
  });
  validateOrderedTokenRanges(normalized);
  return { id, source, unitKey, reference: copy(reference), text, tokens: normalized, annotations: [] };
}

function validateOrderedTokenRanges(tokens) {
  let previousEnd = 0;
  for (const token of tokens) {
    if (!token.range) continue;
    assert(token.range.start >= previousEnd, 'OVERLAPPING_TOKENS', 'Word token ranges must follow source order without overlap.');
    previousEnd = token.range.end;
  }
}
