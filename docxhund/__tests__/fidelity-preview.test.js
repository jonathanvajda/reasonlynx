import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFidelityPreview } from '../scripts/fidelity-preview.js';

function createContainer() {
  return {
    cleared: false,
    replaceChildren() {
      this.cleared = true;
    }
  };
}

test('fidelity preview renders with hardened options and sanitizes in place', async () => {
  const body = createContainer();
  const styles = createContainer();
  const calls = [];
  const runtime = {
    docx: {
      async renderAsync(source, bodyTarget, styleTarget, options) {
        calls.push({ source, bodyTarget, styleTarget, options });
      }
    },
    DOMPurify: {
      isSupported: true,
      sanitize(target, options) {
        calls.push({ target, sanitizeOptions: options });
      }
    }
  };
  const source = new Uint8Array([1, 2, 3]);
  await renderFidelityPreview(source, body, styles, runtime);
  assert.equal(calls[0].source, source);
  assert.equal(calls[0].options.renderAltChunks, false);
  assert.equal(calls[0].options.useBase64URL, true);
  assert.equal(calls[1].target, body);
  assert.equal(calls[1].sanitizeOptions.IN_PLACE, true);
});

test('fidelity preview fails closed without a sanitizer', async () => {
  await assert.rejects(
    renderFidelityPreview(new Uint8Array(), createContainer(), createContainer(), {
      docx: { renderAsync() {} }
    }),
    /DOMPurify/
  );
});
