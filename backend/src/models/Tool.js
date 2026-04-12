// =====================================================
// Tool Model — Custom HTTP Tools for AI Agents
// =====================================================
const mongoose = require('mongoose');

const toolSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Which agents can use this tool (empty = all agents)
  agentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Agent',
  }],

  // ── Definition ──
  type: {
    type: String,
    enum: ['built_in', 'custom_http', 'integration'],
    default: 'custom_http',
  },
  name: {
    type: String,
    required: [true, 'اسم الأداة مطلوب'],
    trim: true,
    maxlength: 100,
  },
  functionName: {
    type: String,
    required: [true, 'الاسم التقني مطلوب'],
    trim: true,
    maxlength: 50,
    match: [/^[a-z][a-z0-9_]*$/, 'الاسم التقني يجب أن يكون بأحرف صغيرة وأرقام و _ فقط'],
  },
  description: {
    type: String,
    required: [true, 'وصف الأداة مطلوب'],
    maxlength: 500,
  },

  // ── Parameters ──
  parameters: [{
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ['string', 'number', 'boolean', 'date', 'enum'],
      required: true,
    },
    description: { type: String, required: true },
    required: { type: Boolean, default: true },
    enumValues: [String],
    defaultValue: { type: String, default: '' },
  }],

  // ── HTTP Configuration ──
  httpConfig: {
    url: {
      type: String,
      required: function() { return this.type === 'custom_http'; },
    },
    method: {
      type: String,
      enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      default: 'POST',
    },
    headers: [{
      key: String,
      value: String,
    }],
    bodyTemplate: { type: String, default: '' },
    queryParams: [{
      key: String,
      value: String,
    }],
    timeout: {
      type: Number,
      default: 5000,
      min: 1000,
      max: 30000,
    },
    retries: {
      type: Number,
      default: 1,
      min: 0,
      max: 3,
    },
    responsePath: { type: String, default: '' },
    successCondition: { type: String, default: '' },
  },

  // ── Agent behavior ──
  behavior: {
    waitingMessage: { type: String, default: 'لحظة وأتحقق لك' },
    failureMessage: { type: String, default: 'عذراً ما قدرت أنفذ هذا الطلب حالياً' },
    confirmBeforeExecute: { type: Boolean, default: false },
  },

  // ── Post-execution webhook (optional) ──
  postExecutionWebhook: {
    enabled: { type: Boolean, default: false },
    url: { type: String, default: '' },
  },

  // ── State ──
  isEnabled: { type: Boolean, default: true },
  executionCount: { type: Number, default: 0 },
  lastExecutedAt: { type: Date, default: null },
  avgResponseTime: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },

}, { timestamps: true });

// Compound index
toolSchema.index({ userId: 1, functionName: 1 }, { unique: true });

// Convert to OpenAI function calling format
toolSchema.methods.toFunctionSchema = function() {
  const properties = {};
  const required = [];

  for (const param of this.parameters) {
    const prop = { description: param.description };

    switch (param.type) {
      case 'string': prop.type = 'string'; break;
      case 'number': prop.type = 'number'; break;
      case 'boolean': prop.type = 'boolean'; break;
      case 'date': prop.type = 'string'; prop.format = 'date'; break;
      case 'enum': prop.type = 'string'; prop.enum = param.enumValues; break;
    }

    properties[param.name] = prop;
    if (param.required) required.push(param.name);
  }

  return {
    type: 'function',
    function: {
      name: this.functionName,
      description: this.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
};

// Public JSON
toolSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    type: this.type,
    name: this.name,
    functionName: this.functionName,
    description: this.description,
    parameters: this.parameters,
    httpConfig: this.type === 'custom_http' ? this.httpConfig : undefined,
    behavior: this.behavior,
    postExecutionWebhook: this.postExecutionWebhook,
    isEnabled: this.isEnabled,
    executionCount: this.executionCount,
    lastExecutedAt: this.lastExecutedAt,
    avgResponseTime: this.avgResponseTime,
    errorCount: this.errorCount,
    agentIds: this.agentIds,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Tool', toolSchema);
