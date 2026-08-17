import { jest } from '@jest/globals';
import { COMMON_NAMESPACE_IRIS } from '../../namespace-registry/src/namespace-registry.js';
import {
  createRdfDataset,
  createRdfQuadsFromJsonLdGraph,
  createRdfQuadsFromObjects,
  literal,
  namedNode,
  parseRdfText,
  parseRdfTextWithAdapters,
  quad,
  rdfDatasetToJsonLdGraph,
  getRdfGraphExportGraphShape,
  isSupportedRdfGraphExportMimeType,
  RDF_GRAPH_EXPORT_MIME_TYPES,
  selectRdfGraphExportQuads,
  serializeRdfGraphExport,
  serializeRdfDataset,
  serializeRdfDatasetWithAdapters,
  serializeRdfDatasetToNQuads
} from '../src/index.js';

describe('RDF/JS dataset and line serialization', () => {
  test('serializes named nodes, literals, datatypes, languages, and graph names to N-Quads', () => {
    const dataset = createRdfDataset([
      quad('http://ex/s1', 'http://ex/p', literal('hello', { language: 'en' }), 'http://ex/g'),
      quad('http://ex/s1', 'http://ex/count', literal(7, { datatype: 'http://www.w3.org/2001/XMLSchema#integer' }))
    ]);

    expect(serializeRdfDatasetToNQuads(dataset)).toBe([
      '<http://ex/s1> <http://ex/p> "hello"@en <http://ex/g> .',
      '<http://ex/s1> <http://ex/count> "7"^^<http://www.w3.org/2001/XMLSchema#integer> .',
      ''
    ].join('\n'));
  });

  test('parses N-Quads and round-trips through the canonical serializer result shape', () => {
    const parsed = parseRdfText('<http://ex/s> <http://ex/p> "line\\n2" <http://ex/g> .\n', { format: 'nquads' });
    expect(parsed.quads).toHaveLength(1);
    expect(parsed.quads[0].object.value).toBe('line\n2');

    const serialized = serializeRdfDataset(parsed.dataset, { format: 'application/n-quads' });
    expect(serialized).toEqual({
      text: '<http://ex/s> <http://ex/p> "line\\n2" <http://ex/g> .\n',
      format: 'nquads',
      mimeType: 'application/n-quads',
      warnings: []
    });
  });

  test('throws clear errors for unsupported dependency-free parse formats', () => {
    expect(() => parseRdfText('@prefix ex: <http://ex/> .', { format: 'turtle' }))
      .toThrow('supports only N-Triples and N-Quads');
  });
});

describe('object-to-RDF projection', () => {
  test('converts app records to reusable RDF quads with a mapping', () => {
    const result = createRdfQuadsFromObjects([
      {
        id: 'http://ex/ClassA',
        label: 'Class A',
        definition: 'A test class',
        parent: 'http://ex/Parent'
      }
    ], {
      subject: 'id',
      type: 'http://www.w3.org/2002/07/owl#Class',
      properties: {
        label: {
          predicate: 'http://www.w3.org/2000/01/rdf-schema#label',
          language: 'en'
        },
        definition: 'http://purl.obolibrary.org/obo/IAO_0000115',
        parent: {
          predicate: 'http://www.w3.org/2000/01/rdf-schema#subClassOf',
          termType: 'iri'
        }
      }
    });

    expect(result.warnings).toEqual([]);
    expect(result.quads).toHaveLength(4);
    expect(result.quads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: namedNode(COMMON_NAMESPACE_IRIS.rdf.type),
        object: namedNode('http://www.w3.org/2002/07/owl#Class')
      }),
      expect.objectContaining({
        predicate: namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        object: literal('Class A', { language: 'en' })
      }),
      expect.objectContaining({
        predicate: namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        object: namedNode('http://ex/Parent')
      })
    ]));
  });

  test('warns and skips objects with missing subjects or invalid IRI object values', () => {
    const result = createRdfQuadsFromObjects([
      { id: '', label: 'No subject' },
      { id: 'http://ex/Good', related: '' }
    ], {
      subject: 'id',
      properties: {
        related: {
          predicate: 'http://ex/related',
          termType: 'iri'
        }
      },
      skipNullValues: false
    });

    expect(result.quads).toHaveLength(0);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'missing_subject',
      'invalid_property_value'
    ]);
  });
});

