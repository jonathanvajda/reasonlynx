import {
  buildSparqlRewritePreviewRows,
  buildSparqlGraphModelFromAst,
  buildSparqlUpdatePreviewConstructs,
  classifySparqlOperationFamily,
  countAppliedSparqlIriRewrites,
  createSparqlAstTermKey,
  extractSelectedVariableKeysFromSparqlAst,
  extractSparqlPrologueDeclarations,
  extractSparqlRewriteTokens,
  extractWhereTriplesFromSparqlAst,
  formatSparqlAstTermLabel,
  formatSparqlIriToken,
  formatSparqlPrefixDeclarations,
  parseSparqlQueryToAst,
  prependSparqlPrologue,
  readBalancedSparqlBraceBlock,
  applySparqlUpdateToQuadStore,
  rdfJsQuadsToQuadRows,
  rewriteSparqlIris,
  scanSparqlLexicalTokens,
  splitSparqlPrologueFromBody,
  stripSparqlLineComments
} from '../src/index.js';

describe('sparql-utils prologue handling', () => {
  test('extracts namespace prefixes and keeps BASE separate from prefix maps', () => {
    const query = [
      'BASE <http://example.org/base/>',
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'PREFIX ex: <http://example.org/>',
      '',
      'SELECT * WHERE { ex:a rdfs:label ?label }'
    ].join('\n');

    const result = extractSparqlPrologueDeclarations(query);

    expect(result.ok).toBe(true);
    expect(result.baseIri).toBe('http://example.org/base/');
    expect(result.prefixes).toEqual({
      ex: 'http://example.org/',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#'
    });
    expect(result.bodyText).toBe('SELECT * WHERE { ex:a rdfs:label ?label }');
  });

  test('formats and prepends sorted prefix declarations', () => {
    const formatted = formatSparqlPrefixDeclarations({
      skos: 'http://www.w3.org/2004/02/skos/core#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    });
    const prepended = prependSparqlPrologue('ASK { ?s ?p ?o }', {
      skos: 'http://www.w3.org/2004/02/skos/core#',
      rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
    });

    expect(formatted.value).toBe([
      'PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>',
      'PREFIX skos: <http://www.w3.org/2004/02/skos/core#>'
    ].join('\n'));
    expect(prepended.value).toContain('ASK { ?s ?p ?o }');
  });

  test('splits only leading prologue declarations from body text', () => {
    const result = splitSparqlPrologueFromBody([
      'PREFIX ex: <http://example.org/>',
      'SELECT * WHERE {',
      '  ?s ?p ?o .',
      '}'
    ].join('\n'));

    expect(result.prologueText).toBe('PREFIX ex: <http://example.org/>');
    expect(result.bodyText).toBe('SELECT * WHERE {\n  ?s ?p ?o .\n}');
  });
});

describe('sparql-utils lexical scanning', () => {
  test('extracts IRI refs and prefixed names while ignoring comments and strings', () => {
    const query = [
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'SELECT * WHERE {',
      '  ?s rdfs:label "do not stage skos:prefLabel" .',
      '  # do not stage owl:Class',
      '  ?s <http://example.org/p> ?o .',
      '}'
    ].join('\n');

    const result = scanSparqlLexicalTokens(query);

    expect(result.iriRefs).toContain('http://www.w3.org/2000/01/rdf-schema#');
    expect(result.iriRefs).toContain('http://example.org/p');
    expect(result.prefixedNames).toContain('rdfs:label');
    expect(result.prefixedNames).not.toContain('skos:prefLabel');
    expect(result.prefixedNames).not.toContain('owl:Class');
  });

  test('strips comments without removing hash fragments or quoted hashes', () => {
    const query = '<http://example.org/a#frag> "literal # text" . # comment';

    expect(stripSparqlLineComments(query)).toBe('<http://example.org/a#frag> "literal # text" . ');
  });

  test('reads balanced brace blocks and ignores braces in strings', () => {
    const result = readBalancedSparqlBraceBlock('{ ?s ?p "{not a block}" . OPTIONAL { ?s ?p ?o } }', 0);

    expect(result.ok).toBe(true);
    expect(result.content).toContain('OPTIONAL { ?s ?p ?o }');
  });
});

describe('sparql-utils query kind', () => {
  test('classifies read and update operations after comments and prologue', () => {
    expect(classifySparqlOperationFamily('PREFIX ex: <http://example.org/>\n# comment\nSELECT * WHERE {}')).toBe('READ');
    expect(classifySparqlOperationFamily('PREFIX ex: <http://example.org/>\nINSERT DATA { ex:a ex:b ex:c }')).toBe('UPDATE');
    expect(classifySparqlOperationFamily('')).toBe('UNKNOWN');
  });
});

describe('sparql-utils IRI rewrite', () => {
  const prefixes = {
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    ex: 'http://example.org/'
  };

  test('extracts rewrite tokens from body but not prefix declarations', () => {
    const query = [
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'PREFIX ex: <http://example.org/>',
      'SELECT * WHERE { ex:a rdfs:label ?label }'
    ].join('\n');

    const result = extractSparqlRewriteTokens(query, prefixes);

    expect(result.tokens).toEqual([
      { token: 'ex:a', kind: 'PrefixedName', expandedIri: 'http://example.org/a' },
      { token: 'rdfs:label', kind: 'PrefixedName', expandedIri: 'http://www.w3.org/2000/01/rdf-schema#label' }
    ]);
  });

  test('builds rewrite preview rows for direct IRI and prefix-namespace mappings', () => {
    const mapping = new Map([
      ['http://www.w3.org/2000/01/rdf-schema#label', 'http://www.w3.org/2000/01/rdf-schema#comment']
    ]);

    const result = buildSparqlRewritePreviewRows({
      prefixes,
      tokens: [{ token: 'rdfs:label', kind: 'PrefixedName', expandedIri: 'http://www.w3.org/2000/01/rdf-schema#label' }]
    }, mapping);

    expect(result.proposedChangeCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      targetIri: 'http://www.w3.org/2000/01/rdf-schema#comment',
      status: 'Change'
    });
  });

  test('rewrites prefix declarations, IRI refs, and prefixed names without touching strings or comments', () => {
    const query = [
      'PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
      'PREFIX ex: <http://example.org/>',
      'SELECT * WHERE {',
      '  ?s rdfs:label "rdfs:label should stay literal" .',
      '  # rdfs:label should stay comment',
      '  <http://example.org/a> rdfs:label ?label .',
      '}'
    ].join('\n');
    const mapping = new Map([
      ['http://www.w3.org/2000/01/rdf-schema#label', 'http://www.w3.org/2000/01/rdf-schema#comment'],
      ['http://example.org/a', 'http://example.org/b']
    ]);

    const result = rewriteSparqlIris(query, prefixes, mapping);

    expect(result.value).toContain('rdfs:comment ?label');
    expect(result.value).toContain('<http://example.org/b>');
    expect(result.value).toContain('"rdfs:label should stay literal"');
    expect(result.value).toContain('# rdfs:label should stay comment');
    expect(countAppliedSparqlIriRewrites(result)).toBe(3);
  });

  test('formats target IRIs as prefixed names when active prefixes support them', () => {
    expect(formatSparqlIriToken('http://www.w3.org/2000/01/rdf-schema#comment', prefixes)).toBe('rdfs:comment');
    expect(formatSparqlIriToken('http://other.example/x', prefixes)).toBe('<http://other.example/x>');
  });
});

describe('sparql-utils query pattern extraction', () => {
  const ast = {
    queryType: 'SELECT',
    prefixes: { foaf: 'http://xmlns.com/foaf/0.1/' },
    variables: [{ termType: 'Variable', value: 'person' }],
    where: [
      {
        type: 'bgp',
        triples: [
          {
            subject: { termType: 'Variable', value: 'person' },
            predicate: { termType: 'NamedNode', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type' },
            object: { termType: 'NamedNode', value: 'http://xmlns.com/foaf/0.1/Person' }
          }
        ]
      },
      {
        type: 'optional',
        patterns: [{
          type: 'bgp',
          triples: [{
            subject: { termType: 'Variable', value: 'person' },
            predicate: { termType: 'NamedNode', value: 'http://xmlns.com/foaf/0.1/name' },
            object: { termType: 'Literal', value: 'Alice', language: 'en' }
          }]
        }]
      }
    ]
  };

  test('extracts selected variables and recursive WHERE triples', () => {
    expect([...extractSelectedVariableKeysFromSparqlAst(ast)]).toEqual(['var:?person']);
    expect(extractWhereTriplesFromSparqlAst(ast.where)).toHaveLength(2);
  });

  test('creates graph models from SPARQL.js AST-shaped objects', () => {
    const graph = buildSparqlGraphModelFromAst(ast);

    expect(graph.whereTripleCount).toBe(2);
    expect(graph.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'var:?person', isSelectedVar: true, category: 'variable' }),
      expect.objectContaining({ id: 'iri:http://xmlns.com/foaf/0.1/Person', category: 'class' })
    ]));
    expect(graph.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'rdfType' }),
      expect.objectContaining({ category: 'datatypeProp' })
    ]));
  });

  test('formats stable SPARQL AST term keys and labels', () => {
    expect(createSparqlAstTermKey({ termType: 'Variable', value: 'x' })).toBe('var:?x');
    expect(formatSparqlAstTermLabel({
      termType: 'Literal',
      value: 'Alice',
      language: 'en',
      datatype: { termType: 'NamedNode', value: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString' }
    }, {})).toContain('"Alice"@en');
  });

  test('parses SPARQL query text through an explicitly injected parser runtime', () => {
    const parseCalls = [];
    class MockParser {
      constructor(options) {
        this.options = options;
      }

      parse(text) {
        parseCalls.push([text, this.options]);
        return { queryType: 'ASK', sourceText: text };
      }
    }

    const ast = parseSparqlQueryToAst('ASK { ?s ?p ?o }', {
      Parser: MockParser,
      skipValidation: true
    });

    expect(ast).toEqual({ queryType: 'ASK', sourceText: 'ASK { ?s ?p ?o }' });
    expect(parseCalls).toEqual([['ASK { ?s ?p ?o }', { skipValidation: true }]]);
  });

  test('requires an explicit SPARQL.js parser runtime', () => {
    expect(() => parseSparqlQueryToAst('SELECT * WHERE { ?s ?p ?o }')).toThrow(
      'SPARQL.js Parser not found'
    );
  });
});

