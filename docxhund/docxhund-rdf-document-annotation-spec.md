# DocxHund RDF-Native Document Annotation Workbench

## Rough UI, Capability, and Technical Gap Specification

**Status:** Early architecture / capability specification\
**Scope:** DOCX-first, browser-only, RDF-native; PDF support explicitly
out of scope for this phase.

------------------------------------------------------------------------

## 1. Architectural Premises

This specification assumes the existing DocxHund and SDK architecture
remains authoritative.

### Existing foundation

-   **JSZip** opens the DOCX/OOXML package.
-   Existing application code parses WordprocessingML/XML, including
    document structure and styling.
-   **N3.js** provides RDF parsing/serialization for Turtle, N-Triples,
    N-Quads, and TriG.
-   **jsonld.js** provides JSON-LD support.
-   **Comunica** provides SPARQL query support.
-   **IndexedDB** provides browser-native persistence.
-   Existing SDK adapters/helpers provide:
    -   RDF I/O
    -   tabular I/O via SheetJS and Papa Parse
    -   MIME/extension handling
    -   namespace management
    -   SPARQL support
    -   D3/Cytoscape visualization
    -   project stores
    -   ontology/knowledge-base stores
    -   artifact stores
-   **Compromise.js** is already available elsewhere in the ecosystem
    for lightweight NLP.

### Governing architectural rule

**RDF in application memory is the application state. The UI is a
projection of that state.**

Document annotations therefore do not originate as independent DOM state
that is later synchronized into RDF. An annotation action should create
or modify RDF in memory immediately; the UI then re-renders the
resulting state.

This yields the desired flow:

``` mermaid
flowchart LR
    U[User interaction] --> C[Command / action handler]
    C --> R[(RDF dataset in memory)]
    R --> Q[Selectors / SPARQL / derived view state]
    Q --> UI[Document + annotation UI]
    R --> P[(IndexedDB project store)]
```

The DOM is **not** the system of record.

------------------------------------------------------------------------

## 2. Separation of Concerns

The application should distinguish five layers.

``` mermaid
flowchart TB
    A[DOCX Artifact] --> B[OOXML Ingestion Layer]
    B --> C[(Document RDF)]
    C --> D[Document Presentation Layer]
    C --> E[Semantic Annotation Layer]
    E --> F[(Curated RDF / Knowledge Graph)]
    F --> G[Queries / Transformations / Visualizations]

    H[(Ontology / KB Store)] --> E
    H --> G
    I[Compromise.js / deterministic matchers] --> J[Candidate Assertions]
    J --> E
```

### 2.1 OOXML ingestion

Existing responsibility.

-   unzip DOCX
-   parse WordprocessingML
-   read styles
-   identify structural document parts
-   mint or assign RDF resources
-   write the document representation into the RDF dataset

### 2.2 Document RDF

Existing architecture remains the canonical representation of the
imported document.

Potential entities include:

-   document
-   section
-   heading
-   paragraph
-   sentence
-   run
-   list/list item
-   table/row/cell
-   hyperlink
-   image/artifact
-   style or style-derived classification

Not every one must be exposed to users or materialized at every
extraction level.

### 2.3 Presentation

New or expanded responsibility.

The renderer reads RDF state and creates a readable document view. It
does **not** independently parse the DOCX.

### 2.4 Annotation

New major responsibility.

User selections and annotation forms generate RDF assertions against
document resources or text selectors.

### 2.5 Knowledge integration

Existing and expanded responsibility.

Annotations can connect document portions to:

-   persons
-   organizations
-   information systems
-   laws/regulations
-   ontology classes
-   actions/processes
-   permissions
-   prohibitions
-   requirements
-   information entities
-   other project resources

------------------------------------------------------------------------

# 3. Proposed Main UI

A useful evolution of the current prototype is a project-oriented
three-pane workbench.

