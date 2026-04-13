// =====================================================
// Lead Service — CRUD + Import/Export
// =====================================================
const Lead = require('../models/Lead');
const { paginationMeta } = require('../utils/helpers');

class LeadService {

  async create(userId, data) {
    const lead = await Lead.create({ userId, ...data });
    return lead;
  }

  async getAll(userId, { page = 1, limit = 20, status, source, search, sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
    const filter = { userId };
    if (status) filter.status = status;
    if (source) filter.source = source;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [leads, total] = await Promise.all([
      Lead.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
      Lead.countDocuments(filter),
    ]);

    return {
      leads: leads.map(l => l.toPublicJSON()),
      ...paginationMeta(total, page, limit),
    };
  }

  async getById(userId, leadId) {
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) throw Object.assign(new Error('العميل المحتمل غير موجود'), { statusCode: 404 });
    return lead;
  }

  async update(userId, leadId, data) {
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) throw Object.assign(new Error('العميل المحتمل غير موجود'), { statusCode: 404 });
    Object.assign(lead, data);
    await lead.save();
    return lead;
  }

  async delete(userId, leadId) {
    const lead = await Lead.findOneAndDelete({ _id: leadId, userId });
    if (!lead) throw Object.assign(new Error('العميل المحتمل غير موجود'), { statusCode: 404 });
    return lead;
  }

  async bulkDelete(userId, leadIds) {
    const result = await Lead.deleteMany({ _id: { $in: leadIds }, userId });
    return result.deletedCount;
  }

  async updateStatus(userId, leadId, status) {
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) throw Object.assign(new Error('العميل المحتمل غير موجود'), { statusCode: 404 });
    lead.status = status;
    if (status === 'contacted') {
      lead.lastContactedAt = new Date();
      lead.contactCount += 1;
    }
    await lead.save();
    return lead;
  }

  // ── Import from CSV rows ──
  async importCSV(userId, rows) {
    const leads = rows.map(row => ({
      userId,
      name: row.name || row['الاسم'] || '',
      phone: row.phone || row['الهاتف'] || row['رقم الهاتف'] || '',
      email: row.email || row['البريد'] || '',
      company: row.company || row['الشركة'] || '',
      notes: row.notes || row['ملاحظات'] || '',
      source: 'import',
      status: 'new',
    })).filter(l => l.name || l.phone || l.email);

    if (leads.length === 0) {
      throw Object.assign(new Error('لم يتم العثور على بيانات صالحة في الملف'), { statusCode: 400 });
    }

    const result = await Lead.insertMany(leads);
    return result.length;
  }

  // ── Export as array (for CSV conversion) ──
  async exportAll(userId, { status } = {}) {
    const filter = { userId };
    if (status) filter.status = status;

    const leads = await Lead.find(filter).sort({ createdAt: -1 }).lean();
    return leads.map(l => ({
      name: l.name,
      phone: l.phone,
      email: l.email,
      company: l.company,
      status: l.status,
      source: l.source,
      notes: l.notes,
      createdAt: l.createdAt?.toISOString(),
    }));
  }

  // ── Capture lead from Agent Worker (built-in tool) ──
  async captureFromAgent(userId, agentId, data) {
    // Check if lead with same phone already exists
    if (data.phone) {
      const existing = await Lead.findOne({ userId, phone: data.phone });
      if (existing) {
        // Update existing lead
        existing.contactCount += 1;
        existing.lastContactedAt = new Date();
        if (data.notes) existing.notes += `\n${data.notes}`;
        await existing.save();
        return existing;
      }
    }

    const lead = await Lead.create({
      userId,
      agentId,
      source: 'call',
      status: 'new',
      ...data,
    });
    return lead;
  }

  // ── Stats ──
  async getStats(userId) {
    const [total, byStatus, bySrc, thisWeek] = await Promise.all([
      Lead.countDocuments({ userId }),
      Lead.aggregate([
        { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Lead.aggregate([
        { $match: { userId: require('mongoose').Types.ObjectId.createFromHexString(userId.toString()) } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]),
      Lead.countDocuments({
        userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
    ]);

    return {
      total,
      thisWeek,
      byStatus: Object.fromEntries(byStatus.map(s => [s._id, s.count])),
      bySource: Object.fromEntries(bySrc.map(s => [s._id, s.count])),
    };
  }
}

module.exports = new LeadService();
