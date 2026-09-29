import { COMMON_NAMESPACE_IRIS } from '../../packages/namespace-registry/src/namespace-registry.js';
import { literal, namedNode, quad } from '../../packages/rdf-io/src/index.js';
import { createUuid } from '../../packages/ontology-utils/src/index.js';
import { DOCXHUND_TERMS } from './docxhund-vocabulary.js';

/** @param {string} subject @param {string} predicate @param {string} object */
const iriQuad = (subject, predicate, object) => quad(namedNode(subject), namedNode(predicate), namedNode(object));

/**
 * Describe one DocxHund parsing execution using CCO input/output relations.
 * @param {{documentIri:string, fileName:string, actIri?:string, sourceIri?:string, occurredAt?:string}} options
 * @returns {{actIri:string, sourceIri:string, occurredAt:string, quads:object[]}}
 */
export function createDocumentParsingProvenance(options) {
  const actIri = options.actIri || 'urn:uuid:' + createUuid();
  const sourceIri = options.sourceIri || options.documentIri + '/source-docx';
  const occurredAt = options.occurredAt || new Date().toISOString();
  const quads = [
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.rdf.type, DOCXHUND_TERMS.DocumentParsingAct),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasInput, sourceIri),
    iriQuad(actIri, COMMON_NAMESPACE_IRIS.cco2.hasOutput, options.documentIri),
    iriQuad(sourceIri, COMMON_NAMESPACE_IRIS.rdf.type, DOCXHUND_TERMS.SourceDocument),
    quad(namedNode(sourceIri), namedNode(COMMON_NAMESPACE_IRIS.rdfs.label), literal(options.fileName)),
    quad(namedNode(actIri), namedNode(DOCXHUND_TERMS.occurredAt), literal(occurredAt, COMMON_NAMESPACE_IRIS.xsd.dateTime))
  ];
  return { actIri, sourceIri, occurredAt, quads };
}

