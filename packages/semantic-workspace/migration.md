# Migration

1. Keep application manifests limited to artifact discovery.
2. Register each user-visible transformation in the semantic operation registry.
3. Register the current UI provider for the destination semantic view.
4. Put representation conversion and merge policy in pure functions.
5. Put storage, navigation, and rendering effects in a thin application adapter.
6. Add contract tests before removing the previous application-specific action.

The first completed reference path is a CQ term list to TOM ontology table,
with separate append and replace operations. Saved SPARQL query insertion into
CQ Ferret uses the same routing contract.
