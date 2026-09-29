/**
 * Render an isolated, non-authoritative Word-fidelity preview with docx-preview
 * and sanitize the resulting content in place.
 *
 * The RDF-backed reader remains the annotation surface and source of identity.
 *
 * @param {Blob|ArrayBuffer|Uint8Array} source DOCX package data.
 * @param {HTMLElement} bodyContainer Preview body container.
 * @param {HTMLElement} styleContainer Container for generated preview styles.
 * @param {object} [runtime]
 * @param {object} [runtime.docx=globalThis.docx] docx-preview browser API.
 * @param {object} [runtime.DOMPurify=globalThis.DOMPurify] DOMPurify browser API.
 * @returns {Promise<void>}
 */
export async function renderFidelityPreview(source, bodyContainer, styleContainer, runtime = {}) {
  const docxRuntime = runtime.docx || globalThis.docx;
  const purifier = runtime.DOMPurify || globalThis.DOMPurify;
  if (typeof docxRuntime?.renderAsync !== 'function') {
    throw new Error('docx-preview is not available.');
  }
  if (typeof purifier?.sanitize !== 'function' || purifier.isSupported === false) {
    throw new Error('DOMPurify is not available in this browser.');
  }
  bodyContainer.replaceChildren();
  styleContainer.replaceChildren();
  await docxRuntime.renderAsync(source, bodyContainer, styleContainer, {
    className: 'docxhund-word-preview',
    inWrapper: true,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
    renderComments: false,
    renderChanges: false,
    renderAltChunks: false,
    useBase64URL: true,
    debug: false
  });
  purifier.sanitize(bodyContainer, {
    IN_PLACE: true,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['srcdoc']
  });
}
