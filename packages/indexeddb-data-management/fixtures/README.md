# Fixtures

Fixture files for this package should cover:

- `project-basic.json`: one project with settings and two artifacts.
- `artifact-rdf-source.json`: uploaded RDF source artifact metadata.
- `artifact-rdf-loaded-quads.json`: loaded default-graph and named-graph quad rows.
- `artifact-tabular-source.json`: uploaded tabular source artifact metadata.
- `run-transformation.json`: transformation run with input/output artifacts.
- `run-diagnostic.json`: diagnostic run with report artifact.
- `query-artifacts.json`: SPARQL, SQL, and NoSQL query artifacts.
- `mermaid-project.json`: project with nested Mermaid diagram artifacts.
- `migration-axiolotl-default-graph.json`: empty-string graph rows converted to canonical `graph: null`.

The current Jest suite uses inline fixtures while the promoted API is still being shaped. Move repeated app migration cases into JSON fixtures before cross-app rollout.
