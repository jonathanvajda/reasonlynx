// docs/scripts/config.js

/**
 * Centralized configuration and IRI constants.
 */

export const TABLE_NOVA_DOCUMENT_NAMESPACE_IRI = 'https://example.org/doc-inst/';

export const TABLE_NOVA_DOCUMENT_PART_IRIS = {
  hasSiblingIndex: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_sibling_index`,
  hasImmediatelyPriorDocumentPart: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_immediately_prior_document_part`,
  hasImmediatelyPosteriorDocumentPart: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_immediately_posterior_document_part`,
  hasStyleName: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_style_name`,
  hasStyleId: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_style_id`,
  hasHeadingLevel: `${TABLE_NOVA_DOCUMENT_NAMESPACE_IRI}has_heading_level`
};

export const PART_TYPES_WITH_TEXT_VALUE = new Set([
  'paragraph',
  'sentence',
  'word',
  'list_item',
  'header',
  'footer',
  'table_cell'
]);

export const HEADING_STYLE_PATTERN = /heading\s*([1-9][0-9]*)/i;
