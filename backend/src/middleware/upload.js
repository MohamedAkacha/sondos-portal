// =====================================================
// Upload Middleware — Multer (local dev, S3 production)
// =====================================================
const multer = require('multer');
const path = require('path');
const { MAX_FILE_SIZE, ALLOWED_DOCUMENT_TYPES } = require('../config/constants');

// ── Local storage (dev) ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/tmp/sondos-uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// ── File filter ──
const fileFilter = (req, file, cb) => {
  if (ALLOWED_DOCUMENT_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('صيغة الملف غير مدعومة. الصيغ المدعومة: PDF, DOCX, TXT, CSV'), false);
  }
};

// ── Ensure upload directory exists ──
const fs = require('fs');
if (!fs.existsSync('/tmp/sondos-uploads')) {
  fs.mkdirSync('/tmp/sondos-uploads', { recursive: true });
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
});

module.exports = { upload };