describe('JSON-LD projection depends on RDF quads', () => {
  test('serializes mapped object quads to JSON-LD without a separate app-specific branch', () => {
    const { quads } = createRdfQuadsFromObjects([
      { iri: 'http://ex/cq1', label: 'What assets exist?', source: 'SME' }
    ], {
      subject: 'iri',
      type: 'http://ex/CompetencyQuestion',
      properties: {
        label: 'http://www.w3.org/2000/01/rdf-schema#label',
        source: 'http://purl.org/dc/terms/source'
      }
    });

    const jsonld = serializeRdfDataset(quads, {
      format: 'jsonld',
      context: {
        label: 'http://www.w3.org/2000/01/rdf-schema#label',
        source: 'http://purl.org/dc/terms/source'
      }
    });

    expect(JSON.parse(jsonld.text)).toEqual({
      '@context': {
        label: 'http://www.w3.org/2000/01/rdf-schema#label',
        source: 'http://purl.org/dc/terms/source'
      },
      '@graph': [
        {
          '@id': 'http://ex/cq1',
          '@type': ['http://ex/CompetencyQuestion'],
          label: { '@value': 'What assets exist?' },
          source: { '@value': 'SME' }
        }
      ]
    });
  });

  test('converts simple JSON-LD graph objects back to RDF quads', () => {
    const result = createRdfQuadsFromJsonLdGraph({
      '@context': {
        label: 'http://www.w3.org/2000/01/rdf-schema#label',
        parent: { '@id': 'http://www.w3.org/2000/01/rdf-schema#subClassOf' }
      },
      '@graph': [
        {
          '@id': 'http://ex/A',
          '@type': 'http://www.w3.org/2002/07/owl#Class',
          label: { '@value': 'A', '@language': 'en' },
          parent: { '@id': 'http://ex/B' }
        }
      ]
    });

    expect(result.quads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        predicate: namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        object: literal('A', { language: 'en' })
      }),
      expect.objectContaining({
        predicate: namedNode('http://www.w3.org/2000/01/rdf-schema#subClassOf'),
        object: namedNode('http://ex/B')
      })
    ]));
  });

  test('produces stable graph projection from raw quads', () => {
    const graph = rdfDatasetToJsonLdGraph([
      quad('http://ex/s', 'http://ex/p', 'literal value'),
      quad('http://ex/s', 'http://ex/ref', namedNode('http://ex/o'))
    ]);

    expect(graph).toEqual([
      {
        '@id': 'http://ex/s',
        'http://ex/p': { '@value': 'literal value' },
        'http://ex/ref': { '@id': 'http://ex/o' }
      }
    ]);
  });
});

