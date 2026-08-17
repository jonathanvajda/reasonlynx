import {
  createGraphEdgeId,
  createGraphTermId,
  buildGraphFilterOptionIndex,
  buildGraphFilterPanelViewModel,
  buildInspectorViewModel,
  buildLabelIndex,
  buildNodePropertyIndex,
  calculateNeighborNudgePositions,
  calculateVisibleGraphElementIds,
  clearGraphElementSelection,
  createCytoscapeLayoutOptions,
  createDefaultCytoscapeStylesheet,
  createRdfGraphProjectionPolicy,
  classifyOntologyNode,
  createGraphElementCopyPayload,
  isAxiomSupportNode,
  isRenderedPredicate,
  estimateNodeVisualDimensions,
  getFirstDegreeNeighborNodeIds,
  listCytoscapeLayoutOptions,
  projectGraphStateToCytoscapeElements,
  projectRdfToGraphState,
  projectSparqlGraphModelToGraphState,
  selectGraphElementIds,
  updateGraphElementSelection,
  hideSelectedGraphElements,
  pinGraphNodePosition,
  restoreHiddenGraphElements,
  setGraphInspectorTarget,
  updateGraphVisibilityFilters
} from '../src/index.js';
import {
  COMMON_NAMESPACE_IRIS
} from '../../namespace-registry/src/index.js';

const namedNode = (value) => ({ termType: 'NamedNode', value });
const blankNode = (value) => ({ termType: 'BlankNode', value });
const literal = (value, datatype = COMMON_NAMESPACE_IRIS.xsd.string, language = '') => ({
  termType: 'Literal',
  value,
  language,
  datatype: namedNode(datatype)
});
const defaultGraph = () => ({ termType: 'DefaultGraph', value: '' });
const quad = (subject, predicate, object, graph = defaultGraph()) => ({ subject, predicate, object, graph });

describe('Cytoscape visualization Phase 1 graph state', () => {
  test('creates stable RDF term and edge IDs', () => {
    expect(createGraphTermId(namedNode('http://example.org/A'))).toBe('rdf-term:NamedNode:http%3A%2F%2Fexample.org%2FA');
    expect(createGraphTermId(blankNode('b1'))).toBe('rdf-term:BlankNode:b1');
    expect(createGraphTermId(literal('hello', COMMON_NAMESPACE_IRIS.xsd.string, 'en'))).toBe(
      `rdf-term:Literal:hello:${encodeURIComponent(COMMON_NAMESPACE_IRIS.xsd.string)}:en`
    );

    const edgeId = createGraphEdgeId(quad(
      namedNode('http://example.org/A'),
      namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf),
      namedNode('http://example.org/B'),
      namedNode('http://example.org/graph')
    ));
    expect(edgeId).toContain('rdf-term:NamedNode:http%3A%2F%2Fexample.org%2Fgraph');
  });

  test('projects type statements into classification and keeps literal annotations off edges by default', () => {
    const state = projectRdfToGraphState([
      quad(namedNode('http://example.org/Person'), namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(namedNode('http://example.org/Person'), namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Person')),
      quad(namedNode('http://example.org/Person'), namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), namedNode('http://example.org/Entity'))
    ]);
    const person = state.nodes.find((node) => node.iri === 'http://example.org/Person');

    expect(person.kind).toBe('class');
    expect(person.annotations[0]).toMatchObject({
      predicateIri: COMMON_NAMESPACE_IRIS.rdfs.label,
      value: 'Person'
    });
    expect(state.edges).toHaveLength(1);
  });

  test('deduplicates nodes, preserves named graphs, and hides blank nodes in Cytoscape projection by default', () => {
    const state = projectRdfToGraphState([
      quad(namedNode('http://example.org/A'), namedNode('http://example.org/p'), namedNode('http://example.org/B'), namedNode('http://example.org/g1')),
      quad(namedNode('http://example.org/A'), namedNode('http://example.org/p'), namedNode('http://example.org/B'), namedNode('http://example.org/g2')),
      quad(blankNode('b1'), namedNode('http://example.org/p'), namedNode('http://example.org/A'))
    ]);
    const elements = projectGraphStateToCytoscapeElements(state);

    expect(state.nodes.filter((node) => node.iri === 'http://example.org/A')).toHaveLength(1);
    expect(new Set(state.edges.map((edge) => edge.graphId)).size).toBe(3);
    expect(elements.filter((element) => element.group === 'nodes').every((node) => node.data.kind !== 'blank-node')).toBe(true);
  });
});

