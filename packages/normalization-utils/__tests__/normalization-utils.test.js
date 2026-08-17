import {
  appendTimestampToFilename,
  buildLabelFromWords,
  detectStringCaseStyle,
  getLocalDateParts,
  getTimestampForFilename,
  getUtcDateParts,
  NORMALIZATION_CASE_STYLES,
  normalizeStringToAsciiSlug,
  normalizeStringToCamelCase,
  normalizeStringToCase,
  normalizeStringToCobolCase,
  normalizeStringToFlatCase,
  normalizeStringToKebabCase,
  normalizeStringToPascalCase,
  normalizeStringToShoutingSnakeCase,
  normalizeStringToSnakeCase,
  normalizeStringToTrainCase,
  normalizeStringToUpperFlatCase,
  splitStringToWords
} from '../src/index.js';

describe('case conversion normalization', () => {
  test('publishes supported case styles as a stable contract', () => {
    expect(NORMALIZATION_CASE_STYLES).toEqual([
      'flatcase',
      'UPPERFLATCASE',
      'camelCase',
      'PascalCase',
      'snake_case',
      'SHOUTING_SNAKE',
      'kebab-case',
      'Train-Case',
      'COBOL-CASE'
    ]);
  });

  test('splits human, punctuation, snake, kebab, camel, Pascal, and acronym text', () => {
    expect(splitStringToWords('has email_address!!')).toEqual(['has', 'email', 'address']);
    expect(splitStringToWords('meetingDate')).toEqual(['meeting', 'Date']);
    expect(splitStringToWords('MeetingDate')).toEqual(['Meeting', 'Date']);
    expect(splitStringToWords('HTTPResponseCode')).toEqual(['HTTP', 'Response', 'Code']);
    expect(splitStringToWords('customer-id')).toEqual(['customer', 'id']);
    expect(splitStringToWords(null)).toEqual([]);
  });

  test('converts to common and extended case styles', () => {
    expect(normalizeStringToFlatCase('Example Ontology')).toBe('exampleontology');
    expect(normalizeStringToUpperFlatCase('Example Ontology')).toBe('EXAMPLEONTOLOGY');
    expect(normalizeStringToCamelCase('Example Ontology')).toBe('exampleOntology');
    expect(normalizeStringToPascalCase('example ontology')).toBe('ExampleOntology');
    expect(normalizeStringToSnakeCase('Example Ontology Value')).toBe('example_ontology_value');
    expect(normalizeStringToShoutingSnakeCase('Example Ontology Value')).toBe('EXAMPLE_ONTOLOGY_VALUE');
    expect(normalizeStringToKebabCase('My File (v1).csv')).toBe('my-file-v1-csv');
    expect(normalizeStringToTrainCase('example ontology value')).toBe('Example-Ontology-Value');
    expect(normalizeStringToCobolCase('example ontology value')).toBe('EXAMPLE-ONTOLOGY-VALUE');
  });

  test('normalizes ASCII slugs without splitting existing alphanumeric runs', () => {
    expect(normalizeStringToAsciiSlug('2026-07-29T12:00:00.000Z')).toBe('2026-07-29t12-00-00-000z');
    expect(normalizeStringToAsciiSlug('  ontology report: v1/owl  ', { separator: '_' })).toBe('ontology_report_v1_owl');
  });

  test('converts by named case style and detects naming styles', () => {
    expect(normalizeStringToCase('email address', 'camelCase')).toBe('emailAddress');
    expect(normalizeStringToCase('email address', 'PascalCase')).toBe('EmailAddress');
    expect(normalizeStringToCase('email address', 'snake_case')).toBe('email_address');
    expect(normalizeStringToCase('email address', 'SHOUTING_SNAKE')).toBe('EMAIL_ADDRESS');
    expect(normalizeStringToCase('email address', 'unknown', { fallbackStyle: 'kebab-case' })).toBe('email-address');
    expect(normalizeStringToCase('email address', 'unknown', { fallbackStyle: 'missing' })).toBe('emailAddress');

    expect(detectStringCaseStyle('Meeting Date')).toBe('human');
    expect(detectStringCaseStyle('meetingDate')).toBe('camelCase');
    expect(detectStringCaseStyle('MeetingDate')).toBe('PascalCase');
    expect(detectStringCaseStyle('approval_date')).toBe('snake_case');
    expect(detectStringCaseStyle('APPROVAL_DATE')).toBe('SHOUTING_SNAKE');
    expect(detectStringCaseStyle('Approval-Date')).toBe('Train-Case');
    expect(detectStringCaseStyle('APPROVAL-DATE')).toBe('COBOL-CASE');
  });

  test('builds display labels from word tokens', () => {
    expect(buildLabelFromWords(['meeting', 'date'])).toBe('Meeting Date');
    expect(buildLabelFromWords([], { fallback: 'Column' })).toBe('Column');
  });
});

describe('date and filename timestamp normalization', () => {
  test('returns local and UTC date parts for a provided date', () => {
    const date = new Date('2026-04-13T12:34:56Z');
    expect(getLocalDateParts(date)).toEqual({ year: '2026', month: '04', day: '13' });
    expect(getUtcDateParts(date)).toEqual({ year: '2026', month: '04', day: '13' });
  });

  test('falls back to current date parts for invalid date inputs', () => {
    const parts = getUtcDateParts('not-a-date');
    expect(parts).toEqual({
      year: expect.stringMatching(/^\d{4}$/),
      month: expect.stringMatching(/^\d{2}$/),
      day: expect.stringMatching(/^\d{2}$/)
    });
  });

  test('formats filename timestamps and appends before extension', () => {
    const date = new Date('2026-04-13T12:34:56Z');
    expect(getTimestampForFilename(date, { utc: true })).toBe('2026-04-13_12-34-56');
    expect(appendTimestampToFilename('report.csv', { date, utc: true })).toBe('report_2026-04-13_12-34-56.csv');
    expect(appendTimestampToFilename('report', { date, utc: true, separator: '--' })).toBe('report--2026-04-13_12-34-56');
  });
});
