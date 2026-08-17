
import {
  downloadTextFile,
  readFileAsText
} from '../packages/browser-file-io/src/index.js';
import {
  parseDelimitedText,
  serializeDelimitedRecords
} from '../packages/tabular-io/src/index.js';
import {
  COMMON_NAMESPACE_IRIS
} from '../packages/namespace-registry/src/index.js';
import {
  createRdfQuadsFromJsonLdGraph,
  serializeRdfDataset
} from '../packages/rdf-io/src/index.js';
import { SUPPORTED_MIME_DESCRIPTORS } from '../packages/format-registry/src/index.js';
import {
  deleteCompetencyQuestionById,
  recordCompetencyQuestionProjectSnapshot,
  readCompetencyQuestionNodes
} from './cq-ferret-indexeddb-store.js';

// ======================================================
// SECTION 1: GLOBAL STATE
// ======================================================
let currentCQId = null;
let allNodesCache = [];
const tagger = new window.POSTagger(window.POSTAGGER_LEXICON);
const gdcManager = new window.GDCManager(tagger, allNodesCache);

const CQ_CSV_HEADERS = Object.freeze([
  'cq_id', 'cq_title', 'cq_description', 'cq_created_date', 'cq_modified_date', 'cq_status',
  'item_type', 'item_id', 'item_text',
  'contributor_role', 'contributor_contact', 'contributor_notes',
  'contributor_email_id', 'contributor_role_id',
  'datasource_quality_notes',
  'mermaid_diagram_text',
  'database_query_text'
]);

const OKEA = {
  CQ: "https://github.com/jonathanvajda/okea/ont000002",
  INTERROGATIVE_ICE: "https://github.com/jonathanvajda/okea/ont000001",
  BUSINESS_RULE: "https://github.com/jonathanvajda/okea/ont000009",
  MERMAID_DIAGRAM: "https://github.com/jonathanvajda/okea/ont000004",
  DATABASE_QUERY: "https://github.com/jonathanvajda/okea/ont000016",
  SPARQL_QUERY: "https://github.com/jonathanvajda/okea/ont000007",
  SQL_QUERY: "https://github.com/jonathanvajda/okea/ont000005",

  HAS_MERMAID_DIAGRAM: "https://github.com/jonathanvajda/okea/ont000012",
  HAS_FORMALIZATION: "https://github.com/jonathanvajda/okea/ont000014",

  HAS_MERMAID_TEXT: "https://github.com/jonathanvajda/okea/has_mermaid_diagram_text_value",
  HAS_QUERY_TEXT: "https://github.com/jonathanvajda/okea/has_query_text_value",
  HAS_SPARQL_QUERY_TEXT: "https://github.com/jonathanvajda/okea/has_sparql_query_text_value",
  HAS_SQL_QUERY_TEXT: "https://github.com/jonathanvajda/okea/has_sql_query_text_value"
};

/**
 * Read a JSON-LD literal from the project convention predicate cco2:hasTextValue.
 * CQ Ferret intentionally uses this CCO predicate while ignoring its narrow
 * rdfs:domain axiom for app data.
 *
 * @param {Record<string, unknown>|null|undefined} node JSON-LD node object.
 * @param {string} fallback Value returned when the predicate is absent.
 * @returns {string} Literal value or fallback.
 */
function readCcoTextValueLiteral(node, fallback = '') {
  return node?.[COMMON_NAMESPACE_IRIS.cco2.hasTextValue]?.[0]?.['@value']
    ?? fallback;
}

function getDatabaseQuerySemantics(syntax) {
  switch (syntax) {
    case 'SPARQL':
      return {
        classIri: OKEA.SPARQL_QUERY,
        textPredicate: OKEA.HAS_SPARQL_QUERY_TEXT
      };
    case 'SQL':
      return {
        classIri: OKEA.SQL_QUERY,
        textPredicate: OKEA.HAS_SQL_QUERY_TEXT
      };
    case 'Other':
    default:
      return {
        classIri: OKEA.DATABASE_QUERY,
        textPredicate: OKEA.HAS_QUERY_TEXT
      };
  }
}

function getDatabaseQueryTextAndSyntax(node) {
  if (hasType(node, OKEA.SPARQL_QUERY)) {
    return {
      syntax: 'SPARQL',
      text: node[OKEA.HAS_SPARQL_QUERY_TEXT]?.[0]?.['@value']
        ?? node[OKEA.HAS_QUERY_TEXT]?.[0]?.['@value']
        ?? ''
    };
  }

  if (hasType(node, OKEA.SQL_QUERY)) {
    return {
      syntax: 'SQL',
      text: node[OKEA.HAS_SQL_QUERY_TEXT]?.[0]?.['@value']
        ?? node[OKEA.HAS_QUERY_TEXT]?.[0]?.['@value']
        ?? ''
    };
  }

  return {
    syntax: 'Other',
    text: node[OKEA.HAS_QUERY_TEXT]?.[0]?.['@value'] ?? ''
  };
}

async function readFromIndexedDB() {
  return readCompetencyQuestionNodes();
}

// ======================================================
// SECTION 3: AUTO-SAVE LOGIC
// ======================================================
function debounce(func, delay) {
  let timeoutId;
  const debouncedFunc = function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
  debouncedFunc.cancel = () => clearTimeout(timeoutId);
  return debouncedFunc;
}

const debouncedAutoSave = debounce(() => autoSaveCQ(), 2000);

// ======================================================
// SECTION 4: UI & STATE MANAGEMENT
// ======================================================

// Helper
const hasType = (node, iri) => {
  const t = node?.["@type"];
  if (Array.isArray(t)) return t.includes(iri);
  if (typeof t === "string") return t === iri;
  return false; // undefined/null/other
};

async function initialLoad() {
  allNodesCache = await readFromIndexedDB();
  renderSidebarFromCache();
  document.getElementById("new-cq-button").click();
}