describe('Cytoscape visualization Phase 2 ontology classification', () => {
  test('treats rdf:type as metadata unless all-triples rendering is requested', () => {
    expect(isRenderedPredicate(COMMON_NAMESPACE_IRIS.rdf.type)).toBe(false);
    expect(isRenderedPredicate(COMMON_NAMESPACE_IRIS.rdf.type, { includeTypeEdges: true })).toBe(true);
    expect(isRenderedPredicate(COMMON_NAMESPACE_IRIS.rdfs.subClassOf)).toBe(true);
  });

  test('applies deterministic type precedence for ontology resources', () => {
    const node = {
      term: namedNode('http://example.org/Ontology'),
      typeIris: [
        COMMON_NAMESPACE_IRIS.owl.Class,
        COMMON_NAMESPACE_IRIS.owl.Ontology
      ]
    };

    expect(classifyOntologyNode(node)).toBe('ontology');
  });

  test('classifies common OWL restriction blank nodes as axiom support and hides them by default', () => {
    const restriction = blankNode('restriction1');
    const state = projectRdfToGraphState([
      quad(namedNode('http://example.org/Part'), namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), restriction),
      quad(restriction, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Restriction)),
      quad(restriction, namedNode(COMMON_NAMESPACE_IRIS.owl.onProperty), namedNode('http://example.org/partOf')),
      quad(restriction, namedNode(COMMON_NAMESPACE_IRIS.owl.someValuesFrom), namedNode('http://example.org/Whole'))
    ]);
    const restrictionNode = state.nodes.find((node) => node.term?.termType === 'BlankNode');

    expect(isAxiomSupportNode(restrictionNode, state.indexes)).toBe(true);
    expect(restrictionNode.kind).toBe('axiom-support');
    expect(projectGraphStateToCytoscapeElements(state).some((element) => element.data.kind === 'axiom-support')).toBe(false);
    expect(projectGraphStateToCytoscapeElements(state, { hideAxiomSupportNodes: false }).some((element) => element.data.kind === 'axiom-support')).toBe(true);
  });

  test('treats anonymous OWL class blank nodes as axiom support instead of ordinary classes', () => {
    const anonymousClass = blankNode('n3-143');
    const state = projectRdfToGraphState([
      quad(anonymousClass, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class))
    ]);
    const anonymousClassNode = state.nodes.find((node) => node.term?.termType === 'BlankNode');

    expect(anonymousClassNode.kind).toBe('axiom-support');
    expect(classifyOntologyNode({
      id: createGraphTermId(anonymousClass),
      term: anonymousClass,
      typeIris: [COMMON_NAMESPACE_IRIS.owl.Class]
    })).toBe('axiom-support');
  });

  test('keeps unknown named resources neutral', () => {
    expect(classifyOntologyNode({ term: namedNode('http://example.org/Unknown'), typeIris: [] })).toBe('resource');
  });
});

