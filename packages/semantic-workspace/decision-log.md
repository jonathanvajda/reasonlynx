# Decision log

## 2026-10-05 — Operations target semantic views

Application names are not artifact owners or semantic destinations. Operations
target semantic views, with applications registered only as current providers.
This permits a future unified UI or alternate provider without changing stored
artifacts or producer code.

## 2026-10-05 — Append and replace remain distinct

Term-list loading does not guess whether current table data should survive.
The workspace presents separate append and replace operations. Append merges a
duplicate IRI, falling back to a normalized label only when no IRI is present.

## 2026-10-05 — Consumers pull artifacts

Operations are shown only in their consuming semantic view. For example, TOM
offers append and replace actions for a CQ term-list artifact while the user is
in TOM; CQ Ferret only publishes the artifact and does not push it into TOM.
