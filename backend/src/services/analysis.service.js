// =====================================================
// Analysis Service — Post-Call Analysis via LLM
// =====================================================
const CallAnalysis = require('../models/CallAnalysis');
const CallExtraction = require('../models/CallExtraction');
const LiveKitCall = require('../models/LiveKitCall');
const Agent = require('../models/Agent');
const memoryService = require('./memory.service');

const ANALYSIS_MODEL = 'gpt-4o-mini';

class AnalysisService {

  /**
   * Analyze a completed call
   */
  async analyzeCall(callId) {
    const startTime = Date.now();

    // Check if already analyzed
    const existing = await CallAnalysis.findOne({ callId });
    if (existing && existing.status === 'completed') return existing;

    // Get call data
    const call = await LiveKitCall.findById(callId);
    if (!call) throw new Error('Call not found');
    if (!call.transcript || call.transcript.length === 0) throw new Error('No transcript');

    // Create or update analysis record
    let analysis = existing || new CallAnalysis({
      callId: call._id,
      userId: call.userId,
      agentId: call.agentId,
      status: 'processing',
    });
    analysis.status = 'processing';
    await analysis.save();

    try {
      // Build transcript text
      const transcriptText = call.transcript
        .map(e => `${e.speaker === 'agent' ? 'المساعد' : e.speaker === 'user' ? 'العميل' : 'النظام'}: ${e.text}`)
        .join('\n');

      // Call LLM for analysis
      const result = await this._callLLM(transcriptText);

      // Update analysis
      analysis.summary = result.summary || '';
      analysis.sentiment = result.sentiment || 'neutral';
      analysis.sentimentScore = result.sentimentScore || 0;
      analysis.intent = result.intent || 'other';
      analysis.topics = result.topics || [];
      analysis.performance = {
        accuracy: result.performance?.accuracy || 5,
        helpfulness: result.performance?.helpfulness || 5,
        professionalism: result.performance?.professionalism || 5,
        overall: result.performance?.overall || 5,
      };
      analysis.goalAchieved = result.goalAchieved ?? null;
      analysis.followUpRequired = result.followUpRequired || false;
      analysis.followUpNotes = result.followUpNotes || '';
      analysis.status = 'completed';
      analysis.processingTimeMs = Date.now() - startTime;
      await analysis.save();

      // Update conversation memory
      if (call.phoneNumber || call.destination) {
        const contactId = call.phoneNumber || call.destination;
        try {
          await memoryService.updateAfterInteraction(call.userId, contactId, {
            summary: result.summary,
            sentiment: result.sentiment,
            keyFacts: result.topics,
            sourceId: call._id.toString(),
          });
        } catch (memErr) {
          console.error('Memory update error:', memErr.message);
        }
      }

      return analysis;

    } catch (err) {
      analysis.status = 'failed';
      analysis.errorMessage = err.message;
      await analysis.save();
      throw err;
    }
  }

  /**
   * Extract variables from a call transcript
   */
  async extractVariables(callId) {
    const call = await LiveKitCall.findById(callId);
    if (!call) throw new Error('Call not found');

    const agent = await Agent.findById(call.agentId);
    if (!agent || !agent.extractionConfig?.enabled) return null;

    const variables = agent.extractionConfig.variables || [];
    if (variables.length === 0) return null;

    // Check existing
    let extraction = await CallExtraction.findOne({ callId });
    if (extraction && extraction.status === 'completed') return extraction;

    extraction = extraction || new CallExtraction({
      callId: call._id,
      agentId: call.agentId,
      userId: call.userId,
      status: 'pending',
    });

    try {
      const transcriptText = call.transcript
        .map(e => `${e.speaker}: ${e.text}`)
        .join('\n');

      const result = await this._callExtractionLLM(transcriptText, variables);

      extraction.variables = result.variables || {};
      extraction.confidence = result.confidence || 0;
      extraction.status = 'completed';
      await extraction.save();

      // Send webhook if configured
      if (agent.extractionConfig.postExtractionWebhook?.enabled) {
        await this._sendExtractionWebhook(agent.extractionConfig.postExtractionWebhook, extraction);
      }

      return extraction;

    } catch (err) {
      extraction.status = 'failed';
      extraction.errorMessage = err.message;
      await extraction.save();
      throw err;
    }
  }

  /**
   * Get analysis for a call
   */
  async getForCall(callId) {
    return await CallAnalysis.findOne({ callId });
  }

  /**
   * Get extraction for a call
   */
  async getExtractionForCall(callId) {
    return await CallExtraction.findOne({ callId });
  }