function renderSidebarFromCache() {
  const cqList = document.getElementById("cq-list");
  cqList.innerHTML = "";

  // Add safety checks before calling .includes()
  const cqNodes = allNodesCache.filter(n =>
    hasType(n, "https://github.com/jonathanvajda/okea/ont000002")
  );

  const titleProperty = COMMON_NAMESPACE_IRIS.rdfs.label;
  cqNodes.sort((a, b) => {
    const titleA = a[titleProperty]?.[0]?.['@value'] ?? '';
    const titleB = b[titleProperty]?.[0]?.['@value'] ?? '';
    return titleA.localeCompare(titleB);
  });
  cqNodes.forEach(addCQToSidebar);
}
function addCQToSidebar(cq) {
  const cqList = document.getElementById("cq-list");
  const listItem = document.createElement("div");
  listItem.className = "cq-list-item";
  listItem.dataset.id = cq["@id"];
  listItem.onclick = () => {
    loadCQIntoForm(cq["@id"]);
    if (window.innerWidth <= 768) {
      document.querySelector('.main').scrollIntoView({ behavior: 'smooth' });
    }
  };
  const titleSpan = document.createElement("span");
  const titleProperty = COMMON_NAMESPACE_IRIS.rdfs.label;
  titleSpan.textContent = cq[titleProperty]?.[0]?.['@value'] ?? 'Untitled CQ';
  const deleteBtn = document.createElement("button");
  deleteBtn.textContent = "✖";
  deleteBtn.style.cssText = "float: right; border: none; background: transparent; cursor: pointer; color: gray; margin: 0;margin-top: 0;padding: 0;";
  deleteBtn.onclick = (event) => {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete "${titleSpan.textContent}"?`)) {
      deleteCQ(cq["@id"]);
    }
  };
  listItem.appendChild(titleSpan);
  listItem.appendChild(deleteBtn);
  cqList.appendChild(listItem);
}

function updateCQInSidebar(cq) {
  const listItem = document.querySelector(`.cq-list-item[data-id="${cq['@id']}"]`);
  if (listItem) {
    const titleProperty = COMMON_NAMESPACE_IRIS.rdfs.label;
    listItem.querySelector('span').textContent = cq[titleProperty]?.[0]?.['@value'] ?? 'Untitled CQ';
  }
}

function removeCQFromSidebar(cqId) {
  const listItem = document.querySelector(`.cq-list-item[data-id="${cqId}"]`);
  if (listItem) listItem.remove();
}

function loadCQIntoForm(cqId) {
  console.log(`--- Loading CQ: ${cqId} ---`);
  debouncedAutoSave.cancel();
  document.getElementById('save-status').textContent = '';
  const cq = allNodesCache.find(node => node["@id"] === cqId);
  if (!cq) {
    console.error("CQ node not found in cache.");
    return;
  }
  console.log("Found CQ Node:", cq);

  currentCQId = cqId;
  document.getElementById("cq-title").value = cq[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '';
  document.getElementById("cq-description").value = cq[COMMON_NAMESPACE_IRIS.dcterms.description]?.[0]?.['@value'] ?? '';
  document.getElementById("cq-status").value = cq["http://example.com/ns/status"]?.[0]?.['@value'] ?? 'Draft';
  const personsList = document.getElementById('persons-list');
  personsList.innerHTML = '';
  const participantLinks = cq[COMMON_NAMESPACE_IRIS.dcterms.contributor] || [];
  console.log("Found Contributor Links:", participantLinks);
  // Process Contributors
  const participantNodes = allNodesCache.filter(n =>
    participantLinks.some(p => p?.["@id"] === n?.["@id"]) &&
    hasType(n, COMMON_NAMESPACE_IRIS.cco2.person)
  );
  console.log("Found Participant Nodes:", participantNodes);
  participantNodes.forEach(pNode => {
    const personId = pNode['@id'];
    const emailId = pNode[COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]?.[0]?.['@id'] ?? '';
    const name = pNode[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '';
    const notes = pNode[COMMON_NAMESPACE_IRIS.rdfs.comment]?.[0]?.['@value'] ?? '';
    let contact = '';
    if (emailId) {
      const emailNode = allNodesCache.find(n => n['@id'] === emailId);
      contact = readCcoTextValueLiteral(emailNode);
    }
    let role = 'Other';
    const roleLink = pNode[COMMON_NAMESPACE_IRIS.bfo.bearerOf]?.[0]?.['@id'];
    if (roleLink) {
      const roleNode = allNodesCache.find(n => n['@id'] === roleLink);
      role = readCcoTextValueLiteral(roleNode, 'Other');
    }
    console.log(`Calling addPersonItem with personId: ${personId}`);
    addPersonItem(name, role, contact, notes, personId, emailId);
  });
  if (personsList.children.length === 0) {
    addPersonItem();
  }

  const subquestionsList = document.getElementById('subquestions-list');
  subquestionsList.innerHTML = '';
  const subquestionNodes = allNodesCache.filter(n =>
    (cq[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart] || []).some(item => item["@id"] === n["@id"]) &&
    n["@type"].includes("https://github.com/jonathanvajda/okea/ont000001")
  );

  subquestionNodes.forEach(node => addSubquestionItem(readCcoTextValueLiteral(node)));
  if (subquestionsList.children.length === 0) addSubquestionItem();
  const decisionLogicList = document.getElementById('decision-logic-list');
  decisionLogicList.innerHTML = '';
  const logicNodes = allNodesCache.filter(n =>
    (cq[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart] || []).some(item => item["@id"] === n["@id"]) &&
    n["@type"].includes("https://github.com/jonathanvajda/okea/ont000009")
  );

  logicNodes.forEach(node => addDecisionLogicItem(readCcoTextValueLiteral(node)));
  if (decisionLogicList.children.length === 0) addDecisionLogicItem();
  const dataRequirementsList = document.getElementById('data-requirements-list');
  dataRequirementsList.innerHTML = '';
  const dataSourceNodes = allNodesCache.filter(n =>
    (cq[COMMON_NAMESPACE_IRIS.dcterms.requires] || []).some(item => item["@id"] === n["@id"]) &&
    n["@type"].includes(COMMON_NAMESPACE_IRIS.cco2.database)
  );

  dataSourceNodes.forEach(dsNode => {
    const sourceText = readCcoTextValueLiteral(dsNode);
    const qualityText = dsNode[COMMON_NAMESPACE_IRIS.rdfs.comment]?.[0]?.["@value"] ?? '';
    addDataRequirementItem(sourceText, qualityText);
  });
  if (dataRequirementsList.children.length === 0) addDataRequirementItem();

    // Load Mermaid diagrams
  const mermaidDiagramList = document.getElementById('mermaid-diagram-list');
  mermaidDiagramList.innerHTML = '';

  const mermaidNodes = allNodesCache.filter(n =>
    (cq[OKEA.HAS_MERMAID_DIAGRAM] || []).some(item => item["@id"] === n["@id"]) &&
    hasType(n, OKEA.MERMAID_DIAGRAM)
  );

  mermaidNodes.forEach(node => {
    const diagramText = node[OKEA.HAS_MERMAID_TEXT]?.[0]?.["@value"] ?? '';
    addMermaidDiagramItem(diagramText);
  });

  if (mermaidDiagramList.children.length === 0) addMermaidDiagramItem();

  // Load database queries
  const databaseQueryList = document.getElementById('database-query-list');
  databaseQueryList.innerHTML = '';

  const databaseQueryNodes = allNodesCache.filter(n =>
    (cq[OKEA.HAS_FORMALIZATION] || []).some(item => item["@id"] === n["@id"]) &&
    (
      hasType(n, OKEA.SPARQL_QUERY) ||
      hasType(n, OKEA.SQL_QUERY) ||
      hasType(n, OKEA.DATABASE_QUERY)
    )
  );

  databaseQueryNodes.forEach(node => {
    const queryData = getDatabaseQueryTextAndSyntax(node);
    addDatabaseQueryItem(queryData.text, queryData.syntax);
  });

  if (databaseQueryList.children.length === 0) addDatabaseQueryItem();
}

// ======================================================
// SECTION 5: UI COMPONENT HELPER FUNCTIONS
// ======================================================
function addDataRequirementItem(source = '', quality = '') {
  const listContainer = document.getElementById('data-requirements-list');
  const item = document.createElement('div');
  item.className = 'data-requirement-item';
  const sourceLabel = document.createElement('label');
  sourceLabel.textContent = 'Data Source';
  const sourceInput = document.createElement('input');
  sourceInput.type = 'text';
  sourceInput.className = 'data-source-input';
  sourceInput.placeholder = 'Enter a data source name...';
  sourceInput.value = source;
  const qualityLabel = document.createElement('label');
  qualityLabel.textContent = 'Data Quality Notes (If you know)';
  const qualityTextarea = document.createElement('textarea');
  qualityTextarea.className = 'data-quality-input';
  qualityTextarea.rows = 2;
  qualityTextarea.placeholder = 'Note any known issues or limitations for this source...';
  qualityTextarea.value = quality;
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm('Are you sure you want to delete this data requirement?')) {
      item.remove();
      if (listContainer.children.length === 0) addDataRequirementItem();
      debouncedAutoSave();
    }
  };
  item.appendChild(deleteBtn);
  item.appendChild(sourceLabel);
  item.appendChild(sourceInput);
  item.appendChild(qualityLabel);
  item.appendChild(qualityTextarea);
  listContainer.appendChild(item);
}

function addSubquestionItem(text = '') {
  const listContainer = document.getElementById('subquestions-list');
  const item = document.createElement('div');
  item.className = 'list-item-container';
  const textarea = document.createElement('textarea');
  textarea.className = 'subquestion-input';
  textarea.rows = 3;
  textarea.value = text;
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm(`Are you sure you want to delete this subquestion?`)) {
      item.remove();
      if (listContainer.children.length === 0) addSubquestionItem();
      debouncedAutoSave();
    }
  };
  item.appendChild(textarea);
  item.appendChild(deleteBtn);
  listContainer.appendChild(item);
}

function addDecisionLogicItem(text = '') {
  const listContainer = document.getElementById('decision-logic-list');
  const item = document.createElement('div');
  item.className = 'list-item-container';
  const textarea = document.createElement('textarea');
  textarea.className = 'decision-logic-input';
  textarea.rows = 3;
  textarea.value = text;
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm(`Are you sure you want to delete this logic item?`)) {
      item.remove();
      if (listContainer.children.length === 0) addDecisionLogicItem();
      debouncedAutoSave();
    }
  };
  item.appendChild(textarea);
  item.appendChild(deleteBtn);
  listContainer.appendChild(item);
}

// Operational Context: Business Process Mermaid Diagram
function addMermaidDiagramItem(text = '') {
  const listContainer = document.getElementById('mermaid-diagram-list');
  const item = document.createElement('div');
  item.className = 'list-item-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'mermaid-diagram-input';
  textarea.placeholder = `graph TD;
    A-->B`;
  textarea.value = text;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm('Are you sure you want to delete this process diagram?')) {
      item.remove();
      if (listContainer.children.length === 0) addMermaidDiagramItem();
      debouncedAutoSave();
    }
  };

  const helper = document.createElement('small');
  helper.textContent = '(Expects Mermaid syntax)';

  item.appendChild(textarea);
  item.appendChild(deleteBtn);
  item.appendChild(helper);
  listContainer.appendChild(item);
}

//
function addDatabaseQueryItem(text = '', syntax = 'SPARQL') {
  const listContainer = document.getElementById('database-query-list');
  const item = document.createElement('div');
  item.className = 'list-item-container';

  const textarea = document.createElement('textarea');
  textarea.className = 'database-query-input';
  textarea.rows = 3;
  textarea.placeholder = `SELECT *
WHERE {?subj ?pred ?obj}`;
  textarea.value = text;

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm('Are you sure you want to delete this query?')) {
      item.remove();
      if (listContainer.children.length === 0) addDatabaseQueryItem();
      debouncedAutoSave();
    }
  };

  const syntaxSelect = document.createElement('select');
  syntaxSelect.className = 'database-query-syntax-select';

  ['SPARQL', 'SQL', 'Other'].forEach(optionValue => {
    const option = document.createElement('option');
    option.value = optionValue;
    option.textContent = optionValue;
    if (optionValue === syntax) option.selected = true;
    syntaxSelect.appendChild(option);
  });

  item.appendChild(textarea);
  item.appendChild(deleteBtn);
  item.appendChild(syntaxSelect);
  listContainer.appendChild(item);
}

function addPersonItem(name = '', role = 'Creator', contact = '', notes = '', personId = '', emailId = '') {
  const listContainer = document.getElementById('persons-list');
  const item = document.createElement('div');
  item.className = 'person-entry';
  const header = document.createElement('div');
  header.className = 'person-header';
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'person-name-input';
  nameInput.placeholder = 'Full Name (type to search...)';
  nameInput.value = name;
  nameInput.setAttribute('autocomplete', 'off');
  const roleSelect = document.createElement('select');
  roleSelect.className = 'person-role-select';
  const roles = ['Creator', 'Approver', 'Reviewer', 'Executor', 'Subject Matter Expert', 'Other'];
  roles.forEach(r => {
    const option = document.createElement('option');
    option.value = r;
    option.textContent = r;
    if (r === role) option.selected = true;
    roleSelect.appendChild(option);
  });
  const contactInput = document.createElement('input');
  contactInput.type = 'text';
  contactInput.className = 'person-contact-input';
  contactInput.placeholder = 'Contact (Email, Phone, etc.)';
  contactInput.value = contact;
  const notesTextarea = document.createElement('textarea');
  notesTextarea.className = 'person-notes-textarea';
  notesTextarea.rows = 2;
  notesTextarea.placeholder = 'Notes / Comments (e.g., area of responsibility)';
  notesTextarea.value = notes;
  const personIdInput = document.createElement('input');
  personIdInput.type = 'hidden';
  personIdInput.className = 'person-id-input';
  personIdInput.value = personId;
  const emailIdInput = document.createElement('input');
  emailIdInput.type = 'hidden';
  emailIdInput.className = 'email-id-input';
  emailIdInput.value = emailId;
  const searchResultsContainer = document.createElement('div');
  searchResultsContainer.className = 'person-search-results';
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete-item-btn';
  deleteBtn.textContent = '✖';
  deleteBtn.type = 'button';
  deleteBtn.onclick = () => {
    if (confirm(`Are you sure you want to remove ${nameInput.value || 'this person'}?`)) {
      item.remove();
      if (listContainer.children.length === 0) addPersonItem();
      debouncedAutoSave();
    }
  };
  nameInput.addEventListener('input', () => {
    const searchTerm = nameInput.value.toLowerCase().trim();
    searchResultsContainer.innerHTML = '';
    personIdInput.value = '';
    emailIdInput.value = '';
    if (searchTerm.length < 2) return;
    const allPeople = allNodesCache.filter(n =>
      n["@type"] && Array.isArray(n["@type"]) && // <-- Add this check
      n["@type"].includes(COMMON_NAMESPACE_IRIS.cco2.person)
    );
    const matches = allPeople.filter(p => {
      const personName = p[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '';
      return personName.toLowerCase().includes(searchTerm);
    });
    matches.forEach(match => {
      const resultItem = document.createElement('div');
      resultItem.className = 'person-search-result-item';
      const personName = match[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '';
      const emailIdMatch = match[COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]?.[0]?.['@id'];
      const emailNode = allNodesCache.find(n => n['@id'] === emailIdMatch);
      const personContact = readCcoTextValueLiteral(emailNode, 'No contact info');
      resultItem.innerHTML = `${personName} <small>${personContact}</small>`;
      resultItem.addEventListener('click', () => {
        const selectedPersonId = match['@id'];
        const selectedEmailId = emailIdMatch;
        const selectedName = personName;
        const selectedNotes = match[COMMON_NAMESPACE_IRIS.rdfs.comment]?.[0]?.['@value'] ?? '';
        const selectedContact = personContact === 'No contact info' ? '' : personContact;
        nameInput.value = selectedName;
        contactInput.value = selectedContact;
        notesTextarea.value = selectedNotes;
        personIdInput.value = selectedPersonId;
        emailIdInput.value = selectedEmailId;
        searchResultsContainer.innerHTML = '';
        debouncedAutoSave();
      });
      searchResultsContainer.appendChild(resultItem);
    });
  });
  document.addEventListener('click', (e) => {
    if (!item.contains(e.target)) {
      searchResultsContainer.innerHTML = '';
    }
  });
  header.appendChild(nameInput);
  header.appendChild(roleSelect);
  item.appendChild(deleteBtn);
  item.appendChild(header);
  item.appendChild(searchResultsContainer);
  item.appendChild(contactInput);
  item.appendChild(notesTextarea);
  item.appendChild(personIdInput);
  item.appendChild(emailIdInput);
  listContainer.appendChild(item);
}

// ======================================================
// SECTION 6: DATA TRANSFORMATION & ACTIONS
// ======================================================
function generateJSONLD() {
  const cqUniqueId = currentCQId ? currentCQId.split('/').pop().split('_').pop() : Date.now();
  const title = document.getElementById("cq-title").value;
  if (!title.trim()) {
    console.warn("Save aborted: Title is a required field.");
    return null;
  }
  // ... (get description, status, subquestions, decisionLogic - unchanged) ...
  const description = document.getElementById("cq-description").value;
  const status = document.getElementById("cq-status").value;
  const subquestions = Array.from(document.querySelectorAll('.subquestion-input')).map(input => input.value.trim()).filter(Boolean);
  const decisionLogic = Array.from(document.querySelectorAll('.decision-logic-input')).map(input => input.value.trim()).filter(Boolean);
  const mermaidDiagram = Array.from(document.querySelectorAll('.mermaid-diagram-input'))
    .map(input => input.value.trim())
    .filter(Boolean);

  const databaseQuery = Array.from(document.querySelectorAll('#database-query-list .list-item-container'))
    .map(item => {
      const text = item.querySelector('.database-query-input')?.value.trim() ?? '';
      const syntax = item.querySelector('.database-query-syntax-select')?.value ?? 'SPARQL';
      if (!text) return null;
      return { text, syntax };
    })
    .filter(Boolean);


  const personItems = Array.from(document.querySelectorAll('.person-entry'));
  const personsData = personItems.map(item => ({
    id: item.querySelector('.person-id-input').value,
    emailId: item.querySelector('.email-id-input').value,
    name: item.querySelector('.person-name-input').value.trim(),
    role: item.querySelector('.person-role-select').value,
    contact: item.querySelector('.person-contact-input').value.trim(),
    notes: item.querySelector('.person-notes-textarea').value.trim()
  })).filter(p => p.name);

  const dataRequirementItems = Array.from(document.querySelectorAll('.data-requirement-item'));
  const dataRequirements = dataRequirementItems.map(item => ({
    source: item.querySelector('.data-source-input').value.trim(),
    quality: item.querySelector('.data-quality-input').value.trim()
  })).filter(dr => dr.source);

  let personRelatedNodes = [];
  const contributorLinks = []; // Store links to add to the CQ node

  // --- START MODIFIED PERSON LOGIC ---
  personsData.forEach((p, index) => {
    let personId = p.id;
    let emailId = p.emailId;
    let existingPersonNode = null;

    // If ID is missing, try to find an existing person by name in the cache
    if (!personId && p.name) {
      existingPersonNode = allNodesCache.find(n =>
        n["@type"] && Array.isArray(n["@type"]) && // <-- Add this check
        n["@type"].includes(COMMON_NAMESPACE_IRIS.cco2.person) &&
        n[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] === p.name
      );
      if (existingPersonNode) {
        console.log(`Found existing person for "${p.name}" with ID: ${existingPersonNode['@id']}`);
        personId = existingPersonNode['@id'];
        // Try to get the existing email ID too
        emailId = existingPersonNode[COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]?.[0]?.['@id'] || emailId;
      }
    }

    // If still no personId, generate a new one
    if (!personId) {
      personId = `${COMMON_NAMESPACE_IRIS.cco2.person}/Person_${Date.now() + index}`;
    }
    // Generate email ID if still missing
    if (!emailId) {
      emailId = `${COMMON_NAMESPACE_IRIS.cco2.emailBox}_${Date.now() + index}`;
    }

    const roleId = `${COMMON_NAMESPACE_IRIS.bfo.role}_role_${p.role.replace(/\s+/g, '')}`;

    // Add the contributor link for the CQ node
    contributorLinks.push({ "@id": personId });

    // Create/Update Person Node (only add if not already in cache or if it's new)
    if (!allNodesCache.find(n => n['@id'] === personId)) {
      personRelatedNodes.push({
        "@id": personId,
        "@type": [COMMON_NAMESPACE_IRIS.cco2.person, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
        [COMMON_NAMESPACE_IRIS.rdfs.label]: [{ "@value": p.name }],
        [COMMON_NAMESPACE_IRIS.rdfs.comment]: [{ "@value": p.notes }],
        [COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]: [{ "@id": emailId }],
        [COMMON_NAMESPACE_IRIS.bfo.bearerOf]: [{ "@id": roleId }]
      });
    }

    // Create/Update Email Node
    if (!allNodesCache.find(n => n['@id'] === emailId)) {
      personRelatedNodes.push({
        "@id": emailId,
        "@type": [COMMON_NAMESPACE_IRIS.cco2.emailBox, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
        // Use a more robust property name here, ensure it matches your email node definition
        [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": p.contact }],
      });
    }

    // Create/Update Role Node
    if (!allNodesCache.find(n => n['@id'] === roleId)) {
      personRelatedNodes.push({
        "@id": roleId,
        "@type": [COMMON_NAMESPACE_IRIS.bfo.role, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
        [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": p.role }],
      });
    }
  });
  // --- END MODIFIED PERSON LOGIC ---


  const dataSourceNodes = dataRequirements.map((dr, index) => ({
    "@id": `${COMMON_NAMESPACE_IRIS.cco2.database}/Database_${cqUniqueId}_${index + 1}`,
    // ... rest of data source node ...
    "@type": [COMMON_NAMESPACE_IRIS.cco2.database, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
    [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": dr.source }],
    [COMMON_NAMESPACE_IRIS.rdfs.comment]: [{ "@value": dr.quality }]
  }));
  const subquestionNodes = subquestions.map((sq, index) => ({
    "@id": `https://github.com/jonathanvajda/okea/ont000001_IterrogativeICE_${cqUniqueId}_${index + 1}`,
    // ... rest of subquestion node ...
    "@type": ["https://github.com/jonathanvajda/okea/ont000001", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
    [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": sq }],
  }));
  const decisionLogicNodes = decisionLogic.map((dl, index) => ({
    "@id": `https://github.com/jonathanvajda/okea/ont000009_DecisionLogic_${cqUniqueId}_${index + 1}`,
    // ... rest of logic node ...
    "@type": ["https://github.com/jonathanvajda/okea/ont000009", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
    [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": dl }],
  }));
  
  const mermaidDiagramNodes = mermaidDiagram.map((dl, index) => ({
    "@id": `https://github.com/jonathanvajda/okea/ont000004_MermaidDiagram_${cqUniqueId}_${index + 1}`,
    // ... rest of logic node ...
    "@type": ["https://github.com/jonathanvajda/okea/ont000004", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
    "https://github.com/jonathanvajda/okea/has_mermaid_diagram_text_value": [{ "@value": dl }],
  }));
  
  const databaseQueryNodes = databaseQuery.map((dq, index) => {
    const semantics = getDatabaseQuerySemantics(dq.syntax);

    return {
      "@id": `https://github.com/jonathanvajda/okea/ont000016_DatabaseQuery_${cqUniqueId}_${index + 1}`,
      "@type": [semantics.classIri, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
      [semantics.textPredicate]: [{ "@value": dq.text }]
    };
  });

  // ... (timestamp logic unchanged) ...
  const nowISO = new Date().toISOString();
  const lastModifiedTimestamp = [{ "@value": nowISO, "@type": COMMON_NAMESPACE_IRIS.xsd.dateTime }];
  let createdTimestamp;
  if (currentCQId) { const existingCQ = allNodesCache.find(n => n['@id'] === currentCQId); if (existingCQ && existingCQ[COMMON_NAMESPACE_IRIS.dcterms.created]) { createdTimestamp = existingCQ[COMMON_NAMESPACE_IRIS.dcterms.created]; } }
  if (!createdTimestamp) { createdTimestamp = [{ "@value": nowISO, "@type": COMMON_NAMESPACE_IRIS.xsd.dateTime }]; }

  const jsonLD = [
    ...personRelatedNodes,
    ...dataSourceNodes,
    ...subquestionNodes,
    ...decisionLogicNodes,
    ...mermaidDiagramNodes,
    ...databaseQueryNodes,
    {
      "@id": `https://github.com/jonathanvajda/okea/ont000002_CQ_${cqUniqueId}`,
      "@type": ["https://github.com/jonathanvajda/okea/ont000002", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
      [COMMON_NAMESPACE_IRIS.rdfs.label]: [{ "@value": title }],
      [COMMON_NAMESPACE_IRIS.dcterms.description]: [{ "@value": description }],
      [COMMON_NAMESPACE_IRIS.dcterms.created]: createdTimestamp,
      [COMMON_NAMESPACE_IRIS.dcterms.modified]: lastModifiedTimestamp,
      "http://example.com/ns/status": [{ "@value": status }],
      [COMMON_NAMESPACE_IRIS.dcterms.contributor]: contributorLinks, // Use the collected links
      [COMMON_NAMESPACE_IRIS.dcterms.requires]: dataSourceNodes.map(dsn => ({ "@id": dsn['@id'] })),
      [COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart]: [
        ...decisionLogicNodes.map(n => ({ "@id": n['@id'] })),
        ...subquestionNodes.map(n => ({ "@id": n['@id'] }))
      ],
      [OKEA.HAS_MERMAID_DIAGRAM]: mermaidDiagramNodes.map(n => ({ "@id": n['@id'] })),
      [OKEA.HAS_FORMALIZATION]: databaseQueryNodes.map(n => ({ "@id": n['@id'] })),
    },
  ];
  return jsonLD;
}

async function performSave() {
  // 1. Generate the fresh CQ data from the form.
  const newJsonLD = generateJSONLD(); // <-- Make sure this line exists and is uncommented

  // Check if generation failed (e.g., missing title)
  if (!newJsonLD) {
    return { success: false, reason: 'Title is required.' };
  }

  // 2. Create the sync node.
  const syncNode = {
    '@id': 'sync_state',
    id: 'sync_state', // Required for the IndexedDB keyPath
    [COMMON_NAMESPACE_IRIS.dcterms.modified]: new Date().toISOString()
  };

  // 3. Combine the form data with the sync node.
  const nodesToSave = [...newJsonLD, syncNode];

  // 4. Pass the data and current cache to the manager.
  return await gdcManager.updateAndSave(nodesToSave, allNodesCache, currentCQId);
}

async function saveJSONLD() {
  debouncedAutoSave.cancel();
  const result = await performSave();
  if (result.success) {
    const isUpdate = !!currentCQId;
    const savedDsqId = isUpdate ? currentCQId : result.newJsonLD.find(n => n["@type"].includes("https://github.com/jonathanvajda/okea/ont000002"))["@id"];
    allNodesCache = await readFromIndexedDB();
    const cqNode = allNodesCache.find(n => n['@id'] === savedDsqId);
    if (!cqNode) {
      console.error("Could not find the saved CQ in the cache after saving:", savedDsqId);
      alert("An error occurred after saving. Could not update the UI.");
      return;
    }
    if (!isUpdate) {
      currentCQId = savedDsqId;
      addCQToSidebar(cqNode);
    } else {
      updateCQInSidebar(cqNode);
    }
    await recordCompetencyQuestionProjectSnapshot(allNodesCache, {
      runKind: isUpdate ? 'competency-question-update' : 'competency-question-create',
      label: isUpdate ? 'Updated competency question' : 'Created competency question'
    });
    const cqList = document.getElementById("cq-list");
    Array.from(cqList.children)
      .sort((a, b) => a.textContent.localeCompare(b.textContent))
      .forEach(node => cqList.appendChild(node));
    document.getElementById('save-status').textContent = '';
    alert(isUpdate ? "CQ updated successfully!" : "New CQ saved successfully!");
  } else {
    alert(`Error saving CQ: ${result.reason}`);
  }
}

async function autoSaveCQ() {
  if (!currentCQId) return;
  const statusEl = document.getElementById('save-status');
  statusEl.textContent = 'Saving...';
  const result = await performSave();
  if (result.success) {
    statusEl.textContent = `All changes saved. (${new Date().toLocaleTimeString()})`;
    allNodesCache = await readFromIndexedDB();
    const updatedDsqNode = allNodesCache.find(n => n['@id'] === currentCQId);
    if (updatedDsqNode) updateCQInSidebar(updatedDsqNode);
    await recordCompetencyQuestionProjectSnapshot(allNodesCache, {
      runKind: 'competency-question-autosave',
      label: 'Autosaved competency question'
    });
  } else {
    statusEl.textContent = `Save failed: ${result.reason}`;
  }
}

async function deleteCQ(cqId) {
  debouncedAutoSave.cancel();
  const uniqueId = cqId.split('_').pop();
  await deleteCompetencyQuestionById(cqId);
  allNodesCache = allNodesCache.filter(node => !String(node['@id'] || '').includes(`_${uniqueId}`));
  await recordCompetencyQuestionProjectSnapshot(allNodesCache, {
    runKind: 'competency-question-delete',
    label: 'Deleted competency question'
  });
  removeCQFromSidebar(cqId);
  alert("CQ deleted successfully.");
  if (currentCQId === cqId) {
    document.getElementById("new-cq-button").click();
  }
}

function downloadJSONLD() {
  const rdfNodes = allNodesCache.filter((node) =>
    node &&
    typeof node === 'object' &&
    typeof node['@id'] === 'string' &&
    node['@id'] !== 'sync_state'
  );
  const { quads, warnings } = createRdfQuadsFromJsonLdGraph({
    '@graph': rdfNodes
  });
  if (warnings.length) console.warn('CQ JSON-LD export warnings:', warnings);
  const { text: jsonLD } = serializeRdfDataset(quads, { format: 'jsonld' });
  downloadTextFile('CQDatabase.jsonld', jsonLD, {
    mimeType: SUPPORTED_MIME_DESCRIPTORS.jsonLd.mimeType
  });
}

function createCompetencyQuestionCsvRecords(nodes) {
  const records = [];
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const cqNodes = sourceNodes.filter(n =>
    hasType(n, "https://github.com/jonathanvajda/okea/ont000002")
  );

  cqNodes.forEach(cq => {
    const baseRow = {
      cq_id: cq['@id'] || '',
      cq_title: cq[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '',
      cq_description: cq[COMMON_NAMESPACE_IRIS.dcterms.description]?.[0]?.['@value'] ?? '',
      cq_created_date: cq[COMMON_NAMESPACE_IRIS.dcterms.created]?.[0]?.['@value'] ?? '',
      cq_modified_date: cq[COMMON_NAMESPACE_IRIS.dcterms.modified]?.[0]?.['@value'] ?? '',
      cq_status: cq["http://example.com/ns/status"]?.[0]?.['@value'] ?? '',
    };

    let itemsFound = 0;

    // Process Contributors (Persons/Roles)
    const participantLinks = cq[COMMON_NAMESPACE_IRIS.dcterms.contributor] || [];
    const participantNodes = sourceNodes.filter(n =>
      participantLinks.some(p => p["@id"] === n["@id"]) && n["@type"].includes(COMMON_NAMESPACE_IRIS.cco2.person)
    );
    participantNodes.forEach(pNode => {
      itemsFound++;
      const personId = pNode['@id'];
      const emailId = pNode[COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]?.[0]?.['@id'] ?? '';
      const roleLink = pNode[COMMON_NAMESPACE_IRIS.bfo.bearerOf]?.[0]?.['@id'];

      const emailNode = sourceNodes.find(n => n['@id'] === emailId);
      const roleNode = sourceNodes.find(n => n['@id'] === roleLink);

      const row = {
        ...baseRow,
        item_type: 'Contributor',
        item_id: personId,
        item_text: pNode[COMMON_NAMESPACE_IRIS.rdfs.label]?.[0]?.['@value'] ?? '',
        contributor_role: readCcoTextValueLiteral(roleNode),
        contributor_contact: readCcoTextValueLiteral(emailNode),
        contributor_notes: pNode[COMMON_NAMESPACE_IRIS.rdfs.comment]?.[0]?.['@value'] ?? '',
        // ADDED: Populate the new ID columns
        contributor_email_id: emailId,
        contributor_role_id: roleLink,
        datasource_quality_notes: ''
      };
      records.push(row);
    });

    // Process other item types (Subquestions, Logic, Data Sources)
    const itemTypes = [
      { type: 'Subquestion', iri: OKEA.INTERROGATIVE_ICE, link: COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart },
      { type: 'DecisionLogic', iri: OKEA.BUSINESS_RULE, link: COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart },
      { type: 'DataSource', iri: COMMON_NAMESPACE_IRIS.cco2.database, link: COMMON_NAMESPACE_IRIS.dcterms.requires },
      { type: 'MermaidDiagram', iri: 'https://github.com/jonathanvajda/okea/ont000004', link: 'https://github.com/jonathanvajda/okea/ont000012'},
      { type: 'DatabaseQuery', iri: 'https://github.com/jonathanvajda/okea/ont000016', link: 'https://github.com/jonathanvajda/okea/ont000014'}
    ];

    itemTypes.forEach(config => {
      // Process other item types
      const itemNodes = sourceNodes.filter(n =>
        (cq[config.link] || []).some(item => item?.["@id"] === n?.["@id"]) &&
        hasType(n, config.iri)
      );
            itemNodes.forEach(node => {
        itemsFound++;

        const row = {
          ...baseRow,
          item_type: config.type,
          item_id: node['@id'],
          item_text: '',
          contributor_role: '',
          contributor_contact: '',
          contributor_notes: '',
          contributor_email_id: '',
          contributor_role_id: '',
          datasource_quality_notes: '',
          mermaid_diagram_text: '',
          database_query_text: ''
        };

        if (config.type === 'Subquestion' || config.type === 'DecisionLogic' || config.type === 'DataSource') {
          row.item_text = readCcoTextValueLiteral(node);
        }

        if (config.type === 'DataSource') {
          row.datasource_quality_notes = node[COMMON_NAMESPACE_IRIS.rdfs.comment]?.[0]?.['@value'] ?? '';
        }

        if (config.type === 'MermaidDiagram') {
          row.item_text = node["https://github.com/jonathanvajda/okea/has_mermaid_diagram_text_value"]?.[0]?.['@value'] ?? '';
          row.mermaid_diagram_text = row.item_text;
        }

        if (config.type === 'DatabaseQuery') {
          row.item_text = node["https://github.com/jonathanvajda/okea/has_query_text_value"]?.[0]?.['@value'] ?? '';
          row.database_query_text = row.item_text;
        }

        records.push(row);
      });
  });

    // If a CQ has no items, create a single row for it.
    if (itemsFound === 0) {
      const row = { ...baseRow, item_type: 'CQ', item_id: baseRow.cq_id };
      records.push(row);
    }
  });

  return records;
}

function parseCompetencyQuestionCsvText(text) {
  const parsed = parseDelimitedText(text, {
    delimiter: ',',
    hasHeader: true,
    trimHeaders: true,
    trimCells: true
  });
  if (parsed.warnings.length) {
    console.warn('CSV import warnings:', parsed.warnings);
  }
  return parsed.records;
}

function downloadCSV() {
  console.log("Generating CSV...");
  const csvContent = serializeDelimitedRecords(createCompetencyQuestionCsvRecords(allNodesCache), {
    headers: [...CQ_CSV_HEADERS],
    delimiter: ',',
    trailingNewline: false
  });
  downloadTextFile(`CQ_Export_${new Date().toISOString().slice(0, 10)}.csv`, csvContent, {
    mimeType: SUPPORTED_MIME_DESCRIPTORS.csv.mimeType
  });
  console.log("CSV generation complete.");
}

async function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  // UPDATED: Changed the confirmation message to reflect the new behavior.
  if (!confirm("This will ADD data from the CSV to your tool, or UPDATE existing entries if the IDs match. Are you sure you want to proceed?")) {
    event.target.value = ''; // Reset the file input
    return;
  }

  try {
    const text = await readFileAsText(file);
    const data = parseCompetencyQuestionCsvText(text);
    console.log("Parsed CSV data:", data);

    // --- 2. RECONSTRUCT THE GRAPH FROM THE FLAT DATA ---
    let newGraph = [];
    const processedNodeIds = new Set();
    const cqGroups = data.reduce((acc, row) => {
      const cqId = row.cq_id;
      if (cqId) { // Only process rows that have a cq_id
        if (!acc[cqId]) acc[cqId] = [];
        acc[cqId].push(row);
      }
      return acc;
    }, {});
    console.log("Grouped by CQ:", cqGroups);

    for (const cqId in cqGroups) {
      const groupRows = cqGroups[cqId];
      const baseRow = groupRows[0];

      const cqNode = {
        "@id": baseRow.cq_id,
        "@type": ["https://github.com/jonathanvajda/okea/ont000002", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
        [COMMON_NAMESPACE_IRIS.rdfs.label]: [{ "@value": baseRow.cq_title }],
        [COMMON_NAMESPACE_IRIS.dcterms.description]: [{ "@value": baseRow.cq_description }],
        [COMMON_NAMESPACE_IRIS.dcterms.created]: [{ "@value": baseRow.cq_created_date, "@type": COMMON_NAMESPACE_IRIS.xsd.dateTime }],
        [COMMON_NAMESPACE_IRIS.dcterms.modified]: [{ "@value": baseRow.cq_modified_date, "@type": COMMON_NAMESPACE_IRIS.xsd.dateTime }],
        "http://example.com/ns/status": [{ "@value": baseRow.cq_status }],
        [COMMON_NAMESPACE_IRIS.dcterms.contributor]: [],
        [COMMON_NAMESPACE_IRIS.dcterms.requires]: [],
        [COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart]: []
      };

      // Process each item row within the CQ group
      groupRows.forEach(row => {
        if (!row.item_id || !row.item_type) return;

        switch (row.item_type) {
          case 'Contributor':
            // Create Person, Email, and Role nodes, ensuring no duplicates within this import
            if (row.item_id && !processedNodeIds.has(row.item_id)) {
              const pNode = {
                "@id": row.item_id, "@type": [COMMON_NAMESPACE_IRIS.cco2.person, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.rdfs.label]: [{ "@value": row.item_text }],
                [COMMON_NAMESPACE_IRIS.rdfs.comment]: [{ "@value": row.contributor_notes }],
                [COMMON_NAMESPACE_IRIS.cco2.isSubjectOf]: [{ "@id": row.contributor_email_id }],
                [COMMON_NAMESPACE_IRIS.bfo.bearerOf]: [{ "@id": row.contributor_role_id }]
              };
              newGraph.push(pNode);
              processedNodeIds.add(row.item_id);
            }
            if (row.contributor_email_id && !processedNodeIds.has(row.contributor_email_id)) {
              const eNode = {
                "@id": row.contributor_email_id, "@type": [COMMON_NAMESPACE_IRIS.cco2.emailBox, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": row.contributor_contact }],
              };
              newGraph.push(eNode);
              processedNodeIds.add(row.contributor_email_id);
            }
            if (row.contributor_role_id && !processedNodeIds.has(row.contributor_role_id)) {
              const rNode = {
                "@id": row.contributor_role_id, "@type": [COMMON_NAMESPACE_IRIS.bfo.role, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": row.contributor_role }],
              };
              newGraph.push(rNode);
              processedNodeIds.add(row.contributor_role_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.dcterms.contributor].push({ "@id": row.item_id });
            break;

          // --- ADDED MISSING CASES ---
          case 'Subquestion':
            if (!processedNodeIds.has(row.item_id)) {
              const sqNode = {
                "@id": row.item_id, "@type": ["https://github.com/jonathanvajda/okea/ont000001", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": row.item_text }],
              };
              newGraph.push(sqNode);
              processedNodeIds.add(row.item_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart].push({ "@id": row.item_id });
            break;

          case 'DecisionLogic':
            if (!processedNodeIds.has(row.item_id)) {
              const dlNode = {
                "@id": row.item_id, "@type": ["https://github.com/jonathanvajda/okea/ont000009", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": row.item_text }],
              };
              newGraph.push(dlNode);
              processedNodeIds.add(row.item_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart].push({ "@id": row.item_id });
            break;

          case 'DataSource':
            if (!processedNodeIds.has(row.item_id)) {
              const dsNode = {
                "@id": row.item_id,
                "@type": [COMMON_NAMESPACE_IRIS.cco2.database, COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                [COMMON_NAMESPACE_IRIS.cco2.hasTextValue]: [{ "@value": row.item_text }],
                [COMMON_NAMESPACE_IRIS.rdfs.comment]: [{ "@value": row.datasource_quality_notes }]
              };
              newGraph.push(dsNode);
              processedNodeIds.add(row.item_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.dcterms.requires].push({ "@id": row.item_id });
            break;

          case 'MermaidDiagram':
            if (!processedNodeIds.has(row.item_id)) {
              const mermaidNode = {
                "@id": row.item_id,
                "@type": ["https://github.com/jonathanvajda/okea/ont000004", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                "https://github.com/jonathanvajda/okea/has_mermaid_diagram_text_value": [{ "@value": row.mermaid_diagram_text || row.item_text }]
              };
              newGraph.push(mermaidNode);
              processedNodeIds.add(row.item_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart].push({ "@id": row.item_id });
            break;

          case 'DatabaseQuery':
            if (!processedNodeIds.has(row.item_id)) {
              const dbQueryNode = {
                "@id": row.item_id,
                "@type": ["https://github.com/jonathanvajda/okea/ont000016", COMMON_NAMESPACE_IRIS.owl.NamedIndividual],
                "https://github.com/jonathanvajda/okea/has_query_text_value": [{ "@value": row.database_query_text || row.item_text }]
              };
              newGraph.push(dbQueryNode);
              processedNodeIds.add(row.item_id);
            }
            cqNode[COMMON_NAMESPACE_IRIS.bfo.hasContinuantPart].push({ "@id": row.item_id });
            break;  
        }
      });
      newGraph.push(cqNode);
    }
    console.log("Reconstructed graph:", newGraph);

    // --- 3. UPDATE THE DATABASE USING THE GDC MANAGER ---
    try {
      // The manager handles GDC generation, deletion, and saving for the CSV data.
      const result = await gdcManager.updateAndSave(newGraph, allNodesCache);
      if (result.success) {
        alert(`Successfully processed ${Object.keys(cqGroups).length} CQs from the CSV! The application will now reload with the new data.`);
        await initialLoad(); // Reload the application state from the updated database
        await recordCompetencyQuestionProjectSnapshot(allNodesCache, {
          runKind: 'competency-question-csv-import',
          label: `Imported ${Object.keys(cqGroups).length} competency question CSV group${Object.keys(cqGroups).length === 1 ? '' : 's'}`
        });
      } else {
        throw new Error(result.reason);
      }
    } catch (error) {
      console.error("Failed to save uploaded data:", error);
      alert("An error occurred while saving the uploaded data. Check the console for details.");
    }
  } catch (error) {
    console.error("Failed to read uploaded CSV:", error);
    alert("An error occurred while reading the uploaded CSV. Check the console for details.");
  } finally {
    event.target.value = ''; // Reset file input
  }
}

// ======================================================
// SECTION 7: INITIALIZATION & EVENT LISTENERS
// ======================================================

// Call this whenever you switch tabs
function activateTab(panelId) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === panelId;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.tabIndex = isActive ? 0 : -1;
  });

  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === panelId);
  });
}

// Initialize tab buttons
function initTabs() {
  const btns = document.querySelectorAll('.tab-btn');
  if (!btns.length) return;

  btns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // Default: first tab or hash
  const initial = location.hash && document.getElementById(location.hash.slice(1))
    ? location.hash.slice(1)
    : btns[0].dataset.tab;

  activateTab(initial);
}

// Tab switching
document.querySelectorAll('.tab').forEach((tab, idx) => {
  tab.onclick = () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.tab-content')[idx].classList.add('active');
  };
});

function setupEventListeners() {
  document.querySelector('.main').addEventListener('input', debouncedAutoSave);
  document.getElementById('add-subquestion-btn').addEventListener('click', () => {
    addSubquestionItem();
    debouncedAutoSave();
  });
  document.getElementById('add-decision-logic-btn').addEventListener('click', () => {
    addDecisionLogicItem();
    debouncedAutoSave();
  });
  document.getElementById('add-data-requirement-btn').addEventListener('click', () => {
    addDataRequirementItem();
    debouncedAutoSave();
  });

  // Operational Context Sections
  document.getElementById('add-mermaid-diagram-btn').addEventListener('click', () => {
    addMermaidDiagramItem();
    debouncedAutoSave();
  });
  document.getElementById('add-database-query-btn').addEventListener('click', () => {
    addDatabaseQueryItem();
    debouncedAutoSave();
  });

  document.getElementById('add-person-btn').addEventListener('click', () => {
    addPersonItem();
    debouncedAutoSave();
  });
  const saveButtons = ['save-button-top', 'save-button-bottom'];
  saveButtons.forEach(id => {
    document.getElementById(id).addEventListener('click', saveJSONLD);
  });
  document.getElementById("download-jsonld-button").addEventListener("click", downloadJSONLD);
  document.getElementById("download-csv-button").addEventListener("click", downloadCSV);
  document.getElementById("upload-csv-button").addEventListener("click", () => {
    document.getElementById('csv-upload-input').click();
  });
  document.getElementById("csv-upload-input").addEventListener("change", handleCSVUpload);

  document.getElementById("new-cq-button").addEventListener("click", () => {
    debouncedAutoSave.cancel();
    currentCQId = null;
    document.getElementById("cq-title").value = "";
    document.getElementById("cq-description").value = "";
    document.getElementById("cq-status").value = "Draft";
    document.getElementById('save-status').textContent = '';
    document.getElementById("subquestions-list").innerHTML = "";
    document.getElementById("decision-logic-list").innerHTML = "";
    document.getElementById("persons-list").innerHTML = "";
    addPersonItem();
    document.getElementById("data-requirements-list").innerHTML = "";

    // Operational Context
    document.getElementById("mermaid-diagram-list").innerHTML = "";
    document.getElementById("database-query-list").innerHTML = "";

    addDataRequirementItem();
    addSubquestionItem();
    addDecisionLogicItem();
    addMermaidDiagramItem();
    addDatabaseQueryItem();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  initialLoad();
  initTabs();
});

