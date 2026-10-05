/** @file Cross-app artifact capability manifests used by the shared project shell. */

/**
 * @typedef {object} WorkspaceAction
 * @property {string} actionId Stable action identifier dispatched by the shared header.
 * @property {string} label User-facing verb phrase.
 * @property {'import'|'export'|'create'} direction Data-flow direction.
 * @property {string} description Explanation of where the data will land.
 * @property {string} [accept] File-picker accept value for imports.
 * @property {'append'|'replace'|'merge'|'download'} [mode] Declared load/export behavior.
 * @property {string} [artifactKind] Resulting or source artifact kind.
 */

/**
 * @typedef {object} ArtifactLoadAction
 * @property {string} actionId Stable load action identifier.
 * @property {string} artifactKind Accepted artifact kind.
 * @property {string} label User-facing action label.
 * @property {'append'|'replace'|'merge'|'reference'|'open'} mode Effect on app state.
 * @property {string} destination Named app destination.
 */

/** @typedef {{appId:string, produces:string[], accepts:string[], acceptsMediaTypes?:string[], workspaceActions?:WorkspaceAction[], artifactLoadActions?:ArtifactLoadAction[]}} AppCapabilityManifest */

/** Canonical capability declarations. Artifact kinds describe content, not producer applications. */
export const APP_CAPABILITY_MANIFESTS = Object.freeze({
  ontoeagle: { appId: 'ontoeagle', produces: ['term-selection', 'ontology-seed'], accepts: ['ontology-rdf', 'rdf-dataset'] },
  'ontology-viewer': { appId: 'ontology-viewer', produces: ['term-selection'], accepts: ['ontology-rdf', 'rdf-dataset'] },
  'ontology-tabulator': { appId: 'ontology-tabulator', produces: ['ontology-table', 'term-list'], accepts: ['ontology-rdf', 'ontology-draft'] },
  'visual-lynx': { appId: 'visual-lynx', produces: ['graph-visualization'], accepts: ['rdf-dataset', 'ontology-rdf', 'ontology-draft', 'jsonld-graph', 'document-rdf', 'annotation-rdf'] },
  'cq-ferret': {
    appId: 'cq-ferret',
    produces: ['competency-question-set', 'term-list', 'sparql-query', 'mermaid-diagram'],
    accepts: ['ontology-rdf', 'rdf-dataset', 'sparql-query'],
    artifactLoadActions: [
      {
        actionId: 'append-sparql-query-to-cq',
        artifactKind: 'sparql-query',
        label: 'Append to associated queries',
        mode: 'append',
        destination: 'database-query-list'
      }
    ],
    workspaceActions: [
      {
        actionId: 'import-cq-csv',
        label: 'Import competency questions from CSV',
        direction: 'import',
        description: 'Append new competency questions and update rows whose CQ identifiers already exist.',
        accept: '.csv,text/csv',
        mode: 'merge',
        artifactKind: 'competency-question-set'
      },
      {
        actionId: 'export-cq-jsonld',
        label: 'Download competency questions as JSON-LD',
        direction: 'export',
        description: 'Download the active project’s CQ graph as portable RDF JSON-LD.',
        mode: 'download',
        artifactKind: 'competency-question-set'
      },
      {
        actionId: 'export-cq-csv',
        label: 'Download competency questions as CSV',
        direction: 'export',
        description: 'Download the active project’s CQ graph as a flattened CQ exchange table.',
        mode: 'download',
        artifactKind: 'competency-question-set'
      }
    ]
  },
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

/** @param {AppCapabilityManifest} manifest @returns {WorkspaceAction[]} */
export function listWorkspaceActions(manifest) {
  return Array.isArray(manifest?.workspaceActions) ? manifest.workspaceActions : [];
}

/** @param {AppCapabilityManifest} manifest @param {string} actionId @returns {WorkspaceAction|null} */
export function getWorkspaceAction(manifest, actionId) {
  return listWorkspaceActions(manifest).find((action) => action.actionId === actionId) || null;
}

/** @param {object} artifact @param {AppCapabilityManifest} manifest @returns {ArtifactLoadAction[]} */
export function getArtifactLoadActions(artifact, manifest) {
  if (!artifact || !manifest) return [];
  return (manifest.artifactLoadActions || []).filter((action) => action.artifactKind === artifact.artifactKind);
}
