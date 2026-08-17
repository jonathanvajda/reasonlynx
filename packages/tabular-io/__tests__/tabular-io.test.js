import {
  createIriMappingFromRows,
  applyHeaderRowOptions,
  detectCsvOrTsvDelimiter,
  escapeDelimitedCell,
  parseDelimitedLine,
  parseDelimitedText,
  parseDelimitedTextAsHeaderRows,
  parseQueryRecordsFromDelimitedText,
  serializeDelimitedRecords,
  serializeDelimitedRows,
  serializeQueryRecordsToDelimitedText
} from '../src/index.js';

describe('delimited text parsing', () => {
  test('detectCsvOrTsvDelimiter prefers tabs when more tabs than commas', () => {
    expect(detectCsvOrTsvDelimiter('a,b,c')).toBe(',');
    expect(detectCsvOrTsvDelimiter('a\tb\tc')).toBe('\t');
  });

  test('parseDelimitedLine supports quotes and escaped quotes', () => {
    expect(parseDelimitedLine('a,"b,c",d', ',')).toEqual(['a', 'b,c', 'd']);
    expect(parseDelimitedLine('"a""b",c', ',')).toEqual(['a"b', 'c']);
  });

  test('parseDelimitedTextAsHeaderRows returns Table Nova header plus rows shape', () => {
    const parsed = parseDelimitedTextAsHeaderRows('first,last\nAda,Lovelace\nAlan,Turing\n', ',');
    expect(parsed.header).toEqual(['first', 'last']);
    expect(parsed.rows).toEqual([['Ada', 'Lovelace'], ['Alan', 'Turing']]);
  });

  test('applyHeaderRowOptions can choose a later 1-based header row', () => {
    const parsed = parseDelimitedTextAsHeaderRows('Report export\nGenerated today\nfirst,last\nAda,Lovelace\n', ',');
    const out = applyHeaderRowOptions(parsed, true, 3);
    expect(out.header).toEqual(['first', 'last']);
    expect(out.rows).toEqual([['Ada', 'Lovelace']]);
    expect(applyHeaderRowOptions(parsed, false, 2)).toBe(parsed);
  });

  test('parses quoted commas, escaped quotes, and embedded newlines', () => {
    const parsed = parseDelimitedText('name,note\nAda,"hello, world"\nGrace,"line 1\nline ""2"""');
    expect(parsed.headers).toEqual(['name', 'note']);
    expect(parsed.rows).toEqual([
      ['Ada', 'hello, world'],
      ['Grace', 'line 1\nline "2"']
    ]);
    expect(parsed.records[1]).toEqual({ name: 'Grace', note: 'line 1\nline "2"' });
    expect(parsed.warnings).toEqual([]);
  });

  test('normalizes BOMs, duplicate headers, short rows, and wide rows with warnings', () => {
    const parsed = parseDelimitedText('\ufeffid,id,\n1\n2,3,4,5', { trimCells: true });
    expect(parsed.headers).toEqual(['id', 'id_2', 'column_3']);
    expect(parsed.rows).toEqual([
      ['1', '', ''],
      ['2', '3', '4']
    ]);
    expect(parsed.warnings.map((warning) => warning.code)).toEqual([
      'duplicate_header',
      'blank_header',
      'short_row',
      'wide_row'
    ]);
  });

  test('parses TSV without headers and generates column names', () => {
    const parsed = parseDelimitedText('a\tb\nc\td', { delimiter: '\t', hasHeader: false });
    expect(parsed.headers).toEqual(['column_1', 'column_2']);
    expect(parsed.records).toEqual([
      { column_1: 'a', column_2: 'b' },
      { column_1: 'c', column_2: 'd' }
    ]);
  });

  test('warns on unterminated quoted cells', () => {
    const parsed = parseDelimitedText('id,note\n1,"open');
    expect(parsed.rows).toEqual([['1', 'open']]);
    expect(parsed.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unterminated_quote', row: 2 })
    ]));
  });
});

describe('delimited text serialization', () => {
  test('escapes cells only when needed by default', () => {
    expect(escapeDelimitedCell('plain')).toBe('plain');
    expect(escapeDelimitedCell('a,b')).toBe('"a,b"');
    expect(escapeDelimitedCell('a"b')).toBe('"a""b"');
    expect(escapeDelimitedCell('a\nb')).toBe('"a\nb"');
  });

  test('serializes rows with CRLF and quote-all options', () => {
    const csv = serializeDelimitedRows([
      ['id', 'note'],
      ['1', 'plain']
    ], { newline: '\r\n', quoteAll: true, trailingNewline: false });
    expect(csv).toBe('"id","note"\r\n"1","plain"');
  });

  test('serializes records with explicit header order', () => {
    const csv = serializeDelimitedRecords([
      { b: 'two', a: 'one' }
    ], { headers: ['a', 'b'] });
    expect(csv).toBe('a,b\none,two\n');
  });
});

