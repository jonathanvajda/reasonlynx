import {
  UiFeedbackError,
  applyThemePreference,
  clearStatusMessage,
  createScopedConsoleLogger,
  createStatusPresentation,
  inferToastSeverity,
  normalizeFeedbackSeverity,
  normalizeLogLevel,
  normalizeThemePreference,
  readThemePreference,
  renderStatusMessage,
  renderToastNotification,
  runLoggedAsyncAction,
  toggleThemePreference,
  writeThemePreference
} from '../src/index.js';

function createFakeElement(tagName = 'div') {
  const attrs = new Map();
  const classes = new Set();
  const element = {
    tagName,
    textContent: '',
    title: '',
    id: '',
    tabIndex: -1,
    children: [],
    ownerDocument: null,
    firstElementChild: null,
    appendChild(child) {
      child.parentElement = element;
      element.children.push(child);
      element.firstElementChild = element.children[0] || null;
      return child;
    },
    remove() {
      if (!element.parentElement) return;
      element.parentElement.children = element.parentElement.children.filter((child) => child !== element);
      element.parentElement.firstElementChild = element.parentElement.children[0] || null;
    },
    setAttribute(name, value) {
      attrs.set(name, String(value));
    },
    getAttribute(name) {
      return attrs.get(name) || null;
    },
    addEventListener() {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name)
    },
    _attrs: attrs,
    _classes: classes
  };
  return element;
}

function createFakeDocument() {
  const body = createFakeElement('body');
  const documentElement = createFakeElement('html');
  const byId = new Map();
  return {
    body,
    documentElement,
    createElement(tagName) {
      const element = createFakeElement(tagName);
      element.ownerDocument = this;
      return element;
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    register(element) {
      byId.set(element.id, element);
      element.ownerDocument = this;
      return element;
    }
  };
}

describe('status presentation utilities', () => {
  test('normalizes severities and creates accessible status presentations', () => {
    expect(normalizeFeedbackSeverity('ERROR')).toBe('error');
    expect(normalizeFeedbackSeverity('unknown', 'warning')).toBe('warning');

    expect(createStatusPresentation({ message: 'Saved', severity: 'success' })).toEqual({
      message: 'Saved',
      severity: 'success',
      ariaLive: 'polite',
      role: 'status',
      busy: false,
      metadata: null
    });
    expect(createStatusPresentation({ message: 'Failed', severity: 'error' }).role).toBe('alert');
  });

  test('renders and clears status messages without throwing on missing targets', () => {
    const element = createFakeElement();
    const rendered = renderStatusMessage(element, { message: 'Loading', busy: true }, { classPrefix: 'app-status' });

    expect(rendered.ok).toBe(true);
    expect(element.textContent).toBe('Loading');
    expect(element.getAttribute('aria-busy')).toBe('true');
    expect(element.classList.contains('app-status--busy')).toBe(true);

    expect(clearStatusMessage(element).ok).toBe(true);
    expect(element.getAttribute('data-status-severity')).toBe('idle');
    expect(renderStatusMessage(null, 'Ignored').value).toBe(null);
  });
});

describe('toast notifications', () => {
  test('infers severity from common status words', () => {
    expect(inferToastSeverity('Export failed')).toBe('error');
    expect(inferToastSeverity('Rows deleted')).toBe('warning');
    expect(inferToastSeverity('Run created')).toBe('success');
    expect(inferToastSeverity('Heads up')).toBe('info');
  });

  test('renders toast notifications into an existing or created container', () => {
    const doc = createFakeDocument();
    const win = { setTimeout: (fn) => { fn(); return 1; } };
    const result = renderToastNotification({
      title: 'Saved',
      message: 'Project saved',
      documentRef: doc,
      windowRef: win,
      timeoutMs: 1
    });

    expect(result.ok).toBe(true);
    expect(doc.body.children[0].id).toBe('toast-container');
    expect(doc.body.children[0].children.length).toBe(0);
  });
});

describe('logging utilities', () => {
  test('creates a scoped logger with enabled flag and stable levels', () => {
    const calls = [];
    const consoleRef = {
      debug: (...args) => calls.push(['debug', ...args]),
      info: (...args) => calls.push(['info', ...args]),
      warn: (...args) => calls.push(['warn', ...args]),
      error: (...args) => calls.push(['error', ...args])
    };
    const logger = createScopedConsoleLogger({ scope: 'test', consoleRef });

    logger.info('saved', { count: 1 });
    logger.emit('bad-level', 'fallback');

    expect(normalizeLogLevel('WARN')).toBe('warn');
    expect(calls[0][1]).toBe('[test] saved');
    expect(calls[1][0]).toBe('info');
  });

  test('logs and rethrows async action failures', async () => {
    const events = [];
    const logger = { error: (event, data) => events.push([event, data]) };

    await expect(runLoggedAsyncAction(logger, 'load', async () => {
      throw new Error('nope');
    })).rejects.toThrow('nope');
    expect(events[0][0]).toBe('load.failed');
  });
});

describe('theme preference utilities', () => {
  test('normalizes and applies light/dark theme preferences', () => {
    const root = createFakeElement('html');
    const toggle = createFakeElement('button');

    expect(normalizeThemePreference('DARK')).toBe('dark');
    expect(applyThemePreference({ theme: 'dark', rootElement: root, toggleElement: toggle }).value).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  test('reads, writes, and toggles theme with an injected settings store', async () => {
    const values = new Map();
    const settingsStore = {
      async readSettingValue(key, fallback) {
        return values.has(key) ? values.get(key) : fallback;
      },
      async writeSettingValue(key, value) {
        values.set(key, value);
        return value;
      }
    };
    const root = createFakeElement('html');

    await expect(writeThemePreference(settingsStore, 'dark', { settingKey: 'https://example.org/setting/theme' })).resolves.toBe('dark');
    await expect(readThemePreference(settingsStore, { settingKey: 'https://example.org/setting/theme' })).resolves.toBe('dark');
    await expect(toggleThemePreference({
      currentTheme: 'dark',
      rootElement: root,
      settingsStore,
      settingKey: 'https://example.org/setting/theme'
    })).resolves.toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
    await expect(readThemePreference(settingsStore, { settingKey: '' })).rejects.toThrow(UiFeedbackError);
  });
});
