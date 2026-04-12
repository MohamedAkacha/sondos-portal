// =====================================================
// Tool Service — CRUD + HTTP Execution + Testing
// =====================================================
const Tool = require('../models/Tool');

class ToolService {

  // ── Create tool ──
  async create(userId, data) {
    // Check duplicate functionName for this user
    const existing = await Tool.findOne({ userId, functionName: data.functionName });
    if (existing) {
      throw Object.assign(new Error('الاسم التقني مستخدم مسبقاً'), { statusCode: 400 });
    }

    const tool = await Tool.create({ userId, ...data });
    return tool;
  }

  // ── Get all tools for user ──
  async getAll(userId, { page = 1, limit = 20, type } = {}) {
    const filter = { userId };
    if (type) filter.type = type;

    const [tools, total] = await Promise.all([
      Tool.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Tool.countDocuments(filter),
    ]);

    return { tools: tools.map(t => t.toPublicJSON()), total, page, limit };
  }

  // ── Get single tool ──
  async getById(userId, toolId) {
    const tool = await Tool.findOne({ _id: toolId, userId });
    if (!tool) throw Object.assign(new Error('الأداة غير موجودة'), { statusCode: 404 });
    return tool;
  }

  // ── Update tool ──
  async update(userId, toolId, data) {
    const tool = await Tool.findOne({ _id: toolId, userId });
    if (!tool) throw Object.assign(new Error('الأداة غير موجودة'), { statusCode: 404 });

    // If functionName changed, check uniqueness
    if (data.functionName && data.functionName !== tool.functionName) {
      const dup = await Tool.findOne({ userId, functionName: data.functionName });
      if (dup) throw Object.assign(new Error('الاسم التقني مستخدم مسبقاً'), { statusCode: 400 });
    }

    Object.assign(tool, data);
    await tool.save();
    return tool;
  }

  // ── Delete tool ──
  async delete(userId, toolId) {
    const tool = await Tool.findOneAndDelete({ _id: toolId, userId });
    if (!tool) throw Object.assign(new Error('الأداة غير موجودة'), { statusCode: 404 });
    return tool;
  }

  // ── Toggle enable/disable ──
  async toggle(userId, toolId) {
    const tool = await Tool.findOne({ _id: toolId, userId });
    if (!tool) throw Object.assign(new Error('الأداة غير موجودة'), { statusCode: 404 });

    tool.isEnabled = !tool.isEnabled;
    await tool.save();
    return tool;
  }

  // ── Get tools for a specific agent ──
  async getForAgent(userId, agentId) {
    const tools = await Tool.find({
      userId,
      isEnabled: true,
      $or: [
        { agentIds: { $size: 0 } },
        { agentIds: agentId },
      ],
    });
    return tools;
  }

  // ── Get tools as OpenAI function schemas (for Agent Worker) ──
  async getToolSchemas(userId, agentId) {
    const tools = await this.getForAgent(userId, agentId);
    return tools.map(t => ({
      schema: t.toFunctionSchema(),
      config: {
        id: t._id.toString(),
        type: t.type,
        functionName: t.functionName,
        httpConfig: t.httpConfig,
        behavior: t.behavior,
      },
    }));
  }

  // ── Test a tool (execute HTTP request with test params) ──
  async test(userId, toolId, testParams = {}) {
    const tool = await Tool.findOne({ _id: toolId, userId });
    if (!tool) throw Object.assign(new Error('الأداة غير موجودة'), { statusCode: 404 });

    if (tool.type !== 'custom_http') {
      throw Object.assign(new Error('الاختبار متاح فقط للأدوات من نوع HTTP'), { statusCode: 400 });
    }

    const startTime = Date.now();
    const result = await this.executeHTTP(tool, testParams);
    const responseTime = Date.now() - startTime;

    return {
      success: result.success,
      responseTime,
      statusCode: result.statusCode,
      data: result.data,
      error: result.error,
      request: {
        method: tool.httpConfig.method,
        url: tool.httpConfig.url,
        body: this._buildBody(tool.httpConfig.bodyTemplate, testParams),
      },
    };
  }

