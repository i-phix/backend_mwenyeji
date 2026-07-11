const payservedb = require('payservedb');
const logger = require('../../config/winston');

/**
 * Inbound-message auto-reply matcher.
 *
 * Algorithm (locked by PR 4 scope):
 *   1. If sender domain is `payserve.co.ke`, skip auto-reply entirely (loop guard).
 *   2. Filter rules by channel ('email' | 'whatsapp').
 *   3. Sort ascending by priority (0 = highest), then created_at as tiebreaker.
 *   4. For each enabled rule, test message body with /\b<escaped-keyword>\b/i.
 *   5. FIRST match wins — return the rule (caller is responsible for sending).
 *   6. Auto-replies must NOT receive the always-CC list (caller's
 *      responsibility — do not route through email_cc.getAlwaysCcAddresses).
 *
 * Returns { rule, matched } or null if no rule fires.
 */

function escapeRegex(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isInternalSender(senderAddress) {
  const addr = String(senderAddress || '').toLowerCase();
  if (!addr) return false;
  const at = addr.lastIndexOf('@');
  if (at < 0) return false;
  const domain = addr.slice(at + 1);
  return domain === 'payserve.co.ke' || domain.endsWith('.payserve.co.ke');
}

function isInternalPhone(phone, internalPhones = []) {
  if (!phone) return false;
  const digits = String(phone).replace(/\D/g, '');
  return internalPhones.some((p) => String(p).replace(/\D/g, '') === digits);
}

/**
 * @param {object} args
 * @param {'email'|'whatsapp'} args.channel
 * @param {string} args.body  - inbound message text
 * @param {string} [args.senderAddress] - email address (for 'email' channel)
 * @param {string} [args.senderPhone]   - phone (for 'whatsapp' channel)
 * @returns {Promise<{rule: object, matched: string} | null>}
 */
async function matchAutoReplyRule({ channel, body, senderAddress, senderPhone }) {
  try {
    if (!channel || !body) return null;

    if (channel === 'email' && isInternalSender(senderAddress)) {
      logger.info('Auto-reply skipped: internal email sender', { senderAddress });
      return null;
    }
    // WhatsApp loop guard — list of internal staff numbers via env (comma-separated).
    if (channel === 'whatsapp') {
      const internalPhones = String(process.env.CO_INTERNAL_WA_NUMBERS || '')
        .split(',').map((s) => s.trim()).filter(Boolean);
      if (isInternalPhone(senderPhone, internalPhones)) {
        logger.info('Auto-reply skipped: internal WhatsApp sender', { senderPhone });
        return null;
      }
    }

    const rules = await payservedb.AutoReplyRule
      .find({ channel, enabled: true })
      .sort({ priority: 1, created_at: 1 })
      .lean();

    for (const rule of rules) {
      if (!rule.keyword) continue;
      const rx = new RegExp(`\\b${escapeRegex(rule.keyword)}\\b`, 'i');
      if (rx.test(body)) {
        return { rule, matched: rule.keyword };
      }
    }
    return null;
  } catch (err) {
    logger.error('matchAutoReplyRule failed', err);
    return null;
  }
}

module.exports = { matchAutoReplyRule, isInternalSender };
