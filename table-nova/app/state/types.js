/**
 * @file Shared typedefs (JSDoc types).
 */

/**
 * @typedef {'camelCase'|'PascalCase'|'snake_case'|'SHOUT_CASE'} PredicateCasing
 */

/**
 * @typedef {'human'|'camelCase'|'PascalCase'|'snake_case'|'SHOUT_CASE'|'SHOUTING_SNAKE'|'unknown'} HeaderStyle
 */

/**
 * @typedef {Object} PredicateOptions
 * @property {boolean} prefixHas
 * @property {PredicateCasing} casing
 * @property {'ordinal'|'index'} whenNoHeader
 */

/**
 * @typedef {Object} PreviewData
 * @property {string[]|null} header
 * @property {string[][]} rows
 */

/**
 * @typedef {Object} FileOptions
 * @property {boolean} treatFirstRowAsHeader
 * @property {number} headerRowNumber
 * @property {(','|'\t'|null)} delimiterHint
 * @property {PredicateOptions} predicate
 * @property {PreviewData|null} preview
 * @property {Record<string, string>} datatypesByColumnKey
 * @property {Record<string, {label?: string, predicateLocalName?: string}>} columnSchemaOverridesByKey
 */

/**
 * @typedef {Object} StagedFile
 * @property {string} id
 * @property {File} file
 * @property {FileOptions} options
 */

export {};
