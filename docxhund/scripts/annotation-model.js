import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { literal, namedNode, quad } from '../../packages/rdf-io/src/index.js';
import { createUuid } from '../../packages/ontology-utils/src/index.js';
import { DOCXHUND_TERMS, DOCXHUND_VOCABULARY_IRI } from './docxhund-vocabulary.js';

export const DOCXHUND_ANNOTATION_VOCABULARY_IRI = DOCXHUND_VOCABULARY_IRI;

export const ANNOTATION_TYPES = Object.freeze({
  about: 'about',
  entityMention: 'entity-mention',
  classMention: 'class-mention',
  permission: 'permission',
  prohibition: 'prohibition',
  obligation: 'obligation',
  definition: 'definition'
});

const TERM = DOCXHUND_TERMS;

/** @param {string} value @param {string} fieldName @returns {string} */
function requireAbsoluteIri(value, fieldName) {
  const text = String(value || '').trim();
  try {
    const iri = new URL(text);
    if (!iri.protocol) throw new Error();
  } catch {
    if (!/^urn:[^\s]+$/i.test(text)) throw new TypeError(fieldName + ' must be an absolute IRI.');
  }
  return text;
}

/** @param {string} subject @param {string} predicate @param {string} object */
const iriQuad = (subject, predicate, object) => quad(namedNode(subject), namedNode(predicate), namedNode(object));

/**
 * Build a manual annotation and its semantic assertion as RDF/JS quads.
 *
 * @param {object} command
 * @param {string} command.annotationType
 * @param {object} command.selection
 * @param {string} command.selection.partIri
 * @param {string} command.selection.exact
 * @param {number} command.selection.start
 * @param {number} command.selection.end
 * @param {string} [command.resourceIri]
 * @param {string} [command.processIri]
 * @param {string} [command.annotationIri]
 * @param {string} [command.actIri]
 * @param {string} [command.agentIri]
 * @param {string} [command.occurredAt]
 * @returns {{annotationIri: string, targetIri: string, actIri:string, generatedResourceIri: string|null, quads: object[]}}
 */
export function createAnnotationQuads(command) {
  const type = String(command?.annotationType || '');
  if (!Object.values(ANNOTATION_TYPES).includes(type)) throw new TypeError('Unsupported annotation type.');
  const selection = command.selection || {};
  const partIri = requireAbsoluteIri(selection.partIri, 'Selection document part');
  const exact = String(selection.exact || '').trim();
  if (!exact) throw new TypeError('Select a passage before committing an annotation.');
  const annotationIri = command.annotationIri ||
    'urn:uuid:' + createUuid();
  // Materialize a selected phrase independently when no pre-extracted unit exists.
  const targetIri = 'urn:uuid:' + createUuid();
  const actIri = command.actIri || 'urn:uuid:' + createUuid();
  const occurredAt = command.occurredAt || new Date().toISOString();
  const quads = [
    iriQuad(annotationIri, COMMON_NAMESPACE_IRIS.rdf.type, TERM.Annotation),
    iriQuad(annotationIri, TERM.targetDocumentPart, partIri),
    iriQuad(annotationIri, TERM.targetTextResource, targetIri),
    iriQuad(annotationIri, TERM.annotationType, DOCXHUND_ANNOTATION_VOCABULARY_IRI + type),
    iriQuad(targetIri, COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.cco2.informationContentEntity),
    iriQuad(targetIri, COMMON_NAMESPACE_IRIS.rdf.type, TERM.TextSelection),
    iriQuad(targetIri, COMMON_NAMESPACE_IRIS.bfo.continuantPartOf, partIri),
    quad(namedNode(targetIri), namedNode(COMMON_NAMESPACE_IRIS.cco2.hasTextValue), literal(exact)),
    quad(namedNode(targetIri), namedNode(TERM.exactText), literal(exact)),
    quad(namedNode(targetIri), namedNode(TERM.prefixText), literal(selection.prefix || '')),
    quad(namedNode(targetIri), namedNode(TERM.suffixText), literal(selection.suffix || '')),
    quad(namedNode(targetIri), namedNode(TERM.startOffset), literal(selection.start, COMMON_NAMESPACE_IRIS.xsd.nonNegativeInteger)),
    quad(namedNode(targetIri), namedNode(TERM.endOffset), literal(selection.end, COMMON_NAMESPACE_IRIS.xsd.nonNegativeInteger)),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.rdf.type, TERM.DocumentAnnotationAct),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasInput, partIri),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, targetIri),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, annotationIri),
    quad(namedNode(actIri), namedNode(TERM.occurredAt), literal(occurredAt, COMMON_NAMESPACE_IRIS.xsd.dateTime))
  ];
  if (command.agentIri) quads.push(iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasAgent, requireAbsoluteIri(command.agentIri, 'Agent')));
  let generatedResourceIri = null;
  if (type === ANNOTATION_TYPES.about || type === ANNOTATION_TYPES.entityMention) {
    const resourceIri = requireAbsoluteIri(command.resourceIri, 'About resource');
    quads.push(iriQuad(targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, resourceIri));
  } else if (type === ANNOTATION_TYPES.classMention) {
    const classIri = requireAbsoluteIri(command.resourceIri, 'Class');
    generatedResourceIri = 'urn:uuid:' + createUuid();
    quads.push(iriQuad(generatedResourceIri, COMMON_NAMESPACE_IRIS.rdf.type, classIri));
    quads.push(iriQuad(targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, generatedResourceIri));
  } else if (type === ANNOTATION_TYPES.definition) {
    const definedResourceIri = requireAbsoluteIri(command.resourceIri, 'Defined resource');
    quads.push(quad(namedNode(definedResourceIri), namedNode(COMMON_NAMESPACE_IRIS.skos.definition), literal(exact)));
  } else {
    const regulationIri = requireAbsoluteIri(command.resourceIri, 'Process Regulation');
    const processIri = requireAbsoluteIri(command.processIri, 'Process');
    const predicate = {
      [ANNOTATION_TYPES.permission]: COMMON_NAMESPACE_IRIS.cco2.permits,
      [ANNOTATION_TYPES.prohibition]: COMMON_NAMESPACE_IRIS.cco2.prohibits,
      [ANNOTATION_TYPES.obligation]: COMMON_NAMESPACE_IRIS.cco2.requires
    }[type];
    quads.push(iriQuad(regulationIri, predicate, processIri));
    quads.push(iriQuad(targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, regulationIri));
    quads.push(iriQuad(targetIri, COMMON_NAMESPACE_IRIS.cco2.isAbout, processIri));
  }
  return { annotationIri, targetIri, actIri, generatedResourceIri, quads };
}
