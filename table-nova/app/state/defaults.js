/**
 * @file Default app settings and namespace bases.
 */

import { namespacePrefixMapFromRegistry } from '../../../packages/namespace-registry/src/namespace-registry.js';

const STANDARD_PREFIXES = namespacePrefixMapFromRegistry();

export const TABLENOVA_DEFAULTS = Object.freeze({
  // Swap these bases later when you have a real domain.
  baseInstanceIri: 'https://example.org/TableNova/instance/',
  basePredicateIri: 'https://example.org/TableNova/',
  baseRunIri: 'https://example.org/TableNova/run#',

  prefixes: {
    tablenova: 'https://example.org/TableNova/',
    tablenovaid: 'https://example.org/TableNova/instance/',
    xsd: STANDARD_PREFIXES.xsd,
    owl: STANDARD_PREFIXES.owl,
    rdfs: STANDARD_PREFIXES.rdfs,
    dcterms: STANDARD_PREFIXES.dcterms
  },

  fileOptions: {
    treatFirstRowAsHeader: true,
    headerRowNumber: 1,
    delimiterHint: null, // ',' or '\t' or null (auto)
    predicate: {
      prefixHas: true,
      casing: 'camelCase', // camelCase | PascalCase | snake_case | SHOUT_CASE
      whenNoHeader: 'ordinal' // ordinal (A,B,AA...) or index (1..n) - MVP uses ordinal
    },
    // preview cached after user clicks Preview
    preview: null,
    // columnKey -> xsd datatype IRI
    datatypesByColumnKey: {},
    // columnKey -> user-edited schema metadata
    columnSchemaOverridesByKey: {}
  }
});