``` text
+--------------------+--------------------------------------+-------------------------+
| PROJECT / SOURCES  | DOCUMENT                             | ANNOTATION / KNOWLEDGE  |
|                    |                                      |                         |
| People             | Policy.docx                          | Selected text           |
| Organizations      |                                      | ----------------------  |
| Documents          | 4.2 Access Requirements              | "Authorized employees…" |
| Systems            |                                      |                         |
| Ontologies / KBs   | Employees shall...                   | Annotation type         |
|                    |                                      | [Permission          v] |
| Current document   | [selected / annotated passage]       |                         |
| - Outline          |                                      | About                   |
| - Annotations      | Access shall be...                   | [System X             ] |
| - Suggestions      |                                      | [Organization Y       ] |
|                    |                                      |                         |
|                    |                                      | [Commit Annotation]     |
+--------------------+--------------------------------------+-------------------------+
| STATUS / RDF CHANGES / QUERY RESULTS / PROVENANCE                                   |
+--------------------------------------------------------------------------------------+
```

The existing "Document parts preview" and "Turtle output" remain useful
developer/debug views, but should become tabs or secondary panels rather
than the primary curation interface.

------------------------------------------------------------------------

# 4. UI Element List

## 4.1 Project/source panel

### Project selector

-   create/open project
-   display active project
-   save/check persistence status

### Source collections

Initial logical collections:

-   **People**
-   **Organizations**
-   **Documents**
-   **Information systems/resources**
-   **Ontologies / knowledge bases**

These should be views over RDF/project stores rather than hard-coded
data silos.

### Import controls

Reuse SDK file adapters where possible.

-   Add DOCX
-   Add RDF
-   Add CSV/TSV/XLSX
-   Add vCard if/when supported
-   Add ontology/knowledge base
-   show source/artifact metadata

### Entity browser/search

-   label search
-   type filtering
-   source filtering
-   select resource
-   open resource details
-   insert selected resource into an annotation form

------------------------------------------------------------------------

## 4.2 Document navigation panel

### Document selector

Choose among documents already stored in the project.

### Document outline

Derived from document RDF:

-   sections
-   headings
-   optional paragraph nodes
-   optional tables/figures

Clicking an item scrolls the rendered document to its RDF-backed target.

### Annotation filter

Examples:

-   all
-   manual
-   suggested
-   accepted
-   rejected
-   entity references
-   requirements
-   permissions
-   prohibitions
-   unresolved

### Suggestion queue

A reviewable list of machine/deterministically generated candidate
annotations.

------------------------------------------------------------------------

## 4.3 Document viewer

### RDF-backed document renderer

Displays the document from the current RDF/memory state.

Requirements:

-   readable approximation of Word document
-   headings
-   paragraphs
-   inline emphasis
-   lists
-   tables
-   hyperlinks
-   images where supported
-   stable mapping from rendered elements back to RDF resources
-   no editable rich-text behavior required for MVP

### Text selection

User can select:

-   whole document part
-   sentence
-   phrase within a sentence
-   text spanning inline runs
-   potentially text spanning multiple document parts

### Existing annotation highlighting

Passages with annotations are visually marked.

### Overlapping annotation handling

The viewer must be able to indicate more than one semantic annotation
over the same text.

### Context menu / annotation launcher

After selection:

-   Annotate
-   Link to entity
-   Classify
-   Create new entity
-   Ignore suggestion (where applicable)

------------------------------------------------------------------------

## 4.4 Annotation inspector

### Selected passage display

Shows exact selected text plus its containing document context.

### Annotation type

Initial useful types:

-   `is about`
-   entity mention/reference
-   class mention/reference
-   requirement
-   permission
-   prohibition
-   obligation
-   definition
-   authority/citation
-   action/process mention
-   system/resource mention

The UI vocabulary should be configurable from RDF rather than
permanently hard-coded.

### Entity picker

Search project knowledge bases for:

-   persons
-   organizations
-   systems
-   laws/regulations
-   other instances

### Class picker

Search loaded ontology terms.

### Structured assertion form

For richer annotations, expose ontology-backed slots.

Example:

``` text
Assertion: Permission

Agent / role:       [Authorized Employee]
Action:             [Access]
Object/resource:    [System X]
Organization:       [Agency Y]
Condition:          [optional]
Authority:          [Policy §4.2]
```

### Create-resource control

When the document mentions an entity not already present:

-   mint resource IRI
-   select class
-   provide label
-   add minimal RDF
-   immediately use it in the annotation

### Commit/retract controls

-   commit annotation
-   edit annotation
-   retract/delete user annotation
-   accept candidate
-   reject candidate

All operations modify RDF first.

------------------------------------------------------------------------

## 4.5 RDF/provenance inspector

Useful as a collapsible advanced panel.

### Current resource triples

Show triples for:

-   selected document part
-   selected annotation
-   selected domain entity

### Pending RDF delta

Show triples added/removed by the current operation before or
immediately after commit.

### Provenance

Display:

-   source artifact
-   document
-   structural target
-   exact text target
-   creation method
-   transformation recipe
-   user/manual vs generated status
-   timestamp if the project model uses timestamps

------------------------------------------------------------------------

## 4.6 Query and insights panel

### Stock query browser

Categories:

-   document/entity relationships
-   people/organizations
-   systems
-   requirements
-   permissions/prohibitions
-   regulatory authorities
-   provenance/evidence
-   annotation QA

### Query result table

Reuse existing SPARQL/tabular infrastructure.

### "Explain from evidence" result

For questions such as:

> Does Person A have access to System B?

return evidence rather than only a Boolean.

### Graph visualization

Send query subsets to Cytoscape/D3 rather than rendering the entire
project graph by default.

------------------------------------------------------------------------

# 5. Capability List

## CAP-01 --- RDF-backed document rendering

The application shall render a DOCX-derived document **from the
RDF/memory representation**, not by reparsing the DOCX in the
presentation layer.

Acceptance direction:

1.  Every significant rendered block can be traced to an RDF resource.
2.  Re-rendering from the same RDF dataset produces equivalent document
    structure.
3.  UI rendering does not become an alternative source of truth.

------------------------------------------------------------------------

## CAP-02 --- OOXML style-to-presentation mapping

The application shall convert style information already extracted from
OOXML into a safe browser presentation model.

Examples:

-   Heading 1 -\> `h1`
-   Heading 2 -\> `h2`
-   ordinary paragraph -\> `p`
-   bold run -\> `strong` or CSS font weight
-   italic run -\> `em`
-   list metadata -\> `ol`/`ul`
-   table structures -\> HTML table

The mapping should be explicit and testable.

------------------------------------------------------------------------

## CAP-03 --- Stable RDF-to-DOM identity mapping

Rendered nodes shall carry enough information to resolve UI interaction
back to RDF resources.

For example:

``` html
<p data-rdf-resource="https://example.org/doc-inst/paragraph/42">
```

The RDF resource is authoritative; the DOM attribute is only a UI
pointer.

------------------------------------------------------------------------

## CAP-04 --- Text selection capture

The application shall translate a browser text selection into a durable
RDF annotation target.

The target should ideally include multiple anchors:

-   containing RDF document resource(s)
-   exact selected text
-   character offsets against a canonical text representation
-   prefix/suffix context
-   optional start/end structural resources

This protects against brittle dependence on DOM structure.

------------------------------------------------------------------------

## CAP-05 --- RDF-native annotations

Creating an annotation shall immediately create RDF in the in-memory
dataset.

``` mermaid
sequenceDiagram
    participant User
    participant UI
    participant Command as Annotation Command
    participant RDF as RDF Dataset
    participant View as View Selector

    User->>UI: Highlight text + choose "Permission"
    UI->>Command: submit selection + semantic values
    Command->>RDF: add annotation/assertion quads
    RDF->>View: dataset changed
    View->>UI: derive updated highlights/forms
```

No independent annotation JSON store should become the authoritative
state.

------------------------------------------------------------------------

## CAP-06 --- Annotation target persistence

After closing and reopening a project, annotations shall resolve to the
same source passage whenever the underlying document representation is
unchanged.

