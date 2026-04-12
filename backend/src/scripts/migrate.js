/**
 * Migration Script — v2 Architecture
 * 
 * Cleans up legacy fields from existing users:
 * - Removes plainPassword
 * - Removes sondosApiKey
 * - Removes api_key
 * - Removes autocallsUserId
 * - Adds default values for new fields
 * 
 * Usage: node scripts/migrate.js
 * ⚠️ BACKUP YOUR DATABASE BEFORE RUNNING THIS
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function migrate() {
  console.log('🔄 Starting v2 migration...\n');

  await mongoose.connect(process.env.MONGO_DB_URI);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;

  // ── Step 1: Remove legacy fields from all users ──
  console.log('Step 1: Removing legacy fields from users...');
  const userResult = await db.collection('users').updateMany(
    {},
    {
      $unset: {
        plainPassword: '',
        sondosApiKey: '',
        api_key: '',
        autocallsUserId: '',
      },
      $set: {
        isVerified: true,  // existing users are already verified
        twoFactorEnabled: false,
        tokenVersion: 0,
        loginCount: 0,
        'settings.notifications': {
          email: true,
          sms: false,
          inApp: true,
          webhook: false,
        },
        usage: {
          currentPeriodStart: new Date(),
          callMinutes: 0,
          chatMessages: 0,
          documentsProcessed: 0,
          apiCalls: 0,
          creditsUsed: 0,
        },
      },
    }
  );
  console.log(`   ✅ Updated ${userResult.modifiedCount} users\n`);

  // ── Step 2: Convert planId from String to ObjectId (if needed) ──
  console.log('Step 2: Checking planId format...');
  const usersWithStringPlan = await db.collection('users').find({
    planId: { $type: 'string', $ne: null }
  }).toArray();

  if (usersWithStringPlan.length > 0) {
    console.log(`   Found ${usersWithStringPlan.length} users with string planId — skipping auto-convert`);
    console.log('   ⚠️ You may need to manually update planId references');
  } else {
    console.log('   ✅ All planId fields are correct\n');
  }

  // ── Done ──
  console.log('═══════════════════════════════════════');
  console.log('✅ Migration completed successfully!');
  console.log('═══════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
