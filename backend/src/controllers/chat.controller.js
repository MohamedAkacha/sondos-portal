// =====================================================
// Chat Controller
// =====================================================
const chatService = require('../services/chat.service');

// POST /api/chat/:agentId/sessions — start new session
exports.startSession = async (req, res) => {
  try {
    const session = await chatService.startSession(req.params.agentId, req.body);
    res.status(201).json({ success: true, data: session.toDetailJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// POST /api/chat/sessions/:sessionId/message — send message
exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'الرسالة مطلوبة' });

    const { reply, session } = await chatService.sendMessage(req.params.sessionId, message.trim());
    res.json({ success: true, data: { reply, messageCount: session.messageCount } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// GET /api/chat/sessions — list sessions
exports.getSessions = async (req, res) => {
  try {
    const result = await chatService.getSessions(req.user._id, {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      agentId: req.query.agentId,
      status: req.query.status,
      channel: req.query.channel,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/chat/sessions/:sessionId — get session detail
exports.getSession = async (req, res) => {
  try {
    const session = await chatService.getSession(req.params.sessionId);
    res.json({ success: true, data: session.toDetailJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// DELETE /api/chat/sessions/:sessionId — end session
exports.endSession = async (req, res) => {
  try {
    const session = await chatService.endSession(req.params.sessionId);
    res.json({ success: true, data: session.toPublicJSON() });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// ── Public endpoints (for chat widget — no auth required) ──

// POST /api/public/chat/:agentId/start
exports.publicStartSession = async (req, res) => {
  try {
    const session = await chatService.startSession(req.params.agentId, { ...req.body, channel: 'widget', visitorIp: req.ip });
    res.status(201).json({ success: true, data: { sessionId: session._id, greeting: session.messages[0]?.content } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};

// POST /api/public/chat/:sessionId/message
exports.publicSendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) return res.status(400).json({ success: false, message: 'Message required' });

    const { reply } = await chatService.sendMessage(req.params.sessionId, message.trim());
    res.json({ success: true, data: { reply } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ success: false, message: error.message });
  }
};
