const router = require('express').Router();
const memoryService = require('../services/memory.service');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const result = await memoryService.getAll(req.user._id, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      search: req.query.search,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await memoryService.deleteMemory(req.user._id, req.params.id);
    res.json({ success: true, message: 'تم مسح الذاكرة' });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
});

module.exports = router;
