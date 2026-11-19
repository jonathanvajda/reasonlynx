import { createLinguisticUnit } from './source-model.js';
import { createLinguisticAnnotation, parseStrongsReference, readOshbLemmaReferences } from './lexical-annotations.js';
import { assertLinguisticCondition as assert, requireLinguisticString as string } from './validation.js';

const DEFAULT_FIELDS = Object.freeze({ id: 'id', text: 'text', language: 'language', start: 'start', end: 'end',
  lemma: 'lemma', morphology: 'morph', partOfSpeech: 'pos', gloss: 'gloss', strongs: 'strongs' });
const ANNOTATION_FIELDS = ['lemma', 'morphology', 'partOfSpeech', 'gloss', 'strongs'];

/** Configure an adapter for an explicitly mapped, already-parsed token schema.
 * @param {object} options
 * @param {string} options.adapterId Describes the mapping, not the dataset provider.
 * @param {object} [options.fields] Source keys or tuple indices; null disables a field.
 * @param {string} [options.glossLanguage] Required when supplied glosses lack their own language.
 * @param {'G'|'H'} [options.strongsNamespace] Namespace for bare numeric references.
 * @param {string} [options.morphologyScheme] Preserve raw provider morphology codes under this name.
 * @param {function(object):object[]} [options.mapAdditionalAnnotations] Optional pure provider extension.
 * @returns {{adapterId:string, adaptUnit:function(object):object}} No file/network/parser side effects.
 */
export function createTokenRecordAdapter({ adapterId, fields = {}, glossLanguage,
  strongsNamespace, morphologyScheme = 'provider-raw', mapAdditionalAnnotations = () => [] }) {
  string(adapterId, 'adapterId');
  const mapping = { ...DEFAULT_FIELDS, ...fields };
  assert(Object.values(mapping).every(key => key === null || typeof key === 'string' || Number.isInteger(key)),
    'INVALID_FIELD_MAPPING', 'Field mappings must be source keys, tuple indices, or null.');
  const read = (record, field) => mapping[field] === null ? undefined : record[mapping[field]];
  return Object.freeze({ adapterId, adaptUnit(input) {
    assert(Array.isArray(input.records), 'INVALID_RECORDS', 'Adapter input requires parsed token records.');
    assert(input.records.every(record => record && typeof record === 'object'), 'INVALID_RECORDS', 'Token records must be objects or tuples.');
    const tokens = input.records.map(record => ({ sourceTokenId: read(record, 'id'), text: read(record, 'text'),
      language: read(record, 'language'), start: read(record, 'start'), end: read(record, 'end') }));
    const unit = createLinguisticUnit({ ...input, tokens });
    const provenance = { ...unit.source.provenance, providerId: unit.source.provenance.providerId || unit.source.sourceId,
      sourceId: unit.source.sourceId, version: unit.source.version, adapterId };
    unit.annotations = input.records.flatMap((record, index) => {
      const token = unit.tokens[index];
      const values = ANNOTATION_FIELDS.flatMap(field => suppliedAnnotations(field, read(record, field)));
      values.push(...mapAdditionalAnnotations({ record, token, source: unit.source }));
      return values.map((annotation, annotationIndex) => createLinguisticAnnotation({
        ...normalizeAdapterAnnotation(annotation, { glossLanguage, strongsNamespace, morphologyScheme }),
        id: `${token.id}:annotation:${annotationIndex}`, targetTokenId: token.id, provenance
      }));
    });
    return unit;
  } });
}

function suppliedAnnotations(field, supplied) {
  if (supplied == null) return [];
  const kind = field === 'strongs' ? 'lexicalReference' : field;
  const values = Array.isArray(supplied) ? supplied : [supplied];
  return values.map(value => ({ kind, value, scheme: field === 'strongs' ? 'strongs' : null }));
}

function normalizeAdapterAnnotation(annotation, options) {
  if (annotation.scheme === 'strongs') return { ...annotation, value: parseStrongsReference(annotation.value, { namespace: options.strongsNamespace }) };
  if (annotation.kind === 'gloss') return { ...annotation, language: annotation.language || options.glossLanguage };
  if (annotation.kind === 'morphology') return { ...annotation, scheme: annotation.scheme || options.morphologyScheme };
  return annotation;
}

/** Greek mapping profile for supplied SBLGNT-associated JSON token records.
 * SBLGNT text alone does not imply these annotation fields exist.
 * @param {object} [options] Override source keys and annotation scheme names.
 */
export function createSblgntTokenAdapter(options = {}) {
  return createTokenRecordAdapter({ adapterId: 'sblgnt-token-records', strongsNamespace: 'G', glossLanguage: 'en', ...options });
}

/** English mapping profile; bare numeric Strong's references are intentionally ambiguous. */
export function createEnglishTokenAdapter(options = {}) {
  return createTokenRecordAdapter({ adapterId: 'english-token-records', ...options });
}

/** OSHB parsed-word profile: caller handles XML and provides {id,text,lemma,morph}.
 * Raw slash-separated lemma/morphology strings are retained; morpheme segmentation
 * and full linguistic decoding require separate provider-specific work.
 */
export function createOshbWordAdapter(options = {}) {
  const { fields = {}, ...rest } = options;
  return createTokenRecordAdapter({ adapterId: 'oshb-parsed-words', glossLanguage: 'en', strongsNamespace: 'H',
    morphologyScheme: 'oshb-morphology', fields: { ...fields, lemma: null },
    mapAdditionalAnnotations: ({ record }) => {
      const key = fields.lemma === undefined ? 'lemma' : fields.lemma;
      const value = key === null ? undefined : record[key];
      return value == null ? [] : [{ kind: 'lexicalReference', scheme: 'oshb-lemma', value: readOshbLemmaReferences(value) }];
    }, ...rest });
}