describe('Cytoscape visualization Phase 3 label and property indexes', () => {
  test('prefers rdfs:label over alternate label predicates and preserves multiline labels', () => {
    const subject = namedNode('http://example.org/Entity');
    const labelIndex = buildLabelIndex([
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.skos.prefLabel), literal('Preferred label')),
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Line one\nLine two', COMMON_NAMESPACE_IRIS.xsd.string, 'en'))
    ]);

    expect(labelIndex.get(createGraphTermId(subject))).toMatchObject({
      label: 'Line one\nLine two',
      predicateIri: COMMON_NAMESPACE_IRIS.rdfs.label,
      language: 'en'
    });
  });

  test('builds deterministic node property rows for repeated annotations and typed literals', () => {
    const subject = namedNode('http://example.org/Entity');
    const quads = [
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdfs.comment), literal('Second comment')),
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdfs.comment), literal('First comment', COMMON_NAMESPACE_IRIS.xsd.string, 'en')),
      quad(subject, namedNode('http://example.org/age'), literal('42', COMMON_NAMESPACE_IRIS.xsd.integer)),
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), namedNode('http://example.org/Parent'))
    ];
    const state = projectRdfToGraphState(quads);
    const record = buildNodePropertyIndex(quads, state.indexes).get(createGraphTermId(subject));

    expect(record.typeIris).toContain(COMMON_NAMESPACE_IRIS.owl.Class);
    expect(record.annotations).toEqual([
      expect.objectContaining({
        predicateIri: COMMON_NAMESPACE_IRIS.rdfs.comment,
        value: 'First comment',
        language: 'en'
      }),
      expect.objectContaining({
        predicateIri: COMMON_NAMESPACE_IRIS.rdfs.comment,
        value: 'Second comment'
      })
    ]);
    expect(record.datatypeProperties).toEqual([
      expect.objectContaining({
        predicateIri: 'http://example.org/age',
        value: '42',
        datatypeIri: COMMON_NAMESPACE_IRIS.xsd.integer
      })
    ]);
    expect(record.objectProperties).toHaveLength(0);
  });

  test('adds property records to Cytoscape node data and builds grouped inspector view models', () => {
    const subject = namedNode('http://example.org/Entity');
    const state = projectRdfToGraphState([
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Entity'))
    ]);
    const nodeElement = projectGraphStateToCytoscapeElements(state, { hideBlankNodes: false })
      .find((element) => element.group === 'nodes' && element.data.iri === subject.value);
    const viewModel = buildInspectorViewModel(nodeElement.data, state.indexes.propertyIndex);

    expect(nodeElement.data.propertyRecord).toBeTruthy();
    expect(viewModel.headingRows).toContainEqual(['Label', 'Entity']);
    expect(viewModel.groups.some((group) => group.label === 'Types')).toBe(true);
    expect(viewModel.groups.some((group) => group.label === 'Annotations')).toBe(true);
  });
});

