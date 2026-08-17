# Equivalence Matrix

## Capability Family

- **Capability family:** Toast notifications, logging utils, status notifications, lightmode-darkmode
- **Package:** `packages/ui-feedback`

## Deep Comparison

|Concern|Observed implementations|Comparison|Canonical decision|
|:---|:---|:---|:---|
|Naming convention|`setStatus`, `setDbStatus`, `showToast`, `createToastBus`, `makeLogger`, `logEvent`, `setTheme`, `toggleTheme`, `initTheme`.|Most names are action-oriented but under-specific. `setStatus` hides whether the function mutates DOM, creates a presentation model, or persists state.|Use explicit verbs: `createStatusPresentation`, `renderStatusMessage`, `clearStatusMessage`, `renderToastNotification`, `createScopedConsoleLogger`, `runLoggedAsyncAction`, `readThemePreference`, `writeThemePreference`, `applyThemePreference`, `toggleThemePreference`.|
|Inputs/domain|Status and toast functions accept strings plus inconsistent severity tokens. Theme functions accept `light/dark` in mirrored header code and app-specific `ocd-theme-*` classes in OCD.|The reusable domain is user-feedback presentation, not app layout. Canonical theme values should be `light` and `dark`; app-specific classes are adapters.|Normalize severity and theme values at package boundary. Allow caller-provided DOM elements, document/window adapters, and settings stores.|
|Outputs/range|Most functions return `undefined`; Axiolotl pure status functions return presentation objects; Table Nova factories return logger/toast-bus objects.|Pure presentation objects are more testable. DOM rendering should return a no-op/success result instead of throwing on absent optional elements.|Pure functions return frozen descriptors. DOM adapters return `{ ok, value }` or `{ ok, error }`. Settings writes return the normalized persisted value.|
|Error handling|SPV toast catches and logs; Table Nova `safeAsync` swallows; IRI Swapper `runUiAction` catches and renders status; many status functions ignore missing DOM.|A shared package should distinguish optional DOM no-op from real invalid durable operations. Swallowing async errors should not be the default because it hides failed user workflows.|DOM-missing is a successful no-op. Render failures return `UiFeedbackError`. Settings helper missing key throws `UiFeedbackError`. `runLoggedAsyncAction` logs and rethrows.|
|Logging model|SPV/Ontology Tabulator use exported `logEvent`/`logError`; Visual Lynx uses local `makeLogger`; Axiolotl has verbose debug wrappers; Table Nova has a scoped logger.|The best shared contract is an injected, scoped logger with enabled flag and console adapter. Debug wrappers are useful but too broad for the first package.|Promote `createScopedConsoleLogger` first. Revisit debug function wrapping after more call sites ask for it.|
|Toast accessibility|Axiolotl sets `aria-live`, `aria-atomic`, role, focusability, queue cap, hover/focus pause. SPV and Table Nova are simpler.|Axiolotl is the strongest behavior but has hard-coded CSS classes and icons. SPV also scopes toast classes as `sviz-toast`, but toast is not canvas-specific and should not remain app-scoped.|Promote safe DOM node creation, severity role mapping, queue cap, optional auto-created container, and canonical unscoped toast selectors.|
|Status accessibility|Header DB status uses `aria-live`; many local status helpers only set text.|User-facing status messages should have role and live-region attributes.|Promote `renderStatusMessage` to set role, `aria-live`, `aria-busy`, `data-status-severity`, and a class prefix.|
|Theme persistence|OntoEagle/Table Nova site headers persist `ui.theme` to project portfolio IDB settings. OCD persists app-specific class values in shared settings.|The storage direction is correct, but raw setting keys and app-specific values should be normalized.|Shared package persists canonical `light/dark` only, via injected settings store and caller-supplied ontology-backed setting key. App adapters can translate to CSS classes.|
|Side effects|DOM mutation, timers, console output, IDB setting writes, `matchMedia` reads.|These side effects are separable.|Keep pure presentation separate from DOM adapters. Keep theme storage separate from applying theme to DOM. Inject console/window/document/settings adapters for tests.|
|Vendor dependencies|None.|No third-party dependency needed.|Keep dependency-free.|
|Test fixture availability|Existing apps lacked direct Jest for these utilities. Manual validation exists for recent migrations.|The package needs representative DOM-free fake element tests.|Added package Jest tests for status, toast, logger, async failure logging, and theme settings.|

## Promotion Decisions

- `createStatusPresentation` is level 4 immediately: pure, deterministic, and app-independent.
- `renderStatusMessage` is level 4: DOM side effect is explicit and injected through the target element.
- `renderToastNotification` is level 4: DOM/timer side effects are explicit, safe, and fixture-testable.
- `createScopedConsoleLogger` is level 4: console side effect is explicit and can be disabled or injected.
- `runLoggedAsyncAction` is level 4: behavior is narrow and preserves failure semantics.
- Theme helpers are level 4: they use canonical `light/dark` values and injected settings stores, but setting-key ontology terms still need to be settled before level 5.

## Not Promoted Yet

- Header navigation rendering and DB utility widgets belong in a later site-header/UI-shell package.
- Glide Data Grid theme construction belongs in a grid adapter package, not generic light/dark preference utilities.
- Axiolotl `withDebug` is not promoted yet because function wrapping can obscure stack traces and needs stricter opt-in conventions.
- SPV `sviz-toast-*` classes should be retired during rewiring. The `sviz` namespace can remain for canvas/query-visualizer UI, but shared toast notifications should use `#toast-container`, `.toast-region`, `.toast`, and `.toast--{severity}`.
