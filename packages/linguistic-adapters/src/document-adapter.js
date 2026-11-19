import { createLinguisticUnit } from './source-model.js';
import { createLinguisticTokenSpan } from './text-spans.js';
import { assertLinguisticCondition as assert, requireLinguisticString as string } from './validation.js';

/** Build source-preserving token spans using an explicitly supplied Intl word segmenter.
 * Segmentation is convenience tokenization, not a syntactic or morphological parse.
 * @param {string} text Exact source text.
 * @param {Intl.Segmenter} segmenter Caller chooses locale and word granularity.
 * @returns {object[]} Word-like segments with UTF-16 offsets; punctuation remains in source text.
 */
export function segmentLinguisticWords(text, segmenter) {
  assert(typeof text === 'string', 'INVALID_TEXT', 'Source text must be a string.');
  assert(segmenter?.resolvedOptions?.().granularity === 'word', 'INVALID_SEGMENTER', 'Supply an Intl.Segmenter with word granularity.');
  return Array.from(segmenter.segment(text)).filter(item => item.isWordLike)
    .map(item => ({ text: item.segment, start: item.index, end: item.index + item.segment.length }));
}

/** Adapt canonical document-part text without importing a DOM or a DOCX parser.
 * @param {object} input
 * @param {object} input.source Versioned generic source descriptor.
 * @param {string} input.partId Stable document-part identity, typically an IRI in DocxHund.
 * @param {string} input.text Exact canonical text used by the caller's selection offsets.
 * @param {function(string):object[]} input.tokenize Caller-supplied tokenizer returning text/start/end.
 * @returns {import('./source-model.js').LinguisticUnit}
 */
export function adaptDocumentPartText({ source, partId, text, tokenize }) {
  assert(typeof tokenize === 'function', 'MISSING_TOKENIZER', 'Supply a tokenizer; no language-specific parser is assumed.');
  assert(typeof text === 'string', 'INVALID_TEXT', 'Document text must be a string.');
  return createLinguisticUnit({ source, unitKey: partId, text, tokens: tokenize(text) });
}

/** Bridge token selections to DocxHund-compatible canonical offset selections.
 * Discontinuous token selections yield separate selections; no omitted words are
 * silently included. Contiguous token runs include their intervening punctuation.
 * This produces selection data only, not DocxHund annotation/RDF assertions.
 * @param {object} unit Unit adapted from the exact canonical document part.
 * @param {string[]} tokenIds Canonical source-order token IDs.
 * @param {{partIri?:string, contextLength?:number}} [options]
 * @returns {{partIri:string,exact:string,start:number,end:number,prefix:string,suffix:string}[]}
 */
export function createDocumentSelectionsFromTokenSpan(unit, tokenIds, { partIri = unit.unitKey, contextLength = 32 } = {}) {
  const span = createLinguisticTokenSpan(unit, tokenIds);
  string(partIri, 'partIri');
  assert(/^[A-Za-z][A-Za-z0-9+.-]*:\S+$/.test(partIri), 'INVALID_PART_IRI', 'A DocxHund part must have an absolute IRI.');
  assert(Number.isInteger(contextLength) && contextLength >= 0, 'INVALID_CONTEXT_LENGTH', 'Context length must be a nonnegative UTF-16 length.');
  assert(typeof unit.text === 'string', 'MISSING_SOURCE_TEXT', 'Document selections require the exact canonical source text.');
  const byId = new Map(unit.tokens.map(token => [token.id, token]));
  const runs = [];
  for (const id of span.tokenIds) {
    const token = byId.get(id);
    assert(Boolean(token.range), 'MISSING_TOKEN_RANGE', 'Document selections require supplied source offsets.');
    const previous = runs.at(-1);
    if (previous && previous.lastIndex + 1 === token.index) {
      previous.end = token.range.end; previous.lastIndex = token.index;
    } else runs.push({ start: token.range.start, end: token.range.end, lastIndex: token.index });
  }
  return runs.map(({ start, end }) => ({ partIri, start, end, exact: unit.text.slice(start, end),
    prefix: unit.text.slice(Math.max(0, start - contextLength), start), suffix: unit.text.slice(end, end + contextLength) }));
}
