/** @file Cross-app artifact capability manifests used for discovery only. */

/** @typedef {{appId:string, produces:string[], accepts:string[], acceptsMediaTypes?:string[]}} AppCapabilityManifest */

/** Canonical discovery declarations. Executable actions live in semantic-workspace. */
export const APP_CAPABILITY_MANIFESTS = Object.freeze({
  ontoeagle: { appId: 'ontoeagle', produces: ['term-selection', 'ontology-seed'], accepts: ['ontology-rdf', 'rdf-dataset'] },
  'ontology-viewer': { appId: 'ontology-viewer', produces: ['term-selection'], accepts: ['ontology-rdf', 'rdf-dataset'] },
  'ontology-tabulator': { appId: 'ontology-tabulator', produces: ['ontology-table', 'term-list'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'visual-lynx': { appId: 'visual-lynx', produces: ['graph-visualization'], accepts: ['rdf-dataset', 'ontology-rdf', 'ontology-draft', 'jsonld-graph', 'document-rdf', 'annotation-rdf'] },
  'cq-ferret': { appId: 'cq-ferret', produces: ['competency-question-set', 'term-list', 'sparql-query', 'mermaid-diagram'], accepts: ['ontology-rdf', 'rdf-dataset', 'sparql-query'] },
  'graph-analyst-playbook': { appId: 'graph-analyst-playbook', produces: ['query-playbook', 'sparql-query'], accepts: ['sparql-query', 'rdf-dataset', 'ontology-rdf'] },
  'graph-analytics': { appId: 'graph-analytics', produces: ['graph-analysis-report', 'sparql-query'], accepts: ['rdf-dataset', 'ontology-rdf', 'jsonld-graph'] },
  tom: { appId: 'tom', produces: ['ontology-draft', 'ontology-rdf', 'rdf-dataset'], accepts: ['term-list', 'ontology-table', 'tabular-file', 'ontology-rdf', 'ontology-draft'] },
  'kg-modeler': { appId: 'kg-modeler', produces: ['ontology-seed', 'ontology-draft', 'rdf-dataset', 'mermaid-diagram'], accepts: ['term-list', 'ontology-rdf', 'rdf-dataset'] },
  'mermaid-diagram-builder': { appId: 'mermaid-diagram-builder', produces: ['mermaid-diagram'], accepts: ['mermaid-diagram'] },
  'table-nova': { appId: 'table-nova', produces: ['rdf-dataset', 'ontology-draft'], accepts: ['tabular-file', 'mapping'] },
  docxhund: { appId: 'docxhund', produces: ['document-rdf', 'annotation-rdf', 'rdf-dataset'], accepts: ['document', 'ontology-rdf', 'rdf-dataset'] },
  'linked-data-transformer': { appId: 'linked-data-transformer', produces: ['rdf-dataset'], accepts: ['rdf-dataset', 'ontology-rdf', 'jsonld-graph', 'document-rdf'] },
  axiolotl: { appId: 'axiolotl', produces: ['sparql-query', 'rdf-dataset', 'inferred-rdf'], accepts: ['rdf-dataset', 'ontology-rdf', 'ontology-draft', 'jsonld-graph', 'document-rdf', 'annotation-rdf'] },
  'sparql-pattern-visualizer': { appId: 'sparql-pattern-visualizer', produces: ['query-visualization', 'mermaid-diagram'], accepts: ['sparql-query'] },
  bundler: { appId: 'bundler', produces: ['ontology-seed', 'ontology-slim', 'ontology-rdf'], accepts: ['term-selection', 'ontology-seed', 'ontology-rdf'] },
  'ontology-compliance-diagnostic': { appId: 'ontology-compliance-diagnostic', produces: ['diagnostic-report', 'curation-status-set'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'nlp-quality-assurance': { appId: 'nlp-quality-assurance', produces: ['diagnostic-report'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'ontology-measures': { appId: 'ontology-measures', produces: ['diagnostic-report'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'myna-iri-swapper': { appId: 'myna-iri-swapper', produces: ['rdf-dataset', 'sparql-query', 'mapping'], accepts: ['rdf-dataset', 'ontology-rdf', 'sparql-query', 'mapping'] },
  'onto-merge': { appId: 'onto-merge', produces: ['ontology-rdf'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'onto-diff': { appId: 'onto-diff', produces: ['semantic-diff-report', 'sparql-update'], accepts: ['ontology-rdf', 'ontology-draft'] }
});

/** @param {string} appId @returns {AppCapabilityManifest} */
export function getAppCapabilityManifest(appId) {
  return APP_CAPABILITY_MANIFESTS[appId] || { appId: appId || '', produces: [], accepts: [] };
}

/** @param {object} artifact @param {AppCapabilityManifest} manifest @returns {boolean} */
export function isArtifactCompatible(artifact, manifest) {
  if (!artifact || !manifest) return false;
  if ((manifest.accepts || []).includes('*') || (manifest.accepts || []).includes(artifact.artifactKind)) return true;
  return Boolean(artifact.mediaType && (manifest.acceptsMediaTypes || []).includes(artifact.mediaType));
}

/** @param {object[]} artifacts @param {AppCapabilityManifest} manifest @returns {object[]} */
export function discoverCompatibleArtifacts(artifacts, manifest) {
  return (artifacts || []).filter((artifact) => isArtifactCompatible(artifact, manifest));
}