describe('RDF graph export scopes', () => {
  test('defines promoted RDF export formats and graph-shape policy', () => {
    expect(RDF_GRAPH_EXPORT_MIME_TYPES).toEqual([
      'text/turtle',
      'application/n-triples',
      'application/n-quads',
      'application/trig',
      'application/rdf+xml',
      'application/ld+json'
    ]);
    expect(isSupportedRdfGraphExportMimeType('application/trig')).toBe(true);
    expect(isSupportedRdfGraphExportMimeType('text/plain')).toBe(false);
    expect(getRdfGraphExportGraphShape('text/turtle')).toBe('triples');
    expect(getRdfGraphExportGraphShape('application/n-triples')).toBe('triples');
    expect(getRdfGraphExportGraphShape('application/rdf+xml')).toBe('triples');
    expect(getRdfGraphExportGraphShape('application/n-quads')).toBe('quads');
    expect(getRdfGraphExportGraphShape('application/trig')).toBe('quads');
    expect(getRdfGraphExportGraphShape('application/ld+json')).toBe('quads');
    expect(() => getRdfGraphExportGraphShape('text/plain')).toThrow('Unsupported RDF graph export MIME type');
  });

  test('selects default, named, and all graph scopes from a mixed dataset', () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const dataset = createMixedGraphDataset(runtime);

    expect(selectRdfGraphExportQuads(dataset, {
      scope: 'default',
      defaultGraphTerm: runtime.N3.DataFactory.defaultGraph()
    }).map((item) => item.subject.value)).toEqual(['http://ex/default']);
    expect(selectRdfGraphExportQuads(dataset, { scope: 'named' }).map((item) => item.subject.value)).toEqual(['http://ex/named']);
    expect(selectRdfGraphExportQuads(dataset, { scope: 'all' })).toHaveLength(2);
  });

  test('serializes default graph export as Turtle', async () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const result = await serializeRdfGraphExport(createMixedGraphDataset(runtime), {
      scope: 'default',
      format: 'text/turtle',
      runtime
    });

    expect(result.count).toBe(1);
    expect(result.text).toContain('<http://ex/default>');
    expect(result.text).not.toContain('<http://ex/named>');
  });

  test('serializes named graph export as TriG with graph names', async () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const result = await serializeRdfGraphExport(createMixedGraphDataset(runtime), {
      scope: 'named',
      format: 'application/trig',
      runtime
    });

    expect(result.count).toBe(1);
    expect(result.text).toContain('<http://ex/named>');
    expect(result.text).toContain('<http://ex/graph>');
  });

  test('serializes named graph export as Turtle by flattening graph names', async () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const result = await serializeRdfGraphExport(createMixedGraphDataset(runtime), {
      scope: 'named',
      format: 'text/turtle',
      runtime
    });

    expect(result.count).toBe(1);
    expect(result.text).toContain('<http://ex/named>');
    expect(result.text).not.toContain('<http://ex/graph>');
  });

  test('serializes combined graph export as N-Quads', async () => {
    const runtime = { N3: createGraphAwareMockN3Runtime() };
    const result = await serializeRdfGraphExport(createMixedGraphDataset(runtime), {
      scope: 'all',
      format: 'application/n-quads',
      runtime
    });

    expect(result.count).toBe(2);
    expect(result.text).toContain('<http://ex/default>');
    expect(result.text).toContain('<http://ex/named>');
    expect(result.text).toContain('<http://ex/graph>');
  });
});

