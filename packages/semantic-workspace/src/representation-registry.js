/** @file Pure mapping from shared MIME descriptors to portable source artifacts. */

/**
 * Selects a non-application-specific artifact kind for a recognized file.
 *
 * @param {{id:string,category:string}} descriptor Shared MIME descriptor.
 * @returns {string} Portable artifact kind.
 */
export function getSourceArtifactKindForMimeDescriptor(descriptor) {
  if (descriptor?.id === 'sparqlQuery') return 'sparql-query';
  if (descriptor?.id === 'sparqlUpdate') return 'sparql-update';
  if (descriptor?.category === 'rdf') return 'rdf-dataset';
  if (descriptor?.category === 'tabular') return 'tabular-file';
  if (descriptor?.category === 'document') return 'document';
  if (descriptor?.category === 'visualization') return 'diagram';
  return 'source-file';
}

/**
 * Creates artifact metadata from browser file metadata and a shared descriptor.
 *
 * @param {{name:string,size?:number,lastModified?:number}} fileMetadata Browser file metadata.
 * @param {{id:string,mimeType:string,category:string}} descriptor Shared MIME descriptor.
 * @param {{projectId:string,artifactId:string,extension:string,now?:string}} context Storage context.
 * @returns {object} Canonical artifact metadata.
 */
export function createSourceArtifactMetadata(fileMetadata, descriptor, context) {
  const timestamp = context.now || new Date().toISOString();
  return {
    artifactId: context.artifactId,
    projectId: context.projectId,
    artifactKind: getSourceArtifactKindForMimeDescriptor(descriptor),
    role: 'source',
    label: String(fileMetadata.name || 'Imported file'),
    mediaType: descriptor.mimeType,
    extension: context.extension,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: { origin: 'file-upload', fileName: fileMetadata.name },
    provenance: { derivedFrom: [] },
    summary: {
      representationId: descriptor.id,
      representationCategory: descriptor.category,
      byteLength: Number(fileMetadata.size || 0),
      fileLastModified: Number(fileMetadata.lastModified || 0)
    }
  };
}

/**
 * Determines whether a recognized representation needs binary file reading.
 *
 * @param {{id:string,category:string}} descriptor Shared MIME descriptor.
 * @returns {boolean} True for binary browser reads.
 */
export function isBinaryMimeDescriptor(descriptor) {
  return ['xlsx', 'xls', 'docx', 'zip', 'binary'].includes(descriptor?.id)
    || descriptor?.category === 'archive'
    || descriptor?.category === 'binary';
}
