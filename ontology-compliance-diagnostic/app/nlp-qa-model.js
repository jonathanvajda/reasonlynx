// app/nlp-qa-model.js
// @ts-check

import { NLP_QA_ENGLISH_LEXICON_WORDS } from './data/nlp-qa-english-lexicon.js';

/**
 * @typedef {'pass' | 'warning' | 'fail'} NlpQaStatus
 * @typedef {'error' | 'warning' | 'info'} NlpQaSeverity
 * @typedef {Object} NlpQaCheckModes
 * @property {boolean} spelling
 * @property {boolean} grammar
 * @property {boolean} aristotelian
 * @typedef {Object} NlpQaToken
 * @property {string} text
 * @property {number} start
 * @property {number} end
 * @typedef {Object} NlpQaIssue
 * @property {string} id
 * @property {string} checker
 * @property {string} category
 * @property {NlpQaSeverity} severity
 * @property {string} code
 * @property {string} message
 * @property {number} start
 * @property {number} end
 * @property {string} text
 * @property {string} [fieldName]
 * @property {string} [iri]
 * @property {string[]} [suggestions]
 * @property {Record<string, unknown>} [metadata]
 * @typedef {Object} NlpQaCheckResult
 * @property {NlpQaStatus} status
 * @property {NlpQaIssue[]} issues
 */

const DEFAULT_BUILTIN_WORDS = Object.freeze([
  'a', 'an', 'and', 'are', 'as', 'be', 'by', 'can', 'class', 'defined', 'entity',
  'for', 'has', 'in', 'is', 'it', 'of', 'on', 'or', 'process', 'quality', 'role',
  'some', 'that', 'the', 'thing', 'to', 'which', 'whose', 'with',
  'act', 'agent', 'artifact', 'attribute', 'bearer', 'bears', 'borne', 'category',
  'continuant', 'dependent', 'disposition', 'function', 'independent', 'material',
  'object', 'occurs', 'part', 'participant', 'plan', 'quality', 'realizable',
  'relation', 'site', 'specifically', 'temporal', 'time'
]);

/** @type {ReadonlySet<string>} */
const TECHNICAL_ALLOWLIST = Object.freeze(new Set([
  'bfo', 'cco', 'iao', 'iri', 'iri', 'obo', 'owl', 'rdf', 'rdfs', 'skos', 'xsd'
]));

export const DEFAULT_NLP_QA_CHECK_MODES = Object.freeze({
  spelling: true,
  grammar: true,
  aristotelian: false
});

/**
 * Creates a stable issue id from its meaningful fields.
 *
 * @param {Pick<NlpQaIssue, 'checker' | 'code' | 'start' | 'end' | 'text'> & { fieldName?: string, iri?: string }} input
 * @returns {string}
 */
export function createStableNlpQaIssueId(input) {
  return [
    input.checker,
    input.code,
    input.iri || '',
    input.fieldName || '',
    String(input.start),
    String(input.end),
    input.text
  ].join(':');
}

/**
 * Normalizes a token for lexicon lookup.
 *
 * @param {string} token
 * @returns {string}
 */
