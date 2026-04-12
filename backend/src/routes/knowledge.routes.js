// =====================================================
// Knowledge Routes
// =====================================================
const router = require('express').Router();
const knowledgeCtrl = require('../controllers/knowledge.controller');
const { protect } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// All routes require authentication
router.use(protect);

// ── Knowledge Base CRUD ──
router.post('/bases', knowledgeCtrl.createBase);
router.get('/bases', knowledgeCtrl.getAllBases);
router.get('/bases/:id', knowledgeCtrl.getBase);
router.put('/bases/:id', knowledgeCtrl.updateBase);
router.delete('/bases/:id', knowledgeCtrl.deleteBase);

// ── Documents ──
router.get('/bases/:id/documents', knowledgeCtrl.getDocuments);
router.post('/bases/:id/documents/upload', upload.single('file'), knowledgeCtrl.uploadDocument);
router.post('/bases/:id/documents/url', knowledgeCtrl.addUrl);
router.post('/bases/:id/documents/faq', knowledgeCtrl.addFaq);
router.delete('/documents/:docId', knowledgeCtrl.deleteDocument);

// ── Search (for frontend testing) ──
router.post('/search', knowledgeCtrl.search);

module.exports = router;