describe('vendor adapter layer', () => {
  test('reports unsupported adapter formats and missing runtime dependencies clearly', async () => {
    await expect(parseRdfTextWithAdapters('x', { format: 'unsupported-format', runtime: {} }))
      .rejects.toThrow('Unsupported RDF parse format: unsupported-format');
    await expect(parseRdfTextWithAdapters('@prefix ex: <http://ex/> .', { format: 'turtle', runtime: {} }))
      .rejects.toThrow('N3 Parser runtime is not available.');
    await expect(parseRdfTextWithAdapters('{"@id":"http://ex/s"}', { format: 'jsonld', runtime: {} }))
      .rejects.toThrow('JSON-LD parser runtime library is not available.');
    await expect(parseRdfTextWithAdapters('<rdf:RDF />', { format: 'rdfxml', runtime: {} }))
      .rejects.toThrow('rdflib runtime library is not available.');
    await expect(serializeRdfDatasetWithAdapters([], { format: 'turtle', runtime: {} }))
      .rejects.toThrow('N3 Writer runtime is not available.');
  });

  test('parses and serializes N3-backed formats through an injected N3 runtime', async () => {
    const runtime = { N3: createMockN3Runtime() };
    const parsed = await parseRdfTextWithAdapters('<http://ex/s> <http://ex/p> "v" .', {
      format: 'turtle',
      runtime
    });

    expect(parsed.sourceFormat).toBe('turtle');
    expect(parsed.quads).toHaveLength(1);
    expect(parsed.prefixes).toEqual({ ex: 'http://ex/' });

    const serialized = await serializeRdfDatasetWithAdapters(parsed.dataset, {
      format: 'turtle',
      runtime,
      prefixes: { ex: 'http://ex/' }
    });
    expect(serialized).toEqual({
      text: '<http://ex/s> <http://ex/p> "v" .\n',
      format: 'turtle',
      mimeType: 'text/turtle',
      warnings: []
    });
  });

  test('serializes N3-backed formats when the runtime only exposes Writer', async () => {
    const runtime = {
      N3: {
        Writer: createMockN3Runtime().Writer
      }
    };

    const serialized = await serializeRdfDatasetWithAdapters([
      quad('http://ex/s', 'http://ex/p', 'v')
    ], {
      format: 'application/n-triples',
      runtime
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" .\n');
  });

  test('converts normalized RDF/JS quads through an N3 DataFactory before writer serialization', async () => {
    const serialized = await serializeRdfDatasetWithAdapters([
      quad('http://ex/s', 'http://ex/p', 'v')
    ], {
      format: 'text/turtle',
      runtime: { N3: createStrictMockN3Runtime() }
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" .\n');
  });

  test('serializes Turtle default graph output without graph names', async () => {
    const serialized = await serializeRdfDatasetWithAdapters([
      quad('http://ex/s', 'http://ex/p', 'v')
    ], {
      format: 'text/turtle',
      runtime: { N3: createGraphAwareMockN3Runtime() }
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" .\n');
  });

  test('serializes TriG named graph output with graph names preserved', async () => {
    const serialized = await serializeRdfDatasetWithAdapters([
      quad('http://ex/s', 'http://ex/p', 'v', 'http://ex/g')
    ], {
      format: 'application/trig',
      runtime: { N3: createGraphAwareMockN3Runtime() }
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" <http://ex/g> .\n');
  });

  test('serializes N-Triples by dropping graph names intentionally', () => {
    const serialized = serializeRdfDataset([
      quad('http://ex/s', 'http://ex/p', 'v', 'http://ex/g')
    ], {
      format: 'application/n-triples'
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" .\n');
  });

  test('serializes N-Quads by preserving graph names', () => {
    const serialized = serializeRdfDataset([
      quad('http://ex/s', 'http://ex/p', 'v', 'http://ex/g')
    ], {
      format: 'application/n-quads'
    });

    expect(serialized.text).toBe('<http://ex/s> <http://ex/p> "v" <http://ex/g> .\n');
  });

  test('parses line-based RDF without requiring N3 Parser from a partial runtime', async () => {
    const parsed = await parseRdfTextWithAdapters('<http://ex/s> <http://ex/p> "v" .', {
      format: 'application/n-triples',
      runtime: {
        N3: {
          Writer: createMockN3Runtime().Writer
        }
      }
    });

    expect(parsed.quads).toHaveLength(1);
    expect(parsed.quads[0].object.value).toBe('v');
  });

  test('parses and serializes JSON-LD through injected jsonld plus N3 runtimes', async () => {
    const runtime = {
      N3: createMockN3Runtime(),
      jsonld: {
        toRDF: jest.fn(async () => '<http://ex/s> <http://ex/p> "v" .\n'),
        fromRDF: jest.fn(async () => [{ '@id': 'http://ex/s', 'http://ex/p': [{ '@value': 'v' }] }]),
        compact: jest.fn(async (expanded, context) => ({ '@context': context, '@graph': expanded }))
      }
    };

    const parsed = await parseRdfTextWithAdapters('{"@id":"http://ex/s"}', {
      format: 'jsonld',
      runtime
    });
    expect(parsed.sourceFormat).toBe('jsonld');
    expect(parsed.quads).toHaveLength(1);
    expect(runtime.jsonld.toRDF).toHaveBeenCalled();

    const serialized = await serializeRdfDatasetWithAdapters(parsed.dataset, {
      format: 'jsonld',
      runtime,
      context: { p: 'http://ex/p' }
    });
    expect(JSON.parse(serialized.text)).toEqual({
      '@context': { p: 'http://ex/p' },
      '@graph': [{ '@id': 'http://ex/s', 'http://ex/p': [{ '@value': 'v' }] }]
    });
    expect(runtime.jsonld.fromRDF).toHaveBeenCalledWith(expect.stringContaining('<http://ex/s>'), { format: 'application/n-quads' });
  });

  test('parses and serializes RDF/XML through an injected rdflib runtime', async () => {
    const runtime = { $rdf: createMockRdflibRuntime() };
    const parsed = await parseRdfTextWithAdapters('<rdf:RDF />', {
      format: 'rdfxml',
      runtime,
      baseIri: 'http://ex/base'
    });

    expect(parsed.sourceFormat).toBe('rdfxml');
    expect(parsed.quads).toHaveLength(1);
    expect(parsed.quads[0]).toEqual(expect.objectContaining({
      subject: namedNode('http://ex/s'),
      predicate: namedNode('http://ex/p')
    }));

    const serialized = await serializeRdfDatasetWithAdapters(parsed.dataset, {
      format: 'rdfxml',
      runtime,
      baseIri: 'http://ex/base',
      prefixes: { ex: 'http://ex/' }
    });
    expect(serialized.text).toBe('<rdf:RDF />');
    expect(serialized.mimeType).toBe('application/rdf+xml');
  });

  test('expands rdflib Collection terms into RDF list quads', async () => {
    const runtime = {
      $rdf: {
        graph() {
          return { statements: [] };
        },
        parse(_text, graph, _baseIri, _mime, callback) {
          graph.statements.push({
            subject: { termType: 'NamedNode', value: 'http://ex/s' },
            predicate: { termType: 'NamedNode', value: 'http://ex/list' },
            object: {
              termType: 'Collection',
              value: 'items',
              elements: [
                { termType: 'NamedNode', value: 'http://ex/one' },
                { termType: 'NamedNode', value: 'http://ex/two' }
              ]
            }
          });
          callback(null);
        },
        serialize(_target, _graph, _baseIri, _mime, callback) {
          callback(null, '<rdf:RDF />');
        }
      }
    };

    const parsed = await parseRdfTextWithAdapters('<rdf:RDF />', {
      format: 'application/rdf+xml',
      runtime
    });

    expect(parsed.quads).toHaveLength(5);
    expect(parsed.quads).toEqual(expect.arrayContaining([
      expect.objectContaining({
        subject: expect.objectContaining({ value: 'items' }),
        predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'),
        object: namedNode('http://ex/one')
      }),
      expect.objectContaining({
        predicate: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'),
        object: namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
      })
    ]));
  });

  test('accepts rdflib serializers that return RDF/XML text synchronously', async () => {
    const runtime = {
      $rdf: {
        graph() {
          return {
            statements: [],
            add(subject, predicate, object) {
              this.statements.push({ subject, predicate, object });
            }
          };
        },
        parse(_text, graph, _baseIri, _mime, callback) {
          graph.statements.push({
            subject: { termType: 'NamedNode', value: 'http://ex/s' },
            predicate: { termType: 'NamedNode', value: 'http://ex/p' },
            object: { termType: 'Literal', value: 'v' }
          });
          callback(null);
        },
        serialize(_target, graph) {
          expect(graph.statements).toHaveLength(1);
          return '<rdf:RDF />';
        },
        sym(value) {
          return { termType: 'NamedNode', value };
        },
        literal(value, language, datatype) {
          return { termType: 'Literal', value, language: language || '', datatype };
        },
        blankNode(value) {
          return { termType: 'BlankNode', value };
        }
      }
    };

    const parsed = await parseRdfTextWithAdapters('<rdf:RDF />', {
      format: 'rdfxml',
      runtime
    });
    const serialized = await serializeRdfDatasetWithAdapters(parsed.dataset, {
      format: 'rdfxml',
      runtime
    });

    expect(serialized.text).toBe('<rdf:RDF />');
  });
});

function createMockN3Runtime() {
  class Store {
    constructor() {
      this.items = [];
    }
    addQuad(item) {
      this.items.push(item);
    }
    addQuads(items) {
      this.items.push(...items);
    }
    getQuads() {
      return this.items.slice();
    }
    [Symbol.iterator]() {
      return this.items[Symbol.iterator]();
    }
  }

  return {
    Store,
    Parser: class {
      constructor() {
        this._prefixes = { ex: 'http://ex/' };
      }
      parse() {
        return [quad('http://ex/s', 'http://ex/p', 'v')];
      }
    },
    Writer: class {
      constructor() {
        this.items = [];
      }
      addQuads(items) {
        this.items.push(...items);
      }
      end(callback) {
        callback(null, serializeRdfDatasetToNQuads(this.items).replace(/ <[^>]+> \./g, ' .'));
      }
    }
  };
}

function createStrictMockN3Runtime() {
  const dataFactory = {
    fromQuad: () => {
      throw new Error('fromQuad should not be used for plain normalized RDF/JS quads');
    },
    namedNode: (value) => ({ termType: 'NamedNode', value, __n3Term: true }),
    blankNode: (value) => ({ termType: 'BlankNode', value, __n3Term: true }),
    defaultGraph: () => ({ termType: 'DefaultGraph', value: '', __n3Term: true }),
    literal: (value, languageOrDatatype) => ({
      termType: 'Literal',
      value,
      language: typeof languageOrDatatype === 'string' ? languageOrDatatype : '',
      datatype: typeof languageOrDatatype === 'object' ? languageOrDatatype : undefined,
      __n3Term: true
    }),
    quad: (subject, predicate, object, graph) => ({
      subject,
      predicate,
      object,
      graph,
      __n3Quad: true
    })
  };

  return {
    DataFactory: dataFactory,
    Store: class {
      constructor(items = []) {
        this.items = [...items];
      }
      addQuads(items) {
        this.items.push(...items);
      }
      getQuads(_subject, _predicate, _object, graph) {
        if (!graph) return [...this.items];
        return this.items.filter((item) =>
          item.graph?.termType === graph.termType
          && item.graph?.value === graph.value
        );
      }
    },
    Writer: class {
      constructor() {
        this.items = [];
      }
      addQuads(items) {
        this.items.push(...items);
      }
      end(callback) {
        const allConverted = this.items.every((item) =>
          item.__n3Quad
          && item.subject.__n3Term
          && item.predicate.__n3Term
          && item.object.__n3Term
          && item.graph.__n3Term
        );
        callback(null, allConverted ? '<http://ex/s> <http://ex/p> "v" .\n' : '');
      }
    }
  };
}

function createGraphAwareMockN3Runtime() {
  const dataFactory = {
    namedNode: (value) => ({ termType: 'NamedNode', value }),
    blankNode: (value) => ({ termType: 'BlankNode', value }),
    defaultGraph: () => ({ termType: 'DefaultGraph', value: '' }),
    literal: (value, languageOrDatatype) => ({
      termType: 'Literal',
      value,
      language: typeof languageOrDatatype === 'string' ? languageOrDatatype : '',
      datatype: typeof languageOrDatatype === 'object' ? languageOrDatatype : undefined
    }),
    quad: (subject, predicate, object, graph) => ({
      subject,
      predicate,
      object,
      graph
    })
  };

  return {
    DataFactory: dataFactory,
    Store: class {
      constructor(items = []) {
        this.items = [...items];
      }
      addQuads(items) {
        this.items.push(...items);
      }
      getQuads(_subject, _predicate, _object, graph) {
        if (!graph) return [...this.items];
        return this.items.filter((item) =>
          item.graph?.termType === graph.termType
          && item.graph?.value === graph.value
        );
      }
    },
    Writer: class {
      constructor() {
        this.items = [];
      }
      addQuads(items) {
        this.items.push(...items);
      }
      end(callback) {
        const lines = this.items.map((item) => {
          const graph = item.graph?.termType && item.graph.termType !== 'DefaultGraph'
            ? ` ${termToGraphAwareText(item.graph)}`
            : '';
          return `${termToGraphAwareText(item.subject)} ${termToGraphAwareText(item.predicate)} ${termToGraphAwareText(item.object)}${graph} .`;
        });
        callback(null, `${lines.join('\n')}${lines.length ? '\n' : ''}`);
      }
    }
  };
}

function createMixedGraphDataset(runtime) {
  return new runtime.N3.Store([
    quad('http://ex/default', 'http://ex/p', 'default'),
    quad('http://ex/named', 'http://ex/p', namedNode('http://ex/o'), 'http://ex/graph')
  ]);
}

function termToGraphAwareText(term) {
  if (term.termType === 'Literal') return `"${term.value}"`;
  return `<${term.value}>`;
}

function createMockRdflibRuntime() {
  return {
    graph() {
      return {
        statements: [],
        add(subject, predicate, object) {
          this.statements.push({ subject, predicate, object });
        },
        setPrefixForURI(prefix, iri) {
          this.prefixes = { ...(this.prefixes || {}), [prefix]: iri };
        }
      };
    },
    parse(_text, graph, _baseIri, _mime, callback) {
      graph.statements.push({
        subject: { termType: 'NamedNode', value: 'http://ex/s' },
        predicate: { termType: 'NamedNode', value: 'http://ex/p' },
        object: { termType: 'Literal', value: 'v', datatype: { value: 'http://www.w3.org/2001/XMLSchema#string' } }
      });
      callback(null);
    },
    serialize(_target, _graph, _baseIri, _mime, callback) {
      callback(null, '<rdf:RDF />');
    },
    sym(value) {
      return { termType: 'NamedNode', value };
    },
    literal(value, language, datatype) {
      return { termType: 'Literal', value, language: language || '', datatype };
    },
    blankNode(value) {
      return { termType: 'BlankNode', value };
    }
  };
}
