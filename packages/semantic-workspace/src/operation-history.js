/** @file Pure view-model functions for compact workspace operation history. */

function humanizeIdentifier(value) {
  return String(value || 'operation')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function createArtifactReference(artifactId, artifactById) {
  const artifact = artifactById.get(artifactId);
  return Object.freeze({
    artifactId,
    label: artifact?.label || artifactId,
    available: Boolean(artifact)
  });
}

/**
 * Creates a safe, presentation-ready summary without exposing nested payloads.
 *
 * @param {object} run Canonical operation run record.
 * @param {object[]} artifacts Current project artifact metadata.
 * @returns {object} Detached operation history view model.
 */
export function createOperationHistoryEntry(run, artifacts) {
  const artifactById = new Map((artifacts || []).map((artifact) => [artifact.artifactId, artifact]));
  const inputs = (run?.inputArtifactIds || []).map((id) => createArtifactReference(id, artifactById));
  const outputs = (run?.outputArtifactIds || []).map((id) => createArtifactReference(id, artifactById));
  const facts = Object.entries(run?.payload || {})
    .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => Object.freeze({ label: humanizeIdentifier(key), value: String(value) }));
  return Object.freeze({
    runId: String(run?.runId || ''),
    title: String(run?.label || humanizeIdentifier(run?.runKind)),
    kindLabel: humanizeIdentifier(run?.runKind),
    createdAt: String(run?.createdAt || ''),
    inputs: Object.freeze(inputs),
    outputs: Object.freeze(outputs),
    facts: Object.freeze(facts),
    hasUnavailableArtifacts: [...inputs, ...outputs].some((reference) => !reference.available)
  });
}
