/**
 * @file ui_toast.js
 * @description Toast notifications (DOM utilities).
 */

import { logError } from "./log.js";
import { renderToastNotification } from "../../packages/ui-feedback/src/index.js";

/**
 * Show a toast message.
 * @param {string} message
 * @param {"success"|"error"|"info"} type
 * @param {{timeoutMs?: number}} opts
 */
export function showToast(message, type = "info", opts = {}) {
  try {
    const result = renderToastNotification({
      message,
      severity: type,
      timeoutMs: Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : 2600,
      containerId: "toast-container"
    });
    if (!result.ok) throw result.error;
  } catch (err) {
    logError("showToast.failed", err, { message, type });
  }
}
