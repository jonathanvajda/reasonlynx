import test from 'node:test';
import assert from 'node:assert/strict';
import { compareTriples, createCombinedRows, createSparqlUpdate } from '../app/diff-engine.js';

const nn = (value) => ({ termType: 'NamedNode', value });
const lit = (value, language = '', datatype = 'http://www.w3.org/2001/XMLSchema#string') => ({ termType: 'Literal', value, language, datatype: nn(datatype) });
const triple = (subject, predicate, object) => ({ subject: nn(subject), predicate: nn(predicate), object, graph: { termType: 'DefaultGraph', value: '' } });
const bnTriple = (subject, predicate, object) => ({ subject: { termType: 'BlankNode', value: subject }, predicate: nn(predicate), object, graph: { termType: 'DefaultGraph', value: '' } });

test('compares sets independent of order and duplicates', () => {
  const a = triple('urn:s', 'urn:p', nn('urn:o'));
  const diff = compareTriples([a, a], [a]);
  assert.equal(diff.left.length, 1);
  assert.equal(diff.unchanged.length, 1);
  assert.equal(diff.added.length, 0);
  assert.equal(createCombinedRows(diff).length, 0);
});

test('recognizes unambiguous literal and language changes as modifications', () => {
  const before = triple('urn:s', 'urn:label', lit('Name', 'en'));
  const after = triple('urn:s', 'urn:label', lit('Name', 'fr'));
  const diff = compareTriples([before], [after]);
  assert.equal(diff.modifications.length, 1);
  assert.equal(diff.removed.length, 0);
  assert.equal(createCombinedRows(diff)[0].previousObject, '"Name"@en');
});

test('SPARQL update contains raw delete and insert for modifications', () => {
  const diff = compareTriples([triple('urn:s', 'urn:p', lit('old'))], [triple('urn:s', 'urn:p', lit('new'))]);
  const update = createSparqlUpdate(diff);
  assert.match(update, /DELETE/);
  assert.match(update, /"old"/);
  assert.match(update, /INSERT DATA/);
  assert.match(update, /"new"/);
});

test('rejects named graphs', () => {
  const item = triple('urn:s', 'urn:p', nn('urn:o'));
  item.graph = nn('urn:g');
  assert.throws(() => compareTriples([item], []), /Named graphs/);
});

test('ignores equivalent blank-node structures with different labels', () => {
  const left = [bnTriple('left1', 'urn:name', lit('A')), triple('urn:root', 'urn:has', { termType: 'BlankNode', value: 'left1' })];
  const right = [triple('urn:root', 'urn:has', { termType: 'BlankNode', value: 'right9' }), bnTriple('right9', 'urn:name', lit('A'))];
  const diff = compareTriples(left, right);
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.removed.length, 0);
  assert.deepEqual(diff.ignoredBlankNodeTriples, { left: 2, right: 2 });
});

test('ignores changes within blank-node structures', () => {
  const left = [bnTriple('old-id', 'urn:name', lit('A')), bnTriple('old-id', 'urn:status', lit('old')), triple('urn:root', 'urn:has', { termType: 'BlankNode', value: 'old-id' })];
  const right = [bnTriple('new-id', 'urn:name', lit('A')), bnTriple('new-id', 'urn:status', lit('new')), triple('urn:root', 'urn:has', { termType: 'BlankNode', value: 'new-id' })];
  const diff = compareTriples(left, right);
  assert.equal(diff.unchanged.length, 0);
  assert.equal(diff.modifications.length, 0);
  assert.equal(diff.removed.length, 0);
  assert.equal(diff.added.length, 0);
  assert.deepEqual(diff.ignoredBlankNodeTriples, { left: 3, right: 3 });
});

test('recognizes an unambiguous IRI object change', () => {
  const diff = compareTriples([triple('urn:s', 'urn:p', nn('urn:old'))], [triple('urn:s', 'urn:p', nn('urn:new'))]);
  assert.equal(diff.modifications.length, 1);
  assert.equal(diff.modifications[0].reason, 'object changed');
});

test('recognizes an unambiguous predicate change', () => {
  const diff = compareTriples([triple('urn:s', 'urn:oldP', nn('urn:o'))], [triple('urn:s', 'urn:newP', nn('urn:o'))]);
  assert.equal(diff.modifications.length, 1);
  assert.equal(diff.modifications[0].reason, 'predicate changed');
});

test('recognizes a unique multi-triple subject rename', () => {
  const left = [triple('urn:old', 'urn:p1', lit('A')), triple('urn:old', 'urn:p2', nn('urn:o'))];
  const right = [triple('urn:new', 'urn:p1', lit('A')), triple('urn:new', 'urn:p2', nn('urn:o'))];
  const diff = compareTriples(left, right);
  assert.equal(diff.modifications.length, 2);
  assert.ok(diff.modifications.every((item) => item.reason === 'subject changed'));
});

test('does not infer a subject rename from a single common triple', () => {
  const diff = compareTriples([triple('urn:old', 'urn:p', lit('A'))], [triple('urn:new', 'urn:p', lit('A'))]);
  assert.equal(diff.modifications.length, 0);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.added.length, 1);
});

test('projects an OWL restriction cardinality change without exposing blank-node rows', () => {
  const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const owl = 'http://www.w3.org/2002/07/owl#';
  const xsdInteger = 'http://www.w3.org/2001/XMLSchema#nonNegativeInteger';
  const restriction = (id, cardinality) => [
    triple('urn:Person', 'http://www.w3.org/2000/01/rdf-schema#subClassOf', { termType: 'BlankNode', value: id }),
    bnTriple(id, rdfType, nn(`${owl}Restriction`)),
    bnTriple(id, `${owl}onProperty`, nn('urn:hasChild')),
    bnTriple(id, `${owl}maxCardinality`, lit(String(cardinality), '', xsdInteger))
  ];
  const diff = compareTriples(restriction('old', 2), restriction('new', 3));
  assert.equal(diff.modifications.length, 1);
  assert.match(diff.modifications[0].after.predicate.displayValue, /Restriction\(urn:hasChild\).*maxCardinality/);
  assert.equal(createCombinedRows(diff).length, 1);
  const update = createSparqlUpdate(diff);
  assert.match(update, /owl#maxCardinality/);
  assert.doesNotMatch(update, /urn:ontology-diff:restriction/);
});
