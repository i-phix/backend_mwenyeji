/**
 * One-shot backfill: normalise every RecipientGroupMember.phone in the
 * database to E.164 (254XXXXXXXXX). Idempotent — running it twice is a no-op
 * on already-normalised rows. Skips rows whose phone is already normalised.
 *
 * Run:  cd payserve_backend && node scripts/backfill_member_phones.js
 */

const payservedb = require('payservedb');
const { normalisePhone } = require('../src/utils/phone');

(async () => {
  await payservedb.connectToMongoDB(
    'payserve_property',
    true,
    'Ps',
    'Letmein987',
    '127.0.0.1',
    '27017',
  );

  const cursor = payservedb.RecipientGroupMember.find({ phone: { $exists: true, $ne: null, $ne: '' } }).cursor();

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  let cleared = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const normalised = normalisePhone(doc.phone);
    if (!normalised) {
      // Phone was unsalvageable digits-only; leave row but null the phone.
      doc.phone = null;
      await doc.save();
      cleared += 1;
      continue;
    }
    if (normalised === doc.phone) {
      unchanged += 1;
      continue;
    }
    doc.phone = normalised;
    await doc.save();
    updated += 1;
  }

  console.log(`\n──────────────────────────────────`);
  console.log(`  scanned:    ${scanned}`);
  console.log(`  updated:    ${updated}`);
  console.log(`  unchanged:  ${unchanged}`);
  console.log(`  cleared:    ${cleared}`);
  console.log(`──────────────────────────────────`);
  process.exit(0);
})().catch((err) => {
  console.error('backfill failed:', err);
  process.exit(1);
});
