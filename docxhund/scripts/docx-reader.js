// docxhund/scripts/docx-reader.js
import JSZip from '../../vendor/jszip-esm.js';
import { readFileAsArrayBuffer } from '../../packages/browser-file-io/src/index.js';

/**
 * Load a DOCX file and expose key XML parts as parsed XML documents.
 * This MVP reads only a subset of OOXML parts.
 */

/**
 * Parse XML text into a browser XML document.
 * @param {string} xmlText
 * @returns {XMLDocument}
 */
function parseXml(xmlText) {
  var parser = new DOMParser();
  return parser.parseFromString(xmlText, 'application/xml');
}

/**
 * Get a ZIP entry as text, or null if not found.
 * @param {JSZip} zip
 * @param {string} path
 * @returns {Promise<string|null>}
 */
async function getZipTextOrNull(zip, path) {
  var entry = zip.file(path);
  if (!entry) {
    return null;
  }
  return await entry.async('text');
}

/**
 * Load relevant DOCX parts into parsed XML docs.
 * @param {File} file
 * @returns {Promise<object>}
 */
export async function loadDocxParts(file) {
  var buffer = await readFileAsArrayBuffer(file);
  var zip = await JSZip.loadAsync(buffer);

  var documentXmlText = await getZipTextOrNull(zip, 'word/document.xml');
  if (!documentXmlText) {
    throw new Error('DOCX is missing word/document.xml');
  }

  var stylesXmlText = await getZipTextOrNull(zip, 'word/styles.xml');
  var numberingXmlText = await getZipTextOrNull(zip, 'word/numbering.xml');

  return {
    raw: {
      documentXmlText: documentXmlText,
      stylesXmlText: stylesXmlText,
      numberingXmlText: numberingXmlText
    },
    xml: {
      documentXml: parseXml(documentXmlText),
      stylesXml: stylesXmlText ? parseXml(stylesXmlText) : null,
      numberingXml: numberingXmlText ? parseXml(numberingXmlText) : null
    }
  };
}