------------------------------------------------------------------------

## CAP-07 --- Entity linking

The user shall be able to associate a passage with an existing RDF
resource.

Candidate resources may come from:

-   project KB
-   imported RDF
-   person dataset
-   organization dataset
-   system dataset
-   legal/regulatory dataset

------------------------------------------------------------------------

## CAP-08 --- Ontology class linking

The user shall be able to state that a passage:

-   concerns a class,
-   mentions an instance of a class,
-   or expresses an assertion whose participants are typed by ontology
    classes.

------------------------------------------------------------------------

## CAP-09 --- Structured semantic assertions

The application shall support annotation templates that create
multi-triple RDF patterns rather than merely adding comments.

Templates should themselves be configuration-driven where practical.

------------------------------------------------------------------------

## CAP-10 --- Candidate annotation generation

Deterministic processing shall be able to propose annotations without
committing them as accepted project assertions.

Candidate sources can include:

-   exact label matching
-   case-normalized matching
-   alternate labels/acronyms
-   regex patterns for legal citations
-   SPARQL transformations
-   Compromise.js NLP
-   project-specific rules

------------------------------------------------------------------------

## CAP-11 --- Candidate review lifecycle

Candidate assertions require states such as:

-   suggested
-   accepted
-   rejected
-   superseded

A suggestion should not silently become an accepted assertion.

------------------------------------------------------------------------

## CAP-12 --- SPARQL transformation recipes

Existing SPARQL capabilities should be surfaced as reusable named
recipes with:

-   name
-   description
-   expected input graph/pattern
-   query/update
-   preview
-   resulting RDF delta
-   provenance

------------------------------------------------------------------------

## CAP-13 --- Provenance

The application shall distinguish at minimum:

-   imported source assertions
-   document-content assertions
-   manual annotations
-   accepted suggestions
-   SPARQL-derived assertions

------------------------------------------------------------------------

## CAP-14 --- Project resource creation

Users shall be able to create an RDF resource during annotation without
leaving the document workflow.

------------------------------------------------------------------------

## CAP-15 --- Query library

The application shall expose reusable queries whose results are rendered
as user-facing insights rather than raw SPARQL alone.

------------------------------------------------------------------------

## CAP-16 --- Evidence-bearing answers

Operational questions shall preserve the difference between:

-   explicit permission
-   explicit prohibition
-   derived support
-   conflicting evidence
-   no supporting assertion found

Absence of a permission triple must not automatically mean prohibition.

------------------------------------------------------------------------

## CAP-17 --- Project persistence

The RDF dataset, annotations, source metadata, recipes, and artifacts
shall persist through the existing IndexedDB/project-store architecture.

------------------------------------------------------------------------

## CAP-18 --- Export

Users shall be able to export:

-   full curated project RDF
-   document-only RDF
-   annotation-only RDF
-   query result subsets
-   provenance/evidence subsets
-   supported RDF serializations already provided by the SDK

------------------------------------------------------------------------

# 6. Technical Gap Shopping List

