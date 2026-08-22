// docxhund/scripts/rdf-writer.js

import { COMMON_NAMESPACE_IRIS, namespacePrefixMapFromRegistry } from '../../packages/namespace-registry/src/namespace-registry.js';
import {
  PART_TYPES_WITH_TEXT_VALUE,
  TABLE_NOVA_DOCUMENT_NAMESPACE_IRI,
  TABLE_NOVA_DOCUMENT_PART_IRIS
} from './config.js';

const STANDARD_PREFIXES = namespacePrefixMapFromRegistry();

/**
 * Escape a JS string as a Turtle string literal.
 * @param {string} value
 * @returns {string}
 */
function turtleString(value) {
  return '"' + String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n') + '"';
}

/**
 * Wrap an IRI for Turtle.
 * @param {string} iri
 * @returns {string}
 */
function iriRef(iri) {
  return '<' + String(iri) + '>';
}

/**
 * Build a predicate-object line for an IRI object.
 * @param {string} predicate
 * @param {string} objectIri
 * @returns {string}
 */
function poIri(predicate, objectIri) {
  return '    ' + iriRef(predicate) + ' ' + iriRef(objectIri);
}

/**
 * Build a predicate-object line for a literal object.
 * @param {string} predicate
 * @param {string|number} value
 * @returns {string}
 */
function poLiteral(predicate, value) {
  return '    ' + iriRef(predicate) + ' ' + turtleString(value);
}

/**
 * Serialize normalized parts to Turtle without external RDF libraries.
 * @param {object[]} parts
 * @returns {Promise<string>}
 */
export async function serializePartsToTurtle(parts) {
  var lines = [];

  lines.push('@prefix rdf: <' + STANDARD_PREFIXES.rdf + '> .');
  lines.push('@prefix rdfs: <' + STANDARD_PREFIXES.rdfs + '> .');
  lines.push('@prefix owl: <' + STANDARD_PREFIXES.owl + '> .');
  lines.push('@prefix dcterms: <' + STANDARD_PREFIXES.dcterms + '> .');
  lines.push('@prefix cco2: <' + STANDARD_PREFIXES.cco2 + '> .');
  lines.push('@prefix bfo: <' + STANDARD_PREFIXES.bfo + '> .');
  lines.push('@prefix ex: <' + TABLE_NOVA_DOCUMENT_NAMESPACE_IRI + '> .');
  lines.push('');

  for (var i = 0; i < parts.length; i += 1) {
    var part = parts[i];
    var po = [];

    po.push(poIri(COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.owl.NamedIndividual));
    po.push(poIri(COMMON_NAMESPACE_IRIS.rdf.type, COMMON_NAMESPACE_IRIS.cco2.informationContentEntity));

    if (part.label) {
      po.push(poLiteral(COMMON_NAMESPACE_IRIS.rdfs.label, part.label));
    }

    if (part.partType) {
      po.push(poLiteral(COMMON_NAMESPACE_IRIS.dcterms.type, part.partType));
    }

    if (PART_TYPES_WITH_TEXT_VALUE.has(part.partType) && part.textValue) {
      po.push(poLiteral(COMMON_NAMESPACE_IRIS.cco2.hasTextValue, part.textValue));
    }

    if (part.parentIri) {
      po.push(poIri(COMMON_NAMESPACE_IRIS.bfo.continuantPartOf, part.parentIri));
    }

    if (part.priorIri) {
      po.push(poIri(TABLE_NOVA_DOCUMENT_PART_IRIS.hasImmediatelyPriorDocumentPart, part.priorIri));
    }

    if (part.posteriorIri) {
      po.push(poIri(TABLE_NOVA_DOCUMENT_PART_IRIS.hasImmediatelyPosteriorDocumentPart, part.posteriorIri));
    }

    if (part.siblingIndex !== null && part.siblingIndex !== undefined) {
      po.push(poLiteral(TABLE_NOVA_DOCUMENT_PART_IRIS.hasSiblingIndex, part.siblingIndex));
    }

    if (part.styleId) {
      po.push(poLiteral(TABLE_NOVA_DOCUMENT_PART_IRIS.hasStyleId, part.styleId));
    }

    if (part.styleName) {
      po.push(poLiteral(TABLE_NOVA_DOCUMENT_PART_IRIS.hasStyleName, part.styleName));
    }

    if (part.headingLevel !== null && part.headingLevel !== undefined) {
      po.push(poLiteral(TABLE_NOVA_DOCUMENT_PART_IRIS.hasHeadingLevel, part.headingLevel));
    }

    lines.push(iriRef(part.iri));
    for (var j = 0; j < po.length; j += 1) {
      lines.push(po[j] + (j === po.length - 1 ? ' .' : ' ;'));
    }
    lines.push('');
  }

  for (var k = 0; k < parts.length; k += 1) {
    var child = parts[k];
    if (child.parentIri) {
      lines.push(
        iriRef(child.parentIri) + ' ' +
        iriRef(COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart) + ' ' +
        iriRef(child.iri) + ' .'
      );
    }
  }

  lines.push('');
  return lines.join('\n');
}
