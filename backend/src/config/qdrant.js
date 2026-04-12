const { QdrantClient } = require('@qdrant/js-client-rest');

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || 'http://localhost:6333',
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

// Test connection on startup
async function testQdrantConnection() {
  try {
    const result = await qdrant.getCollections();
    console.log(`✅ Qdrant connected (${result.collections.length} collections)`);
  } catch (err) {
    console.error('❌ Qdrant connection error:', err.message);
  }
}

testQdrantConnection();

module.exports = qdrant;
