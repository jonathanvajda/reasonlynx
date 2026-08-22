/**
 * @file UI telemetry helpers (logger, toasts, safe async wrapper).
 */

import {
  createScopedConsoleLogger,
  inferToastSeverity,
  renderToastNotification
} from '../../../packages/ui-feedback/src/index.js';

/**
 * @typedef {Object} Logger
 * @property {(event: string, data?: any) => void} info
 * @property {(event: string, data?: any) => void} warn
 * @property {(event: string, data?: any) => void} error
 */

/**
 * Creates a scoped logger.
 * @param {{scope: string, enabled: boolean}} params
 * @returns {Logger}
 */
export function createLogger({ scope, enabled }) {
  return createScopedConsoleLogger({ scope: `tablenova:${scope}`, enabled });
}

/**
 * @typedef {Object} ToastBus
 * @property {(toast: {title: string, body: string, kind?: 'success'|'warning'|'error', timeoutMs?: number}) => void} show
 */

/**
 * Creates a lightweight toast bus.
 * @param {{rootId: string}} params
 * @returns {ToastBus}
 */
export function createToastBus({ rootId }) {
  return Object.freeze({
    show: ({ title, body, kind, timeoutMs = 2600 }) => {
      const result = renderToastNotification({
        title,
        message: body,
        severity: kind,
        timeoutMs,
        containerId: rootId
      });
      if (!result.ok) {
        // eslint-disable-next-line no-console
        console.error('[tablenova:toast] render failed', result.error);
      }
    }
  });
}

/**
 * Infers a shared toast style from the title used by Table Nova call sites.
 * @param {string} title
 * @returns {'success'|'warning'|'error'}
 */
export function inferToastKind(title) {
  return inferToastSeverity(title);
}

/**
 * Safely runs an async function with logging and an optional error handler.
 * @template T
 * @param {{error: (event: string, data?: any) => void}} log
 * @param {() => Promise<T>} fn
 * @param {(err: any) => void} [onError]
 * @returns {Promise<T|undefined>}
 */
export async function safeAsync(log, fn, onError) {
  try {
    return await fn();
  } catch (err) {
    log.error('safeAsync_error', { err });
    if (onError) onError(err);
    return undefined;
  }
}
