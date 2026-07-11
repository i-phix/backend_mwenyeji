/**
 * Phone normalisation helpers.
 *
 * Customer data in the existing tables stores phones in many shapes:
 *   "0712345678", "+254 712 345 678", "254712345678", "712345678",
 *   "(254) 712-345-678", etc.
 *
 * Green API (and WhatsApp generally) needs E.164 digits without the `+` —
 * for Kenya that's `254` followed by 9 digits. Everything else gets prefixed
 * with `254` defensively when it looks Kenyan; non-Kenyan numbers are kept
 * as digits-only and returned as best-effort.
 */

const KE_CC = '254';

/**
 * Normalise a phone string to digits-only E.164 (no `+`).
 *
 *   "0712345678"          → "254712345678"
 *   "+254 712 345 678"    → "254712345678"
 *   "254712345678"        → "254712345678"
 *   "712345678"           → "254712345678"  (assumes Kenya)
 *   "+1 415 555 1234"     → "14155551234"   (kept as-is, non-Kenyan)
 *   ""                    → ""
 *   null/undefined        → ""
 */
function normalisePhone(raw) {
  if (raw == null) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return '';

  // Already a complete Kenyan E.164 (12 digits starting 254).
  if (digits.length === 12 && digits.startsWith(KE_CC)) return digits;

  // 0-prefixed local format (10 digits, e.g. 0712...): swap leading 0 for 254.
  if (digits.length === 10 && digits.startsWith('0')) return KE_CC + digits.slice(1);

  // Bare local subscriber (9 digits, e.g. 712...): prepend country code.
  if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    return KE_CC + digits;
  }

  // 11-digit accidental: 25471234567 (missing a digit). Best-effort keep.
  // Anything else (international, malformed): return digits-only as-is.
  return digits;
}

/** Quick "does this look like a Green-API-deliverable number" check. */
function isDeliverable(raw) {
  const n = normalisePhone(raw);
  // Kenya numbers must be 12 digits 254XXXXXXXXX; otherwise accept 8-15 digit
  // international ranges (E.164 max is 15).
  if (n.length === 12 && n.startsWith(KE_CC)) return true;
  return n.length >= 8 && n.length <= 15;
}

module.exports = { normalisePhone, isDeliverable };
