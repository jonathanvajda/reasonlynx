import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { extractLibraryQueries, searchQueryLibrary, ontologyTerms, queryResourceIris, resourceMention } from '../../packages/sparql-utils/src/query-library.js';

const runtime = vm.createContext({});
vm.runInContext(readFileSync(new URL('../../vendor/sparqljs.umd.js', import.meta.url), 'utf8'), runtime);
const parse = text => new runtime.sparqljs.Parser().parse(text);
const query = 'PREFIX ex: <https://example.org/>\nSELECT * WHERE {\n# Retrieve phone number\nex:ont00001262 ex:designated_by ex:ont00001400 .\n}';
const make = (text = query) => ({ id: text, label: 'Example', query: text, iris: queryResourceIris(text, parse) });
const terms = ontologyTerms([
  { subject: 'https://example.org/ont00001262', predicate: 'http://www.w3.org/2000/01/rdf-schema#label', object: 'Telephone communications endpoint' },
  { subject: 'https://example.org/ont00001400', predicate: 'http://www.w3.org/2004/02/skos/core#altLabel', object: 'phone number' }
]);

test('normalizes raw, artifact, expanded and compact OKEA queries', () => {
  for (const payload of [query, { query }, { 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value': [{ '@value': query }] },
    { '@graph': [{ '@id': 'q', 'https://github.com/jonathanvajda/okea/has_sparql_query_text_value': [{ '@value': query }] }] },
    { '@context': { o: 'https://github.com/jonathanvajda/okea/', body: 'o:has_sparql_query_text_value' }, body: query }]) {
    assert.equal(extractLibraryQueries(payload).some(q => q.query === query), true);
  }
});
test('exact matches return line and span; fuzzy corrections rank below exact matches', () => {
  const exact = searchQueryLibrary([make()], 'phone')[0];
  assert.equal(exact.hits[0].lineIndex, 2);
  assert.equal(query.split('\n')[2].slice(exact.hits[0].start, exact.hits[0].end), 'phone');
  const fuzzy = searchQueryLibrary([make()], 'phonr')[0];
  assert.equal(fuzzy.hits[0].term, 'phone'); assert.ok(exact.score > fuzzy.score);
  assert.equal(searchQueryLibrary([make()], 'phonr', { fuzzy: false }).length, 0);
});
test('ontology search finds both resources via expanded CURIEs and labels', () => {
  const result = searchQueryLibrary([make()], 'phone', { terms })[0];
  assert.equal(result.resources.length, 2);
  const semanticOnly = searchQueryLibrary([make(query.replace('# Retrieve phone number', '# Example'))], 'phone', { terms })[0];
  assert.equal(semanticOnly.resources.length, 2); assert.equal(semanticOnly.hits.length, 0);
  assert.ok(resourceMention('ex:ont00001400 .', terms[1].iri, make().iris.prefixes));
  assert.equal(resourceMention('wrong:ont00001400 .', terms[1].iri, make().iris.prefixes), null);
});
test('declared prefixes, comments and string literals do not count as used resources', () => {
  const q = make('PREFIX ex: <https://example.org/>\nSELECT * WHERE { # ex:ont00001400\n?s ?p "https://example.org/ont00001400" . }');
  assert.equal(q.iris.has('https://example.org/ont00001400'), false);
  assert.equal(searchQueryLibrary([q], 'phone', { terms }).length, 0);
});
test('invalid queries remain searchable; result scores sort descending and empty input lists all', () => {
  const queries = [make('SELECT phonr'), make('SELECT phone')];
  const results = searchQueryLibrary(queries, 'phone');
  assert.ok(results[0].score > results[1].score);
  assert.equal(searchQueryLibrary(queries, '').length, 2);
  assert.equal(searchQueryLibrary(queries, 'unrelated').length, 0);
});

test('BASE, default prefixes, update IRIs, acronym annotations and serialized JSON-LD are supported', () => {
  const q = make('BASE <https://example.org/> PREFIX : <https://example.org/> INSERT DATA { :device :number <phone> . }');
  assert.ok(q.iris.has('https://example.org/phone'));
  const acronymTerms = ontologyTerms([{ subject: 'https://example.org/phone', predicate: 'https://www.commoncoreontologies.org/ont00001753', object: 'TCE' }]);
  assert.equal(searchQueryLibrary([q], 'tce', { terms: acronymTerms })[0].resources.length, 1);
  assert.ok(resourceMention(':phone;', 'https://example.org/phone', q.iris.prefixes));
  assert.equal(extractLibraryQueries(JSON.stringify({ query }))[0].query, query);
});


