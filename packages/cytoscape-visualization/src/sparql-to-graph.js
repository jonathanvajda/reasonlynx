import { createDefaultGraphUiState, createGraphState } from './graph-state.js';

const SPARQL_NODE_KIND_BY_MODEL_KIND = Object.freeze({
  variable: 'variable',
  literal: 'literal',
  blank: 'blank-node',
  iri: 'resource'
});

const SPARQL_NODE_KIND_BY_CATEGORY = Object.freeze({
  class: 'class',
  individual: 'named-individual',
  variable: 'variable',
  literal: 'literal'
});

const SPARQL_EDGE_KIND_BY_CATEGORY = Object.freeze({
  datatypeProp: 'datatype',
  annotationProp: 'annotation',
  objectProp: 'object',
  rdfType: 'type',
  path: 'path'
});

/**
 * Projects a read-only SPARQL graph model into the same renderer-independent
 * GraphState contract used by RDF visualizations.
 *
 * The input is expected to come from `sparql-utils`:
 * `buildSparqlGraphModelFromAst(ast)`. This adapter does not create or mutate
 * SPARQL authoring state; it only prepares query patterns for visualization.
 *
 * @param {{queryType?: string, prefixes?: Record<string,string>, nodes?: object[], edges?: object[], diagnostics?: object[], whereTripleCount?: number}} sparqlGraphModel
 * @param {{ui?: object}} [options]
 * @returns {object}
 */
export function projectSparqlGraphModelToGraphState(sparqlGraphModel, options = {}) {
  const nodes = Array.from(sparqlGraphModel?.nodes || []).map((node) => Object.freeze({
    id: String(node.id || ''),
    term: null,
    termType: node.kind || '',
    iri: node.kind === 'iri' ? node.value || node.iri || '' : '',
    value: node.value || node.id || '',
    label: node.label || node.id || '',
    kind: classifySparqlGraphNodeKind(node),
    typeIris: Object.freeze([]),
    annotations: Object.freeze([]),
    isSelectedVar: Boolean(node.isSelectedVar),
    sourceModelNode: Object.freeze({ ...node })
  })).filter((node) => node.id);

  const knownNodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.from(sparqlGraphModel?.edges || []).map((edge, index) => Object.freeze({
    id: String(edge.id || `sparql-edge:${index}`),
    subjectId: String(edge.source || ''),
    predicateId: String(edge.label || edge.category || `predicate:${index}`),
    objectId: String(edge.target || ''),
    graphId: '',
    predicateTerm: null,
    predicateIri: edge.predicateIri || edge.label || edge.category || '',
    label: edge.label || edge.category || '',
    kind: classifySparqlGraphEdgeKind(edge),
    quad: null,
    sourceModelEdge: Object.freeze({ ...edge })
  })).filter((edge) => knownNodeIds.has(edge.subjectId) && knownNodeIds.has(edge.objectId));

  const labelIndex = new Map();
  const propertyIndex = new Map();
  for (const node of nodes) {
    labelIndex.set(node.id, Object.freeze({ label: node.label, predicateIri: '', language: '', datatypeIri: '' }));
    propertyIndex.set(node.id, Object.freeze({
      iri: node.iri,
      typeIris: Object.freeze([]),
      annotations: Object.freeze([
        Object.freeze({ predicateLabel: 'SPARQL term kind', predicateIri: '', value: node.termType }),
        Object.freeze({ predicateLabel: 'SPARQL visual category', predicateIri: '', value: node.kind })
      ]),
      datatypeProperties: Object.freeze([]),
      objectProperties: Object.freeze([])
    }));
  }

  return createGraphState({
    nodes,
    edges,
    quads: [],
    ui: createDefaultGraphUiState(options.ui),
    indexes: {
      labelIndex,
      propertyIndex,
      sparqlPrefixes: Object.freeze({ ...(sparqlGraphModel?.prefixes || {}) }),
      sparqlQueryType: sparqlGraphModel?.queryType || 'UNKNOWN',
      sparqlWhereTripleCount: Number(sparqlGraphModel?.whereTripleCount || 0)
    },
    diagnostics: sparqlGraphModel?.diagnostics || []
  });
}

/**
 * @param {{kind?: string, category?: string}} node
 * @returns {string}
 */
export function classifySparqlGraphNodeKind(node) {
  if (node?.kind === 'variable' || node?.kind === 'literal' || node?.kind === 'blank') {
    return SPARQL_NODE_KIND_BY_MODEL_KIND[node.kind];
  }
  return SPARQL_NODE_KIND_BY_CATEGORY[node?.category]
    || SPARQL_NODE_KIND_BY_MODEL_KIND[node?.kind]
    || 'resource';
}

/**
 * @param {{category?: string}} edge
 * @returns {string}
 */
export function classifySparqlGraphEdgeKind(edge) {
  return SPARQL_EDGE_KIND_BY_CATEGORY[edge?.category] || 'object';
}
