# DocxHund Annotation Data Model

Manual annotations have two related layers:

1. An annotation resource identifies its type and points to a persistent selected-text resource.
2. The selected-text resource is an Information Content Entity that records its containing document part, exact quote, canonical character offsets, and prefix/suffix context.
3. A semantic assertion expresses what the selected-text resource means in project RDF.

Documents, sections, paragraphs, sentences, and words produced by extraction are all asserted directly as CCO Information Content Entities. A highlight always materializes an independently identified `urn:uuid:` selected-text resource and asserts both CCO Information Content Entity and DocxHund Text Selection types. Consequently, selecting a phrase or word still creates a queryable ICE even when sentence- or word-level extraction was disabled. Its offsets and prefix/suffix context anchor it within the containing parsed document part.

The annotation resource preserves evidence anchors. DocxHund's explicit application ontology is [data/ontologies/docxhund.ttl](data/ontologies/docxhund.ttl); selector fields are declared there rather than existing only in JavaScript.

Provenance uses CCO's process model instead of PROV. A parse is a DocxHund Document Parsing Act, specialized from CCO Act of Data Transformation, with the DOCX source as its CCO input and the RDF document model as its CCO output. A commit is a DocxHund Document Annotation Act, specialized from CCO Act of Information Processing, with the existing document part as input and the selected-text resource and annotation as outputs. The application-specific `occurredAt` property is deliberately explicit because CCO's generic `has datetime value` is deprecated. Project-store run records remain an operational index of the same events.

An agent is only asserted when DocxHund has an explicit user/agent IRI. The application does not invent a person identity from browser state.

## Initial semantic templates

| UI type | Semantic assertion |
| --- | --- |
| Is about | Selected-text resource CCO **is about** the chosen individual. |
| Entity mention | Same CCO assertion as “is about”; the annotation type records that the relation arose from a mention. |
| Class mention | Mint a persistent generated individual, type it with the chosen class, and make the selected-text resource CCO **is about** that individual. |
| Permission | Chosen Process Regulation CCO **permits** chosen BFO Process. |
| Prohibition | Chosen Process Regulation CCO **prohibits** chosen BFO Process. |
| Obligation / requirement | Chosen Process Regulation CCO **requires** chosen BFO Process. |
| Definition | Chosen resource **skos:definition** selected text. |

## Modeling notes

- OWL object properties relate individuals, so a class mention is not modeled by placing an OWL class directly in the object position of CCO **is about**.
- Generated class instances use persistent generated IRIs rather than transient blank nodes so annotations remain addressable across project reloads.
- CCO's current property is labeled **requires**. The UI may explain it as obligation/requirement, but stored RDF uses the registered CCO IRI.
- CCO deontic properties have a Process Regulation domain and BFO Process range. The UI therefore requires both resources.
- SKOS definition is used for the initial generic definition template because CCO itself uses it for ontology definitions. Later templates may distinguish a quoted textual definition, an asserted ontology definition, a description, or a document passage that merely mentions a definition.
