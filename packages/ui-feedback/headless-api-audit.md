# Headless API Audit

## Capability Family

- **Capability family:** Toast notifications, logging utils, status notifications, lightmode-darkmode
- **Date updated:** 2026-08-16

## Audit Conclusion

The `ui-feedback` package is adapter-oriented by design. It exposes pure presentation helpers plus explicit browser/logging adapters for status messages, toast notifications, scoped logging, and theme preference persistence.

The stable headless surface is the presentation and preference model. DOM mutation, console logging, and settings persistence are explicit adapters with injected runtime handles.

## Public API Groups

| API group | Representative exports | Boundary category | Side effects | Headless status |
| --- | --- | --- | --- | --- |
| Feedback errors | `UiFeedbackError`, `createUiFeedbackValidationError` | Pure error model | None | Stable |
| Status presentation | `normalizeFeedbackSeverity`, `createStatusPresentation` | Pure core | None | Stable |
| Status rendering | `renderStatusMessage`, `clearStatusMessage` | DOM adapter | Mutates supplied status element | Stable adapter |
| Toast presentation/rendering | `inferToastSeverity`, `resolveToastContainer`, `renderToastNotification` | Pure classifier plus DOM adapter | Creates/mutates toast container and toast nodes through injected/default document/window | Stable adapter |
| Logging | `normalizeLogLevel`, `createScopedConsoleLogger`, `runLoggedAsyncAction` | Pure level model plus logger adapter | Calls injected/default console when enabled | Stable adapter |
| Theme preference | `normalizeThemePreference`, `applyThemePreference`, `readThemePreference`, `writeThemePreference`, `toggleThemePreference` | Pure preference model plus DOM/settings adapter | Applies DOM attribute/class and reads/writes injected settings store | Stable adapter |

## Boundary Rules

- App UI code should use this package instead of local status, toast, logger, and light/dark-mode helpers.
- Pure helpers must remain usable in Node/Jest without DOM.
- DOM helpers must accept injected elements or document/window handles.
- Theme persistence must use injected settings stores, not `localStorage`.
- Logging helpers must accept injected logger/console handles for tests and non-browser adapters.

## Headless Coverage

Jest covers severity normalization, accessible status presentations, status rendering with mock elements, toast severity inference, toast rendering with mock DOM, scoped logging with injected loggers, async action logging/rethrow behavior, theme normalization/application, and theme read/write/toggle through an injected settings store.

