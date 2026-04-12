// =====================================================
// Sondos AI Backend — Express App (v2 Architecture)
// =====================================================
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { loginLimiter, registerLimiter, apiLimiter } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const notificationRoutes = require('./routes/notification.routes');
const paymentRoutes = require('./routes/payment.routes');
const livekitRoutes = require('./routes/livekit.routes');
const publicRoutes = require('./routes/public.routes');
const agentRoutes = require('./routes/agent.routes');
const campaignRoutes = require('./routes/campaign.routes');
const phoneRoutes = require('./routes/phone.routes');
const voiceRoutes = require('./routes/voice.routes');

const app = express();

// ✅ IMPORTANT FOR RENDER + RATE LIMIT
app.set('trust proxy', 1);

// ==================== Security ====================
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());

// ==================== CORS — Environment-aware ====================
const isProduction = process.env.NODE_ENV === 'production';

const allowedOrigins = isProduction
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174',
     process.env.FRONTEND_URL].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    if (!isProduction) return callback(null, true);
    return callback(new Error('غير مسموح من هذا المصدر (CORS)'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept-Language']
}));

// ==================== Body Parsing ====================
// Raw body for Moyasar webhook signature verification
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  try {
    req.body = JSON.parse(req.rawBody);
  } catch (e) {
    // body already parsed
  }
  next();
});

// Raw body for LiveKit webhook signature verification
app.use('/api/livekit/webhook', express.raw({ type: '*/*' }), (req, res, next) => {
  req.rawBody = req.body.toString('utf8');
  try {
    req.body = JSON.parse(req.rawBody);
  } catch (e) {
    // body already parsed
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==================== Request Logging (dev only) ====================
if (!isProduction) {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// ==================== Health Check ====================
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ==================== Routes with Rate Limiting ====================
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api', apiLimiter);

// Auth routes
app.use('/api/auth', authRoutes);

// User routes
app.use('/api/user', userRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Payment routes (Moyasar)
app.use('/api/payments', paymentRoutes);

// LiveKit routes (Voice Agent — Token + Status)
app.use('/api/livekit', livekitRoutes);

// Agent routes (CRUD + Chat + Templates)
app.use('/api/agents', agentRoutes);

// Phone routes (SIP + Twilio + Telnyx)
app.use('/api/phones', phoneRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/voices', voiceRoutes);

// Public routes (external systems — API Key auth, no user token)
app.use('/api/public', publicRoutes);

// ==================== API 404 (before static files) ====================
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// ==================== Serve Frontend in Production ====================
if (isProduction) {
  const frontendDist = path.join(__dirname, '../../frontend/dist');

  app.use(express.static(frontendDist));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({
      success: true,
      message: 'Sondos AI Backend API',
      version: '3.0.0',
    });
  });

  app.use(notFound);
}

app.use(errorHandler);

module.exports = app;