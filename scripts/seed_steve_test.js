/**
 * Seeds Steve Karechio as a prepaid water-meter customer in Knights Bridge,
 * with state arranged so every water SMS scenario will fire:
 *
 *   - WaterMeterAccount (Prepaid, Active, phone +254721913945)
 *   - Prepaid credits + debits → net balance ~150 (low-balance range)
 *   - SmsNotification.currentRange seeded at '500-800' so the next check sees
 *     a change to '100-200' and fires
 *   - One Pending WaterInvoice with a past dueDate (so overdue cron picks it)
 *   - One Pending WaterInvoice for the current month (so invoice-ready cron picks it)
 *
 * Outputs all IDs needed by the orchestrator.
 *
 * Run with:
 *   node scripts/seed_steve_test.js
 */
const mongoose = require('mongoose');
const payservedb = require('payservedb');

const MAIN_URI    = 'mongodb://Ps:Letmein987@127.0.0.1:27017/payserve_property?authSource=admin';
const UTIL_URI    = 'mongodb://Ps:Letmein987@127.0.0.1:27017/utility_database?authSource=admin';
const KNIGHTS_URI = 'mongodb://Ps:Letmein987@127.0.0.1:27017/knights_db_1743081665748?authSource=admin';

const KNIGHTS_FACILITY_ID = '67e550c1d12f3f1b2e914fcc';
const TEST_PHONE          = '+254721913945';

