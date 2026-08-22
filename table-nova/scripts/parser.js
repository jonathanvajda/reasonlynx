// docs/scripts/parser.js

import { HEADING_STYLE_PATTERN, PART_TYPES_WITH_TEXT_VALUE } from './config.js';
import { makeGeneratedLabel, mintInstanceIri } from './utils.js';

/**
 * Normalize DOCX XML into a simple internal document-part model.
 * This MVP handles:
 * - document
 * - section (heuristic)
 * - paragraph
 *
 * Optional:
 * - sentences
 * - words
 */

/**
 * Return child elements by local name.
 * @param {Element} parent
 * @param {string} localName
 * @returns {Element[]}
 */
function getChildElementsByLocalName(parent, localName) {
  var results = [];
  var children = parent ? parent.children : [];
  for (var i = 0; i < children.length; i += 1) {
    if (children[i].localName === localName) {
      results.push(children[i]);
    }
  }
  return results;
}

/**
 * Find the first descendant by local name.
 * @param {Element} root
 * @param {string} localName
 * @returns {Element|null}
 */
function findFirstDescendantByLocalName(root, localName) {
  var nodes = root ? root.getElementsByTagNameNS('*', localName) : [];
  return nodes.length ? nodes[0] : null;
}

/**
 * Extract concatenated paragraph text from all w:t descendants.
 * @param {Element} paragraphEl
 * @returns {string}
 */
function extractParagraphText(paragraphEl) {
  var textNodes = paragraphEl.getElementsByTagNameNS('*', 't');
  var chunks = [];
  for (var i = 0; i < textNodes.length; i += 1) {
    chunks.push(textNodes[i].textContent || '');
  }
  return chunks.join('').replace(/\s+/g, ' ').trim();
}

/**
 * Get paragraph style metadata if present.
 * @param {Element} paragraphEl
 * @returns {{styleId: string|null, styleName: string|null, headingLevel: number|null}}
 */
function getParagraphStyleInfo(paragraphEl) {
  var pPr = findFirstDescendantByLocalName(paragraphEl, 'pPr');
  if (!pPr) {
    return { styleId: null, styleName: null, headingLevel: null };
  }

  var pStyle = findFirstDescendantByLocalName(pPr, 'pStyle');
  var styleId = pStyle ? (pStyle.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'val') || pStyle.getAttribute('w:val') || pStyle.getAttribute('val')) : null;

  var headingLevel = null;
  if (styleId && HEADING_STYLE_PATTERN.test(styleId)) {
    headingLevel = parseInt(styleId.match(HEADING_STYLE_PATTERN)[1], 10);
  }

  return {
    styleId: styleId,
    styleName: styleId,
    headingLevel: headingLevel
  };
}

/**
 * Naive sentence split. Replace later with a better tokenizer.
 * @param {string} text
 * @returns {string[]}
 */
function splitSentences(text) {
  var value = String(text || '').trim();
  if (!value) {
    return [];
  }
  return value
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
}

/**
 * Naive word split. Replace later with a tokenizer.
 * @param {string} text
 * @returns {string[]}
 */
function splitWords(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .map(function (token) {
      return token.trim();
    })
    .filter(Boolean);
}

/**
 * Create a normalized document-part node.
 * @param {object} options
 * @returns {object}
 */
function createPartNode(options) {
  return {
    iri: options.iri,
    partType: options.partType,
    label: options.label,
    textValue: options.textValue || null,
    styleId: options.styleId || null,
    styleName: options.styleName || null,
    headingLevel: options.headingLevel || null,
    siblingIndex: options.siblingIndex || null,
    parentIri: options.parentIri || null,
    priorIri: options.priorIri || null,
    posteriorIri: options.posteriorIri || null
  };
}

/**
 * Parse DOCX XML into normalized document parts.
 * @param {object} docxParts
 * @param {object} options
 * @returns {object}
 */
