import { jest } from '@jest/globals';
import {
  ReportExportError,
  appendPrintScript,
  createReportTextExportDescriptor,
  escapeHtmlText,
  openPrintableHtmlDocument,
  serializeReportDocumentToHtml,
  serializeReportTableToHtml,
  serializeReportValueToYaml
} from '../src/index.js';

describe('serializeReportValueToYaml', () => {
  test('serializes nested report data with safe scalar quoting', () => {
    const yaml = serializeReportValueToYaml({
      ontologyIri: 'http://example.org/onto',
      status: 'needs "review"',
      standards: [
        { id: 'STD:001', failedResourcesCount: 2 },
        { id: 'STD:002', passed: true }
      ],
      empty: null
    });

    expect(yaml).toContain('ontologyIri: "http://example.org/onto"');
    expect(yaml).toContain('status: "needs \\"review\\""');
    expect(yaml).toContain('- id: "STD:001"');
    expect(yaml).toContain('failedResourcesCount: 2');
    expect(yaml).toContain('passed: true');
    expect(yaml).toContain('empty: null');
    expect(yaml.endsWith('\n')).toBe(true);
  });

  test('quotes keys that are full IRIs or compact terms', () => {
    const yaml = serializeReportValueToYaml({
      'http://purl.org/dc/terms/title': 'Example',
      'dcterms:title': 'Example compact'
    });

    expect(yaml).toContain('"http://purl.org/dc/terms/title": "Example"');
    expect(yaml).toContain('"dcterms:title": "Example compact"');
  });

  test('serializes arrays, empty objects, empty arrays, and optional trailing newline deterministically', () => {
    const yaml = serializeReportValueToYaml({
      rows: [
        { id: 'one', values: [1, 2] },
        {}
      ],
      emptyList: [],
      emptyObject: {}
    }, { trailingNewline: false });

    expect(yaml).toContain('rows:');
    expect(yaml).toContain('- id: "one"');
    expect(yaml).toContain('values:');
    expect(yaml).toContain('- 1');
    expect(yaml).toContain('- {}');
    expect(yaml).toContain('emptyList:\n  []');
    expect(yaml).toContain('emptyObject:\n  {}');
    expect(yaml.endsWith('\n')).toBe(false);
  });
});

describe('serializeReportDocumentToHtml', () => {
  test('creates a complete escaped HTML report document', () => {
    const html = serializeReportDocumentToHtml({
      title: 'Quality <Report>',
      metadata: [['Ontology IRI', 'http://example.org/onto']],
      sections: [{
        title: 'Checks',
        paragraphs: ['A < B'],
        tables: [{
          caption: 'Failures',
          headers: ['Resource', 'Status'],
          rows: [['<x>', 'fail']]
        }]
      }]
    }, { language: 'en' });

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('<title>Quality &lt;Report&gt;</title>');
    expect(html).toContain('<h3>Checks</h3>');
    expect(html).toContain('<td>&lt;x&gt;</td>');
    expect(html).toContain('@media print');
  });

  test('serializes a table fragment independently', () => {
    expect(serializeReportTableToHtml({
      headers: ['A'],
      rows: [['B']]
    })).toBe('<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>B</td></tr></tbody></table>');
  });

  test('requires a title', () => {
    expect(() => serializeReportDocumentToHtml({ title: '' })).toThrow(ReportExportError);
  });
});

describe('createReportTextExportDescriptor', () => {
  test('uses format registry descriptors for YAML and filename timestamps', () => {
    const descriptor = createReportTextExportDescriptor({
      text: 'a: 1\n',
      formatKey: 'yaml',
      baseFileName: 'Example Report',
      date: new Date('2026-08-10T12:34:56Z'),
      utc: true
    });

    expect(descriptor.mimeType).toBe('text/yaml');
    expect(descriptor.extension).toBe('yaml');
    expect(descriptor.fileName).toBe('Example Report_2026-08-10_12-34-56.yaml');
  });

  test('can produce an untimestamped HTML descriptor', () => {
    const descriptor = createReportTextExportDescriptor({
      text: '<!doctype html>',
      formatKey: 'html',
      baseFileName: 'report.html',
      includeTimestamp: false
    });

    expect(descriptor).toMatchObject({
      fileName: 'report.html',
      mimeType: 'text/html',
      extension: 'html'
    });
  });
});

describe('openPrintableHtmlDocument', () => {
  function createWindowMock() {
    const written = [];
    const printWindow = {
      document: {
        open: jest.fn(),
        write: jest.fn((html) => written.push(html)),
        close: jest.fn()
      },
      focus: jest.fn()
    };
    return {
      written,
      printWindow,
      windowRef: {
        open: jest.fn(() => printWindow)
      }
    };
  }

  test('writes printable HTML to an opened window', () => {
    const { windowRef, printWindow, written } = createWindowMock();
    const returned = openPrintableHtmlDocument('<!doctype html><html><body><h1>Report</h1></body></html>', { windowRef });

    expect(returned).toBe(printWindow);
    expect(windowRef.open).toHaveBeenCalledWith('', '_blank', 'width=1200,height=800');
    expect(printWindow.document.open).toHaveBeenCalled();
    expect(printWindow.document.close).toHaveBeenCalled();
    expect(printWindow.focus).toHaveBeenCalled();
    expect(written[0]).toContain('window.print()');
  });

  test('throws a stable error when the popup is blocked', () => {
    const windowRef = { open: jest.fn(() => null) };
    expect(() => openPrintableHtmlDocument('<p>x</p>', { windowRef })).toThrow(ReportExportError);
  });

  test('throws a validation error for blank printable HTML', () => {
    expect(() => openPrintableHtmlDocument('   ', { windowRef: { open: jest.fn() } })).toThrow(ReportExportError);
  });

  test('appendPrintScript supports fragments', () => {
    const html = appendPrintScript('<p>x</p>', { closeAfterPrint: false });
    expect(html).toContain('window.print()');
    expect(html).not.toContain('window.close()');
  });
});

describe('escapeHtmlText', () => {
  test('escapes HTML special characters', () => {
    expect(escapeHtmlText('<a b="c">&')).toBe('&lt;a b=&quot;c&quot;&gt;&amp;');
  });
});
