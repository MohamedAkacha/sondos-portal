// =====================================================
// Knowledge Service — CRUD + Document Processing + Search
// =====================================================
const KnowledgeBase = require('../models/KnowledgeBase');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const embeddingService = require('./embedding.service');
const { CHUNK_SIZE, CHUNK_OVERLAP } = require('../config/constants');

class KnowledgeService {

  // ── Collection name for a user ──
  _collectionName(userId) {
    return `sondos_kb_${userId}`;
  }

  // ══════════════ Knowledge Base CRUD ══════════════

  async createBase(userId, data) {
    const collectionName = this._collectionName(userId);
    const base = await KnowledgeBase.create({
      userId,
      ...data,
      qdrantCollection: collectionName,
    });
    return base;
  }

  async getAllBases(userId) {
    const bases = await KnowledgeBase.find({ userId }).sort({ createdAt: -1 });
    return bases.map(b => b.toPublicJSON());
  }

  async getBase(userId, baseId) {
    const base = await KnowledgeBase.findOne({ _id: baseId, userId });
    if (!base) throw Object.assign(new Error('قاعدة المعرفة غير موجودة'), { statusCode: 404 });
    return base;
  }

  async updateBase(userId, baseId, data) {
    const base = await KnowledgeBase.findOne({ _id: baseId, userId });
    if (!base) throw Object.assign(new Error('قاعدة المعرفة غير موجودة'), { statusCode: 404 });
    Object.assign(base, data);
    await base.save();
    return base;
  }

  async deleteBase(userId, baseId) {
    const base = await KnowledgeBase.findOne({ _id: baseId, userId });
    if (!base) throw Object.assign(new Error('قاعدة المعرفة غير موجودة'), { statusCode: 404 });

    // Delete all documents and their vectors
    const docs = await KnowledgeDocument.find({ knowledgeBaseId: baseId });
    for (const doc of docs) {
      await embeddingService.deleteDocument(base.qdrantCollection, doc._id.toString());
    }
    await KnowledgeDocument.deleteMany({ knowledgeBaseId: baseId });
    await base.deleteOne();
    return base;
  }

  // ══════════════ Document Management ══════════════

  async getDocuments(userId, baseId) {
    const base = await this.getBase(userId, baseId);
    const docs = await KnowledgeDocument.find({ knowledgeBaseId: baseId }).sort({ createdAt: -1 });
    return docs.map(d => d.toPublicJSON());
  }

  async addFileDocument(userId, baseId, file) {
    const base = await this.getBase(userId, baseId);

    const doc = await KnowledgeDocument.create({
      knowledgeBaseId: baseId,
      userId,
      sourceType: 'file',
      fileName: file.originalname,
      fileSize: file.size,
      fileMimeType: file.mimetype,
      fileS3Key: file.key || file.filename || '',
      status: 'pending',
    });

    // Process async (in production, use Bull queue)
    this._processDocument(doc, base).catch(err => {
      console.error(`Document processing failed: ${err.message}`);
    });

    return doc;
  }

  async addUrlDocument(userId, baseId, url) {
    const base = await this.getBase(userId, baseId);

    const doc = await KnowledgeDocument.create({
      knowledgeBaseId: baseId,
      userId,
      sourceType: 'url',
      sourceUrl: url,
      status: 'pending',
    });

    this._processDocument(doc, base).catch(err => {
      console.error(`URL processing failed: ${err.message}`);
    });

    return doc;
  }

  async addFaqDocument(userId, baseId, question, answer) {
    const base = await this.getBase(userId, baseId);

    const doc = await KnowledgeDocument.create({
      knowledgeBaseId: baseId,
      userId,
      sourceType: 'faq',
      faqQuestion: question,
      faqAnswer: answer,
      status: 'pending',
    });

    this._processDocument(doc, base).catch(err => {
      console.error(`FAQ processing failed: ${err.message}`);
    });

    return doc;
  }

  async deleteDocument(userId, docId) {
    const doc = await KnowledgeDocument.findOne({ _id: docId, userId });
    if (!doc) throw Object.assign(new Error('المستند غير موجود'), { statusCode: 404 });

    const base = await KnowledgeBase.findById(doc.knowledgeBaseId);

    // Delete vectors from Qdrant
    if (base) {
      await embeddingService.deleteDocument(base.qdrantCollection, doc._id.toString());

      // Update base stats
      base.totalDocuments = Math.max(0, base.totalDocuments - 1);
      base.totalChunks = Math.max(0, base.totalChunks - doc.totalChunks);
      base.totalTokens = Math.max(0, base.totalTokens - doc.totalTokens);
      await base.save();
    }

    await doc.deleteOne();
    return doc;
  }