describe('query record exchange', () => {
  test('serializes and parses SQL, SPARQL, and NoSQL query records', () => {
    const csv = serializeQueryRecordsToDelimitedText([
      {
        queryId: 'q1',
        queryLabel: 'Classes',
        queryLanguage: 'SPARQL',
        queryText: 'SELECT * WHERE { ?s ?p ?o }',
        queryKind: 'select',
        tags: ['rdf', 'demo']
      },
      {
        queryId: 'q2',
        queryLabel: 'Active users',
        queryLanguage: 'SQL',
        queryText: 'select * from users where active = 1'
      },
      {
        queryId: 'q3',
        queryLabel: 'Documents',
        queryLanguage: 'MongoDB',
        queryText: 'db.docs.find({})'
      }
    ]);
    const parsed = parseQueryRecordsFromDelimitedText(csv);
    expect(parsed.records.map((record) => record.queryLanguage)).toEqual(['sparql', 'sql', 'mongodb']);
    expect(parsed.records[0].tags).toEqual(['rdf', 'demo']);
    expect(parsed.warnings).toEqual([]);
  });

  test('accepts Axiolotl legacy saved-query headers with an explicit language default', () => {
    const csv = 'query ID (IRI),label,type (class iri),value (\'has sparql query text value\')\nq1,Ask,type:Saved,ASK {}';
    const parsed = parseQueryRecordsFromDelimitedText(csv, { defaultQueryLanguage: 'sparql' });
    expect(parsed.records).toEqual([
      expect.objectContaining({
        queryId: 'q1',
        queryLabel: 'Ask',
        queryLanguage: 'sparql',
        queryKind: 'type:Saved',
        queryText: 'ASK {}'
      })
    ]);
  });

  test('round-trips saved query CSV fields containing commas, quotes, and newlines', () => {
    const csv = serializeQueryRecordsToDelimitedText([{
      queryId: 'q,1',
      queryLabel: 'Quoted "query"',
      queryLanguage: 'sparql',
      queryText: 'SELECT * WHERE {\n  ?s ?p "literal, value" .\n}',
      queryKind: 'type:Saved'
    }], {
      trailingNewline: false,
      defaultQueryLanguage: 'sparql'
    });

    expect(csv).toContain('"q,1"');
    expect(csv).toContain('"Quoted ""query"""');

    const parsed = parseQueryRecordsFromDelimitedText(csv, { defaultQueryLanguage: 'sparql' });
    expect(parsed.records).toEqual([
      expect.objectContaining({
        queryId: 'q,1',
        queryLabel: 'Quoted "query"',
        queryLanguage: 'sparql',
        queryText: 'SELECT * WHERE {\n  ?s ?p "literal, value" .\n}',
        queryKind: 'type:Saved'
      })
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  test('warns and skips rows missing required query text', () => {
    const parsed = parseQueryRecordsFromDelimitedText('query_id,query_language,query_text\nq1,sql,\nq2,sql,select 1');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].queryId).toBe('q2');
    expect(parsed.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_query_text', row: 2 })
    ]));
  });

  test('parses TSV query exchange and warns without skipping unknown query languages', () => {
    const parsed = parseQueryRecordsFromDelimitedText('query_id\tquery_language\tquery_text\ttags\nq1\tCustom Query\tbody\talpha; beta', {
      delimiter: '\t'
    });
    expect(parsed.records).toEqual([
      expect.objectContaining({
        queryId: 'q1',
        queryLanguage: 'customquery',
        queryText: 'body',
        tags: ['alpha', 'beta']
      })
    ]);
    expect(parsed.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unknown_query_language', row: 2 })
    ]));
  });
});

describe('IRI mapping row adapter', () => {
  test('creates mappings from parsed row records with last duplicate policy', () => {
    const result = createIriMappingFromRows([
      { 'Old IRI': '<http://old>', 'New IRI': '<http://new>' },
      { 'Old IRI': 'http://old', 'New IRI': 'http://newer' }
    ]);
    expect(result.mapping.get('http://old')).toBe('http://newer');
    expect(result.meta).toEqual({ rows: 2, uniqueOld: 1, duplicateOld: 1, skippedRows: 0 });
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'conflicting_mapping', row: 3 })
    ]));
  });

  test('can keep the first duplicate mapping and warn on missing row values', () => {
    const result = createIriMappingFromRows([
      { source: 'http://a', target: 'http://b' },
      { source: 'http://a', target: 'http://c' },
      { source: '', target: 'http://d' }
    ], {
      oldIriHeaders: ['source'],
      newIriHeaders: ['target'],
      duplicatePolicy: 'first'
    });
    expect(result.mapping.get('http://a')).toBe('http://b');
    expect(result.meta).toEqual({ rows: 3, uniqueOld: 1, duplicateOld: 1, skippedRows: 1 });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      'conflicting_mapping',
      'missing_mapping_value'
    ]);
  });

  test('throws when mapping headers are missing or duplicate policy is error', () => {
    expect(() => createIriMappingFromRows([{ old: 'a', newer: 'b' }]))
      .toThrow('Mapping rows must include old and new IRI columns.');
    expect(() => createIriMappingFromRows([
      { 'old iri': 'a', 'new iri': 'b' },
      { 'old iri': 'a', 'new iri': 'c' }
    ], { duplicatePolicy: 'error' })).toThrow('Conflicting mapping for "a"');
    expect(() => createIriMappingFromRows([
      { 'old iri': 'a', 'new iri': 'b' }
    ], { duplicatePolicy: 'overwrite' })).toThrow('Unsupported IRI mapping duplicate policy: overwrite');
  });
});
