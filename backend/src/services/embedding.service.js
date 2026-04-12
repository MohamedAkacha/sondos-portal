// =====================================================
// Embedding Service — OpenAI Embeddings + Qdrant Vector DB
// =====================================================
const qdrant = require('../config/qdrant');
const { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } = require('../config/constants');

class EmbeddingService {

  /**
   * Generate embeddings for an array of texts via OpenAI
   */
  async generateEmbeddings(texts) {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Embeddings API error: ${err}`);
    }

    const data = await response.json();
    return data.data.map(item => item.embedding);
  }

  /**
   * Create a Qdrant collection for a user (if not exists)
   */
  async ensureCollection(collectionName) {
    try {
      await qdrant.getCollection(collectionName);
    } catch {
      await qdrant.createCollection(collectionName, {
        vectors: {
          size: EMBEDDING_DIMENSIONS,
          distance: 'Cosine',
        },
      });
      console.log(`✅ Qdrant collection created: ${collectionName}`);
    }
  }

  /**
   * Store document chunks in Qdrant
   */
  async storeChunks(collectionName, documentId, chunks, vectors) {
    await this.ensureCollection(collectionName);

    const points = chunks.map((chunk, i) => ({
      id: `${documentId}_${i}`,
      vector: vectors[i],
      payload: {
        documentId: documentId.toString(),
        text: chunk.text,
        chunkIndex: i,
        source: chunk.source || '',
        page: chunk.page || null,
      },
    }));

    // Upsert in batches of 100
    const BATCH_SIZE = 100;
    const pointIds = [];

    for (let i = 0; i < points.length; i += BATCH_SIZE) {
      const batch = points.slice(i, i + BATCH_SIZE);
      await qdrant.upsert(collectionName, {
        wait: true,
        points: batch,
      });
      pointIds.push(...batch.map(p => p.id));
    }

    return pointIds;
  }

  /**
   * Search Qdrant for similar chunks
   */
  async search(collectionName, query, topK = 5, filter = null) {
    // Generate query embedding
    const [queryVector] = await this.generateEmbeddings([query]);

    const searchParams = {
      vector: queryVector,
      limit: topK,
      with_payload: true,
      score_threshold: 0.3,
    };

    if (filter) {
      searchParams.filter = filter;
    }

    try {
      const results = await qdrant.search(collectionName, searchParams);

      return results.map(result => ({
        text: result.payload?.text || '',
        score: result.score,
        source: result.payload?.source || '',
        page: result.payload?.page || null,
        documentId: result.payload?.documentId || '',
        chunkIndex: result.payload?.chunkIndex || 0,
      }));
    } catch (err) {
      console.error(`Qdrant search error (${collectionName}):`, err.message);
      return [];
    }
  }

  /**
   * Delete all points for a document
   */
  async deleteDocument(collectionName, documentId) {
    try {
      await qdrant.delete(collectionName, {
        wait: true,
        filter: {
          must: [{
            key: 'documentId',
            match: { value: documentId.toString() },
          }],
        },
      });
    } catch (err) {
      console.error(`Qdrant delete error:`, err.message);
    }
  }

  /**
   * Delete entire collection
   */
  async deleteCollection(collectionName) {
    try {
      await qdrant.deleteCollection(collectionName);
    } catch (err) {
      console.error(`Qdrant delete collection error:`, err.message);
    }
  }
}

module.exports = new EmbeddingService();
