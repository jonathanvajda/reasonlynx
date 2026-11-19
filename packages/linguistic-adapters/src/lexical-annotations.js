import { assertLinguisticCondition as assert, copyLinguisticData as copy,
  requireLinguisticString as string, requireLinguisticLanguage } from './validation.js';

export const LINGUISTIC_ANNOTATION_KINDS = Object.freeze(['lemma', 'morphology', 'partOfSpeech', 'gloss', 'lexicalReference']);
export const LINGUISTIC_REVIEW_STATUSES = Object.freeze(['provided', 'proposed', 'accepted', 'rejected', 'unavailable']);

/** Create a sourced annotation without treating morphology or lexical IDs as syntax.
 * @param {object} input Annotation fields; unavailable entries have value null.
 * @returns {object} Detached, JSON-compatible annotation.
 */
export function createLinguisticAnnotation({ id, targetTokenId, kind, value = null, scheme = null,
  language = null, status = 'provided', provenance }) {
  assert(LINGUISTIC_ANNOTATION_KINDS.includes(kind), 'INVALID_ANNOTATION_KIND', 'Unknown linguistic annotation kind.');
  assert(LINGUISTIC_REVIEW_STATUSES.includes(status), 'INVALID_REVIEW_STATUS', 'Unknown annotation review status.');
  assert(status === 'unavailable' ? value === null : value !== null,
    'INVALID_ANNOTATION_VALUE', 'Only unavailable annotations have null values.');
  assert(provenance && typeof provenance === 'object', 'MISSING_PROVENANCE', 'Annotations require provider provenance.');
  string(provenance.providerId, 'provenance.providerId');
  if (kind === 'gloss' && status !== 'unavailable') requireLinguisticLanguage(language);
  return { id: string(id, 'annotation.id'), targetTokenId: string(targetTokenId, 'targetTokenId'), kind,
    value: copy(value), scheme: scheme === null ? null : string(scheme, 'scheme'),
    language: language === null ? null : requireLinguisticLanguage(language), status, provenance: copy(provenance) };
}

/** Parse an explicit Strong's reference, retaining raw spelling and optional provider suffix.
 * @param {string} raw G3056, H0430, or digits with an explicitly supplied G/H namespace.
 * @param {{namespace?:'G'|'H'}} [options]
 * @returns {{system:string, id:string, raw:string, extension:string|null}}
 */
export function parseStrongsReference(raw, { namespace } = {}) {
  string(raw, 'Strong’s reference');
  const match = /^([GH])?(\d{1,5})(?:\s+([A-Za-z]+))?$/.exec(raw.trim());
  assert(Boolean(match), 'INVALID_STRONGS_REFERENCE', `Unrecognized Strong’s reference: ${raw}`);
  const prefix = match[1] || namespace;
  assert(['G', 'H'].includes(prefix), 'MISSING_STRONGS_NAMESPACE', 'Bare Strong’s numbers require a G or H namespace.');
  assert(!namespace || namespace === prefix, 'STRONGS_NAMESPACE_MISMATCH', 'Strong’s reference conflicts with the supplied namespace.');
  assert(Number(match[2]) > 0, 'INVALID_STRONGS_REFERENCE', 'Strong’s numbers must be positive.');
  return { system: 'strongs', id: `${prefix}${Number(match[2])}`, raw, extension: match[3] || null };
}

/** Preserve OSHB prefix/lemma coding and extract only explicitly numeric lexical entries.
 * This does not decode morphology, turn prefix codes into Strong's numbers, or
 * treat the provider's lemma attribute as a Greek/Hebrew lemma spelling.
 * @param {string} raw OSHB lemma attribute, e.g. c/m/6529.
 * @returns {{raw:string, references:object[]}}
 */
export function readOshbLemmaReferences(raw) {
  string(raw, 'OSHB lemma attribute');
  const references = raw.split('/').filter(part => /^\d{1,5}(?:\s+[A-Za-z]+)?$/.test(part))
    .map(part => parseStrongsReference(part, { namespace: 'H' }));
  return { raw, references };
}