  // ── Execute HTTP tool ──
  async executeHTTP(tool, params = {}) {
    const config = tool.httpConfig || tool;
    let { url, method, headers, bodyTemplate, queryParams, timeout, retries, responsePath } = config;

    // Build URL with query params
    if (queryParams && queryParams.length > 0) {
      const searchParams = new URLSearchParams();
      for (const qp of queryParams) {
        searchParams.append(qp.key, this._replaceParams(qp.value, params));
      }
      url = `${url}?${searchParams.toString()}`;
    }

    // Build body
    const body = method !== 'GET' ? this._buildBody(bodyTemplate, params) : undefined;

    // Build headers
    const headerObj = { 'Content-Type': 'application/json' };
    if (headers) {
      for (const h of headers) {
        if (h.key && h.value) headerObj[h.key] = h.value;
      }
    }

    // Execute with retries
    let lastError = null;
    const maxAttempts = (retries || 0) + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout || 5000);

        const response = await fetch(url, {
          method: method || 'POST',
          headers: headerObj,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timer);

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          if (attempt < maxAttempts) continue;
          return { success: false, statusCode: response.status, error: lastError, data };
        }

        // Extract response using path
        let extractedData = data;
        if (responsePath) {
          const paths = responsePath.split('.');
          for (const p of paths) {
            extractedData = extractedData?.[p];
          }
        }

        // Update tool stats
        if (tool._id) {
          await Tool.findByIdAndUpdate(tool._id, {
            $inc: { executionCount: 1 },
            lastExecutedAt: new Date(),
          });
        }

        return { success: true, statusCode: response.status, data: extractedData };

      } catch (err) {
        lastError = err.name === 'AbortError' ? 'Timeout' : err.message;
        if (attempt < maxAttempts) continue;

        // Update error stats
        if (tool._id) {
          await Tool.findByIdAndUpdate(tool._id, { $inc: { errorCount: 1 } });
        }

        return { success: false, statusCode: 0, error: lastError, data: null };
      }
    }
  }

  // ── Replace {{param}} in template ──
  _replaceParams(template, params) {
    if (!template) return template;
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  // ── Build request body from template ──
  _buildBody(template, params) {
    if (!template) {
      return params;
    }

    try {
      const replaced = this._replaceParams(template, params);
      return JSON.parse(replaced);
    } catch {
      return params;
    }
  }

  // ── Built-in tools list ──
  getBuiltInTools() {
    return [
      { functionName: 'knowledge_search', name: 'البحث في قاعدة المعرفة', description: 'يبحث في مستندات الشركة للرد على أسئلة العملاء', type: 'built_in', parameters: [{ name: 'query', type: 'string', description: 'السؤال أو الموضوع للبحث عنه', required: true }] },
      { functionName: 'capture_lead', name: 'تسجيل عميل محتمل', description: 'يحفظ بيانات المتصل كعميل محتمل', type: 'built_in', parameters: [{ name: 'name', type: 'string', description: 'اسم العميل', required: true }, { name: 'phone', type: 'string', description: 'رقم الهاتف', required: false }, { name: 'email', type: 'string', description: 'البريد الإلكتروني', required: false }, { name: 'notes', type: 'string', description: 'ملاحظات', required: false }] },
      { functionName: 'transfer_to_human', name: 'تحويل لموظف', description: 'يحوّل المكالمة لموظف بشري عندما يطلب العميل ذلك أو عندما لا يستطيع المساعد المساعدة', type: 'built_in', parameters: [{ name: 'reason', type: 'string', description: 'سبب التحويل', required: true }] },
      { functionName: 'send_sms', name: 'إرسال SMS', description: 'يرسل رسالة نصية للعميل', type: 'built_in', parameters: [{ name: 'phone', type: 'string', description: 'رقم الهاتف', required: true }, { name: 'message', type: 'string', description: 'نص الرسالة', required: true }] },
      { functionName: 'end_call', name: 'إنهاء المكالمة', description: 'ينهي المكالمة بأدب عند اكتمال الهدف أو طلب العميل', type: 'built_in', parameters: [{ name: 'reason', type: 'string', description: 'سبب الإنهاء', required: false }] },
    ];
  }
}

module.exports = new ToolService();
