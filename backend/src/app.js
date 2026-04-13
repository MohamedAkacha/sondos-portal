const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const { loginLimiter, registerLimiter, apiLimiter } = require('./middleware/rateLimiter');

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
const toolRoutes = require('./routes/tool.routes');
const knowledgeRoutes = require('./routes/knowledge.routes');
const leadRoutes = require('./routes/lead.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const extractionRoutes = require('./routes/extraction.routes');
const chatRoutes = require('./routes/chat.routes');
const usageRoutes = require('./routes/usage.routes');
const handoffRoutes = require('./routes/handoff.routes');
const apikeyRoutes = require('./routes/apikey.routes');
const webhookRoutes = require('./routes/webhook.routes');
const v1Routes = require('./routes/v1/index');
const internalRoutes = require('./routes/internal.routes');
const memoryRoutes = require('./routes/memory.routes');

const app = express();
app.set('trust proxy', 1);
app.use(helmet()); app.use(mongoSanitize()); app.use(hpp());

const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = isProduction ? [process.env.FRONTEND_URL].filter(Boolean) : ['http://localhost:5173', 'http://localhost:5174', process.env.FRONTEND_URL].filter(Boolean);
app.use(cors({ origin: (origin, cb) => { if (!origin) return cb(null, true); if (allowedOrigins.includes(origin)) return cb(null, true); if (!isProduction) return cb(null, true); return cb(new Error('CORS blocked')); }, credentials: true, methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Accept-Language','X-Agent-Secret'] }));

app.use('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res, next) => { req.rawBody = req.body.toString('utf8'); try { req.body = JSON.parse(req.rawBody); } catch(e){} next(); });
app.use('/api/livekit/webhook', express.raw({ type: '*/*' }), (req, res, next) => { req.rawBody = req.body.toString('utf8'); try { req.body = JSON.parse(req.rawBody); } catch(e){} next(); });
app.use(express.json({ limit: '10mb' })); app.use(express.urlencoded({ extended: true }));
app.use('/widget', express.static(path.join(__dirname, '../../chat-widget/src')));
if (!isProduction) { app.use((req, res, next) => { console.log(`${req.method} ${req.path}`); next(); }); }

app.get('/api/health', (req, res) => { res.json({ success: true, status: 'healthy', version: '3.0.0', timestamp: new Date().toISOString() }); });
app.use('/api/auth/login', loginLimiter); app.use('/api/auth/register', registerLimiter); app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes); app.use('/api/user', userRoutes); app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes); app.use('/api/payments', paymentRoutes); app.use('/api/livekit', livekitRoutes);
app.use('/api/agents', agentRoutes); app.use('/api/phones', phoneRoutes); app.use('/api/campaigns', campaignRoutes);
app.use('/api/voices', voiceRoutes); app.use('/api/tools', toolRoutes); app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/leads', leadRoutes); app.use('/api/analytics', analyticsRoutes); app.use('/api/extraction', extractionRoutes);
app.use('/api/chat', chatRoutes); app.use('/api/usage', usageRoutes); app.use('/api/handoff', handoffRoutes);
app.use('/api/apikeys', apikeyRoutes); app.use('/api/webhooks', webhookRoutes); app.use('/api/memory', memoryRoutes);
app.use('/api/v1', v1Routes); app.use('/api/internal', internalRoutes); app.use('/api/public', publicRoutes);

app.all('/api/*', (req, res) => { res.status(404).json({ success: false, message: 'API endpoint not found' }); });
if (isProduction) { const fd = path.join(__dirname, '../../frontend/dist'); app.use(express.static(fd)); app.get('*', (req, res) => { res.sendFile(path.join(fd, 'index.html')); }); }
else { app.get('/', (req, res) => { res.json({ success: true, message: 'Sondos AI Backend API', version: '3.0.0' }); }); app.use(notFound); }
app.use(errorHandler);
module.exports = app;