The main conclusion is that **most of the missing work is
application-layer glue, not another large framework**.

  --------------------------------------------------------------------------------------------------------
  Gap             Need                       Existing capability Candidate            Recommendation
                                                                 vendor/library       
  --------------- -------------------------- ------------------- -------------------- --------------------
  DOCX package    Read OOXML                 JSZip + existing    Mammoth.js           **No new dependency
  parsing                                    parser                                   needed**

  DOCX -\> RDF    Structural KG              Existing code +     Mammoth.js           **Keep existing
                                             N3.js                                    architecture**

  RDF-backed HTML Show document from RDF     Partial/new         Native DOM APIs      **Build thin
  rendering                                                                           internal renderer**

  Style mapping   OOXML styles -\> safe      Parsed style data   Native CSS/DOM;      **Build internally**
                  HTML/CSS                   exists              optional internal    
                                                                 mapping tables       

  Text selection  Capture user highlight     Browser-native      Selection API +      **Use native APIs**
                                                                 Range API            

  Durable text    Restore annotations        New                 W3C Web Annotation   **Adopt data model
  anchors                                                        selector concepts    concepts; library
                                                                                      optional**

  Highlight       Show annotations           New                 CSS Custom Highlight **Evaluate native
  rendering                                                      API; DOM wrappers    API + fallback**
                                                                 fallback             

  Annotation      RDF assertions             N3.js/store         Annotation           **Keep RDF-native;
  state                                      architecture        frameworks           avoid separate state
                                                                                      framework**

  NLP candidate   Names/entities/sentences   Compromise.js       Compromise.js        **Reuse**
  generation                                 available                                

  Exact/alias     KB entity detection        SPARQL + RDF labels Fuse.js optional     **Start
  matching                                                                            deterministic;
                                                                                      Fuse.js optional**

  Legal citation  USC/CFR/etc.               None/some SPARQL    regex/rule module    **Build
  recognition                                                                         domain-specific
                                                                                      matcher**

  Ontology term   Class/property picker      RDF/Comunica        MiniSearch/Fuse.js   **Index only if
  search                                                         optional             SPARQL search is too
                                                                                      slow**

  Annotation      Structured assertion       RDF/ontology stack  JSON Forms etc.      **Prefer small
  forms           templates                                                           RDF-driven internal
                                                                                      forms initially**

  Graph           Context/subgraph           D3/Cytoscape        Existing             **Reuse**
  visualization                                                                       

  Query execution Insights                   Comunica            Existing             **Reuse**

  Tabular results Query/import views         SheetJS/Papa Parse  Existing             **Reuse**

  Persistence     Project state              IndexedDB/project   Existing             **Reuse**
                                             stores                                   

  Undo/redo       RDF mutation history       Gap                 custom RDF delta     **Build at RDF
                                                                 command stack        command layer**

  Sanitization    Safe rendered content      Gap/verify          DOMPurify            **Strong candidate
                                                                                      if any
                                                                                      generated/imported
                                                                                      HTML is injected**

  UI              Keyboard selection,        Gap/verify          native ARIA patterns **Design into
  accessibility   annotation controls                                                 renderer**
  --------------------------------------------------------------------------------------------------------

------------------------------------------------------------------------

# 7. Mammoth.js: Explicit Scope Decision

## Recommendation for the current architecture

**Do not make Mammoth.js part of the canonical ingestion pipeline.**

Mammoth's central responsibility is DOCX-to-HTML conversion. Your
application already performs the more important operation for this
architecture:

``` text
DOCX
  -> OOXML
  -> parsed document semantics/styles
  -> RDF
```

Introducing Mammoth into that path would create a second interpretation
of the DOCX:

``` mermaid
flowchart LR
    D[DOCX] --> X[Existing OOXML Parser]
    X --> R[(Canonical RDF)]

    D -.-> M[Mammoth]
    M -.-> H[Independent HTML interpretation]

    R --> UI[UI]
    H -.-> UI
```

That risks disagreement between the graph and the displayed document.

## The only compelling Mammoth role

Mammoth could be used as a **non-authoritative presentation/reference
adapter** if there is a demonstrated rendering gap that would otherwise
be costly to implement---for example, rapidly obtaining semantic HTML
for complicated combinations of lists, footnotes, images, links, and
styles.

Even then, constrain it:

1.  Mammoth does **not** create knowledge-graph resources.
2.  Mammoth does **not** determine canonical paragraph/sentence IDs.
3.  Mammoth output is not persisted as authoritative application state.
4.  Annotations never target Mammoth-generated IDs.
5.  The RDF document model remains the source of truth.
6.  Mammoth is removable without changing project RDF.

Given the current architecture, the cleaner MVP is probably to **omit
Mammoth entirely** and build the RDF-to-DOM renderer.

------------------------------------------------------------------------

# 8. Proposed Document Renderer

A deliberately small internal package could expose something like:

