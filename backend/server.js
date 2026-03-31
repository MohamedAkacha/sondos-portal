const dotenv = require('dotenv');
dotenv.config();

const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log('');
      console.log('══════════════════════════════════════');
      console.log(`  Sondos AI Backend v2.0`);
      console.log(`  http://localhost:${PORT}`);
      console.log(`  ${process.env.NODE_ENV || 'development'}`);
      console.log('══════════════════════════════════════');
      console.log('');

      // ── SIP Cleanup Cron — runs daily at 3:00 AM ──
      const scheduleSipCleanup = () => {
        const now = new Date();
        const next = new Date();
        next.setHours(3, 0, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
        const delay = next - now;

        setTimeout(async () => {
          try {
            const { runCleanup } = require('./src/utils/sipCleanup');
            await runCleanup();
          } catch (e) {
            console.error('[SIP Cleanup Cron]', e.message);
          }
          // Schedule next run
          scheduleSipCleanup();
        }, delay);

        console.log(`  [Cron] SIP cleanup scheduled at ${next.toLocaleString()}`);
      };

      scheduleSipCleanup();

      // ── Campaign Runner — polls active campaigns ──
      const campaignRunner = require('./src/utils/campaignRunner');
      campaignRunner.start();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

start();
