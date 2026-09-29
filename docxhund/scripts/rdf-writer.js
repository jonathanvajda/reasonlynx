// docxhund/scripts/rdf-writer.js

import { COMMON_NAMESPACE_IRIS, namespacePrefixMapFromRegistry } from '../../packages/namespace-registry/src/namespace-registry.js';
import { selectPrefixesUsedByRdfTerms } from '../../packages/namespace-registry/src/rdf-serialization-prefixes.js';
import { createRdfDataset, literal, namedNode, quad, serializeRdfDatasetWithAdapters } from '../../packages/rdf-io/src/index.js';
import {
  PART_TYPES_WITH_TEXT_VALUE,
  TABLE_NOVA_DOCUMENT_NAMESPACE_IRI,
  TABLE_NOVA_DOCUMENT_PART_IRIS
} from './config.js';

const STANDARD_PREFIXES = namespacePrefixMapFromRegistry();

/** @param {string} subject @param {string} predicate @param {string} object */
const iriQuad = (subject, predicate, object) => quad(namedNode(subject), namedNode(predicate), namedNode(object));
/** @param {string} subject @param {string} predicate @param {string|number} object */
const literalQuad = (subject, predicate, object) => quad(namedNode(subject), namedNode(predicate), literal(String(object)));

/**
 * Convert normalized document parts into the shared RDF/JS dataset model.
 * @param {object[]} parts
 * @returns {object}
 */
export function createPartsDataset(parts, additionalQuads = []) {
  const quads = [...additionalQuads];
  for (const part of parts || []) {
    quads.push(iriQuad(part.iri, COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.owl.NamedIndividual));
    quads.push(iriQuad(part.iri, COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.cco2.informationContentEntity));
    if (part.label) quads.push(literalQuad(part.iri, COMMON_NAMESPACE_IRIS.rdfs.label, part.label));
    if (part.partType) quads.push(literalQuad(part.iri, COMMON_NAMESPACE_IRIS.dcterms.type, part.partType));
    if (PART_TYPES_WITH_TEXT_VALUE.has(part.partType) && part.textValue) quads.push(literalQuad(part.iri, COMMON_NAMESPACE_IRIS.cco2.hasTextValue, part.textValue));
    if (part.parentIri) {
      quads.push(iriQuad(part.iri, COMMON_NAMESPACE_IRIS.bfo.continuantPartOf, part.parentIri));
      quads.push(iriQuad(part.parentIri, COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart, part.iri));
    }
    if (part.priorIri) quads.push(iriQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasImmediatelyPriorDocumentPart, part.priorIri));
    if (part.posteriorIri) quads.push(iriQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasImmediatelyPosteriorDocumentPart, part.posteriorIri));
    if (part.siblingIndex != null) quads.push(literalQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasSiblingIndex, part.siblingIndex));
    if (part.styleId) quads.push(literalQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasStyleId, part.styleId));
    if (part.styleName) quads.push(literalQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasStyleName, part.styleName));
    if (part.headingLevel != null) quads.push(literalQuad(part.iri, TABLE_NOVA_DOCUMENT_PART_IRIS.hasHeadingLevel, part.headingLevel));
  }
  return createRdfDataset(quads);
}

/**
 * Serialize normalized parts to Turtle without external RDF libraries.
 * @param {object[]} parts
 * @returns {Promise<string>}
 */
export async function serializePartsToTurtle(parts, additionalQuads = []) {
  const dataset = createPartsDataset(parts, additionalQuads);
  const prefixes = selectPrefixesUsedByRdfTerms(
    { ...STANDARD_PREFIXES, docxhund: TABLE_NOVA_DOCUMENT_NAMESPACE_IRI },
    dataset
  );
  const serialized = await serializeRdfDatasetWithAdapters(dataset, {
    format: 'text/turtle',
    prefixes,
    runtime: { N3: globalThis.N3 }
  });
  return serialized.text;
}
