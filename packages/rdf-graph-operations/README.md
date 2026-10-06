# RDF Graph Operations

Runtime-neutral RDF graph planning and transformation helpers shared by
ReasonLynx applications.

The package currently exposes ontology source normalization and direct-import
decision planning. It deliberately does not yet expose ontology merge execution
or semantic graph differencing; the maturity gaps for those functions are
tracked in `merge-diff-function-inventory.md`.

```js
import {
  createOntologyImportDecisionRows,
  createOntologyMergeSource
} from './src/index.js';
```

The core accepts RDF/JS-compatible data and does not read files, access the DOM,
download output, or persist state.
