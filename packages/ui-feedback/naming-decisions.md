# Naming Decisions

## Accepted Naming Pattern

- Use `create*` for pure descriptors and factories.
- Use `render*` for DOM mutation.
- Use `read*` and `write*` for storage access.
- Use `apply*` for applying a preference to an existing UI surface.
- Use `toggle*` only for a user action that computes the next value.
- Use `run*Action` for command wrappers that execute caller-provided work.

## Rejected or Deprecated Names

|Name|Reason|Replacement|
|:---|:---|:---|
|`setStatus`|Does not say whether it creates state, mutates DOM, or persists anything.|`renderStatusMessage` or `createStatusPresentation`.|
|`setDbStatus`|App/header-specific and mixes state calculation with rendering in some copies.|`createStatusPresentation` plus app-specific DB status adapter.|
|`showToast`|Acceptable user-facing language but less precise than render semantics.|`renderToastNotification`.|
|`makeLogger`|Factory name is generic and does not state console scope.|`createScopedConsoleLogger`.|
|`safeAsync`|Does not state whether failures are swallowed or rethrown.|`runLoggedAsyncAction`; app-local swallowing remains explicit if needed.|
|`initTheme`|Too broad; can include storage read, system preference, DOM mutation, and listener registration.|Compose `readThemePreference`, `applyThemePreference`, and app-local listener setup.|
|`saveTheme`|Ambiguous storage target.|`writeThemePreference`.|

## Notes

- App-specific names may remain for workflow commands, but their internals should call the promoted functions.
- Persistent setting keys should be full IRIs supplied by app/data-management code, not string constants invented in `ui-feedback`.
