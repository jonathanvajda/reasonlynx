import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { ANNOTATION_TYPES, createAnnotationQuads } from '../scripts/annotation-model.js';
import { DOCXHUND_TERMS } from '../scripts/docxhund-vocabulary.js';

const selection = Object.freeze({
  partIri: 'https://example.test/paragraph/1',
  exact: 'authorized employees',
  prefix: 'Only ',
  suffix: ' may enter.',
  start: 5,
  end: 25
});

function hasQuad(quads, subject, predicate, object) {
  return quads.some((item) =>
    item.subject.value === subject &&
    item.predicate.value === predicate &&
    item.object.value === object
  );
}

test('entity mention uses CCO is about', () => {
  const result = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.entityMention,
    selection,
    resourceIri: 'https://example.test/person/1',
    annotationIri: 'urn:annotation:1'
  });
  assert.ok(hasQuad(result.quads, result.targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, 'https://example.test/person/1'));
  assert.match(result.targetIri, /^urn:uuid:/);
  assert.ok(hasQuad(result.quads, result.targetIri, COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.cco2.informationContentEntity));
  assert.ok(hasQuad(result.quads, result.targetIri, COMMON_NAMESPACE_IRIS.rdf.type, DOCXHUND_TERMS.TextSelection));
  assert.equal(result.quads.some((item) =>
    item.predicate.value.startsWith('http://www.w3.org/ns/prov#') ||
    item.object.value.startsWith('http://www.w3.org/ns/prov#')
  ), false);
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.rdf.type, DOCXHUND_TERMS.DocumentAnnotationAct));
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.cco2.hasInput, selection.partIri));
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, result.targetIri));
  assert.ok(hasQuad(result.quads, result.actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, result.annotationIri));
});

test('annotation act records an explicit agent without inventing one', () => {
  const withoutAgent = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.entityMention, selection,
    resourceIri: 'https://example.test/person/1', annotationIri: 'urn:annotation:no-agent'
  });
  assert.equal(withoutAgent.quads.some((item) => item.predicate.value === COMMON_NAMESPACE_IRIS.cco2.hasAgent), false);
  const withAgent = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.entityMention, selection,
    resourceIri: 'https://example.test/person/1', annotationIri: 'urn:annotation:agent',
    agentIri: 'https://example.test/user/1'
  });
  assert.ok(hasQuad(withAgent.quads, withAgent.actIri, COMMON_NAMESPACE_IRIS.cco2.hasAgent, 'https://example.test/user/1'));
});

test('class mention creates an instance and makes the passage about it', () => {
  const result = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.classMention,
    selection,
    resourceIri: 'https://example.test/AuthorizedEmployee',
    annotationIri: 'urn:annotation:2'
  });
  assert.ok(result.generatedResourceIri);
  assert.ok(hasQuad(result.quads, result.generatedResourceIri, COMMON_NAMESPACE_IRIS.rdf.type, 'https://example.test/AuthorizedEmployee'));
  assert.ok(hasQuad(result.quads, result.targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, result.generatedResourceIri));
});

test('definition annotates the defined resource with skos definition', () => {
  const result = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.definition,
    selection,
    resourceIri: 'https://example.test/AuthorizedEmployee',
    annotationIri: 'urn:annotation:3'
  });
  assert.ok(hasQuad(result.quads, 'https://example.test/AuthorizedEmployee', COMMON_NAMESPACE_IRIS.skos.definition, selection.exact));
});

test('deontic assertions require regulation and process resources', () => {
  const result = createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.permission,
    selection,
    resourceIri: 'https://example.test/regulation/1',
    processIri: 'https://example.test/process/1',
    annotationIri: 'urn:annotation:4'
  });
  assert.ok(hasQuad(result.quads, 'https://example.test/regulation/1', COMMON_NAMESPACE_IRIS.cco2.permits, 'https://example.test/process/1'));
  assert.throws(() => createAnnotationQuads({
    annotationType: ANNOTATION_TYPES.prohibition,
    selection,
    resourceIri: 'https://example.test/regulation/1'
  }), /Process must be an absolute IRI/);
});
