# Side-Effect Boundaries

## Pure Core

- `normalizeFeedbackSeverity`
- `createStatusPresentation`
- `inferToastSeverity`
- `normalizeLogLevel`
- `normalizeThemePreference`

These functions perform no DOM, storage, console, timer, or network work.

## DOM Adapters

- `renderStatusMessage`
- `clearStatusMessage`
- `resolveToastContainer`
- `renderToastNotification`
- `applyThemePreference`

These functions mutate existing UI elements or create toast elements. They accept injected DOM references where needed for Jest and later headless testing.

Toast DOM adapters should use the shared unscoped class contract:

- `#toast-container` or `.toast-region` for the container
- `.toast` for each notification
- `.toast--info`, `.toast--success`, `.toast--warning`, `.toast--error` for severity

App-scoped toast selectors such as `sviz-toast-*` are considered migration targets, not the canonical API.

## Storage Adapters

- `readThemePreference`
- `writeThemePreference`
- `toggleThemePreference` when `settingsStore` and `settingKey` are supplied.

These functions depend on the shared IndexedDB settings-store interface, but they do not open a database themselves.

## Logging Adapters

- `createScopedConsoleLogger`
- `runLoggedAsyncAction`

These functions write to an injected console-like object or to `globalThis.console`. `runLoggedAsyncAction` logs and rethrows errors.

## Out Of Scope

- Site-header layout rendering.
- DB inspection widgets.
- App-specific status text construction from graph counts, query endpoint state, or workflow state.
- LocalStorage/sessionStorage persistence.
- CSS theme palettes and app-specific class names.
