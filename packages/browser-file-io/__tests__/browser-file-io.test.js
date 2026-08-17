import { jest } from '@jest/globals';
import {
  createAcceptAttribute,
  createTextBlob,
  downloadBlob,
  downloadTextFile,
  createSafeFilenameBase,
  isBlobLike,
  normalizeFileExtension,
  normalizeDownloadFileName,
  normalizeTextMimeType,
  readFileAsArrayBuffer,
  readFileAsText,
  stripFileExtension
} from '../src/index.js';

function createMockFileReaderConstructor({ result, error, throwOnRead = false } = {}) {
  const instances = [];
  class MockFileReader {
    constructor() {
      this.result = null;
      this.error = null;
      instances.push(this);
    }

    readAsText(file, encoding) {
      this.file = file;
      this.encoding = encoding;
      if (throwOnRead) throw new Error('setup failed');
      if (error) {
        this.error = error;
        this.onerror?.();
        return;
      }
      this.result = result;
      this.onload?.();
    }

    readAsArrayBuffer(file) {
      this.file = file;
      if (throwOnRead) throw new Error('setup failed');
      if (error) {
        this.error = error;
        this.onerror?.();
        return;
      }
      this.result = result;
      this.onload?.();
    }

    abort() {
      this.aborted = true;
      this.onabort?.();
    }
  }
  MockFileReader.instances = instances;
  return MockFileReader;
}

function makeDocumentMock() {
  const body = {
    appended: [],
    appendChild(node) {
      this.appended.push(node);
      node.parent = this;
    }
  };
  const anchors = [];
  return {
    body,
    anchors,
    createElement(tagName) {
      if (tagName !== 'a') throw new Error(`Unexpected element: ${tagName}`);
      const anchor = {
        clicked: false,
        removed: false,
        click() {
          this.clicked = true;
        },
        remove() {
          this.removed = true;
        }
      };
      anchors.push(anchor);
      return anchor;
    }
  };
}

describe('browser-file-io read adapters', () => {
  test('readFileAsText prefers native Blob.text when no encoding or signal is needed', async () => {
    const file = { text: jest.fn().mockResolvedValue('hello') };
    await expect(readFileAsText(file)).resolves.toBe('hello');
    expect(file.text).toHaveBeenCalledTimes(1);
  });

  test('readFileAsText uses FileReader when encoding is supplied and preserves error detail', async () => {
    const nativeError = new Error('disk said no');
    const FileReaderConstructor = createMockFileReaderConstructor({ error: nativeError });
    await expect(readFileAsText({}, { encoding: 'utf-16le', FileReaderConstructor })).rejects.toBe(nativeError);
    expect(FileReaderConstructor.instances[0].encoding).toBe('utf-16le');
  });

  test('readFileAsText resolves empty FileReader results as an empty string', async () => {
    const FileReaderConstructor = createMockFileReaderConstructor({ result: null });
    await expect(readFileAsText({}, { preferNativeText: false, FileReaderConstructor })).resolves.toBe('');
  });

  test('readFileAsArrayBuffer prefers native Blob.arrayBuffer when no signal is needed', async () => {
    const buffer = new ArrayBuffer(4);
    const file = { arrayBuffer: jest.fn().mockResolvedValue(buffer) };
    await expect(readFileAsArrayBuffer(file)).resolves.toBe(buffer);
    expect(file.arrayBuffer).toHaveBeenCalledTimes(1);
  });

  test('readFileAsArrayBuffer uses FileReader fallback and rejects non-ArrayBuffer results', async () => {
    const FileReaderConstructor = createMockFileReaderConstructor({ result: 'not binary' });
    await expect(readFileAsArrayBuffer({}, { preferNativeArrayBuffer: false, FileReaderConstructor }))
      .rejects.toThrow('File read did not produce an ArrayBuffer.');
  });

  test('read adapters reject missing browser primitives clearly', async () => {
    await expect(readFileAsText({}, { preferNativeText: false, FileReaderConstructor: undefined }))
      .rejects.toThrow('FileReader is not available');
    await expect(readFileAsArrayBuffer({}, { preferNativeArrayBuffer: false, FileReaderConstructor: undefined }))
      .rejects.toThrow('FileReader is not available');
  });

  test('read adapters reject invalid file inputs before touching browser APIs', async () => {
    expect(() => readFileAsText(null)).toThrow('readFileAsText expected a File or Blob-like object.');
    expect(() => readFileAsArrayBuffer(undefined)).toThrow('readFileAsArrayBuffer expected a File or Blob-like object.');
  });

  test('readFileAsText rejects already-aborted reads without constructing FileReader', async () => {
    const FileReaderConstructor = jest.fn();
    const controller = new AbortController();
    controller.abort('cancelled');

    await expect(readFileAsText({}, {
      preferNativeText: false,
      FileReaderConstructor,
      signal: controller.signal
    })).rejects.toMatchObject({
      name: 'AbortError',
      message: 'cancelled'
    });
    expect(FileReaderConstructor).not.toHaveBeenCalled();
  });

  test('readFileAsArrayBuffer preserves setup errors from FileReader construction/read', async () => {
    const FileReaderConstructor = createMockFileReaderConstructor({ throwOnRead: true });
    await expect(readFileAsArrayBuffer({}, {
      preferNativeArrayBuffer: false,
      FileReaderConstructor
    })).rejects.toThrow('setup failed');
  });
});