``` javascript
function renderDocument(dataset, documentIri, container, options) {}
function renderDocumentPart(dataset, resourceIri, options) {}
function resolveResourceFromDom(node) {}
function resolveSelection(selection, dataset) {}
```

Conceptually:

``` mermaid
flowchart LR
    RDF[(RDF Dataset)] --> S[Document View Selector]
    S --> VM[Presentation Model]
    VM --> DOM[DOM Renderer]
    DOM --> B[Browser]

    B --> SEL[Selection / Range]
    SEL --> RES[Selection Resolver]
    RES --> CMD[Annotation Command]
    CMD --> RDF
```

The optional **presentation model** is not a second domain data model.
It is ephemeral view state derived from RDF, comparable to a UI
view-model.

------------------------------------------------------------------------

# 9. Annotation Target Model

Avoid making the DOM Range itself persistent.

A robust target can contain several selectors:

``` text
Annotation
  |
  +-- targets document part IRI
  |
  +-- exact text
  |
  +-- start/end character offsets
  |
  +-- prefix text
  |
  +-- suffix text
  |
  +-- optional start/end run or sentence resources
```

``` mermaid
graph TD
    A[Annotation] --> T[Text Target]
    T --> D[Document Part IRI]
    T --> E[Exact Text Selector]
    T --> P[Prefix / Suffix Selector]
    T --> O[Position Selector]

    A --> B[Semantic Body]
    B --> I[Existing Instance]
    B --> C[Ontology Class]
    B --> X[Structured Assertion]
```

The W3C Web Annotation model is useful primarily as a **design
vocabulary/pattern**, even if the application does not adopt a
third-party annotation framework.

------------------------------------------------------------------------

# 10. Highlight Rendering

There are two distinct problems:

1.  **Selection:** what text did the user just select?
2.  **Persistent highlighting:** how should existing RDF annotations
    appear?

For selection, use the browser's `Selection` and `Range` APIs.

For persistent annotation display, evaluate:

### Option A --- CSS Custom Highlight API

Good separation of presentation from document DOM. It can reduce the
need to inject nested `<span>` elements merely to color ranges.

### Option B --- generated span wrappers

More universally controllable, but can make overlapping annotations and
DOM-to-text offsets harder.

Recommended approach:

``` text
Selection/Range
      |
      v
RDF text selector
      |
      v
Annotation RDF
      |
      v
Resolve selectors against current document view
      |
      v
CSS Highlight / fallback wrapper
```

This ensures the highlight is a **consequence** of RDF state.

------------------------------------------------------------------------

# 11. Lightweight NLP and Entity Recognition

Compromise.js fits the architecture well if treated as a **candidate
generator**, not an authority.

``` mermaid
flowchart LR
    T[Document text] --> C[Compromise.js]
    T --> M[String / Regex Matchers]
    KB[(Project KB)] --> M
    O[(Ontology Store)] --> M

    C --> CAN[Candidate Assertions]
    M --> CAN
    CAN --> REV[User Review]
    REV -->|accept| RDF[(RDF Dataset)]
    REV -->|reject| LOG[Rejected Candidate State]
```

Useful candidate operations:

-   sentence boundary assistance
-   person-like phrase detection
-   organization-like phrase detection
-   dates
-   acronyms
-   noun phrases
-   known-label matching
-   alternate-label matching

For your regulatory scenario, hand-written deterministic recognizers may
be more valuable than generic NLP for:

-   `42 U.S.C. § ...`
-   `45 CFR ...`
-   `Public Law ...`
-   named acts
-   policy section references
-   organizational acronyms

------------------------------------------------------------------------

# 12. Annotation Templates as RDF-Driven UI

A strategically useful capability is to describe annotation forms as
configuration rather than hard-code every regulatory concept.

For example:

``` text
Template: Permission
  field: Agent
  field: Action Type
  field: Object / Resource
  field: Recipient
  field: Condition
  field: Authority
```

The form engine reads the template, presents controls, and emits a known
RDF pattern.

