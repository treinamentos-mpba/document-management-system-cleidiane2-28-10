const fs = require('node:fs/promises');
const path = require('node:path');

const storageDirectory = path.resolve(__dirname, '../../storage');
const documents = new Map();

function save(document) {
  documents.set(document.id, document);
}

function findById(id) {
  return documents.get(id) || null;
}

function findByOwner(owner) {
  return [...documents.values()].filter((document) => document.owner === owner);
}

async function findFilePath(document) {
  const filePath = path.join(storageDirectory, document.storedName);
  try {
    await fs.access(filePath);
    return filePath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function removeFile(storedName) {
  if (!storedName || path.basename(storedName) !== storedName) {
    return;
  }

  await fs.rm(path.join(storageDirectory, storedName), { force: true });
}

module.exports = {
  storageDirectory,
  save,
  findById,
  findByOwner,
  findFilePath,
  removeFile,
};