  // ══════════════ Search ══════════════

  async search(userId, query, topK = 5) {
    const collectionName = this._collectionName(userId);

    try {
      const results = await embeddingService.search(collectionName, query, topK);
      return results;
    } catch (err) {
      console.error('Knowledge search error:', err.message);
      return [];
    }
  }

  // ══════════════ Document Processing Pipeline ══════════════

  async _processDocument(doc, base) {
    try {
      doc.status = 'processing';
      await doc.save();

      // 1. Extract text based on source type
      let text = '';
      let source = '';

      switch (doc.sourceType) {
        case 'faq':
          text = `سؤال: ${doc.faqQuestion}\nجواب: ${doc.faqAnswer}`;
          source = 'FAQ';
          break;

        case 'url':
          text = await this._fetchUrlContent(doc.sourceUrl);
          source = doc.sourceUrl;
          break;

        case 'file':
          text = await this._extractFileText(doc);
          source = doc.fileName;
          break;

        case 'text':
          text = doc.rawText;
          source = 'Text Input';
          break;
      }

      if (!text || text.trim().length < 10) {
        throw new Error('لم يتم استخراج نص كافٍ من المستند');
      }

      // 2. Clean text
      text = this._cleanText(text);

      // 3. Split into chunks
      const chunks = this._splitIntoChunks(text, source);

      // 4. Generate embeddings
      const chunkTexts = chunks.map(c => c.text);
      const vectors = await embeddingService.generateEmbeddings(chunkTexts);

      // 5. Store in Qdrant
      const pointIds = await embeddingService.storeChunks(
        base.qdrantCollection,
        doc._id.toString(),
        chunks,
        vectors
      );

      // 6. Estimate tokens (rough: 1 token ≈ 4 chars for Arabic)
      const totalTokens = Math.ceil(text.length / 3);

      // 7. Update document
      doc.status = 'ready';
      doc.totalChunks = chunks.length;
      doc.totalTokens = totalTokens;
      doc.qdrantPointIds = pointIds;
      await doc.save();

      // 8. Update base stats
      base.totalDocuments += 1;
      base.totalChunks += chunks.length;
      base.totalTokens += totalTokens;
      await base.save();

      console.log(`✅ Document processed: ${doc.fileName || doc.sourceType} → ${chunks.length} chunks`);

    } catch (err) {
      doc.status = 'failed';
      doc.errorMessage = err.message;
      await doc.save();
      console.error(`❌ Document processing failed: ${err.message}`);
    }
  }

  // ── Text extraction from file (basic — extend with pdf-parse, mammoth, etc.) ──
  async _extractFileText(doc) {
    // For now, handle text files directly
    // In production: use S3 to download, then parse based on mime type
    const mime = doc.fileMimeType;

    if (mime === 'text/plain' || mime === 'text/csv') {
      // Read from S3 or local storage
      // TODO: implement S3 file reading
      return doc.rawText || `[File: ${doc.fileName} — text extraction pending S3 setup]`;
    }

    if (mime === 'application/pdf') {
      // TODO: use pdf-parse library
      return `[PDF: ${doc.fileName} — PDF extraction requires pdf-parse setup]`;
    }

    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      // TODO: use mammoth library
      return `[DOCX: ${doc.fileName} — DOCX extraction requires mammoth setup]`;
    }

    throw new Error(`صيغة الملف غير مدعومة: ${mime}`);
  }

  // ── Fetch URL content ──
  async _fetchUrlContent(url) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SondosAI-Bot/1.0' },
      });

      clearTimeout(timeout);

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();

      // Basic HTML to text (strip tags)
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();

      return text;
    } catch (err) {
      throw new Error(`فشل في استخراج محتوى الصفحة: ${err.message}`);
    }
  }

  // ── Clean text ──
  _cleanText(text) {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  // ── Split text into overlapping chunks ──
  _splitIntoChunks(text, source = '') {
    const chunks = [];
    const sentences = text.split(/(?<=[.!?،؟])\s+/);

    let currentChunk = '';
    let chunkStart = 0;

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length > CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({ text: currentChunk.trim(), source });

        // Overlap: keep last portion
        const words = currentChunk.split(' ');
        const overlapWords = Math.ceil(words.length * (CHUNK_OVERLAP / CHUNK_SIZE));
        currentChunk = words.slice(-overlapWords).join(' ') + ' ' + sentence;
      } else {
        currentChunk = currentChunk ? currentChunk + ' ' + sentence : sentence;
      }
    }

    // Last chunk
    if (currentChunk.trim().length > 20) {
      chunks.push({ text: currentChunk.trim(), source });
    }

    return chunks;
  }
}

module.exports = new KnowledgeService();
