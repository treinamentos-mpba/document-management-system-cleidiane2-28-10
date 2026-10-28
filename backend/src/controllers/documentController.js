const documentService = require('../services/documentService');

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function getOwner(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function upload(req, res, next) {
  const owner = getOwner(req.body?.owner);

  if (!req.file || !owner) {
    if (req.file) {
      try {
        await documentService.discardUpload(req.file.filename);
      } catch (error) {
        return next(error);
      }
    }
    return sendError(res, 400, 'INVALID_REQUEST', 'Arquivo e owner são obrigatórios.');
  }

  try {
    const document = await documentService.create(req.file, owner);
    return res.status(201).json(document);
  } catch (error) {
    await documentService.discardUpload(req.file.filename).catch(() => {});
    return next(error);
  }
}

function list(req, res) {
  const owner = getOwner(req.query.owner);
  if (!owner) {
    return sendError(res, 400, 'INVALID_REQUEST', 'O parâmetro owner é obrigatório.');
  }

  return res.status(200).json({ documents: documentService.list(owner) });
}

async function download(req, res, next) {
  const owner = getOwner(req.query.owner);
  if (!owner || !uuidPattern.test(req.params.id)) {
    return sendError(res, 400, 'INVALID_REQUEST', 'id e owner válidos são obrigatórios.');
  }

  try {
    const result = await documentService.findDownload(req.params.id, owner);
    if (!result) {
      return sendError(res, 404, 'DOCUMENT_NOT_FOUND', 'Documento não encontrado.');
    }

    return res.download(result.filePath, result.document.originalName, (error) => {
      if (error) {
        next(error);
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { upload, list, download };