# Ontology Utils Migration Notes

1. Import only the function needed by the app module.
2. Replace local predicates first because they have the lowest behavioral risk.
3. Replace ontology file preflight checks after confirming the app still sends
   accepted inputs through RDF IO parsing.
4. Replace UUID helpers last where saved IDs or graph IRIs are user-visible.
5. Delete local duplicates immediately after each app check passes.

Expected first pilots:

- Simple pilot: Table Nova XSD datatype helpers.
- Demanding pilot: Axiolotl IRI, RDF term, UUID, and graph IRI helpers.
