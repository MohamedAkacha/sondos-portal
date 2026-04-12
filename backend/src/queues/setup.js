const Queue = require('bull');
const { QUEUES } = require('../config/constants');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
};

// ── Create queues ──
const analysisQueue = new Queue(QUEUES.ANALYSIS, { redis: redisConfig });
const extractionQueue = new Queue(QUEUES.EXTRACTION, { redis: redisConfig });
const embeddingQueue = new Queue(QUEUES.EMBEDDING, { redis: redisConfig });
const webhookQueue = new Queue(QUEUES.WEBHOOK, { redis: redisConfig });
const notificationQueue = new Queue(QUEUES.NOTIFICATION, { redis: redisConfig });

// ── Default settings for all queues ──
const defaultJobOptions = {
  removeOnComplete: 100,
  removeOnFail: 50,
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
};

// Apply defaults
[analysisQueue, extractionQueue, embeddingQueue, webhookQueue, notificationQueue].forEach(queue => {
  queue.defaultJobOptions = defaultJobOptions;

  queue.on('error', (err) => {
    console.error(`❌ Queue [${queue.name}] error:`, err.message);
  });

  queue.on('failed', (job, err) => {
    console.error(`❌ Job [${queue.name}:${job.id}] failed:`, err.message);
  });
});

console.log('✅ Bull queues initialized');

module.exports = {
  analysisQueue,
  extractionQueue,
  embeddingQueue,
  webhookQueue,
  notificationQueue,
};
