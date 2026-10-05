# Semantic workspace inventory

| ID | Capability | Maturity | Evidence |
| --- | --- | --- | --- |
| SWO-001 | Match artifacts to semantic operations | Shared | `semantic-operation-registry.js` and tests |
| SWO-002 | Route operations to semantic view providers | Shared | `view-provider-registry.js` and tests |
| SWO-003 | Project term lists into ontology-table rows | Shared | `term-list-ontology-table.js` and tests |
| SWO-004 | Append or replace ontology-table rows | Shared | Pure combination tests and TOM adapter |
| SWO-005 | Append stored SPARQL query text to a CQ | Shared pilot | CQ Ferret adapter and shared operation declaration |
| SWO-006 | Classify recognized file representations as portable source artifacts | Shared | MIME-registry adapter, workspace file ingress, and tests |

Browser navigation, IndexedDB reads/writes, grid replacement, and notifications
are deliberately adapter responsibilities and are not part of the pure core.
