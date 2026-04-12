// =====================================================
// Tool Routes
// =====================================================
const router = require('express').Router();
const { body } = require('express-validator');
const toolCtrl = require('../controllers/tool.controller');
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validator');

const toolValidation = [
  body('name').trim().notEmpty().withMessage('اسم الأداة مطلوب'),
  body('functionName').trim().notEmpty().matches(/^[a-z][a-z0-9_]*$/).withMessage('الاسم التقني يجب أن يكون بأحرف صغيرة وأرقام و _ فقط'),
  body('description').trim().notEmpty().withMessage('وصف الأداة مطلوب'),
];

// ── All routes require authentication ──
router.use(protect);

// Built-in tools (must be before /:id)
router.get('/built-in', toolCtrl.getBuiltIn);

// CRUD
router.post('/', validate(toolValidation), toolCtrl.create);
router.get('/', toolCtrl.getAll);
router.get('/:id', toolCtrl.getById);
router.put('/:id', toolCtrl.update);
router.delete('/:id', toolCtrl.delete);

// Test & Toggle
router.post('/:id/test', toolCtrl.test);
router.post('/:id/toggle', toolCtrl.toggle);

module.exports = router;
