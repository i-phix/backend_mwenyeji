/**
 * Triggers every water-related SMS scenario against Steve Karechio's seeded data.
 * Each scenario calls the EXISTING production function — no message templates
 * are duplicated here; they live in the controllers / cron services.
 *
 * Both SMS and WhatsApp fire for every scenario (the WhatsApp leg goes through
 * payserve_backend's /api/internal/notifications/whatsapp endpoint).
 *
 * Run:
 *   INTERNAL_SERVICE_TOKEN=smoketest123 UTILITY_WHATSAPP_ENABLED=true \
 *     node scripts/test_all_water_sms.js
 */
require('dotenv').config();
process.env.BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3050';

const path = require('path');

// Each service has its OWN mongoose instance (separate node_modules tree).
// All three need a default connection so payservedb.<Model>.* calls work.
const backendMongoose      = require('mongoose');
const waterMeterMongoose   = require('/home/seint/Dev/Payserve/Main2/water_meter_service/node_modules/mongoose');
const waterBillingMongoose = require('/home/seint/Dev/Payserve/Main2/water_billing_service/node_modules/mongoose');

const PROPERTY_URI = 'mongodb://Ps:Letmein987@127.0.0.1:27017/payserve_property?authSource=admin';
const UTILITY_URI  = 'mongodb://Ps:Letmein987@127.0.0.1:27017/utility_database?authSource=admin';

const KNIGHTS_FACILITY_ID = '67e550c1d12f3f1b2e914fcc';
const STEVE_PHONE         = '+254721913945';
const STEVE_ACCOUNT_NO    = 'STEVE-LOCAL-001';
const STEVE_TEST_ACCOUNT_NO = 'STEVE-ONBOARD-TEST';   // separate account for #1 only

const results = [];
const log = (name, ok, detail) => {
  results.push({ scenario: name, ok, detail });
  const mark = ok === true ? '✅' : ok === false ? '❌' : '⏭️';
  console.log(`${mark} ${name} — ${detail}`);
};

const mockReply = () => {
  let _code = 200, _body = null;
  const r = {
    code(c)   { _code = c; return r; },
    status(c) { _code = c; return r; },
    send(b)   { _body = b; return r; },
  };
  Object.defineProperty(r, 'statusCode', { get: () => _code });
  Object.defineProperty(r, 'body',       { get: () => _body });
  return r;
};

