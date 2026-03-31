// =====================================================
// SIP Cleanup — تنظيف الموارد المعلّقة
// ─────────────────────────────────────────────────────
// Compares DB records with LiveKit resources
// Removes orphaned trunks/rules not linked to any phone
// Can be triggered manually (admin) or via cron
// =====================================================
const PhoneNumber = require('../models/PhoneNumber');
const livekitSip = require('./livekitSip');

async function runCleanup() {
  if (!livekitSip.isConfigured()) {
    return { skipped: true, reason: 'LiveKit SIP not configured' };
  }

  const result = {
    startedAt: new Date(),
    orphanedTrunks: 0,
    orphanedRules: 0,
    staleDbRecords: 0,
    errors: [],
  };

  try {
    // ── 1. Get all resources from LiveKit ──
    const [liveTrunks, liveRules] = await Promise.all([
      livekitSip.listSipTrunks().catch(e => { result.errors.push(`List trunks: ${e.message}`); return []; }),
      livekitSip.listDispatchRules().catch(e => { result.errors.push(`List rules: ${e.message}`); return []; }),
    ]);

    const liveTrunkIds = new Set(liveTrunks.map(t => t.sipTrunkId || t.sip_trunk_id).filter(Boolean));
    const liveRuleIds = new Set(liveRules.map(r => r.sipDispatchRuleId || r.sip_dispatch_rule_id).filter(Boolean));

    // ── 2. Get all phone records from DB ──
    const phones = await PhoneNumber.find({
      $or: [
        { sipTrunkId: { $ne: '' } },
        { sipDispatchRuleId: { $ne: '' } },
      ],
    }).lean();

    const dbTrunkIds = new Set(phones.map(p => p.sipTrunkId).filter(Boolean));
    const dbRuleIds = new Set(phones.map(p => p.sipDispatchRuleId).filter(Boolean));

    // ── 3. Find orphaned trunks (on LiveKit but not in DB) ──
    for (const trunkId of liveTrunkIds) {
      if (!dbTrunkIds.has(trunkId)) {
        // Check if it's a Sondos trunk (by name convention)
        const trunk = liveTrunks.find(t => (t.sipTrunkId || t.sip_trunk_id) === trunkId);
        const trunkName = trunk?.name || '';
        if (trunkName.startsWith('Sondos')) {
          try {
            await livekitSip.deleteSipTrunk(trunkId);
            result.orphanedTrunks++;
            console.log(`[SIP Cleanup] Deleted orphaned trunk: ${trunkId} (${trunkName})`);
          } catch (e) {
            result.errors.push(`Delete trunk ${trunkId}: ${e.message}`);
          }
        }
      }
    }

    // ── 4. Find orphaned rules (on LiveKit but not in DB) ──
    for (const ruleId of liveRuleIds) {
      if (!dbRuleIds.has(ruleId)) {
        const rule = liveRules.find(r => (r.sipDispatchRuleId || r.sip_dispatch_rule_id) === ruleId);
        const ruleName = rule?.name || '';
        if (ruleName.startsWith('Route') || ruleName.startsWith('Sondos')) {
          try {
            await livekitSip.deleteDispatchRule(ruleId);
            result.orphanedRules++;
            console.log(`[SIP Cleanup] Deleted orphaned rule: ${ruleId} (${ruleName})`);
          } catch (e) {
            result.errors.push(`Delete rule ${ruleId}: ${e.message}`);
          }
        }
      }
    }

    // ── 5. Find stale DB records (reference IDs that don't exist on LiveKit) ──
    for (const phone of phones) {
      let stale = false;

      if (phone.sipTrunkId && !liveTrunkIds.has(phone.sipTrunkId)) {
        stale = true;
      }
      if (phone.sipDispatchRuleId && !liveRuleIds.has(phone.sipDispatchRuleId)) {
        stale = true;
      }

      if (stale) {
        try {
          await PhoneNumber.findByIdAndUpdate(phone._id, {
            $set: {
              sipTrunkId: liveTrunkIds.has(phone.sipTrunkId) ? phone.sipTrunkId : '',
              sipDispatchRuleId: liveRuleIds.has(phone.sipDispatchRuleId) ? phone.sipDispatchRuleId : '',
              status: 'pending',
              statusMessage: 'تم اكتشاف موارد SIP مفقودة — أعد إعداد SIP',
            },
          });
          result.staleDbRecords++;
          console.log(`[SIP Cleanup] Fixed stale record: ${phone.phoneNumber}`);
        } catch (e) {
          result.errors.push(`Fix DB ${phone.phoneNumber}: ${e.message}`);
        }
      }
    }

    result.finishedAt = new Date();
    result.durationMs = result.finishedAt - result.startedAt;

    const total = result.orphanedTrunks + result.orphanedRules + result.staleDbRecords;
    if (total > 0) {
      console.log(`[SIP Cleanup] ✅ Done — removed ${result.orphanedTrunks} trunks, ${result.orphanedRules} rules, fixed ${result.staleDbRecords} DB records (${result.durationMs}ms)`);
    } else {
      console.log(`[SIP Cleanup] ✅ Clean — no orphaned resources (${result.durationMs}ms)`);
    }

    return result;

  } catch (error) {
    result.errors.push(error.message);
    console.error('[SIP Cleanup] Fatal error:', error.message);
    return result;
  }
}

module.exports = { runCleanup };
