/**
 * Semantic color palette used by the Cytoscape RDF visualizer.
 *
 * The values intentionally match the D3 visualizer's broad visual language:
 * yellow classes, cyan object properties, green datatype/literal values, red
 * ontologies, orange annotation properties, purple individuals, and gray support
 * structures.
 */
export const CYTOSCAPE_VISUAL_STYLE = Object.freeze({
  node: Object.freeze({
    defaultFill: '#f3f4f6',
    defaultStroke: '#6b7280',
    classFill: '#fef3c7',
    classStroke: '#b45309',
    objectPropertyFill: '#cffafe',
    objectPropertyStroke: '#0369a1',
    datatypePropertyFill: '#dcfce7',
    datatypePropertyStroke: '#15803d',
    annotationPropertyFill: '#fed7aa',
    annotationPropertyStroke: '#c2410c',
    ontologyFill: '#fee2e2',
    ontologyStroke: '#b91c1c',
    namedIndividualFill: '#ede9fe',
    namedIndividualStroke: '#6d28d9',
    supportFill: '#f9fafb',
    supportStroke: '#9ca3af',
    literalFill: '#ecfdf5',
    literalStroke: '#047857',
    variableFill: '#eef2ff',
    variableStroke: '#4f46e5',
    selectedStroke: '#2563eb',
    hoverStroke: '#111827'
  }),
  edge: Object.freeze({
    defaultStroke: '#6b7280',
    datatypeStroke: '#15803d',
    annotationStroke: '#c2410c',
    typeStroke: '#7c3aed',
    pathStroke: '#0f766e',
    selectedStroke: '#2563eb',
    hoverStroke: '#111827',
    labelBackground: '#ffffff'
  })
});

/**
 * @returns {object[]} Cytoscape stylesheet.
 */
export function createDefaultCytoscapeStylesheet() {
  const palette = CYTOSCAPE_VISUAL_STYLE;
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        shape: 'round-rectangle',
        width: 'data(visualWidth)',
        height: 'data(visualHeight)',
        padding: '0px',
        'text-wrap': 'wrap',
        'text-max-width': 'data(textMaxWidth)',
        'text-halign': 'center',
        'text-valign': 'center',
        'font-size': 11,
        'font-weight': 500,
        'text-outline-color': '#ffffff',
        'text-outline-width': 1,
        'background-color': palette.node.defaultFill,
        'border-width': 2,
        'border-color': palette.node.defaultStroke,
        color: '#111827'
      }
    },
    { selector: 'node[kind = "class"]', style: { 'background-color': palette.node.classFill, 'border-color': palette.node.classStroke } },
    { selector: 'node[kind = "object-property"]', style: { 'background-color': palette.node.objectPropertyFill, 'border-color': palette.node.objectPropertyStroke } },
    { selector: 'node[kind = "datatype-property"]', style: { 'background-color': palette.node.datatypePropertyFill, 'border-color': palette.node.datatypePropertyStroke } },
    { selector: 'node[kind = "annotation-property"]', style: { 'background-color': palette.node.annotationPropertyFill, 'border-color': palette.node.annotationPropertyStroke } },
    { selector: 'node[kind = "ontology"]', style: { 'background-color': palette.node.ontologyFill, 'border-color': palette.node.ontologyStroke, 'border-width': 3 } },
    { selector: 'node[kind = "named-individual"]', style: { 'background-color': palette.node.namedIndividualFill, 'border-color': palette.node.namedIndividualStroke } },
    { selector: 'node[kind = "axiom-support"]', style: { 'background-color': palette.node.supportFill, 'border-color': palette.node.supportStroke, 'border-style': 'dashed' } },
    { selector: 'node[kind = "blank-node"]', style: { 'background-color': '#e5e7eb', 'border-color': '#4b5563', 'border-style': 'dashed' } },
    { selector: 'node[kind = "literal"]', style: { 'background-color': palette.node.literalFill, 'border-color': palette.node.literalStroke, shape: 'rectangle' } },
    { selector: 'node[kind = "variable"]', style: { 'background-color': palette.node.variableFill, 'border-color': palette.node.variableStroke, 'border-style': 'dotted' } },
    { selector: 'node[isSelectedVar]', style: { 'border-width': 4, 'border-color': '#ca8a04' } },
    {
      selector: 'edge',
      style: {
        label: 'data(label)',
        width: 1.5,
        'line-color': palette.edge.defaultStroke,
        'target-arrow-color': palette.edge.defaultStroke,
        'target-arrow-shape': 'triangle',
        'curve-style': 'unbundled-bezier',
        'control-point-distances': 'data(controlPointDistance)',
        'control-point-weights': 0.5,
        'loop-direction': 'data(loopDirection)',
        'loop-sweep': 'data(loopSweep)',
        'font-size': 10,
        'text-background-color': palette.edge.labelBackground,
        'text-background-opacity': 0.92,
        'text-background-padding': 2,
        'text-outline-color': palette.edge.labelBackground,
        'text-outline-width': 1,
        'text-rotation': 'autorotate'
      }
    },
    { selector: 'edge[kind = "datatype"]', style: { 'line-color': palette.edge.datatypeStroke, 'target-arrow-color': palette.edge.datatypeStroke } },
    { selector: 'edge[kind = "annotation"]', style: { 'line-color': palette.edge.annotationStroke, 'target-arrow-color': palette.edge.annotationStroke } },
    { selector: 'edge[kind = "type"]', style: { 'line-color': palette.edge.typeStroke, 'target-arrow-color': palette.edge.typeStroke, 'line-style': 'dashed' } },
    { selector: 'edge[kind = "path"]', style: { 'line-color': palette.edge.pathStroke, 'target-arrow-color': palette.edge.pathStroke, 'line-style': 'dotted' } },
    { selector: 'node.is-hovered', style: { 'border-color': palette.node.hoverStroke, 'border-width': 4 } },
    { selector: 'edge.is-hovered', style: { 'line-color': palette.edge.hoverStroke, 'target-arrow-color': palette.edge.hoverStroke, width: 3 } },
    { selector: 'node:selected', style: { 'border-color': palette.node.selectedStroke, 'border-width': 4 } },
    { selector: 'edge:selected', style: { 'line-color': palette.edge.selectedStroke, 'target-arrow-color': palette.edge.selectedStroke, width: 3 } }
  ];
}