describe('Cytoscape visualization Phase 4 RDF-to-Cytoscape projection', () => {
  test('projects a small ontology fixture with RDF terms, semantic kinds, and predicate labels', () => {
    const ontology = namedNode('http://example.org/ExampleOntology');
    const person = namedNode('http://example.org/Person');
    const organization = namedNode('http://example.org/Organization');
    const memberOf = namedNode('http://example.org/memberOf');
    const state = projectRdfToGraphState([
      quad(ontology, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Ontology)),
      quad(person, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(organization, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(memberOf, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.ObjectProperty)),
      quad(memberOf, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('member of')),
      quad(person, memberOf, organization),
      quad(person, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Person', COMMON_NAMESPACE_IRIS.xsd.string, 'en'))
    ]);
    const elements = projectGraphStateToCytoscapeElements(state);
    const personElement = elements.find((element) => element.group === 'nodes' && element.data.iri === person.value);
    const memberOfEdge = elements.find((element) => element.group === 'edges' && element.data.predicateIri === memberOf.value);

    expect(personElement).toMatchObject({
      group: 'nodes',
      data: {
        label: 'Person',
        visualWidth: expect.any(Number),
        visualHeight: expect.any(Number),
        textMaxWidth: expect.any(Number),
        kind: 'class',
        term: person
      }
    });
    expect(memberOfEdge).toMatchObject({
      group: 'edges',
      data: {
        source: createGraphTermId(person),
        target: createGraphTermId(organization),
        label: 'member of',
        kind: 'object',
        subjectTerm: person,
        predicateTerm: memberOf,
        objectTerm: organization
      }
    });
  });

  test('computes stable node dimensions so wrapped labels remain inside node boxes', () => {
    const shortLabel = estimateNodeVisualDimensions('Short');
    const longLabel = estimateNodeVisualDimensions('SPARQL Protocol and Resource Description Framework Query Language Select Query');
    const longWordLabel = estimateNodeVisualDimensions('SupercalifragilisticexpialidociousOntologyArtifact');

    expect(shortLabel.visualWidth).toBeGreaterThanOrEqual(54);
    expect(longLabel.visualWidth).toBeLessThanOrEqual(230);
    expect(longLabel.visualHeight).toBeGreaterThan(shortLabel.visualHeight);
    expect(longWordLabel.visualHeight).toBeGreaterThan(shortLabel.visualHeight);
    expect(longLabel.textMaxWidth).toBeLessThan(longLabel.visualWidth);
  });

  test('supports multiple edges between the same nodes and self-loop statements', () => {
    const node = namedNode('http://example.org/A');
    const parent = namedNode('http://example.org/B');
    const state = projectRdfToGraphState([
      quad(node, namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), parent),
      quad(node, namedNode('http://example.org/relatedTo'), parent),
      quad(node, namedNode('http://example.org/refines'), node)
    ]);
    const edgeElements = projectGraphStateToCytoscapeElements(state).filter((element) => element.group === 'edges');

    expect(edgeElements).toHaveLength(3);
    expect(edgeElements.filter((edge) => edge.data.source === createGraphTermId(node) && edge.data.target === createGraphTermId(parent))).toHaveLength(2);
    expect(edgeElements.some((edge) => edge.data.source === createGraphTermId(node) && edge.data.target === createGraphTermId(node))).toBe(true);
  });

  test('projects datatype literal nodes when requested and keeps rdf:type hidden unless debug mode is enabled', () => {
    const subject = namedNode('http://example.org/A');
    const quads = [
      quad(subject, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(subject, namedNode('http://example.org/count'), literal('2', COMMON_NAMESPACE_IRIS.xsd.integer))
    ];
    const literalState = projectRdfToGraphState(quads, { renderLiteralsAsNodes: true });
    const literalElements = projectGraphStateToCytoscapeElements(literalState);
    const debugState = projectRdfToGraphState(quads, { includeTypeEdges: true, renderLiteralsAsNodes: true });
    const debugEdges = projectGraphStateToCytoscapeElements(debugState).filter((element) => element.group === 'edges');

    expect(literalElements.some((element) => element.group === 'nodes' && element.data.kind === 'literal' && element.data.value === '2')).toBe(true);
    expect(literalElements.some((element) => element.group === 'edges' && element.data.kind === 'datatype')).toBe(true);
    expect(literalElements.some((element) => element.group === 'edges' && element.data.predicateIri === COMMON_NAMESPACE_IRIS.rdf.type)).toBe(false);
    expect(debugEdges.some((edge) => edge.data.predicateIri === COMMON_NAMESPACE_IRIS.rdf.type)).toBe(true);
  });

  test('limits focused projection to the focus node and adjacent nodes', () => {
    const focus = namedNode('http://example.org/Focus');
    const adjacent = namedNode('http://example.org/Adjacent');
    const distant = namedNode('http://example.org/Distant');
    const state = projectRdfToGraphState([
      quad(focus, namedNode('http://example.org/p'), adjacent),
      quad(distant, namedNode('http://example.org/p'), namedNode('http://example.org/Other'))
    ], { focusNodeIri: focus.value });

    expect(state.nodes.map((node) => node.iri).filter(Boolean).sort()).toEqual([adjacent.value, focus.value]);
    expect(state.edges).toHaveLength(1);
  });

  test('can exclude blank and axiom support nodes from projection without dropping source quads', () => {
    const named = namedNode('http://example.org/Named');
    const anonymousClass = blankNode('n3-143');
    const ordinaryBlank = blankNode('ordinary');
    const quads = [
      quad(named, namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), anonymousClass),
      quad(anonymousClass, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(ordinaryBlank, namedNode('http://example.org/p'), named)
    ];
    const state = projectRdfToGraphState(quads, {
      blankNodeProjectionMode: 'exclude',
      axiomSupportProjectionMode: 'exclude'
    });

    expect(createRdfGraphProjectionPolicy({
      blankNodeProjectionMode: 'exclude',
      axiomSupportProjectionMode: 'exclude'
    })).toEqual({
      blankNodeProjectionMode: 'exclude',
      axiomSupportProjectionMode: 'exclude'
    });
    expect(state.quads).toHaveLength(quads.length);
    expect(state.nodes.every((node) => node.term?.termType !== 'BlankNode')).toBe(true);
    expect(state.edges).toHaveLength(0);
    expect(state.indexes.propertyIndex.get(createGraphTermId(anonymousClass))).toBeTruthy();
  });

  test('can project axiom-support blank nodes without projecting ordinary blank nodes', () => {
    const named = namedNode('http://example.org/Named');
    const anonymousClass = blankNode('n3-143');
    const ordinaryBlank = blankNode('ordinary');
    const state = projectRdfToGraphState([
      quad(named, namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), anonymousClass),
      quad(anonymousClass, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
      quad(ordinaryBlank, namedNode('http://example.org/p'), named)
    ], {
      blankNodeProjectionMode: 'exclude',
      axiomSupportProjectionMode: 'include'
    });

    expect(state.nodes.some((node) => node.value === 'n3-143' && node.kind === 'axiom-support')).toBe(true);
    expect(state.nodes.some((node) => node.value === 'ordinary')).toBe(false);
  });
});

describe('Cytoscape visualization Phase 5 visual styling parity', () => {
  test('defines semantic node styles for ontology graph categories', () => {
    const stylesheet = createDefaultCytoscapeStylesheet();
    const selectors = stylesheet.map((entry) => entry.selector);

    expect(selectors).toEqual(expect.arrayContaining([
      'node[kind = "class"]',
      'node[kind = "object-property"]',
      'node[kind = "datatype-property"]',
      'node[kind = "annotation-property"]',
      'node[kind = "ontology"]',
      'node[kind = "named-individual"]',
      'node[kind = "axiom-support"]',
      'node[kind = "blank-node"]',
      'node[kind = "literal"]'
    ]));
    expect(findStyle(stylesheet, 'node').style).toMatchObject({
      width: 'data(visualWidth)',
      height: 'data(visualHeight)',
      'text-max-width': 'data(textMaxWidth)',
      'text-halign': 'center',
      'text-valign': 'center'
    });
  });

  test('defines readable directed edge styles and interaction states', () => {
    const stylesheet = createDefaultCytoscapeStylesheet();

    expect(findStyle(stylesheet, 'edge').style).toMatchObject({
      label: 'data(label)',
      'target-arrow-shape': 'triangle',
      'curve-style': 'unbundled-bezier',
      'text-background-opacity': 0.92,
      'text-rotation': 'autorotate'
    });
    expect(findStyle(stylesheet, 'edge[kind = "datatype"]').style['line-color']).toBe('#15803d');
    expect(findStyle(stylesheet, 'node.is-hovered').style['border-width']).toBe(4);
    expect(findStyle(stylesheet, 'node:selected').style['border-color']).toBe('#2563eb');
    expect(findStyle(stylesheet, 'edge:selected').style.width).toBe(3);
  });
});

describe('Cytoscape visualization Phase 6 layout and edge deconfliction', () => {
  test('provides deterministic layout presets for overview, wide, readable, compact, grid, and hierarchy views', () => {
    expect(listCytoscapeLayoutOptions()).toEqual([
      { value: 'overview', label: 'Overview' },
      { value: 'wide', label: 'Wide' },
      { value: 'readable', label: 'Readable' },
      { value: 'compact', label: 'Compact' },
      { value: 'grid', label: 'Grid' },
      { value: 'breadthfirst', label: 'Hierarchy' }
    ]);
    expect(createCytoscapeLayoutOptions('readable')).toMatchObject({
      name: 'cose',
      fit: true,
      nodeDimensionsIncludeLabels: true,
      idealEdgeLength: 220
    });
    expect(createCytoscapeLayoutOptions('wide').nodeRepulsion).toBeGreaterThan(createCytoscapeLayoutOptions('overview').nodeRepulsion);
    expect(createCytoscapeLayoutOptions('breadthfirst')).toMatchObject({ name: 'breadthfirst', directed: true });
    expect(createCytoscapeLayoutOptions('missing')).toMatchObject({
      name: 'cose',
      idealEdgeLength: 170
    });
  });

  test('assigns deterministic routing data for parallel edges and self-loops', () => {
    const node = namedNode('http://example.org/A');
    const parent = namedNode('http://example.org/B');
    const state = projectRdfToGraphState([
      quad(node, namedNode('http://example.org/p1'), parent),
      quad(node, namedNode('http://example.org/p2'), parent),
      quad(node, namedNode('http://example.org/p3'), parent),
      quad(node, namedNode('http://example.org/self1'), node),
      quad(node, namedNode('http://example.org/self2'), node)
    ]);
    const edges = projectGraphStateToCytoscapeElements(state).filter((element) => element.group === 'edges');
    const parallelEdges = edges.filter((edge) => edge.data.target === createGraphTermId(parent));
    const selfLoops = edges.filter((edge) => edge.data.source === edge.data.target);

    expect(parallelEdges.map((edge) => edge.data.parallelEdgeCount)).toEqual([3, 3, 3]);
    expect(new Set(parallelEdges.map((edge) => edge.data.controlPointDistance)).size).toBe(3);
    expect(selfLoops.map((edge) => edge.data.parallelEdgeCount)).toEqual([2, 2]);
    expect(selfLoops.every((edge) => edge.data.loopDirection.endsWith('deg'))).toBe(true);
  });

  test('uses routing metadata in the Cytoscape edge stylesheet', () => {
    const edgeStyle = findStyle(createDefaultCytoscapeStylesheet(), 'edge').style;

    expect(edgeStyle['control-point-distances']).toBe('data(controlPointDistance)');
    expect(edgeStyle['loop-direction']).toBe('data(loopDirection)');
    expect(edgeStyle['loop-sweep']).toBe('data(loopSweep)');
  });

  test('computes dampened neighbor movement for manual drag interactions', () => {
    const focus = namedNode('http://example.org/Focus');
    const left = namedNode('http://example.org/Left');
    const right = namedNode('http://example.org/Right');
    const distant = namedNode('http://example.org/Distant');
    const state = projectRdfToGraphState([
      quad(focus, namedNode('http://example.org/p'), left),
      quad(right, namedNode('http://example.org/p'), focus),
      quad(distant, namedNode('http://example.org/p'), namedNode('http://example.org/Other'))
    ]);
    const focusId = createGraphTermId(focus);
    const neighborIds = getFirstDegreeNeighborNodeIds(state, focusId);
    const nudged = calculateNeighborNudgePositions(
      { x: 10, y: 10 },
      { x: 30, y: 0 },
      new Map(neighborIds.map((nodeId) => [nodeId, { x: 100, y: 100 }])),
      { strength: 0.5 }
    );

    expect(neighborIds).toEqual([createGraphTermId(left), createGraphTermId(right)].sort());
    expect(Array.from(nudged.values())).toEqual([
      { x: 110, y: 95 },
      { x: 110, y: 95 }
    ]);
  });
});

describe('Cytoscape visualization Phase 7 filtering and visibility', () => {
  test('builds filter options for node kinds, predicates, subjects, and objects', () => {
    const state = createFilterFixtureState();
    const options = buildGraphFilterOptionIndex(state);

    expect(options.kinds).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: 'class', count: 3 }),
      expect.objectContaining({ value: 'object-property', count: 1 })
    ]));
    expect(options.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ value: COMMON_NAMESPACE_IRIS.rdfs.subClassOf, count: 1 }),
      expect.objectContaining({ value: 'http://example.org/memberOf', label: 'member of', count: 1 })
    ]));
    expect(options.subjects.some((option) => option.label === 'Person')).toBe(true);
    expect(options.objects.some((option) => option.label === 'Organization')).toBe(true);
  });

  test('filters visibility by kind, predicate, subject, and object without mutating RDF state', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const organizationId = createGraphTermId(namedNode('http://example.org/Organization'));
    const filtered = updateGraphVisibilityFilters(state, {
      visibleKinds: ['class'],
      visiblePredicates: ['http://example.org/memberOf'],
      visibleSubjectIds: [personId],
      visibleObjectIds: [organizationId]
    });
    const visible = calculateVisibleGraphElementIds(filtered);
    const elements = projectGraphStateToCytoscapeElements(filtered);

    expect(filtered.quads).toHaveLength(state.quads.length);
    expect(visible.nodeIds).toEqual(new Set([personId, organizationId]));
    expect(visible.edgeIds.size).toBe(1);
    expect(elements.filter((element) => element.group === 'nodes')).toHaveLength(2);
    expect(elements.filter((element) => element.group === 'edges')).toHaveLength(1);
  });

  test('builds panel counts and supports reset/show-all filter patches', () => {
    const state = createFilterFixtureState();
    const filtered = updateGraphVisibilityFilters(state, { visibleKinds: ['object-property'] });
    const viewModel = buildGraphFilterPanelViewModel(filtered);
    const reset = updateGraphVisibilityFilters(filtered, {
      hideBlankNodes: true,
      hideAxiomSupportNodes: true,
      visibleKinds: [],
      visiblePredicates: [],
      visibleSubjectIds: [],
      visibleObjectIds: []
    });
    const showAll = updateGraphVisibilityFilters(filtered, {
      hideBlankNodes: false,
      hideAxiomSupportNodes: false,
      visibleKinds: [],
      visiblePredicates: [],
      visibleSubjectIds: [],
      visibleObjectIds: []
    });

    expect(viewModel.counts.hiddenNodes).toBeGreaterThan(0);
    expect(buildGraphFilterPanelViewModel(reset).counts.visibleNodes).toBeLessThanOrEqual(state.nodes.length);
    expect(buildGraphFilterPanelViewModel(showAll).counts.visibleNodes).toBe(state.nodes.length);
  });

  test('supports single, Ctrl additive, and Shift range selection helpers', () => {
    const orderedIds = ['a', 'b', 'c', 'd'];
    const single = selectGraphElementIds([], orderedIds, 'b');
    const additive = selectGraphElementIds(single.selectedIds, orderedIds, 'd', { ctrlKey: true });
    const removed = selectGraphElementIds(additive.selectedIds, orderedIds, 'b', { ctrlKey: true });
    const range = selectGraphElementIds([], orderedIds, 'd', { shiftKey: true, anchorId: 'b' });

    expect(single).toEqual({ selectedIds: ['b'], anchorId: 'b' });
    expect(additive).toEqual({ selectedIds: ['b', 'd'], anchorId: 'd' });
    expect(removed).toEqual({ selectedIds: ['d'], anchorId: 'b' });
    expect(range).toEqual({ selectedIds: ['b', 'c', 'd'], anchorId: 'b' });
  });
});

