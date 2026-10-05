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

## 2026-10-05 — File ingress precedes stored workspace content

The workspace places Add files immediately below the project heading, before
knowledge bases and artifacts. File selection is universal, while post-store
choices come from the current consuming view. TOM currently contributes
spreadsheet/ontology interpretation and append/replace controls.

## 2026-10-05 — Operation history is secondary disclosure

Operation history is collapsed by default because it supports explanation and
diagnosis rather than the primary workspace flow. Expanded entries resolve
input/output artifact names and safe scalar facts. Users may clean unavailable
records selectively or clear all history without deleting artifacts.
