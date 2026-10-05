/** @file Pure registry for UI views capable of executing semantic operations. */

export const SEMANTIC_VIEW_PROVIDERS = Object.freeze([
  Object.freeze({
    viewId: 'ontology-table-editor',
    pageId: 'tom',
    label: 'Tabular Ontology Maker',
    route: '../tabular-ontology-maker/'
  }),
  Object.freeze({
    viewId: 'competency-question-editor',
    pageId: 'cq-ferret',
    label: 'Competency Question Ferret',
    route: '../cq-ferret/'
  })
]);

/**
 * Returns the view provider registered for a semantic view identifier.
 *
 * @param {string} viewId Semantic view identifier.
 * @returns {object|null} Matching view provider or null.
 */
export function getSemanticViewProvider(viewId) {
  return SEMANTIC_VIEW_PROVIDERS.find((provider) => provider.viewId === viewId) || null;
}

/**
 * Returns the semantic view currently provided by an application page.
 *
 * @param {string} pageId Current page identifier.
 * @returns {object|null} Matching view provider or null.
 */
export function getSemanticViewProviderForPage(pageId) {
  return SEMANTIC_VIEW_PROVIDERS.find((provider) => provider.pageId === pageId) || null;
}

/**
 * Creates a route carrying a pending semantic operation to another view.
 *
 * @param {object} provider Destination view provider.
 * @param {{operationId:string,projectId:string,artifactId:string}} request Operation request.
 * @returns {string} Relative URL for the destination view.
 */
export function createSemanticOperationUrl(provider, request) {
  const parameters = new URLSearchParams({
    workspaceOperation: request.operationId,
    projectId: request.projectId,
    artifactId: request.artifactId
  });
  return `${provider.route}?${parameters.toString()}`;
}
