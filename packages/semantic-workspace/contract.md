# Contract

An artifact is visible when an application discovery manifest accepts its
`artifactKind`. Visibility never implies loading.

A semantic operation declares an action-oriented identifier, accepted artifact
kinds, a mode, and a semantic destination view. A view provider declares which
page currently presents that view. The shared shell resolves these registries;
the view adapter alone performs browser, IndexedDB, and UI effects.

Operation discovery is consumer-led. The workspace only presents operations
whose destination is the current semantic view. Producer views publish portable
artifacts but do not push them into another application's state.

Core projections and merge functions accept data and return data without
reading global state or mutating their inputs. All namespace IRIs are imported
from `packages/namespace-registry`; this package and its adapters define no
local namespace aliases.