  /**
   * Get analytics overview for a user
   */
  async getOverview(userId, { startDate, endDate, agentId } = {}) {
    const match = { userId: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()) };
    if (startDate) match.createdAt = { $gte: new Date(startDate) };
    if (endDate) match.createdAt = { ...match.createdAt, $lte: new Date(endDate) };
    if (agentId) match.agentId = require('mongoose').Types.ObjectId.createFromHexString(agentId);

    const [sentimentDist, intentDist, topTopics, avgPerformance] = await Promise.all([
      CallAnalysis.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $group: { _id: '$sentiment', count: { $sum: 1 } } },
      ]),
      CallAnalysis.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $group: { _id: '$intent', count: { $sum: 1 } } },
      ]),
      CallAnalysis.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $unwind: '$topics' },
        { $group: { _id: '$topics', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      CallAnalysis.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $group: {
          _id: null,
          avgAccuracy: { $avg: '$performance.accuracy' },
          avgHelpfulness: { $avg: '$performance.helpfulness' },
          avgProfessionalism: { $avg: '$performance.professionalism' },
          avgOverall: { $avg: '$performance.overall' },
          total: { $sum: 1 },
        }},
      ]),
    ]);

    return {
      sentimentDistribution: Object.fromEntries(sentimentDist.map(s => [s._id, s.count])),
      intentDistribution: Object.fromEntries(intentDist.map(s => [s._id, s.count])),
      topTopics: topTopics.map(t => ({ topic: t._id, count: t.count })),
      avgPerformance: avgPerformance[0] || { avgAccuracy: 0, avgHelpfulness: 0, avgProfessionalism: 0, avgOverall: 0, total: 0 },
    };
  }

  // ══════════════ Private: LLM Calls ══════════════

  async _callLLM(transcript) {
    const prompt = `حلل المحادثة التالية بين مساعد ذكي وعميل. أرجع JSON فقط بدون أي نص إضافي.

المحادثة:
${transcript}

أرجع JSON بالشكل التالي:
{
  "summary": "ملخص المكالمة في 2-3 جمل",
  "sentiment": "very_positive|positive|neutral|negative|very_negative",
  "sentimentScore": رقم بين -1 و 1,
  "intent": "inquiry|complaint|purchase|booking|support|cancellation|feedback|other",
  "topics": ["موضوع1", "موضوع2"],
  "performance": {
    "accuracy": رقم 1-10,
    "helpfulness": رقم 1-10,
    "professionalism": رقم 1-10,
    "overall": رقم 1-10
  },
  "goalAchieved": true أو false أو null,
  "followUpRequired": true أو false,
  "followUpNotes": "ملاحظات المتابعة إن وجدت"
}`;

    return await this._sendToOpenAI(prompt);
  }

  async _callExtractionLLM(transcript, variables) {
    const varDescriptions = variables.map(v =>
      `- ${v.name} (${v.type}): ${v.description}${v.required ? ' [مطلوب]' : ''}${v.enumValues?.length ? ` [القيم: ${v.enumValues.join(', ')}]` : ''}`
    ).join('\n');

    const prompt = `اقرأ المحادثة التالية واستخرج المتغيرات التالية بدقة. أرجع JSON فقط.
إذا لم تُذكر معلومة أرجع null لها.

المتغيرات المطلوبة:
${varDescriptions}

المحادثة:
${transcript}

أرجع JSON بالشكل:
{
  "variables": { "اسم_المتغير": "القيمة" أو null },
  "confidence": رقم بين 0 و 1 يعبر عن مدى ثقتك
}`;

    return await this._sendToOpenAI(prompt);
  }

  async _sendToOpenAI(prompt) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';

    try {
      return JSON.parse(content);
    } catch {
      throw new Error('Failed to parse LLM response as JSON');
    }
  }

  async _sendExtractionWebhook(webhookConfig, extraction) {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (webhookConfig.headers) {
        for (const h of webhookConfig.headers) {
          if (h.key && h.value) headers[h.key] = h.value;
        }
      }

      const response = await fetch(webhookConfig.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          event: 'extraction.completed',
          callId: extraction.callId?.toString(),
          agentId: extraction.agentId?.toString(),
          variables: extraction.variables,
          confidence: extraction.confidence,
          timestamp: new Date().toISOString(),
        }),
      });

      extraction.webhookSent = true;
      extraction.webhookResponse = { status: response.status };
      await extraction.save();

    } catch (err) {
      extraction.webhookSent = false;
      extraction.webhookError = err.message;
      await extraction.save();
    }
  }
}

module.exports = new AnalysisService();