``` mermaid
flowchart LR
    T[(Template RDF)] --> F[Form Generator]
    O[(Ontology / KB)] --> F
    F --> UI[Annotation Form]
    UI --> C[Command]
    C --> R[(Project RDF)]
```

This could eventually allow a DUO-oriented template, an informed-consent
template, or a CCO action template without redesigning the annotation
UI.

For the MVP, however, a few hand-authored templates may be preferable
before generalizing a form-description ontology.

------------------------------------------------------------------------

# 13. RDF Mutation / Command Layer

Because RDF is the state, UI actions should not directly scatter calls
to `store.addQuad()` throughout event handlers.

Introduce or reuse a command boundary:

``` javascript
function addAnnotation(command, dataset) {}
function acceptSuggestion(command, dataset) {}
function rejectSuggestion(command, dataset) {}
function createResource(command, dataset) {}
function linkEntity(command, dataset) {}
function retractAnnotation(command, dataset) {}
```

Each command can produce an RDF delta:

``` javascript
{
    added: [/* quads */],
    removed: [/* quads */]
}
```

This creates a natural basis for:

-   undo/redo
-   provenance
-   change preview
-   autosave
-   audit trail
-   tests
-   deterministic transformations

``` mermaid
flowchart LR
    UI --> CMD[Command]
    CMD --> DELTA[RDF Delta]
    DELTA --> MEM[(Memory Dataset)]
    DELTA --> HIST[Change History]
    MEM --> VIEW[Derived UI]
    MEM --> SAVE[(IndexedDB)]
```

------------------------------------------------------------------------

# 14. Suggested Implementation Phases

## Phase 1 --- RDF-backed reader

Build only:

-   project/document selection
-   RDF-to-DOM document rendering
-   headings/paragraphs/runs/styles
-   stable RDF-to-DOM pointers
-   document outline
-   selected-resource RDF inspector

**Exit criterion:** the existing DOCX can be imported into RDF and
reconstructed into a useful reading view without consulting the original
DOCX again.

## Phase 2 --- Basic annotation

Add:

-   browser text selection
-   durable text selectors
-   `is about` annotation
-   instance picker
-   class picker
-   create-new-resource
-   RDF-native annotation commit
-   reload/persistence
-   annotation highlighting

**Exit criterion:** highlight a phrase, link it to an organization,
reload the project, and recover the annotation/highlight solely from
project state.

## Phase 3 --- Structured assertions

Add:

-   requirement
-   permission
-   prohibition
-   action/event annotation
-   structured annotation forms
-   evidence/provenance panel

## Phase 4 --- Assisted curation

Add:

-   Compromise.js candidate extraction
-   known-instance label matching
-   ontology label matching
-   legal citation regexes
-   suggestion queue
-   accept/reject workflow
-   SPARQL transformation recipes

## Phase 5 --- Insights

Add stock queries such as:

-   Which organizations are mentioned by this document?
-   Which requirements concern System X?
-   Which documents authorize access to System X?
-   Which persons are associated with organizations affected by
    Requirement Y?
-   What evidence supports Person X having access to System Y?
-   Which passages contain unresolved entity mentions?
-   Which requirements lack an identified responsible
    organization/system?
-   Which assertions conflict or appear to express both permission and
    prohibition over the same action/resource?

------------------------------------------------------------------------

# 15. Recommended New Dependencies

The first implementation should be conservative.

## Strong candidate

### DOMPurify

Use if any HTML derived from imported content or transformations is
inserted through `innerHTML`. If the renderer creates DOM nodes/text
nodes directly and never trusts imported HTML, the need is reduced, but
a sanitization boundary remains worth considering.

## Already available and useful

### Compromise.js

Use for **candidate generation only**, especially
sentence/noun/person/organization hints. Do not make its analysis
canonical RDF without a rule or review step.

## Evaluate before adding

### Fuse.js or MiniSearch

Potentially useful for fuzzy entity/class pickers if SPARQL label search
becomes insufficient. Not necessary for the first implementation.

### Annotation libraries