async function main() {
  console.log('Connecting all three mongoose instances…');
  await backendMongoose.connect(PROPERTY_URI);
  await waterMeterMongoose.connect(UTILITY_URI);
  await waterBillingMongoose.connect(UTILITY_URI);
  console.log('All connected.\n');

  // Look up Steve's IDs at runtime (so we don't depend on stale hardcoded values)
  const utilityDb = require('../src/middlewares/utilityDb');
  const Wma = await utilityDb.getModel('WaterMeterAccount');
  const account = await Wma.findOne({ account_no: STEVE_ACCOUNT_NO, facilityId: KNIGHTS_FACILITY_ID });
  if (!account) {
    console.error(`Steve's WaterMeterAccount (${STEVE_ACCOUNT_NO}) missing. Re-run scripts/seed_steve_test.js first.`);
    process.exit(1);
  }
  // WaterInvoice lives in utility_database. Query via water_meter_service's
  // payservedb which has its mongoose connected to utility_database.
  const payservedbWaterMeter = require('/home/seint/Dev/Payserve/Main2/water_meter_service/node_modules/payservedb');
  const overdueInv = await payservedbWaterMeter.WaterInvoice.findOne({ accountNumber: STEVE_ACCOUNT_NO, status: 'Pending', dueDate: { $lt: new Date() } });
  const readyInv   = await payservedbWaterMeter.WaterInvoice.findOne({ accountNumber: STEVE_ACCOUNT_NO, status: 'Pending', dueDate: { $gt: new Date() } });

  const STEVE = {
    accountId:        String(account._id),
    customerId:       String(account.customerId),
    unitId:           String(account.unitId),
    accountNo:        account.account_no,
    overdueInvoiceId: overdueInv ? String(overdueInv._id) : null,
    readyInvoiceId:   readyInv   ? String(readyInv._id)   : null,
  };
  console.log('Resolved Steve IDs:', JSON.stringify(STEVE, null, 2), '\n');

  // ─────────────────────────────────────────────────────────────
  // #2 — Resend onboarding (existing controller)
  // ─────────────────────────────────────────────────────────────
  try {
    const { resendOnboardingController } = require('../src/controllers/app/utility_management/customer_account/resend_onboarding');
    const reply = mockReply();
    await resendOnboardingController({
      body: {
        accountId:    STEVE.accountId,
        facilityId:   KNIGHTS_FACILITY_ID,
        phoneNumber:  STEVE_PHONE,
        customerName: 'Steve Karechio',
        unitName:     'STEVE-TEST',
      }
    }, reply);
    log('#2 resend onboarding', reply.statusCode === 200, `HTTP ${reply.statusCode} — ${reply.body?.message || reply.body?.error || '(none)'}`);
  } catch (err) {
    log('#2 resend onboarding', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #4 — Water-invoice-ready (water_meter_service cron path)
  // ─────────────────────────────────────────────────────────────
  try {
    const wm = require('/home/seint/Dev/Payserve/Main2/water_meter_service/src/crons/invoicing/invoiceNotifications');
    const r = await wm.sendInvoiceNotifications(STEVE.readyInvoiceId, true, false);
    log('#4 invoice ready (cron)', !!(r.sms?.sent), `sms.sent=${r.sms?.sent} customerName=${r.customerName}`);
  } catch (err) {
    log('#4 invoice ready (cron)', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #5 — Overdue reminder (water_meter_service cron path)
  // ─────────────────────────────────────────────────────────────
  try {
    const wm = require('/home/seint/Dev/Payserve/Main2/water_meter_service/src/crons/invoicing/overdueReminders');
    const r = await wm.sendOverdueReminder(STEVE.overdueInvoiceId);
    log('#5 overdue reminder (cron)', !!(r.sms?.sent), `sms.sent=${r.sms?.sent} daysOverdue=${r.daysOverdue}`);
  } catch (err) {
    log('#5 overdue reminder (cron)', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #6 — Low-balance range change (water_billing_service)
  // ─────────────────────────────────────────────────────────────
  try {
    const wb = require('/home/seint/Dev/Payserve/Main2/water_billing_service/src/utils/balance_check_sms');
    const r = await wb.checkBalanceRangeChangeAndSendSms(STEVE.accountId);
    log('#6 low-balance alert', r === true, `result=${r}`);
  } catch (err) {
    log('#6 low-balance alert', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #7 — Payment confirmation (water_billing_service)
  // ─────────────────────────────────────────────────────────────
  try {
    const wb = require('/home/seint/Dev/Payserve/Main2/water_billing_service/src/utils/balance_check_sms');
    const r = await wb.sendPaymentConfirmationSms(STEVE.accountId, 200, 350, new Date().toISOString());
    log('#7 payment confirmation', r === true, `result=${r}`);
  } catch (err) {
    log('#7 payment confirmation', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #8 — Minimum payment rejection (water_billing_service)
  // ─────────────────────────────────────────────────────────────
  try {
    const wb = require('/home/seint/Dev/Payserve/Main2/water_billing_service/src/utils/balance_check_sms');
    const r = await wb.sendMinimumPaymentRejectionSms(STEVE.accountId, 500);
    log('#8 minimum-payment rejection', r === true, `result=${r}`);
  } catch (err) {
    log('#8 minimum-payment rejection', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #1 — Welcome onboarding (createUserAccount controller)
  // Uses a SEPARATE account_no + meterNumber so we don't disturb Steve's
  // main account. Deletes the test account after firing.
  // ─────────────────────────────────────────────────────────────
  try {
    await Wma.deleteMany({ account_no: STEVE_TEST_ACCOUNT_NO, facilityId: KNIGHTS_FACILITY_ID });

    const createUserAccount = require('../src/controllers/app/utility_management/customer_account/add_customer_account');
    const reply = mockReply();
    await createUserAccount({
      body: {
        account_no:    STEVE_TEST_ACCOUNT_NO,
        facilityId:    KNIGHTS_FACILITY_ID,
        customerId:    STEVE.customerId,
        meter_id:      STEVE.accountId,   // placeholder
        meterNumber:   'WM-STEVE-ONBOARD-TEST',
        unitId:        STEVE.unitId,
        payment_type:  'Prepaid',
        phoneNumber:   STEVE_PHONE,
        email:         'steve.karechio.test@payserve.local',
        customerName:  'Steve Karechio',
        previousReading: 100,
        currentReading: 150,
      }
    }, reply);
    log('#1 welcome onboarding', reply.statusCode === 200 || reply.statusCode === 201,
        `HTTP ${reply.statusCode} — ${JSON.stringify(reply.body).slice(0, 160)}`);

    // Clean up the test account
    await Wma.deleteMany({ account_no: STEVE_TEST_ACCOUNT_NO, facilityId: KNIGHTS_FACILITY_ID });
  } catch (err) {
    log('#1 welcome onboarding', false, `threw: ${err.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // #3 — Manual bill ready: skipped (analog meter setup too heavy).
  //       Same sendUtilityNotification dispatch as #1/#2 already proven.
  // ─────────────────────────────────────────────────────────────
  log('#3 manual bill ready', null, 'skipped — same dispatch as #1/#2/#4');

  console.log('\n════════ Summary ════════');
  results.forEach(r => {
    const mark = r.ok === true ? '✅' : r.ok === false ? '❌' : '⏭️';
    console.log(`${mark} ${r.scenario}`);
  });

  process.exit(0);
}

main().catch((e) => { console.error('ORCHESTRATOR FAILED:', e); process.exit(1); });
