const payservedb = require('payservedb');
const logger = require('../../config/winston');

/**
 * Returns the always-CC addresses for agent-sent emails.
 *
 * Source of truth is the EmailCcConfig collection (admin-managed in
 * core_main). Falls back to the legacy CO_EMAIL_PERMANENT_CC env var so a
 * deployment without admin-seeded rows behaves identically to before.
 *
 * Caller is responsible for deduping against `to` / `cc` already on the
 * outbound message, and for stripping the sender's own address.
 *
 * IMPORTANT: never call this for auto-replies — the always-CC list is only
 * for agent-sent emails (replies, new sends, bulk). The auto-reply path
 * deliberately skips it (see PR 4).
 */
async function getAlwaysCcAddresses() {
  try {
    const rows = await payservedb.EmailCcConfig
      .find({ enabled: true })
      .select('address')
      .lean();
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => String(r.address || '').toLowerCase()).filter(Boolean);
    }
  } catch (err) {
    logger.error('getAlwaysCcAddresses DB read failed; falling back to env', err);
  }
  const envFallback = String(process.env.CO_EMAIL_PERMANENT_CC || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return envFallback;
}

/**
 * Merge agent-supplied CC with the always-CC list, dedupe (case-insensitive),
 * and strip the sender's own address. Returns a deduped array of email
 * addresses preserving the order of user-supplied entries first.
 */
function mergeCcLists(userCc = [], alwaysCc = [], senderAddress = '') {
  const sender = String(senderAddress || '').toLowerCase();
  const seen = new Set();
  const out = [];
  const push = (addr) => {
    const v = String(addr || '').trim().toLowerCase();
    if (!v || v === sender || seen.has(v)) return;
    seen.add(v);
    out.push(v);
  };
  (userCc || []).forEach(push);
  (alwaysCc || []).forEach(push);
  return out;
}

module.exports = { getAlwaysCcAddresses, mergeCcLists };