describe('Cytoscape visualization Phase 8 selection, dragging, hiding, and inspector', () => {
  test('routes node and edge selection through graph UI state', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const edgeId = state.edges.find((edge) => edge.predicateIri === 'http://example.org/memberOf').id;
    const nodeSelected = updateGraphElementSelection(state, { elementType: 'node', elementId: personId });
    const edgeSelected = updateGraphElementSelection(nodeSelected, { elementType: 'edge', elementId: edgeId });

    expect(nodeSelected.ui.selectedNodeIds).toEqual([personId]);
    expect(nodeSelected.ui.activeInspectorTarget).toEqual({ elementType: 'node', elementId: personId });
    expect(edgeSelected.ui.selectedNodeIds).toEqual([]);
    expect(edgeSelected.ui.selectedEdgeIds).toEqual([edgeId]);
  });

  test('hides selected elements and restores hidden elements without removing RDF state', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const selected = updateGraphElementSelection(state, { elementType: 'node', elementId: personId });
    const hidden = hideSelectedGraphElements(selected);
    const restored = restoreHiddenGraphElements(hidden);

    expect(hidden.ui.hiddenNodeIds).toContain(personId);
    expect(hidden.ui.selectedNodeIds).toEqual([]);
    expect(hidden.quads).toHaveLength(state.quads.length);
    expect(calculateVisibleGraphElementIds(hidden).nodeIds.has(personId)).toBe(false);
    expect(restored.ui.hiddenNodeIds).toEqual([]);
  });

  test('persists pinned node positions into Cytoscape node element projection', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const pinned = pinGraphNodePosition(state, personId, { x: 123, y: 456 });
    const element = projectGraphStateToCytoscapeElements(pinned)
      .find((candidate) => candidate.group === 'nodes' && candidate.data.id === personId);

    expect(pinned.ui.pinnedNodePositions[personId]).toEqual({ x: 123, y: 456 });
    expect(element.position).toEqual({ x: 123, y: 456 });
  });

  test('sets inspector targets and creates copy payloads for IRIs, CURIEs, and triple IDs', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const inspected = setGraphInspectorTarget(state, { elementType: 'node', elementId: personId });
    const elements = projectGraphStateToCytoscapeElements(state);
    const nodeElement = elements.find((candidate) => candidate.group === 'nodes' && candidate.data.id === personId);
    const edgeElement = elements.find((candidate) => candidate.group === 'edges' && candidate.data.predicateIri === COMMON_NAMESPACE_IRIS.rdfs.subClassOf);

    expect(inspected.ui.activeInspectorTarget).toEqual({ elementType: 'node', elementId: personId });
    expect(createGraphElementCopyPayload(nodeElement.data)).toMatchObject({
      iri: 'http://example.org/Person',
      curie: 'http://example.org/Person',
      tripleId: ''
    });
    expect(createGraphElementCopyPayload(edgeElement.data)).toMatchObject({
      iri: COMMON_NAMESPACE_IRIS.rdfs.subClassOf,
      curie: 'rdfs:subClassOf',
      tripleId: edgeElement.data.id
    });
  });

  test('clears selection and inspector target together', () => {
    const state = createFilterFixtureState();
    const personId = createGraphTermId(namedNode('http://example.org/Person'));
    const selected = updateGraphElementSelection(state, { elementType: 'node', elementId: personId });
    const cleared = clearGraphElementSelection(selected);

    expect(cleared.ui.selectedNodeIds).toEqual([]);
    expect(cleared.ui.selectedEdgeIds).toEqual([]);
    expect(cleared.ui.activeInspectorTarget).toBeNull();
  });
});

