/** @file Pure registry and selection functions for cross-view semantic operations. */

/**
 * Semantic operations describe what a user can do with an artifact. They do
 * not encode a producer application or perform browser/UI side effects.
 */
export const SEMANTIC_OPERATIONS = Object.freeze([
  Object.freeze({
    operationId: 'ontology-table.append-terms',
    label: 'Append terms to current table',
    description: 'Add terms as candidate ontology rows without clearing the current table.',
    acceptedArtifactKinds: Object.freeze(['term-list']),
    destinationViewId: 'ontology-table-editor',
    mode: 'append'
  }),
  Object.freeze({
    operationId: 'ontology-table.replace-with-terms',
    label: 'Replace current table with terms',
    description: 'Replace the current ontology table with rows projected from this term list.',
    acceptedArtifactKinds: Object.freeze(['term-list']),
    destinationViewId: 'ontology-table-editor',
    mode: 'replace'
  }),
  Object.freeze({
    operationId: 'competency-question.append-sparql-query',
    label: 'Append to associated queries',
    description: 'Append the SPARQL text to the current competency question query list.',
    acceptedArtifactKinds: Object.freeze(['sparql-query']),
    destinationViewId: 'competency-question-editor',
    mode: 'append'
  })
]);

/**
 * Returns the registered semantic operation with the supplied identifier.
 *
 * @param {string} operationId Stable operation identifier.
 * @returns {object|null} Registered operation or null.
 */
export function getSemanticOperation(operationId) {
  return SEMANTIC_OPERATIONS.find((operation) => operation.operationId === operationId) || null;
}

/**
 * Determines whether an operation accepts an artifact's semantic kind.
 *
 * @param {object} operation Semantic operation descriptor.
 * @param {object} artifact Project artifact metadata.
 * @returns {boolean} True when the operation can consume the artifact.
 */
export function doesSemanticOperationAcceptArtifact(operation, artifact) {
  return Boolean(operation && artifact && operation.acceptedArtifactKinds.includes(artifact.artifactKind));
}

/**
 * Lists every semantic operation available for an artifact.
 *
 * @param {object} artifact Project artifact metadata.
 * @param {{destinationViewId?:string}} [options] Optional consuming-view filter.
 * @returns {object[]} Matching immutable operation descriptors.
 */
export function listSemanticOperationsForArtifact(artifact, { destinationViewId = '' } = {}) {
  return SEMANTIC_OPERATIONS.filter((operation) => (
    doesSemanticOperationAcceptArtifact(operation, artifact)
    && (!destinationViewId || operation.destinationViewId === destinationViewId)
  ));
}