export function parseDocumentParts(docxParts, options) {
  var baseIri = options.baseIri;
  var includeSections = Boolean(options.includeSections);
  var includeParagraphs = Boolean(options.includeParagraphs);
  var includeSentences = Boolean(options.includeSentences);
  var includeWords = Boolean(options.includeWords);

  var parts = [];
  var documentCounter = 1;
  var sectionCounter = 0;
  var paragraphCounter = 0;

  var documentIri = mintInstanceIri(baseIri, 'document');
  var documentNode = createPartNode({
    iri: documentIri,
    partType: 'document',
    label: makeGeneratedLabel('document', documentCounter),
    siblingIndex: 1
  });
  parts.push(documentNode);

  var paragraphEls = docxParts.xml.documentXml.getElementsByTagNameNS('*', 'p');
  var currentSectionIri = documentIri;
  var currentSectionIndex = 0;
  var lastSectionIri = null;
  var lastParagraphIri = null;

  for (var i = 0; i < paragraphEls.length; i += 1) {
    var paragraphEl = paragraphEls[i];
    var text = extractParagraphText(paragraphEl);
    var style = getParagraphStyleInfo(paragraphEl);

    if (!text) {
      continue;
    }

    if (includeSections && style.headingLevel != null) {
      sectionCounter += 1;

      var sectionIri = mintInstanceIri(baseIri, 'section');
      var sectionNode = createPartNode({
        iri: sectionIri,
        partType: 'section',
        label: makeGeneratedLabel('section', sectionCounter),
        siblingIndex: sectionCounter,
        parentIri: documentIri,
        priorIri: lastSectionIri,
        headingLevel: style.headingLevel,
        styleId: style.styleId,
        styleName: style.styleName
      });

      if (lastSectionIri) {
        var previousSection = parts.find(function (part) {
          return part.iri === lastSectionIri;
        });
        if (previousSection) {
          previousSection.posteriorIri = sectionIri;
        }
      }

      parts.push(sectionNode);
      currentSectionIri = sectionIri;
      currentSectionIndex = sectionCounter;
      lastSectionIri = sectionIri;
      lastParagraphIri = null;
    }

    if (!includeParagraphs) {
      continue;
    }

    paragraphCounter += 1;

    var paragraphIri = mintInstanceIri(baseIri, 'paragraph');
    var paragraphNode = createPartNode({
      iri: paragraphIri,
      partType: 'paragraph',
      label: makeGeneratedLabel('paragraph', paragraphCounter),
      textValue: PART_TYPES_WITH_TEXT_VALUE.has('paragraph') ? text : null,
      siblingIndex: paragraphCounter,
      parentIri: currentSectionIri,
      priorIri: lastParagraphIri,
      styleId: style.styleId,
      styleName: style.styleName,
      headingLevel: style.headingLevel
    });

    if (lastParagraphIri) {
      var previousParagraph = parts.find(function (part) {
        return part.iri === lastParagraphIri;
      });
      if (previousParagraph) {
        previousParagraph.posteriorIri = paragraphIri;
      }
    }

    parts.push(paragraphNode);
    lastParagraphIri = paragraphIri;

    if (includeSentences) {
      var sentences = splitSentences(text);
      var lastSentenceIri = null;

      for (var s = 0; s < sentences.length; s += 1) {
        var sentenceText = sentences[s].trim();
        if (!sentenceText) {
          continue;
        }

        var sentenceIri = mintInstanceIri(baseIri, 'sentence');
        var sentenceNode = createPartNode({
          iri: sentenceIri,
          partType: 'sentence',
          label: makeGeneratedLabel('sentence', paragraphCounter + '.' + (s + 1)),
          textValue: sentenceText,
          siblingIndex: s + 1,
          parentIri: paragraphIri,
          priorIri: lastSentenceIri
        });

        if (lastSentenceIri) {
          var previousSentence = parts.find(function (part) {
            return part.iri === lastSentenceIri;
          });
          if (previousSentence) {
            previousSentence.posteriorIri = sentenceIri;
          }
        }

        parts.push(sentenceNode);
        lastSentenceIri = sentenceIri;

        if (includeWords) {
          var words = splitWords(sentenceText);
          var lastWordIri = null;

          for (var w = 0; w < words.length; w += 1) {
            var wordText = words[w];
            var wordIri = mintInstanceIri(baseIri, 'word');
            var wordNode = createPartNode({
              iri: wordIri,
              partType: 'word',
              label: makeGeneratedLabel('word', paragraphCounter + '.' + (s + 1) + '.' + (w + 1)),
              textValue: wordText,
              siblingIndex: w + 1,
              parentIri: sentenceIri,
              priorIri: lastWordIri
            });

            if (lastWordIri) {
              var previousWord = parts.find(function (part) {
                return part.iri === lastWordIri;
              });
              if (previousWord) {
                previousWord.posteriorIri = wordIri;
              }
            }

            parts.push(wordNode);
            lastWordIri = wordIri;
          }
        }
      }
    }
  }

  return {
    documentIri: documentIri,
    sectionCount: sectionCounter,
    paragraphCount: paragraphCounter,
    parts: parts
  };
}