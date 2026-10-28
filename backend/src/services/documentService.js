const documentRepository = require('../repositories/documentRepository');

async function create(file, owner) {
  const document = {
    id: file.filename,
    originalName: file.originalname,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner,
    mimeType: file.mimetype || 'application/octet-stream',
    storedName: file.filename,
  };

  documentRepository.save(document);
  return toPublicDocument(document);
}

function list(owner) {
  return documentRepository
    .findByOwner(owner)
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
    .map(toPublicDocument);
}

async function findDownload(id, owner) {
  const document = documentRepository.findById(id);
  if (!document || document.owner !== owner) {
    return null;
  }

  const filePath = await documentRepository.findFilePath(document);
  return filePath ? { document, filePath } : null;
}

function discardUpload(storedName) {
  return documentRepository.removeFile(storedName);
}

function toPublicDocument(document) {
  const { storedName, ...publicDocument } = document;
  return publicDocument;
}

module.exports = { create, list, findDownload, discardUpload };