async function main() {
  console.log('Connecting to databases…');
  const mainConn    = await mongoose.createConnection(MAIN_URI).asPromise();
  const utilConn    = await mongoose.createConnection(UTIL_URI).asPromise();
  const knightsConn = await mongoose.createConnection(KNIGHTS_URI).asPromise();
  console.log('  ✓ payserve_property connected');
  console.log('  ✓ utility_database connected');
  console.log('  ✓ knights_db_1743081665748 connected');

  // Bind schemas to the right connections (avoids OverwriteModelError)
  const Customer            = mainConn.model('Customer', payservedb.Customer.schema);
  const Unit                = knightsConn.model('Unit', payservedb.Unit.schema);
  const WaterMeterAccount   = utilConn.model('WaterMeterAccount', payservedb.WaterMeterAccount.schema);
  const WaterPrepaidCredit  = utilConn.model('WaterPrepaidCredit', payservedb.WaterPrepaidCredit.schema);
  const WaterPrepaidDebit   = utilConn.model('WaterPrepaidDebit', payservedb.WaterPrepaidDebit.schema);
  const SmsNotification     = utilConn.model('SmsNotification', payservedb.SmsNotification.schema);
  const WaterInvoice        = utilConn.model('WaterInvoice', payservedb.WaterInvoice.schema);

  // 1. Customer in payserve_property -----------------------------------------------------------
  let customer = await Customer.findOne({
    phoneNumber: '721913945',
    facilityId: KNIGHTS_FACILITY_ID
  });
  if (!customer) {
    customer = await Customer.create({
      firstName: 'Steve',
      lastName: 'Karechio',
      phoneNumber: '721913945',
      email: 'steve.karechio.test@payserve.local',
      idNumber: 'STEVE-TEST-ID',
      customerNumber: 'STEVE-TEST-001',
      facilityId: KNIGHTS_FACILITY_ID,
      status: 'Active',
      customerType: 'Tenant',
      residentType: 'Resident'
    });
    console.log(`  + Customer created: ${customer._id}`);
  } else {
    console.log(`  = Customer exists:  ${customer._id}`);
  }

  // 2. Unit in knights_db ----------------------------------------------------------------------
  let unit = await Unit.findOne({ name: 'STEVE-TEST', facilityId: KNIGHTS_FACILITY_ID });
  if (!unit) {
    unit = await Unit.create({
      name: 'STEVE-TEST',
      unitType: 'Residential',
      division: 'Test Division',
      floorUnitNo: '1',
      status: 'Occupied',
      facilityId: KNIGHTS_FACILITY_ID,
      homeOwnerId: customer._id,
      residentId: customer._id,
      occupants: [{
        customerId: customer._id,
        customerType: 'tenant',
        moveInDate: new Date(),
        moveOutDate: null
      }]
    });
    console.log(`  + Unit created:     ${unit._id} (${unit.name})`);
  } else {
    console.log(`  = Unit exists:      ${unit._id} (${unit.name})`);
  }

  // 3. WaterMeterAccount (Prepaid) -------------------------------------------------------------
  let account = await WaterMeterAccount.findOne({
    account_no: 'STEVE-LOCAL-001',
    facilityId: KNIGHTS_FACILITY_ID
  });
  if (!account) {
    account = await WaterMeterAccount.create({
      facilityId: KNIGHTS_FACILITY_ID,
      account_no: 'STEVE-LOCAL-001',
      customerId: customer._id,
      customerName: 'Steve Karechio',
      phoneNumber: TEST_PHONE,
      email: 'steve.karechio.test@payserve.local',
      meterNumber: 'WM-STEVE-001',
      unitId: unit._id,
      payment_type: 'Prepaid',
      previousReading: 100,
      currentReading: 150,
      status: 'Active',
      accountBalance: 0
    });
    console.log(`  + WaterMeterAccount: ${account._id}`);
  } else {
    console.log(`  = WaterMeterAccount: ${account._id}`);
  }

  // 4. Wipe any existing credits/debits/sms-notification for this account, then re-seed --------
  await WaterPrepaidCredit.deleteMany({ accountId: account._id });
  await WaterPrepaidDebit.deleteMany({ accountId: account._id });
  await SmsNotification.deleteMany({ accountId: account._id });

  await WaterPrepaidCredit.create({
    accountId: account._id,
    meterId: account._id,                        // placeholder; not used by balance calc
    ref: 'SEED-CREDIT-001',
    amount: 500,
    time: '10:00:00',
    addedOn: new Date().toISOString().slice(0, 10),
    reason: 'Local test seed',
    type: 'Mobile Money'
  });
  await WaterPrepaidDebit.create({
    accountId: account._id,
    meterId: account._id,
    prev_reading: 100,
    current_reading: 150,
    consumption: 1.1,
    rate: '320',
    totalAmount: 350,
    date: new Date().toISOString().slice(0, 10),
    time: '10:01:00'
  });

  // Pre-set SmsNotification.currentRange to a HIGHER bucket so when the
  // low-balance check runs, it sees a change to '100-200' (balance 150 → range '100-200')
  // and fires the SMS+WhatsApp combo instead of deduping.
  await SmsNotification.create({
    accountId: account._id,
    currentRange: '500-800',
    balance: 600,
    lastNotificationDate: new Date(Date.now() - 24 * 3600 * 1000)
  });
  console.log('  + Credits/debits/SmsNotification seeded for low-balance scenario');

  // 5. Overdue WaterInvoice (for overdue-reminder cron) ----------------------------------------
  await WaterInvoice.deleteMany({ accountNumber: 'STEVE-LOCAL-001', facilityId: KNIGHTS_FACILITY_ID });

  const overdueInvoice = await WaterInvoice.create({
    invoiceNumber: 'WTR-STEVE-OVERDUE',
    accountNumber: 'STEVE-LOCAL-001',
    unitName: 'STEVE-TEST',
    yearMonth: '2026-04',
    facilityId: KNIGHTS_FACILITY_ID,
    customerId: customer._id,
    billingType: 'postpaid',
    balanceBroughtForward: 0,
    billerAddress: {
      name: 'Knights Bridge Water',
      email: 'billing@knightsbridge.local.com',
      phone: '+254700000000',
      address: 'P. O. BOX 0000-00000',
      city: 'Nairobi'
    },
    dueDate: new Date(Date.now() - 5 * 86400 * 1000),       // 5 days ago
    meterNumber: 'WM-STEVE-001',
    meterReadings: { previousReading: 100, currentReading: 150, usage: 50, previous: 100, current: 150 },
    consumptionPeriod: { startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 30), from: new Date(2026, 3, 1), to: new Date(2026, 3, 30) },
    charges: { waterCharge: 1250, sewerCharge: 0, tax: 0, fixedCharge: 0, totalMonthlyBill: 1250 },
    amountPaid: 0,
    status: 'Pending',
    currency: 'KES',
    dateIssued: new Date(Date.now() - 30 * 86400 * 1000)
  });
  console.log(`  + Overdue invoice:   ${overdueInvoice._id} (due ${overdueInvoice.dueDate.toISOString().slice(0,10)})`);

  // 6. Current-month WaterInvoice (for invoice-ready cron) ------------------------------------
  const readyInvoice = await WaterInvoice.create({
    invoiceNumber: 'WTR-STEVE-READY',
    accountNumber: 'STEVE-LOCAL-001',
    unitName: 'STEVE-TEST',
    yearMonth: new Date().toISOString().slice(0, 7),
    facilityId: KNIGHTS_FACILITY_ID,
    customerId: customer._id,
    billingType: 'postpaid',
    balanceBroughtForward: 0,
    billerAddress: {
      name: 'Knights Bridge Water',
      email: 'billing@knightsbridge.local.com',
      phone: '+254700000000',
      address: 'P. O. BOX 0000-00000',
      city: 'Nairobi'
    },
    dueDate: new Date(Date.now() + 14 * 86400 * 1000),      // 14 days from now
    meterNumber: 'WM-STEVE-001',
    meterReadings: { previousReading: 150, currentReading: 200, usage: 50, previous: 150, current: 200 },
    consumptionPeriod: { startDate: new Date(Date.now() - 30 * 86400 * 1000), endDate: new Date(), from: new Date(Date.now() - 30 * 86400 * 1000), to: new Date() },
    charges: { waterCharge: 1250, sewerCharge: 0, tax: 0, fixedCharge: 0, totalMonthlyBill: 1250 },
    amountPaid: 0,
    status: 'Pending',
    currency: 'KES',
    dateIssued: new Date()
  });
  console.log(`  + Ready invoice:     ${readyInvoice._id} (due ${readyInvoice.dueDate.toISOString().slice(0,10)})`);

  console.log('\n════════ HANDOFF TO ORCHESTRATOR ════════');
  console.log(JSON.stringify({
    facilityId:       KNIGHTS_FACILITY_ID,
    customerId:       String(customer._id),
    unitId:           String(unit._id),
    accountId:        String(account._id),
    accountNumber:    account.account_no,
    phone:            TEST_PHONE,
    overdueInvoiceId: String(overdueInvoice._id),
    readyInvoiceId:   String(readyInvoice._id),
    yearMonth:        readyInvoice.yearMonth
  }, null, 2));

  await mainConn.close();
  await utilConn.close();
  await knightsConn.close();
  console.log('\nDone.');
}

main().catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