export function normalizeTokenForNlpQaLexicon(token) {
  return String(token || '')
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/^['"`]+|['"`]+$/g, '')
    .toLowerCase();
}

/**
 * Normalizes partial mode input into a complete check-mode object.
 *
 * @param {Partial<NlpQaCheckModes> | null | undefined} modes
 * @param {NlpQaCheckModes} [defaults]
 * @returns {NlpQaCheckModes}
 */
export function normalizeNlpQaCheckModes(modes, defaults = DEFAULT_NLP_QA_CHECK_MODES) {
  return {
    spelling: modes?.spelling ?? defaults.spelling,
    grammar: modes?.grammar ?? defaults.grammar,
    aristotelian: modes?.aristotelian ?? defaults.aristotelian
  };
}

/**
 * Tokenizes text into word-like spans. Compromise may be supplied for sentence
 * awareness, while offsets stay regex-derived for deterministic highlighting.
 *
 * @param {string} text
 * @param {{ compromiseNlp?: ((text: string) => unknown) | null }} [options]
 * @returns {NlpQaToken[]}
 */
export function tokenizeTextIntoNlpQaTokens(text, options = {}) {
  const source = String(text || '');
  if (typeof options.compromiseNlp === 'function') {
    try {
      options.compromiseNlp(source);
    } catch {
      // Compromise is an optional tokenizer aid; offset tokenization remains deterministic.
    }
  }

  /** @type {NlpQaToken[]} */
  const tokens = [];
  const wordPattern = /[A-Za-z][A-Za-z0-9]*(?:[-'\u2019][A-Za-z0-9]+)*/g;
  let match = wordPattern.exec(source);
  while (match) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
    match = wordPattern.exec(source);
  }
  return tokens;
}

/**
 * Builds a lexicon from built-in words, ontology terms, and user allowlists.
 *
 * @param {{ words?: Iterable<string>, ontologyWords?: Iterable<string>, allowlist?: Iterable<string> }} [config]
 * @returns {Set<string>}
 */
export function buildNlpQaLexicon(config = {}) {
  const lexicon = new Set();
  for (const word of NLP_QA_ENGLISH_LEXICON_WORDS) {
    lexicon.add(word);
  }
  for (const word of DEFAULT_BUILTIN_WORDS) {
    lexicon.add(word);
  }
  for (const word of TECHNICAL_ALLOWLIST) {
    lexicon.add(word);
  }
  for (const source of [config.words, config.ontologyWords, config.allowlist]) {
    if (!source) {
      continue;
    }
    for (const word of source) {
      const normalized = normalizeTokenForNlpQaLexicon(word);
      if (normalized) {
        lexicon.add(normalized);
      }
    }
  }
  return lexicon;
}

/**
 * Returns true when a token should bypass spelling checks.
 *
 * @param {string} token
 * @returns {boolean}
 */
export function shouldSkipTokenForNlpQaSpelling(token) {
  const value = String(token || '');
  return (
    value.length <= 1 ||
    /\d/.test(value) ||
    /^[A-Z]{2,}$/.test(value) ||
    /^[A-Z][a-z]+[A-Z]/.test(value)
  );
}

/**
 * Returns candidate lexicon forms for simple English inflections.
 *
 * @param {string} token
 * @returns {string[]}
 */
export function deriveNlpQaSpellingLookupForms(token) {
  const normalized = normalizeTokenForNlpQaLexicon(token);
  const forms = new Set([normalized]);
  if (normalized.endsWith("'s") && normalized.length > 3) {
    forms.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("s'") && normalized.length > 3) {
    forms.add(normalized.slice(0, -1));
    forms.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith('ies') && normalized.length > 4) {
    forms.add(`${normalized.slice(0, -3)}y`);
  }
  if (normalized.endsWith('es') && normalized.length > 3) {
    forms.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith('s') && normalized.length > 3) {
    forms.add(normalized.slice(0, -1));
  }
  if (normalized.endsWith('ing') && normalized.length > 5) {
    forms.add(normalized.slice(0, -3));
    forms.add(`${normalized.slice(0, -3)}e`);
  }
  if (normalized.endsWith('ed') && normalized.length > 4) {
    forms.add(normalized.slice(0, -2));
    forms.add(`${normalized.slice(0, -1)}`);
  }
  return Array.from(forms).filter(Boolean);
}

/**
 * Returns true when any token form appears in the lexicon.
 *
 * @param {string} token
 * @param {Set<string>} lexicon
 * @returns {boolean}
 */
export function doesNlpQaLexiconContainTokenOrInflection(token, lexicon) {
  return deriveNlpQaSpellingLookupForms(token).some((form) => lexicon.has(form));
}

/**
 * Checks spelling by comparing tokens against a local lexicon.
 *
 * @param {string} text
 * @param {{ lexicon?: Set<string>, fieldName?: string, iri?: string, compromiseNlp?: ((text: string) => unknown) | null }} [options]
 * @returns {NlpQaCheckResult}
 */
export function checkTextWithNlpQaSpelling(text, options = {}) {
  const lexicon = options.lexicon || buildNlpQaLexicon();
  const tokens = tokenizeTextIntoNlpQaTokens(text, { compromiseNlp: options.compromiseNlp });
  const issues = tokens
    .filter((token) => !shouldSkipTokenForNlpQaSpelling(token.text))
    .filter((token) => !doesNlpQaLexiconContainTokenOrInflection(token.text, lexicon))
    .map((token) => {
      /** @type {NlpQaIssue} */
      const issue = {
        id: '',
        checker: 'spelling',
        category: 'spelling',
        severity: 'error',
        code: 'UNKNOWN_WORD',
        message: 'Possible spelling error.',
        fieldName: options.fieldName,
        iri: options.iri,
        start: token.start,
        end: token.end,
        text: token.text,
        suggestions: [],
        metadata: {}
      };
      issue.id = createStableNlpQaIssueId(issue);
      return issue;
    });

  return {
    status: issues.length ? 'fail' : 'pass',
    issues
  };
}

/**
 * Checks whether a definition resembles a genus-differentia form.
 *
 * @param {string} text
 * @param {{ fieldName?: string, iri?: string }} [options]
 * @returns {NlpQaCheckResult}
 */
export function checkTextWithNlpQaAristotelianForm(text, options = {}) {
  const source = String(text || '').trim();
  if (!source) {
    return { status: 'pass', issues: [] };
  }

  const looksAristotelian = /^(an?|the)\s+.+\s+(that|which|whose|in which|borne by)\b/i.test(source);
  if (looksAristotelian) {
    return { status: 'pass', issues: [] };
  }

  const token = {
    text: source,
    start: 0,
    end: source.length
  };
  const issue = createNlpQaGrammarIssue(
    'ARISTOTELIAN_FORM_NOT_DETECTED',
    'Definition may not follow a genus-differentia form.',
    token,
    options
  );
  issue.checker = 'aristotelian-definition';
  issue.category = 'genus-species-form';
  issue.id = createStableNlpQaIssueId(issue);
  return {
    status: 'warning',
    issues: [issue]
  };
}

/**
 * Checks for lightweight grammar and style issues.
 *
 * @param {string} text
 * @param {{ fieldName?: string, iri?: string, compromiseNlp?: ((text: string) => unknown) | null }} [options]
 * @returns {NlpQaCheckResult}
 */
export function checkTextWithNlpQaGrammar(text, options = {}) {
  const source = String(text || '');
  const tokens = tokenizeTextIntoNlpQaTokens(source, { compromiseNlp: options.compromiseNlp });
  /** @type {NlpQaIssue[]} */
  const issues = [];

  for (let index = 1; index < tokens.length; index += 1) {
    const previous = normalizeTokenForNlpQaLexicon(tokens[index - 1].text);
    const current = normalizeTokenForNlpQaLexicon(tokens[index].text);
    if (previous && previous === current) {
      issues.push(createNlpQaGrammarIssue('REPEATED_WORD', 'Repeated word.', tokens[index], options));
    }
  }

  const trimmed = source.trim();
  if (trimmed && !/[.!?)]$/.test(trimmed)) {
    issues.push(createNlpQaGrammarIssue('MISSING_FINAL_PUNCTUATION', 'Text may be missing final punctuation.', {
      text: trimmed.slice(-1),
      start: source.lastIndexOf(trimmed.slice(-1)),
      end: source.lastIndexOf(trimmed.slice(-1)) + 1
    }, options));
  }

  const agreementMatch = /\b([A-Z]?[a-z]+)\s+that\s+are\b/.exec(source);
  if (agreementMatch) {
    issues.push(createNlpQaGrammarIssue('SUSPICIOUS_AGREEMENT', 'Suspicious subject-verb agreement pattern.', {
      text: agreementMatch[0],
      start: agreementMatch.index,
      end: agreementMatch.index + agreementMatch[0].length
    }, options));
  }

  const openParens = (source.match(/\(/g) || []).length;
  const closeParens = (source.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    issues.push(createNlpQaGrammarIssue('UNMATCHED_PARENTHESES', 'Unmatched parentheses.', {
      text: source,
      start: 0,
      end: source.length
    }, options));
  }

  return {
    status: issues.length ? 'warning' : 'pass',
    issues
  };
}

/**
 * Creates one grammar issue.
 *
 * @param {string} code
 * @param {string} message
 * @param {NlpQaToken} token
 * @param {{ fieldName?: string, iri?: string }} options
 * @returns {NlpQaIssue}
 */
export function createNlpQaGrammarIssue(code, message, token, options = {}) {
  const issue = {
    id: '',
    checker: 'grammar',
    category: 'grammar',
    severity: /** @type {NlpQaSeverity} */ ('warning'),
    code,
    message,
    fieldName: options.fieldName,
    iri: options.iri,
    start: token.start,
    end: token.end,
    text: token.text,
    suggestions: [],
    metadata: {}
  };
  issue.id = createStableNlpQaIssueId(issue);
  return issue;
}

/**
 * Combines selected checks for one text field.
 *
 * @param {string} text
 * @param {{ lexicon?: Set<string>, fieldName?: string, iri?: string, compromiseNlp?: ((text: string) => unknown) | null, checkModes?: Partial<NlpQaCheckModes> }} [options]
 * @returns {NlpQaCheckResult}
 */
export function checkTextFieldWithNlpQa(text, options = {}) {
  const checkModes = normalizeNlpQaCheckModes(options.checkModes);
  const issues = [
    ...(checkModes.spelling ? checkTextWithNlpQaSpelling(text, options).issues : []),
    ...(checkModes.grammar ? checkTextWithNlpQaGrammar(text, options).issues : []),
    ...(checkModes.aristotelian ? checkTextWithNlpQaAristotelianForm(text, options).issues : [])
  ];
  return {
    status: deriveNlpQaStatusFromIssues(issues),
    issues
  };
}

/**
 * Derives an aggregate status from issue severities.
 *
 * @param {NlpQaIssue[]} issues
 * @returns {NlpQaStatus}
 */
export function deriveNlpQaStatusFromIssues(issues) {
  if (issues.some((issue) => issue.severity === 'error')) {
    return 'fail';
  }
  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'warning';
  }
  return 'pass';
}