describe('browser-file-io Blob and download adapters', () => {
  test('filename utilities normalize extensions and safe basenames', () => {
    expect(normalizeFileExtension('.TTL')).toBe('ttl');
    expect(normalizeFileExtension('..JSONLD')).toBe('jsonld');
    expect(stripFileExtension('report.final.ttl')).toBe('report.final');
    expect(stripFileExtension('archive.tar.gz')).toBe('archive.tar');
    expect(createSafeFilenameBase(' Bad/File:Name?.ttl ')).toBe('Bad-File-Name-.ttl');
    expect(createSafeFilenameBase(stripFileExtension(' Bad/File:Name?.ttl '))).toBe('Bad-File-Name-');
    expect(createSafeFilenameBase('', { fallbackBase: 'artifact' })).toBe('artifact');
  });

  test('isBlobLike detects Blob-compatible payloads without relying on global Blob', () => {
    expect(isBlobLike(new Blob(['x'], { type: 'text/plain' }))).toBe(true);
    expect(isBlobLike({ type: 'text/plain', arrayBuffer: async () => new ArrayBuffer(0) })).toBe(true);
    expect(isBlobLike({ type: 'text/plain' })).toBe(false);
  });

  test('normalizeTextMimeType appends charset unless disabled or already present', () => {
    expect(normalizeTextMimeType('text/csv')).toBe('text/csv;charset=utf-8');
    expect(normalizeTextMimeType('text/csv;charset=utf-16')).toBe('text/csv;charset=utf-16');
    expect(normalizeTextMimeType('application/json', false)).toBe('application/json');
  });

  test('createTextBlob stringifies nullish content and applies MIME options', async () => {
    const blob = createTextBlob(null, { mimeType: 'text/plain' });
    expect(blob.type).toBe('text/plain;charset=utf-8');
    expect(await blob.text()).toBe('');
  });

  test('downloadBlob appends, clicks, removes, and revokes object URLs', () => {
    const documentRef = makeDocumentMock();
    const urlRef = {
      createObjectURL: jest.fn(() => 'blob:one'),
      revokeObjectURL: jest.fn()
    };
    const blob = new Blob(['x']);

    const result = downloadBlob(' example.txt ', blob, { documentRef, urlRef });

    expect(result).toEqual({ fileName: 'example.txt', objectUrl: 'blob:one', revokeDelayMs: 0 });
    expect(urlRef.createObjectURL).toHaveBeenCalledWith(blob);
    expect(documentRef.body.appended).toHaveLength(1);
    expect(documentRef.anchors[0]).toMatchObject({
      href: 'blob:one',
      download: 'example.txt',
      rel: 'noopener',
      clicked: true,
      removed: true
    });
    expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:one');
  });

  test('downloadTextFile composes text blob creation with blob download', async () => {
    const documentRef = makeDocumentMock();
    const urlRef = {
      createObjectURL: jest.fn(() => 'blob:csv'),
      revokeObjectURL: jest.fn()
    };

    const result = downloadTextFile('rows.csv', 'a,b', {
      mimeType: 'text/csv',
      documentRef,
      urlRef
    });

    expect(result.fileName).toBe('rows.csv');
    expect(urlRef.createObjectURL.mock.calls[0][0].type).toBe('text/csv;charset=utf-8');
    expect(await urlRef.createObjectURL.mock.calls[0][0].text()).toBe('a,b');
  });

  test('downloadBlob supports delayed revocation and no-append mode', () => {
    jest.useFakeTimers();
    try {
      const documentRef = makeDocumentMock();
      const urlRef = {
        createObjectURL: jest.fn(() => 'blob:delayed'),
        revokeObjectURL: jest.fn()
      };

      const result = downloadBlob('delayed.txt', new Blob(['x']), {
        documentRef,
        urlRef,
        appendToDocument: false,
        revokeDelayMs: 25
      });

      expect(result).toEqual({ fileName: 'delayed.txt', objectUrl: 'blob:delayed', revokeDelayMs: 25 });
      expect(documentRef.body.appended).toHaveLength(0);
      expect(documentRef.anchors[0].clicked).toBe(true);
      expect(urlRef.revokeObjectURL).not.toHaveBeenCalled();
      jest.advanceTimersByTime(25);
      expect(urlRef.revokeObjectURL).toHaveBeenCalledWith('blob:delayed');
    } finally {
      jest.useRealTimers();
    }
  });

  test('Blob and download helpers fail clearly when required browser APIs are missing', () => {
    expect(() => downloadBlob('x.txt', {}, { documentRef: {}, urlRef: URL })).toThrow('document.createElement is not available');
    expect(() => downloadBlob('x.txt', {}, { documentRef: makeDocumentMock(), urlRef: {} }))
      .toThrow('URL.createObjectURL and URL.revokeObjectURL are required');
  });

  test('normalizeDownloadFileName provides a stable fallback', () => {
    expect(normalizeDownloadFileName(' report.ttl ')).toBe('report.ttl');
    expect(normalizeDownloadFileName('')).toBe('download.txt');
  });
});

describe('browser-file-io accept attributes', () => {
  test('createAcceptAttribute normalizes extensions, filters categories, and de-duplicates', () => {
    const descriptors = [
      { category: 'rdf', extensions: ['ttl', '.rdf'], mimeType: 'text/turtle' },
      { category: 'tabular', extensions: ['csv'], mimeType: 'text/csv' },
      '.ttl'
    ];

    expect(createAcceptAttribute(descriptors, { category: 'rdf' })).toBe('.ttl,.rdf');
  });

  test('createAcceptAttribute can include MIME types when desired', () => {
    expect(createAcceptAttribute([
      { extensions: ['rq'], mimeType: 'application/sparql-query' },
      'text/csv'
    ], { includeMimeTypes: true })).toBe('.rq,application/sparql-query,text/csv');
  });
});