Apache Annotator or similar W3C Web Annotation-oriented projects can be
studied for selector and lifecycle patterns. A generic annotation
library should **not** own annotation state if that conflicts with
RDF-native state.

## Probably omit

### Mammoth.js

For this architecture, there is currently no clear missing canonical
responsibility for Mammoth. Its DOCX-to-HTML conversion overlaps with
information your ingestion layer already extracts. Add it only if a
concrete rendering requirement proves expensive enough to justify a
secondary, explicitly non-authoritative renderer.

------------------------------------------------------------------------

# 16. What Is Actually Missing?

The architecture already owns most infrastructure. The meaningful gaps
are comparatively focused:

1.  **RDF -\> document DOM renderer**
2.  **DOM selection -\> durable RDF text selector**
3.  **RDF annotation vocabulary/pattern**
4.  **RDF-driven persistent highlight renderer**
5.  **annotation command/delta layer**
6.  **entity/class picker**
7.  **structured annotation templates**
8.  **candidate/suggestion lifecycle**
9.  **provenance conventions**
10. **stock query/insight catalog**
11. **undo/redo over RDF deltas**
12. **legal/regulatory deterministic recognizers**

This is favorable: the project does **not** appear to need another
application framework. It needs a relatively thin document-curation
layer over capabilities already present in the SDK.

------------------------------------------------------------------------

# 17. Target Architecture

``` mermaid
flowchart TB
    subgraph INPUTS[Project Inputs]
        DOCX[DOCX]
        RDFI[RDF]
        TAB[CSV / TSV / XLSX]
        ONT[Ontologies / KBs]
    end

    subgraph SDK[Existing SDK / Infrastructure]
        ZIP[JSZip + OOXML Parser]
        RIO[RDF I/O<br/>N3.js + jsonld.js]
        TIO[Tabular I/O<br/>SheetJS + Papa Parse]
        NS[Namespace / MIME Helpers]
        SPARQL[Comunica / SPARQL Helpers]
        STORE[Project / KB / Artifact Stores]
    end

    DOCX --> ZIP
    RDFI --> RIO
    TAB --> TIO
    ONT --> RIO

    ZIP --> RDF
    RIO --> RDF
    TIO --> RDF

    subgraph STATE[Authoritative Application State]
        RDF[(In-Memory RDF Dataset)]
    end

    RDF <--> STORE

    subgraph CURATION[New Document Curation Layer]
        SELECT[Document View Selectors]
        RENDER[RDF-to-DOM Renderer]
        RANGE[Selection / Range Resolver]
        ANNO[Annotation Commands]
        TEMPL[Annotation Templates]
        CAND[Candidate Generator]
        DELTA[RDF Delta / Undo]
    end

    RDF --> SELECT --> RENDER
    RENDER --> RANGE
    RANGE --> ANNO
    TEMPL --> ANNO
    CAND --> ANNO
    ANNO --> DELTA --> RDF

    subgraph ASSIST[Assistance]
        NLP[Compromise.js]
        MATCH[String / Alias Matchers]
        LEGAL[Legal Citation Rules]
        RECIPES[SPARQL Recipes]
    end

    NLP --> CAND
    MATCH --> CAND
    LEGAL --> CAND
    RECIPES --> CAND

    subgraph OUTPUTS[Views / Outputs]
        DOCVIEW[Annotated Document]
        TABLES[Query Tables]
        GRAPH[Cytoscape / D3]
        EXPORT[RDF / Reports / Artifacts]
    end

    RDF --> DOCVIEW
    RDF --> SPARQL --> TABLES
    RDF --> GRAPH
    RDF --> EXPORT
```

------------------------------------------------------------------------

# 18. Architectural Test

A useful test for every future feature is:

> **If the entire DOM disappeared and were rebuilt from the current
> in-memory RDF dataset, would the user's meaningful work still exist?**

For annotations, entity links, classifications, provenance, suggestions
that have been intentionally retained, and structured assertions, the
answer should be **yes**.

That rule keeps the application RDF-native rather than merely placing an
RDF export feature underneath a conventional document annotator.
