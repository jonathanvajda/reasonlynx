import { assertLinguisticCondition as assert, copyLinguisticData as copy,
  requireLinguisticString as string } from './validation.js';

/** Create a span over existing canonical tokens, including discontinuous selections.
 * @param {import('./source-model.js').LinguisticUnit} unit Normalized text unit.
 * @param {string[]} tokenIds Ordered, distinct identifiers belonging to this unit.
 * @returns {object} Detached source/version-scoped span, not a duplicate token set.
 */
export function createLinguisticTokenSpan(unit, tokenIds) {
  assert(Array.isArray(tokenIds) && tokenIds.length > 0, 'EMPTY_TOKEN_SPAN', 'A span requires at least one token.');
  const byId = new Map(unit.tokens.map(token => [token.id, token]));
  const indices = tokenIds.map(id => {
    assert(byId.has(id), 'UNKNOWN_SPAN_TOKEN', `Token does not belong to this source unit: ${id}`);
    return byId.get(id).index;
  });
  assert(indices.every((index, position) => position === 0 || index > indices[position - 1]),
    'UNORDERED_TOKEN_SPAN', 'Span tokens must be distinct and in source order.');
  return { unitId: unit.id, sourceId: unit.source.sourceId, sourceVersion: unit.source.version,
    tokenIds: [...tokenIds], discontinuous: indices.some((index, position) => position > 0 && index !== indices[position - 1] + 1) };
}

/** Create a supplied/reviewed alignment; never infer one from Strong's or word spelling.
 * @param {object} input
 * @param {string} input.id Explicit stable alignment ID.
 * @param {{unit:object,tokenIds:string[]}|null} input.from Source span, or null for an unmapped target.
 * @param {{unit:object,tokenIds:string[]}|null} input.to Target span, or null for an unmapped source.
 * @param {'proposed'|'accepted'|'rejected'|'unmapped'} [input.status]
 * @param {object} input.provenance Includes providerId; review details may be supplied.
 * @returns {object} JSON-compatible, many-to-many alignment record.
 */
export function createLinguisticAlignment({ id, from, to, status = 'proposed', provenance }) {
  assert(['proposed', 'accepted', 'rejected', 'unmapped'].includes(status), 'INVALID_ALIGNMENT_STATUS', 'Unknown alignment status.');
  assert(status === 'unmapped' ? Boolean(from) !== Boolean(to) : Boolean(from) && Boolean(to),
    'INVALID_ALIGNMENT_ENDPOINTS', 'Unmapped alignments have exactly one endpoint; other alignments require two.');
  string(provenance?.providerId, 'provenance.providerId');
  return { id: string(id, 'alignment.id'),
    from: from ? createLinguisticTokenSpan(from.unit, from.tokenIds) : null,
    to: to ? createLinguisticTokenSpan(to.unit, to.tokenIds) : null,
    status, provenance: copy(provenance) };
}

/** Find whole mapped spans intersecting a selected span, in either direction.
 * Results do not imply word-to-word equivalence within a many-to-many mapping.
 * @param {object[]} alignments Validated alignment records.
 * @param {object} selection Span from createLinguisticTokenSpan.
 * @param {{includeProposals?:boolean}} [options] Accepted alignments are the default.
 * @returns {object[]} Matching alignment IDs, statuses, and opposite spans (possibly null).
 */
export function selectAlignedTokenSpans(alignments, selection, { includeProposals = false } = {}) {
  const allowed = new Set(includeProposals ? ['accepted', 'proposed', 'unmapped'] : ['accepted', 'unmapped']);
  return alignments.filter(item => allowed.has(item.status)).flatMap(item => {
    const sides = [[item.from, item.to], [item.to, item.from]];
    return sides.filter(([span]) => span?.unitId === selection.unitId && span.tokenIds.some(id => selection.tokenIds.includes(id)))
      .map(([matchedSpan, oppositeSpan]) => ({ alignmentId: item.id, status: item.status,
        matchedSpan: copy(matchedSpan), oppositeSpan: copy(oppositeSpan), provenance: copy(item.provenance) }));
  });
}