describe('Cytoscape visualization Phase 9 SPARQL visualization reuse', () => {
  test('projects SPARQL graph models into the shared GraphState contract', () => {
    const graphState = projectSparqlGraphModelToGraphState({
      queryType: 'SELECT',
      prefixes: { foaf: 'http://xmlns.com/foaf/0.1/' },
      whereTripleCount: 2,
      nodes: [
        { id: 'var:?p', label: '?p', kind: 'variable', category: 'individual', isSelectedVar: true },
        { id: 'iri:http://xmlns.com/foaf/0.1/Person', label: 'foaf:Person', kind: 'iri', category: 'class' },
        { id: 'lit:Alice||', label: '"Alice"', kind: 'literal', category: 'literal' }
      ],
      edges: [
        { id: 'e:type', source: 'var:?p', target: 'iri:http://xmlns.com/foaf/0.1/Person', label: 'rdf:type', category: 'rdfType' },
        { id: 'e:name', source: 'var:?p', target: 'lit:Alice||', label: 'foaf:name', category: 'datatypeProp' }
      ]
    });
    const elements = projectGraphStateToCytoscapeElements(graphState, { hideBlankNodes: false });
    const selectedVariable = elements.find((element) => element.group === 'nodes' && element.data.id === 'var:?p');
    const datatypeEdge = elements.find((element) => element.group === 'edges' && element.data.id === 'e:name');

    expect(graphState.indexes.sparqlQueryType).toBe('SELECT');
    expect(graphState.indexes.sparqlWhereTripleCount).toBe(2);
    expect(selectedVariable.data).toMatchObject({
      kind: 'variable',
      isSelectedVar: true,
      label: '?p'
    });
    expect(datatypeEdge.data).toMatchObject({
      kind: 'datatype',
      label: 'foaf:name',
      source: 'var:?p',
      target: 'lit:Alice||'
    });
  });

  test('keeps SPARQL path predicates as read-only visualization edges', () => {
    const graphState = projectSparqlGraphModelToGraphState({
      nodes: [
        { id: 'var:?s', label: '?s', kind: 'variable', category: 'variable' },
        { id: 'var:?o', label: '?o', kind: 'variable', category: 'variable' }
      ],
      edges: [
        { id: 'e:path', source: 'var:?s', target: 'var:?o', label: '[path]', category: 'path' }
      ]
    });
    const edge = projectGraphStateToCytoscapeElements(graphState)
      .find((element) => element.group === 'edges');

    expect(edge.data.kind).toBe('path');
    expect(graphState.quads).toHaveLength(0);
  });
});

function createFilterFixtureState() {
  const person = namedNode('http://example.org/Person');
  const organization = namedNode('http://example.org/Organization');
  const employee = namedNode('http://example.org/Employee');
  const memberOf = namedNode('http://example.org/memberOf');
  return projectRdfToGraphState([
    quad(person, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
    quad(organization, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
    quad(employee, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.Class)),
    quad(memberOf, namedNode(COMMON_NAMESPACE_IRIS.rdf.type), namedNode(COMMON_NAMESPACE_IRIS.owl.ObjectProperty)),
    quad(memberOf, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('member of')),
    quad(person, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Person')),
    quad(organization, namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal('Organization')),
    quad(person, memberOf, organization),
    quad(employee, namedNode(COMMON_NAMESPACE_IRIS.rdfs.subClassOf), person),
    quad(blankNode('support'), namedNode('http://example.org/p'), person)
  ]);
}

function findStyle(stylesheet, selector) {
  return stylesheet.find((entry) => entry.selector === selector);
}
