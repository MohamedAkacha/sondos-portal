// =====================================================
// Chat Service — Message Processing via OpenAI
// =====================================================
const ChatSession = require('../models/ChatSession');
const Agent = require('../models/Agent');
const toolService = require('./tool.service');
const memoryService = require('./memory.service');

class ChatService {

  async startSession(agentId, visitorData) {
    const agent = await Agent.findById(agentId);
    if (!agent) throw Object.assign(new Error('المساعد غير موجود'), { statusCode: 404 });

    const session = await ChatSession.create({
      userId: agent.userId,
      agentId: agent._id,
      ...visitorData,
      channel: visitorData.channel || 'widget',
      status: 'active',
      messages: [{ role: 'assistant', content: agent.greeting || 'أهلاً! كيف أقدر أساعدك؟', timestamp: new Date() }],
      messageCount: 1,
    });
    return session;
  }

  async sendMessage(sessionId, userMessage) {
    const session = await ChatSession.findById(sessionId);
    if (!session) throw Object.assign(new Error('الجلسة غير موجودة'), { statusCode: 404 });
    if (session.status !== 'active') throw Object.assign(new Error('الجلسة منتهية'), { statusCode: 400 });

    const agent = await Agent.findById(session.agentId);
    if (!agent) throw Object.assign(new Error('المساعد غير موجود'), { statusCode: 404 });

    session.messages.push({ role: 'user', content: userMessage, timestamp: new Date() });

    // Build prompt with memory
    let systemPrompt = agent.systemPrompt || agent.personality?.systemPrompt || `أنت مساعد ذكي اسمك ${agent.name}.`;
    const identifier = session.visitorPhone || session.visitorEmail;
    if (identifier) {
      const ctx = await memoryService.getContext(agent.userId, identifier);
      if (ctx) systemPrompt += `\n\n=== معلومات سابقة ===\n${ctx}`;
    }
    systemPrompt += '\n\nأنت في دردشة نصية. أجب بإيجاز ووضوح.';

    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...session.messages.slice(-20).map(m => ({ role: m.role === 'tool' ? 'assistant' : m.role, content: m.content })),
    ];

    // Get tools
    const toolSchemas = await toolService.getToolSchemas(agent.userId, agent._id);
    const tools = toolSchemas.map(t => t.schema);

    // Call OpenAI
    let result = await this._callOpenAI(openaiMessages, tools, agent);
    let reply = result.content || '';

    // Handle tool calls
    if (result.tool_calls?.length > 0) {
      for (const tc of result.tool_calls) {
        const fnName = tc.function.name;
        const args = JSON.parse(tc.function.arguments || '{}');
        const toolCfg = toolSchemas.find(t => t.config.functionName === fnName);

        if (toolCfg && toolCfg.config.type === 'custom_http') {
          const execResult = await toolService.executeHTTP({ httpConfig: toolCfg.config.httpConfig, _id: toolCfg.config.id }, args);
          const toolResult = JSON.stringify(execResult.data || execResult.error);
          session.messages.push({ role: 'tool', content: toolResult, toolCall: { name: fnName, result: toolResult }, timestamp: new Date() });

          openaiMessages.push({ role: 'assistant', content: null, tool_calls: [tc] });
          openaiMessages.push({ role: 'tool', content: toolResult, tool_call_id: tc.id });
          const followUp = await this._callOpenAI(openaiMessages, tools, agent);
          reply = followUp.content || reply;
        }
      }
    }

    session.messages.push({ role: 'assistant', content: reply, timestamp: new Date() });
    session.messageCount = session.messages.length;
    await session.save();
    return { reply, session };
  }

  async endSession(sessionId) {
    const session = await ChatSession.findById(sessionId);
    if (!session) throw Object.assign(new Error('الجلسة غير موجودة'), { statusCode: 404 });
    session.status = 'ended';
    session.endedAt = new Date();
    session.durationSeconds = Math.floor((session.endedAt - session.startedAt) / 1000);
    await session.save();
    return session;
  }

  async getSessions(userId, { page = 1, limit = 20, agentId, status, channel } = {}) {
    const filter = { userId };
    if (agentId) filter.agentId = agentId;
    if (status) filter.status = status;
    if (channel) filter.channel = channel;

    const [sessions, total] = await Promise.all([
      ChatSession.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('agentId', 'name avatar'),
      ChatSession.countDocuments(filter),
    ]);
    return { sessions: sessions.map(s => s.toPublicJSON()), total, page, limit };
  }

  async getSession(sessionId) {
    const session = await ChatSession.findById(sessionId).populate('agentId', 'name avatar');
    if (!session) throw Object.assign(new Error('الجلسة غير موجودة'), { statusCode: 404 });
    return session;
  }

  async _callOpenAI(messages, tools, agent) {
    const body = {
      model: agent.llmModel || agent.personality?.llmModel || 'gpt-4o-mini',
      messages,
      temperature: agent.llmTemperature || agent.personality?.llmTemperature || 0.7,
    };
    if (tools?.length > 0) { body.tools = tools; body.tool_choice = 'auto'; }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
    });
    if (!response.ok) { const err = await response.text(); throw new Error(`OpenAI error: ${err}`); }
    const data = await response.json();
    return data.choices?.[0]?.message || {};
  }
}

module.exports = new ChatService();
