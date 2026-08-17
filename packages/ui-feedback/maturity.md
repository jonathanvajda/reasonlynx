# Maturity Assessment

## Capability Family

- **Capability family:** Toast notifications, logging utils, status notifications, lightmode-darkmode
- **Package:** `packages/ui-feedback`
- **Current maturity:** Level 4 for the proposed package; Level 2-4 across current app-local implementations.

## Maturity Rating

```
0 - Local only
1 - Candidate
2 - Characterized
3 - Extractable
4 - Shared package ready
5 - Canonical across apps
```

## Package Status

|Area|Current rating|Reason|
|:---|:---:|:---|
|Status presentation|4|Pure descriptor and DOM adapter are documented and tested.|
|Toast notifications|4|Shared DOM adapter is accessible, safe, injected for tests, and compatible with existing app patterns.|
|Logging utilities|4|Scoped logger and async action wrapper are dependency-free and tested.|
|Theme preference|4|Canonical `light/dark` values, DOM application, and injected settings-store persistence are tested. Needs ontology-backed setting-key decision before level 5 adoption.|
|Cross-app rewiring|1|Inventory is complete, but app rewiring/deletion is not started for this capability family.|

## Level 5 Requirements

- Add or select ontology-backed setting keys for theme and language preferences.
- Rewire OntoEagle/Table Nova site headers to the shared theme helpers without breaking byte-for-byte mirrored header expectations.
- Rewire TOM, Axiolotl, SPV, Table Nova, IRI Swapper, OCD, Visual Lynx, and Ontology Tabulator to shared logger/status/toast utilities where relevant.
- Delete app-local duplicate functions after successful rewiring.
- Preserve or add Jest coverage for representative old behavior before deletion.
- Confirm no active localStorage usage remains for theme/status/logging preferences.

## Current Decision

Do not mark this family level 5 yet. The package is ready for pilot rewiring, but canonical status requires app adoption and duplicate deletion.
