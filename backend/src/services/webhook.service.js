// =====================================================
// Webhook Service — Event Delivery to User Endpoints
// =====================================================
const crypto = require('crypto');
const WebhookEndpoint = require('../models/WebhookEndpoint');

class WebhookService {

  /**
   * Deliver an event to all matching webhook endpoints for a user
   */
  async deliverEvent(userId, event, payload) {
    const endpoints = await WebhookEndpoint.find({
      userId,
      isActive: true,
      events: event,
    });

    const results = [];
    for (const endpoint of endpoints) {
      const result = await this._deliver(endpoint, event, payload);
      results.push(result);
    }
    return results;
  }

  async _deliver(endpoint, event, payload, attempt = 1) {
    const MAX_RETRIES = 3;
    const startTime = Date.now();

    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    });

    // Build headers
    const headers = { 'Content-Type': 'application/json', 'X-Sondos-Event': event };
    if (endpoint.secret) {
      const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');
      headers['X-Sondos-Signature'] = signature;
    }
    if (endpoint.headers) {
      for (const h of endpoint.headers) {
        if (h.key && h.value) headers[h.key] = h.value;
      }
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseTime = Date.now() - startTime;
      const success = response.ok;

      // Log
      await this._addLog(endpoint, { event, statusCode: response.status, success, responseTime });

      if (!success && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        return this._deliver(endpoint, event, payload, attempt + 1);
      }

      return { endpointId: endpoint._id, success, statusCode: response.status, responseTime };

    } catch (err) {
      const responseTime = Date.now() - startTime;
      await this._addLog(endpoint, { event, statusCode: 0, success: false, responseTime, error: err.message });

      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 2000));
        return this._deliver(endpoint, event, payload, attempt + 1);
      }

      return { endpointId: endpoint._id, success: false, error: err.message, responseTime };
    }
  }

  async _addLog(endpoint, log) {
    endpoint.totalDeliveries += 1;
    if (log.success) endpoint.successCount += 1;
    else endpoint.failureCount += 1;
    endpoint.lastDeliveredAt = new Date();
    endpoint.recentLogs.push({ ...log, timestamp: new Date() });
    if (endpoint.recentLogs.length > 20) endpoint.recentLogs = endpoint.recentLogs.slice(-20);
    await endpoint.save();
  }

  // ── CRUD ──

  async create(userId, data) {
    return WebhookEndpoint.create({ userId, ...data });
  }

  async getAll(userId) {
    const endpoints = await WebhookEndpoint.find({ userId }).sort({ createdAt: -1 });
    return endpoints.map(e => e.toPublicJSON());
  }

  async getById(userId, id) {
    const endpoint = await WebhookEndpoint.findOne({ _id: id, userId });
    if (!endpoint) throw Object.assign(new Error('Webhook غير موجود'), { statusCode: 404 });
    return endpoint;
  }

  async update(userId, id, data) {
    const endpoint = await WebhookEndpoint.findOne({ _id: id, userId });
    if (!endpoint) throw Object.assign(new Error('Webhook غير موجود'), { statusCode: 404 });
    Object.assign(endpoint, data);
    await endpoint.save();
    return endpoint;
  }

  async delete(userId, id) {
    const endpoint = await WebhookEndpoint.findOneAndDelete({ _id: id, userId });
    if (!endpoint) throw Object.assign(new Error('Webhook غير موجود'), { statusCode: 404 });
    return endpoint;
  }

  async test(userId, id) {
    const endpoint = await this.getById(userId, id);
    return this._deliver(endpoint, 'test', { message: 'This is a test webhook from Sondos AI' });
  }
}

module.exports = new WebhookService();
