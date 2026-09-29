/** @file Canonical IRIs declared by the DocxHund ontology. */

export const DOCXHUND_VOCABULARY_IRI =
  'https://github.com/jonathanvajda/reasonlynx/docxhund/vocabulary/';

/** DocxHund classes and properties. */
export const DOCXHUND_TERMS = Object.freeze({
  Annotation: DOCXHUND_VOCABULARY_IRI + 'Annotation',
  TextSelection: DOCXHUND_VOCABULARY_IRI + 'TextSelection',
  DocumentParsingAct: DOCXHUND_VOCABULARY_IRI + 'DocumentParsingAct',
  DocumentAnnotationAct: DOCXHUND_VOCABULARY_IRI + 'DocumentAnnotationAct',
  SourceDocument: DOCXHUND_VOCABULARY_IRI + 'SourceDocument',
  targetTextResource: DOCXHUND_VOCABULARY_IRI + 'targetTextResource',
  targetDocumentPart: DOCXHUND_VOCABULARY_IRI + 'targetDocumentPart',
  exactText: DOCXHUND_VOCABULARY_IRI + 'exactText',
  prefixText: DOCXHUND_VOCABULARY_IRI + 'prefixText',
  suffixText: DOCXHUND_VOCABULARY_IRI + 'suffixText',
  startOffset: DOCXHUND_VOCABULARY_IRI + 'startOffset',
  endOffset: DOCXHUND_VOCABULARY_IRI + 'endOffset',
  annotationType: DOCXHUND_VOCABULARY_IRI + 'annotationType',
  occurredAt: DOCXHUND_VOCABULARY_IRI + 'occurredAt'
});

