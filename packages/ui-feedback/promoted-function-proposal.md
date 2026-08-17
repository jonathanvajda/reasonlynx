# Promoted Function Proposal

## Capability Family

- **Capability family:** Toast notifications, logging utils, status notifications, lightmode-darkmode
- **Package:** `packages/ui-feedback`
- **Status:** Initial promoted package proposed with Jest characterization coverage.

## Proposed Functions

|Function|Purpose|Inputs|Outputs|Side effects|Promotion rationale|
|:---|:---|:---|:---|:---|:---|
|`normalizeFeedbackSeverity(value, fallback)`|Normalize status/toast severity values.|Candidate severity string and fallback.|`info`, `success`, `warning`, `error`, `idle`, or `busy`.|None.|Avoids divergent `isError`, `kind`, and `type` conventions.|
|`createStatusPresentation(input)`|Create an accessible status descriptor.|Message, severity, busy flag, metadata.|Frozen presentation object.|None.|Preserves Axiolotl's pure presentation pattern for every app.|
|`renderStatusMessage(target, presentation, options)`|Render status presentation into an existing element.|DOM target; status descriptor/message; class prefix.|Structured result.|DOM mutation.|Replaces local `setStatus` copies without forcing app-specific markup.|
|`clearStatusMessage(target, options)`|Clear a status element to idle state.|DOM target and optional idle text.|Structured result.|DOM mutation.|Provides a consistent status reset operation.|
|`inferToastSeverity(title)`|Infer toast severity from common message text.|Title/status text.|`success`, `warning`, `error`, or `info`.|None.|Preserves Table Nova's useful inference pattern as optional sugar.|
|`resolveToastContainer(options)`|Resolve or create a toast container.|Existing container, container id, document adapter.|DOM element or null.|May create DOM node.|Supports both Axiolotl-style auto container and SPV-style fixed region.|
|`renderToastNotification(options)`|Render an accessible toast.|Message/title/severity/container/document/window/timing.|Structured result with element and severity.|DOM mutation and timers.|Unifies Axiolotl, Table Nova, TOM, and SPV toast behavior.|
|`normalizeLogLevel(value, fallback)`|Normalize console log levels.|Candidate level.|`debug`, `info`, `warn`, or `error`.|None.|Makes logger adapters predictable.|
|`createScopedConsoleLogger(options)`|Create an injected scoped logger.|Scope, enabled flag, console adapter.|Logger object.|Console output when called.|Unifies `makeLogger`, `logEvent`, and `createLogger`.|
|`runLoggedAsyncAction(logger, eventName, action)`|Log and rethrow async UI action failures.|Logger, event name, async action.|Promise of action result.|Console/log side effect on failure.|Replaces repeated `try/catch console.error setStatus` wrappers while preserving failure visibility.|
|`normalizeThemePreference(value, fallback)`|Normalize theme preference values.|Candidate theme.|`light` or `dark`.|None.|Keeps durable theme values app-independent.|
|`applyThemePreference(input)`|Apply theme to DOM root and optional toggle.|Theme, root element, toggle element, attribute.|Structured result with normalized theme.|DOM mutation.|Separates theme rendering from storage.|
|`readThemePreference(settingsStore, options)`|Read theme from shared settings store.|Injected settings store and ontology-backed setting key.|`light`, `dark`, or fallback/null.|IndexedDB through caller-provided store.|Avoids localStorage and avoids package-owned setting-key invention.|
|`writeThemePreference(settingsStore, theme, options)`|Write normalized theme to shared settings store.|Injected settings store, theme, setting key.|Normalized theme.|IndexedDB through caller-provided store.|Consolidates IDB theme persistence.|
|`toggleThemePreference(input)`|Toggle, apply, and optionally persist theme.|Current theme/root/toggle/settings store/key.|Next theme.|DOM mutation and optional IDB write.|Replaces duplicate header/OCD toggle functions.|

## App Adoption Plan

|App|Conditional changes if package is adopted|
|:---|:---|
|OntoEagle|Replace local `setStatus` functions in catalog/search/bundler/viewer/project explorer with `renderStatusMessage`. Replace site-header theme internals with `readThemePreference`, `writeThemePreference`, `applyThemePreference`, and `toggleThemePreference` after the theme setting key is ontology-backed. Keep header layout rendering outside this package.|
|Tabular Ontology Maker|Replace `showToast` in `tom-core.js` with `renderToastNotification`. Keep Glide grid theme building local. Use shared status renderer for future save/import/export statuses.|
|Axiolotl|Replace `showToast` in `semantic-core.js` with `renderToastNotification`; replace status render helpers with shared presentation/render helpers. Keep graph count and SPARQL endpoint counting local. Consider later promotion of `withDebug` only if several apps need function instrumentation.|
|Ontology Compliance Diagnostic|Translate `ocd-theme-light`/`ocd-theme-dark` to canonical `light`/`dark` at the adapter boundary; use shared theme storage helpers. Replace main/measures/NLP status setters with `renderStatusMessage`.|
|Visual Lynx|Replace local `makeLogger` copies with `createScopedConsoleLogger`. Add shared status/toast only where user-visible notifications are rendered.|
|SPARQL Pattern Visualizer|Replace `logEvent`/`logError` with `createScopedConsoleLogger`; replace `showToast` with `renderToastNotification`; replace `#svizToastRegion` / `sviz-toast-*` markup and CSS with the shared `#toast-container` / `.toast-*` contract.|
|Ontology Tabulator|Replace `logEvent`/`logError` with `createScopedConsoleLogger`. Use status renderer if/when visible import/export status is formalized.|
|Table Nova|Replace `createLogger`, `safeAsync`, `createToastBus`, and `inferToastKind` with shared logger/toast functions. Keep app-specific toast text and CSS local.|
|IRI Swapper|Replace `setStatus` with `renderStatusMessage`; replace `runUiAction` with `runLoggedAsyncAction` plus app-specific error status rendering.|
|Mermaid|Use shared logger/status/theme helpers during its eventual project-management migration; do not force direct adoption until its concept-model UI layer is inventoried in detail.|

## Data Modeling Constraint

- This package does not define local data properties for persisted settings.
- Persistent preference records must be stored through the shared IndexedDB settings store.
- Setting keys must be caller-provided ontology-backed full IRIs when persisted. The package intentionally does not hard-code `ui.theme`.
- Compact keys are not used for durable JSON-LD data. UI strings such as `light` and `dark` are controlled literal values, not local data properties.

## Test Expectations

Implemented package tests cover:

- Severity and theme normalization.
- Pure status presentation descriptors.
- DOM status rendering and clearing through fake elements.
- Toast severity inference and container rendering with injected document/window adapters.
- Scoped logger emission with injected console adapter.
- Async failure logging with rethrow semantics.
- Theme read/write/toggle behavior through an injected IDB-like settings store.

Additional tests should be added during rewiring:

- App-specific CSS class mapping for OCD theme values.
- Site-header theme persistence with the real project portfolio settings store.
- Toast queue cap behavior with more than eight messages.
- IRI Swapper and TOM status/toast UI smoke tests after old local helpers are deleted.

## Shared Toast CSS

Toast CSS should use the shared unscoped selector contract in `src/toast.css`:

- `#toast-container`
- `.toast-region`
- `.toast`
- `.toast--info`
- `.toast--success`
- `.toast--warning`
- `.toast--error`

SPARQL Pattern Visualizer's `sviz-*` CSS namespace should stay limited to visualizer-specific canvas/layout controls. Toast notifications are shared app feedback and should not remain `sviz-toast-*`.
