const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const express = require('express');
const documentController = require('../controllers/documentController');

const router = express.Router();
const storageDirectory = path.resolve(__dirname, '../../storage');
const configuredFileSize = Number(process.env.MAX_FILE_SIZE_BYTES || 10 * 1024 * 1024);

if (!Number.isSafeInteger(configuredFileSize) || configuredFileSize <= 0) {
  throw new Error('MAX_FILE_SIZE_BYTES deve ser um inteiro positivo.');
}

fs.mkdirSync(storageDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, storageDirectory),
  filename: (req, file, callback) => callback(null, crypto.randomUUID()),
});

const upload = multer({
  storage,
  limits: { fileSize: configuredFileSize },
});

router.post('/upload', upload.single('file'), documentController.upload);
router.get('/documents', documentController.list);
router.get('/documents/:id/download', documentController.download);

module.exports = router;