describe('sparql-utils update pattern implementation', () => {
  test('builds CONSTRUCT previews for INSERT/DELETE WHERE updates', () => {
    const previews = buildSparqlUpdatePreviewConstructs([
      'PREFIX ex: <http://example.org/>',
      'DELETE { ?s ex:old ?o }',
      'INSERT { ?s ex:new ?o }',
      'WHERE { ?s ex:old ?o }'
    ].join('\n'));

    expect(previews).toHaveLength(2);
    expect(previews[0]).toEqual(expect.objectContaining({
      label: 'Triples that would be deleted',
      query: expect.stringContaining('CONSTRUCT {  ?s ex:old ?o  } WHERE {  ?s ex:old ?o  }')
    }));
    expect(previews[1]).toEqual(expect.objectContaining({
      label: 'Triples that would be inserted',
      query: expect.stringContaining('CONSTRUCT {  ?s ex:new ?o  } WHERE {  ?s ex:old ?o  }')
    }));
  });

  test('builds CONSTRUCT preview for INSERT DATA', () => {
    const previews = buildSparqlUpdatePreviewConstructs('INSERT DATA { <s> <p> <o> . }');

    expect(previews).toEqual([{
      label: 'Triples that would be inserted',
      query: '\nCONSTRUCT {  <s> <p> <o> .  } WHERE {}'
    }]);
  });

  test('applies DELETE/INSERT WHERE updates through injected quad-store adapters', async () => {
    const calls = [];
    const adapters = {
      runConstructQuery: async (_query, { operation }) => operation === 'delete' ? 'delete result' : 'insert result',
      parseConstructResult: async (_text, { operation }) => ({
        quads: [createMockQuad({
          subject: 'http://example.org/a',
          predicate: operation === 'delete' ? 'http://example.org/old' : 'http://example.org/new',
          object: 'literal with spaces',
          datatype: 'http://www.w3.org/2001/XMLSchema#string'
        })]
      }),
      deleteQuadRows: async (rows, context) => {
        calls.push({ type: 'delete', rows, context });
        return rows.length;
      },
      insertQuadRows: async (rows, context) => {
        calls.push({ type: 'insert', rows, context });
        return rows.length;
      }
    };

    const result = await applySparqlUpdateToQuadStore([
      'PREFIX ex: <http://example.org/>',
      'DELETE { ?s ex:old ?o }',
      'INSERT { ?s ex:new ?o }',
      'WHERE { ?s ex:old ?o }'
    ].join('\n'), adapters);

    expect(result).toMatchObject({ deleted: 1, inserted: 1, graphIri: '(default graph)' });
    expect(calls[0].rows[0]).toMatchObject({
      subject: 'http://example.org/a',
      predicate: 'http://example.org/old',
      object: 'literal with spaces',
      objectType: 'Literal',
      objectDatatype: 'http://www.w3.org/2001/XMLSchema#string',
      graph: ''
    });
    expect(calls[1].rows[0].predicate).toBe('http://example.org/new');
  });

  test('overrides inserted graph when committing to a named graph', async () => {
    const insertedRows = [];
    const result = await applySparqlUpdateToQuadStore('INSERT DATA { <s> <p> <o> . }', {
      runConstructQuery: async () => 'insert result',
      parseConstructResult: async () => ({
        quads: [createMockQuad({ subject: 's', predicate: 'p', object: 'o', objectType: 'NamedNode' })]
      }),
      deleteQuadRows: async () => 0,
      insertQuadRows: async (rows) => {
        insertedRows.push(...rows);
        return rows.length;
      }
    }, {
      targetMode: 'named',
      graphIri: 'http://example.org/target-graph'
    });

    expect(result).toMatchObject({ inserted: 1, graphIri: 'http://example.org/target-graph' });
    expect(insertedRows[0].graph).toBe('http://example.org/target-graph');
  });

  test('converts RDFJS quads to quad rows without N-Triples string parsing', () => {
    expect(rdfJsQuadsToQuadRows([
      createMockQuad({
        subject: 'http://example.org/s',
        predicate: 'http://example.org/p',
        object: 'text value',
        datatype: 'http://www.w3.org/2001/XMLSchema#string',
        graph: 'http://example.org/g'
      })
    ])).toEqual([expect.objectContaining({
      subject: 'http://example.org/s',
      predicate: 'http://example.org/p',
      object: 'text value',
      objectType: 'Literal',
      objectDatatype: 'http://www.w3.org/2001/XMLSchema#string',
      graph: 'http://example.org/g'
    })]);
  });

  test('rejects unsupported administrative updates before invoking adapters', async () => {
    const calls = [];
    await expect(applySparqlUpdateToQuadStore('CLEAR GRAPH <http://example.org/g>', {
      runConstructQuery: async () => calls.push('runConstructQuery'),
      parseConstructResult: async () => calls.push('parseConstructResult'),
      deleteQuadRows: async () => calls.push('deleteQuadRows'),
      insertQuadRows: async () => calls.push('insertQuadRows')
    })).rejects.toThrow('Unsupported UPDATE shape for quad-store materialization');
    expect(calls).toEqual([]);
  });
});

function createMockQuad({
  subject,
  predicate,
  object,
  objectType = 'Literal',
  datatype = '',
  graph = ''
}) {
  return {
    subject: { termType: 'NamedNode', value: subject },
    predicate: { termType: 'NamedNode', value: predicate },
    object: objectType === 'NamedNode'
      ? { termType: 'NamedNode', value: object }
      : {
          termType: 'Literal',
          value: object,
          language: '',
          datatype: { termType: 'NamedNode', value: datatype || 'http://www.w3.org/2001/XMLSchema#string' }
        },
    graph: graph
      ? { termType: 'NamedNode', value: graph }
      : { termType: 'DefaultGraph', value: '' }
  };
}
