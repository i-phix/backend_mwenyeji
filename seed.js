/**
 * PayServe Full System Seed Script
 * ─────────────────────────────────────────────────────────────────────────────
 * Run from payserve_backend root:
 *   node seed_full_system.js           — idempotent (skips existing records)
 *   node seed_full_system.js --reset   — wipes seed records first, then re-seeds
 *
 * What this seeds (in dependency order):
 *
 *  CORE / PROPERTY MANAGEMENT (payserve_property)
 *   1. Company            – Seed Properties Ltd
 *   2. Facility            – Zuri Heights (with all modules enabled)
 *   3. Admin User         – Admin user linked to company/facility
 *   4. Customers          – 15 resident customers (customerNumber auto-incremented as Number)
 *   5. Units               – 4 units in the dynamically created facility DB
 *
 *  CUSTOMER OBSESSION (payserve_property)
 *   6.  AgentDepartment    – Technical Support, Billing, General Enquiries
 *   7.  AgentRole          – call_center_agent, team_leader, supervisor, manager
 *   8.  SupportLevelConfig – L1 / L2 / L3
 *   9.  Agent              – 3 agents (one per department)
 *  10.  TicketCategory     – 3 categories (low/medium/high priority)
 *  11.  CustomerTicket     – 4 tickets in various states (open, in_progress, resolved, closed)
 *  12.  KnowledgeBase      – 2 articles (published + draft)
 *
 *  MOVE-IN (payserve_movein)
 *  13. MoveInLandlordUser – 2 landlords
 *  14. MoveInUser         – 3 tenants
 *  15. MoveInUnit         – 6 listings
 *  16. MoveInViewingSlot  – 8 slots
 *  17. MoveInApplication  – 4 applications (pending/approved/rejected)
 *  18. MoveInConversation – 2 conversations with messages
 *
 *  UTILITY (utility_database)
 *  19. WaterMeterAccount  – 2 accounts (prepaid + postpaid)
 *  20. WaterPrepaidCredit/Debit/SmsNotification – low-balance SMS trigger scenario
 *  21. WaterInvoice       – 1 overdue + 1 current-month invoice
 *
 * All passwords: Password123
 */

"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const payservedb = require("payservedb");

// ── Connection URIs ───────────────────────────────────────────────────────────
const PROPERTY_URI =
  "mongodb://Ps:Letmein987@127.0.0.1:27017/payserve_property?authSource=admin";
const MOVEIN_URI =
  "mongodb://Ps:Letmein987@127.0.0.1:27017/payserve_movein?authSource=admin";
const UTIL_URI =
  "mongodb://Ps:Letmein987@127.0.0.1:27017/utility_database?authSource=admin";

// Seed identity constants (used for idempotency checks and --reset)
const SEED_COMPANY_PIN = "P051234567Z";
const SEED_ADMIN_EMAIL = "admin@seedproperties.example.com";
const SEED_ADMIN_PHONE = "+254700000100";

// ── Move-In image base path ──────────────────────────────────────────────────
const IMG = "/images";

// ── Inline Move-In schemas (avoids payservedb wiring for move-in models) ─────
const ObjId = mongoose.Schema.Types.ObjectId;

const LandlordUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String, default: "MANAGED_BY_PAYSERVE" },
    companyName: { type: String, default: null },
    isEnabled: { type: Boolean, default: true },
    payserveUserId: { type: ObjId, default: null },
  },
  { timestamps: true },
);

const MoveInTenantSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phoneNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
    nationalId: { type: String },
    occupation: { type: String },
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },
  },
  { timestamps: true },
);

const MoveInUnitSchema = new mongoose.Schema(
  {
    landlordId: { type: ObjId, required: true },
    title: { type: String, required: true },
    description: { type: String, default: null },
    listingType: {
      type: String,
      enum: [
        "Apartment",
        "Studio",
        "Bedsitter",
        "Bungalow",
        "Maisonette",
        "Townhouse",
        "Villa",
        "Office",
      ],
      default: null,
    },
    bedrooms: { type: Number, default: null },
    bathrooms: { type: Number, default: null },
    grossArea: { type: Number, default: null },
    price: { type: Number, required: true },
    location: {
      address: { type: String, default: null },
      city: { type: String, default: null },
      county: { type: String, default: null },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    amenities: { type: [String], default: [] },
    images: [
      {
        category: { type: String },
        label: { type: String },
        url: { type: String, required: true },
      },
    ],
    moveInApproval: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    isListed: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const ViewingSlotSchema = new mongoose.Schema(
  {
    landlordId: { type: ObjId, required: true },
    unitId: { type: ObjId, required: true },
    unitName: { type: String, default: null },
    facilityId: { type: ObjId, default: null },
    date: { type: Date, required: true },
    time: { type: String, required: true },
    durationMins: { type: Number, default: 30 },
    capacity: { type: Number, default: 2 },
    bookedCount: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const MoveInApplicationSchema = new mongoose.Schema(
  {
    unitId: { type: ObjId, required: true },
    facilityId: { type: ObjId, required: true },
    unitName: { type: String, default: null },
    facilityName: { type: String, default: null },
    tenantId: { type: ObjId, required: true },
    tenantName: { type: String, default: null },
    tenantEmail: { type: String, default: null },
    tenantPhone: { type: String, default: null },
    desiredMoveInDate: { type: Date, default: null },
    message: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "assigned", "approved", "rejected", "completed"],
      default: "pending",
    },
    adminNote: { type: String, default: null },
    assignedAt: { type: Date, default: null },
    landlordId: { type: ObjId, default: null },
  },
  { timestamps: true },
);

const ConversationSchema = new mongoose.Schema(
  {
    tenantId: { type: ObjId, required: true },
    landlordId: { type: ObjId, required: true },
    unitId: { type: ObjId, required: true },
    unitName: { type: String, default: null },
    lastMessage: { type: String, default: null },
    lastMessageAt: { type: Date, default: null },
    tenantUnread: { type: Number, default: 0 },
    landlordUnread: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "closed"], default: "active" },
  },
  { timestamps: true },
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: ObjId, required: true },
    senderId: { type: ObjId, required: true },
    senderType: { type: String, enum: ["tenant", "landlord"], required: true },
    body: { type: String, required: true },
    type: { type: String, enum: ["text", "image"], default: "text" },
    attachmentUrl: { type: String, default: null },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── FIX: SupportLevelConfig is not always exported by payservedb ────────────
// Some installed versions of payservedb don't export this model. We fall back
// to a local schema so the seed never crashes here, while still preferring
// payservedb's own schema/version if it's present.
const SupportLevelConfigFallbackSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    roles: { type: [String], default: [] },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// ── FIX: fail fast with a clear message instead of a cryptic crash ─────────
// "Cannot read properties of undefined (reading 'schema')" happens when
// payservedb.<ModelName> doesn't exist on the installed package — almost
// always because node_modules/payservedb is out of date relative to the
// version pinned in package.json. This checks everything up front.
const REQUIRED_PAYSERVEDB_MODELS = [
  "Company",
  "Facility",
  "User",
  "Customer",
  "Unit",
  "AgentDepartment",
  "AgentRole",
  "Agent",
  "TicketCategory",
  "CustomerTicket",
  "KnowledgeBase",
  "WaterMeterAccount",
  "WaterPrepaidCredit",
  "WaterPrepaidDebit",
  "SmsNotification",
  "WaterInvoice",
];

function assertPayserveModelsPresent() {
  const missing = REQUIRED_PAYSERVEDB_MODELS.filter(
    (name) => !payservedb[name],
  );
  if (missing.length) {
    console.error("\n❌  payservedb is missing these model exports:");
    console.error(`    ${missing.join(", ")}`);
    console.error(
      "\n    This almost always means node_modules/payservedb is older than",
    );
    console.error("    the version declared in package.json. Fix it with:\n");
    console.error("      rm -rf node_modules package-lock.json");
    console.error("      npm install\n");
    console.error(
      "    (or just `npm install payservedb@latest` if you don't want a full reinstall)\n",
    );
    process.exit(1);
  }
}

// Binds a payservedb model schema to a specific connection. Falls back to a
// locally-defined schema if payservedb doesn't export that model at all
// (currently only needed for SupportLevelConfig — see note above).
function bindModel(conn, name, fallbackSchema) {
  const exported = payservedb[name];
  const schema = exported ? exported.schema : fallbackSchema;
  if (!schema) {
    throw new Error(
      `No schema available for "${name}" — it isn't exported by payservedb and no fallback schema was provided.`,
    );
  }
  return conn.model(name, schema);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const daysFrom = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
};

const log = (msg) => console.log(`  ${msg}`);
const section = (title) =>
  console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`);

const generateDbName = (name) => {
  const ts = Date.now();
  return `${name
    .trim()
    .toLowerCase()
    .split(" ")[0]
    .replace(/[^a-z0-9]/g, "_")}_db_${ts}`;
};

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  const RESET = process.argv.includes("--reset");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║       PayServe Full System Seed Script                  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  if (RESET)
    log(
      "⚠  --reset flag detected — existing seed data will be removed first\n",
    );

  // Fail fast if the installed payservedb package doesn't match what this
  // script expects, before we open any connections or create any records.
  assertPayserveModelsPresent();

  // ── Open connections ─────────────────────────────────────────────────────
  section("Connecting to databases");
  const propertyConn = await mongoose
    .createConnection(PROPERTY_URI)
    .asPromise();
  const moveinConn = await mongoose.createConnection(MOVEIN_URI).asPromise();
  const utilConn = await mongoose.createConnection(UTIL_URI).asPromise();
  log("✓ payserve_property");
  log("✓ payserve_movein");
  log("✓ utility_database");

  // ── Hash ─────────────────────────────────────────────────────────────────
  const hash = await bcrypt.hash("Password123", 10);

  // ── Bind core models ─────────────────────────────────────────────────────
  const Company = bindModel(propertyConn, "Company");
  const Facility = bindModel(propertyConn, "Facility");
  const User = bindModel(propertyConn, "User");
  const Customer = bindModel(propertyConn, "Customer");

  // ── --reset: clean up everything we seeded ────────────────────────────────
  if (RESET) {
    section("Resetting seed data");

    const existingCompany = await Company.findOne({
      companyPinNumber: SEED_COMPANY_PIN,
    });
    if (existingCompany) {
      // Remove facility (and its facility-DB data) for each facility in the company
      for (const fId of existingCompany.facilities) {
        const fac = await Facility.findById(fId);
        if (fac && fac.dbName) {
          const fConn = await mongoose
            .createConnection(
              `mongodb://Ps:Letmein987@127.0.0.1:27017/${fac.dbName}?authSource=admin`,
            )
            .asPromise();
          await fConn.dropDatabase();
          await fConn.close();
          log(`✓ Dropped facility DB: ${fac.dbName}`);
        }
        await Facility.deleteOne({ _id: fId });
      }
      await Company.deleteOne({ _id: existingCompany._id });
      log("✓ Removed company + facilities");
    }

    // Remove users created by this seed
    await User.deleteMany({
      email: {
        $in: [
          SEED_ADMIN_EMAIL,
          "david.otieno.agent@example.com",
          "faith.kamau.agent@example.com",
          "george.kiprop.agent@example.com",
        ],
      },
    });
    log("✓ Removed seed users");

    // Remove CO models
    const AgentDepartment = bindModel(propertyConn, "AgentDepartment");
    const AgentRole = bindModel(propertyConn, "AgentRole");
    const Agent = bindModel(propertyConn, "Agent");
    const TicketCategory = bindModel(propertyConn, "TicketCategory");
    const CustomerTicket = bindModel(propertyConn, "CustomerTicket");
    const KnowledgeBase = bindModel(propertyConn, "KnowledgeBase");
    const SupportLevelConfig = bindModel(
      propertyConn,
      "SupportLevelConfig",
      SupportLevelConfigFallbackSchema,
    );

    await AgentDepartment.deleteMany({
      code: { $in: ["TECH", "BILLING", "GENERAL"] },
    });
    await AgentRole.deleteMany({
      code: {
        $in: ["call_center_agent", "team_leader", "supervisor", "manager"],
      },
    });
    await Agent.deleteMany({
      email: {
        $in: [
          "david.otieno.agent@example.com",
          "faith.kamau.agent@example.com",
          "george.kiprop.agent@example.com",
        ],
      },
    });
    await TicketCategory.deleteMany({
      name: {
        $in: ["Water Supply Issue", "Billing Dispute", "General Enquiry"],
      },
    });
    await CustomerTicket.deleteMany({ tags: { $in: ["seed"] } });
    await KnowledgeBase.deleteMany({
      title: {
        $in: [
          "How to read your prepaid water meter",
          "Understanding your monthly invoice — draft",
        ],
      },
    });
    await SupportLevelConfig.deleteMany({ level: { $in: [1, 2, 3] } });
    log("✓ Removed Customer Obsession seed data");

    // Remove utility seed data
    const WaterMeterAccount = bindModel(utilConn, "WaterMeterAccount");
    const WaterPrepaidCredit = bindModel(utilConn, "WaterPrepaidCredit");
    const WaterPrepaidDebit = bindModel(utilConn, "WaterPrepaidDebit");
    const SmsNotification = bindModel(utilConn, "SmsNotification");
    const WaterInvoice = bindModel(utilConn, "WaterInvoice");

    const accts = await WaterMeterAccount.find({
      account_no: { $in: ["SEED-WTR-PREPAID-001", "SEED-WTR-POSTPAID-001"] },
    });
    for (const a of accts) {
      await WaterPrepaidCredit.deleteMany({ accountId: a._id });
      await WaterPrepaidDebit.deleteMany({ accountId: a._id });
      await SmsNotification.deleteMany({ accountId: a._id });
    }
    await WaterMeterAccount.deleteMany({
      account_no: { $in: ["SEED-WTR-PREPAID-001", "SEED-WTR-POSTPAID-001"] },
    });
    await WaterInvoice.deleteMany({
      invoiceNumber: { $in: ["WTR-SEED-OVERDUE-001", "WTR-SEED-CURRENT-001"] },
    });
    log("✓ Removed utility seed data");

    // Move-in: always full wipe (see below)
    log("✓ Reset complete\n");
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. COMPANY + FACILITY
  // ════════════════════════════════════════════════════════════════════════
  section("1 · Company & Facility");

  let company = await Company.findOne({ companyPinNumber: SEED_COMPANY_PIN });
  let facility, adminUser, customers, units;
  let FACILITY_DB;

  if (!company) {
    FACILITY_DB = generateDbName("zuri heights");

    facility = await new Facility({
      name: "Zuri Heights",
      location: "Westlands, Nairobi",
      subDivision: "Block A",
      divisionArray: ["Block A", "Block B", "Penthouse"],
      isEnabled: true,
      dbName: FACILITY_DB,
      accountNumber: "P099",
      payServeSync: false,
      modules: {
        visitor: true,
        levy: true,
        maintenance: true,
        lease: true,
        vas: true,
        tickets: true,
        utility: true,
        booking: true,
        handover: true,
        expense: true,
        campaign: true,
        accounts: true,
      },
    }).save();
    log(`✓ Facility created: ${facility._id}  (DB: ${FACILITY_DB})`);

    company = await new Company({
      name: "Seed Properties Ltd",
      address: "1st Floor, Finance House, Loita Street",
      country: "Kenya",
      city: "Nairobi",
      registrationNumber: "CPR/2024/SEED001",
      // companyTaxNumber and companyPinNumber are required by the Company schema
      companyTaxNumber: "T0012345Z",
      companyPinNumber: SEED_COMPANY_PIN,
      email: "info@seedproperties.example.com",
      isEnabled: true,
      facilities: [facility._id],
      kyc: { taxCertificate: null, companyCertificate: null, Id: null },
    }).save();
    log(`✓ Company created:  ${company._id}`);

    // ── 2. Admin User ─────────────────────────────────────────────────────
    section("2 · Admin User");

    adminUser = await User.findOne({ email: SEED_ADMIN_EMAIL });
    if (!adminUser) {
      adminUser = await new User({
        fullName: "Seed Admin",
        email: SEED_ADMIN_EMAIL,
        phoneNumber: SEED_ADMIN_PHONE,
        idNumber: "ID-SEED-ADMIN-001",
        type: "Company",
        role: "admin",
        password: hash,
        companies: [company._id],
        customerData: [{ facilityId: facility._id, isEnabled: true }],
        kyc: {},
      }).save();
      log(`✓ Admin user created: ${adminUser._id}  (${SEED_ADMIN_EMAIL})`);
    } else {
      log(`= Admin user exists: ${adminUser._id}`);
    }

    // ── 3. Customers ──────────────────────────────────────────────────────
    section("3 · Customers");

    // customerNumber is a Number in the Customer schema — auto-increment from max+1
    const lastCust = await Customer.findOne({ facilityId: facility._id }).sort({
      customerNumber: -1,
    });
    let nextNum = lastCust ? lastCust.customerNumber + 1 : 1;

    const customersData = [
      {
        firstName: "Alice",
        lastName: "Wambua",
        phoneNumber: "712001001",
        email: "alice.wambua@seedtest.example.com",
        idNumber: "ID-SEED-001",
        customerNumber: nextNum++, // Number, not String
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Brian",
        lastName: "Mwenda",
        phoneNumber: "712001002",
        email: "brian.mwenda@seedtest.example.com",
        idNumber: "ID-SEED-002",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Carol",
        lastName: "Njeri",
        phoneNumber: "712001003",
        email: "carol.njeri@seedtest.example.com",
        idNumber: "ID-SEED-003",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "HomeOwner",
        residentType: "Owner",
      },
      {
        firstName: "Dennis",
        lastName: "Kiptoo",
        phoneNumber: "712001004",
        email: "dennis.kiptoo@seedtest.example.com",
        idNumber: "ID-SEED-004",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Esther",
        lastName: "Nyambura",
        phoneNumber: "712001005",
        email: "esther.nyambura@seedtest.example.com",
        idNumber: "ID-SEED-005",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Felix",
        lastName: "Omondi",
        phoneNumber: "712001006",
        email: "felix.omondi@seedtest.example.com",
        idNumber: "ID-SEED-006",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Grace",
        lastName: "Wairimu",
        phoneNumber: "712001007",
        email: "grace.wairimu@seedtest.example.com",
        idNumber: "ID-SEED-007",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "HomeOwner",
        residentType: "Owner",
      },
      {
        firstName: "Hassan",
        lastName: "Mohamed",
        phoneNumber: "712001008",
        email: "hassan.mohamed@seedtest.example.com",
        idNumber: "ID-SEED-008",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Irene",
        lastName: "Achieng",
        phoneNumber: "712001009",
        email: "irene.achieng@seedtest.example.com",
        idNumber: "ID-SEED-009",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Joseph",
        lastName: "Mutiso",
        phoneNumber: "712001010",
        email: "joseph.mutiso@seedtest.example.com",
        idNumber: "ID-SEED-010",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Karen",
        lastName: "Cherono",
        phoneNumber: "712001011",
        email: "karen.cherono@seedtest.example.com",
        idNumber: "ID-SEED-011",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "HomeOwner",
        residentType: "Owner",
      },
      {
        firstName: "Lawrence",
        lastName: "Otieno",
        phoneNumber: "712001012",
        email: "lawrence.otieno@seedtest.example.com",
        idNumber: "ID-SEED-012",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Mary",
        lastName: "Auma",
        phoneNumber: "712001013",
        email: "mary.auma@seedtest.example.com",
        idNumber: "ID-SEED-013",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Nicholas",
        lastName: "Kamau",
        phoneNumber: "712001014",
        email: "nicholas.kamau@seedtest.example.com",
        idNumber: "ID-SEED-014",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "Tenant",
        residentType: "Resident",
      },
      {
        firstName: "Olive",
        lastName: "Chebet",
        phoneNumber: "712001015",
        email: "olive.chebet@seedtest.example.com",
        idNumber: "ID-SEED-015",
        customerNumber: nextNum++,
        facilityId: facility._id,
        status: "Active",
        customerType: "HomeOwner",
        residentType: "Owner",
      },
    ];

    customers = [];
    for (const cd of customersData) {
      let c = await Customer.findOne({
        customerNumber: cd.customerNumber,
        facilityId: facility._id,
      });
      if (!c) {
        c = await new Customer(cd).save();
        log(
          `+ Customer: ${c.firstName} ${c.lastName}  (#${c.customerNumber}  ${c._id})`,
        );
      } else {
        log(`= Customer exists: ${c.firstName} ${c.lastName}`);
      }
      customers.push(c);
    }

    // ── 4. Units in facility DB ───────────────────────────────────────────
    section("4 · Facility Units");

    const facilityConn = await mongoose
      .createConnection(
        `mongodb://Ps:Letmein987@127.0.0.1:27017/${FACILITY_DB}?authSource=admin`,
      )
      .asPromise();
    const Unit = bindModel(facilityConn, "Unit");

    // Units for the original 3 customers (A101, A102, PH-01 occupied; B201 vacant),
    // plus one more unit per additional customer (12 more units: A103-A114).
    const unitsData = [
      {
        name: "A101",
        unitType: "Residential",
        division: "Block A",
        floorUnitNo: "1",
        lettableFloorArea: 65,
        grossArea: 75,
        netLettableArea: 60,
        status: "Occupied",
        facilityId: facility._id,
        homeOwnerId: customers[2]._id,
        residentId: customers[0]._id,
        occupants: [
          {
            customerId: customers[0]._id,
            customerType: "tenant",
            moveInDate: new Date("2024-01-01"),
            moveOutDate: null,
          },
        ],
      },
      {
        name: "A102",
        unitType: "Residential",
        division: "Block A",
        floorUnitNo: "1",
        lettableFloorArea: 80,
        grossArea: 95,
        netLettableArea: 75,
        status: "Occupied",
        facilityId: facility._id,
        homeOwnerId: customers[2]._id,
        residentId: customers[1]._id,
        occupants: [
          {
            customerId: customers[1]._id,
            customerType: "tenant",
            moveInDate: new Date("2024-03-01"),
            moveOutDate: null,
          },
        ],
      },
      {
        name: "B201",
        unitType: "Residential",
        division: "Block B",
        floorUnitNo: "2",
        lettableFloorArea: 100,
        grossArea: 120,
        netLettableArea: 95,
        status: "Vacant",
        facilityId: facility._id,
      },
      {
        name: "PH-01",
        unitType: "Commercial",
        division: "Penthouse",
        floorUnitNo: "10",
        lettableFloorArea: 200,
        grossArea: 240,
        netLettableArea: 185,
        status: "Occupied",
        facilityId: facility._id,
        homeOwnerId: customers[2]._id,
        residentId: customers[2]._id,
        occupants: [
          {
            customerId: customers[2]._id,
            // FIX: Unit.occupants.customerType enum is ['home owner', 'tenant']
            // — "homeowner" (no space) is NOT a valid value and crashes on save.
            customerType: "home owner",
            moveInDate: new Date("2023-06-01"),
            moveOutDate: null,
          },
        ],
      },
    ];

    // Additional units A103..A114 for customers[3..14] (the 12 new customers).
    // Each is occupied by its corresponding customer; homeOwnerId points back
    // to Carol Njeri (customers[2]) as the original seed does for tenant units,
    // except for HomeOwner-type customers, who own their own unit.
    const blockACodes = [
      "103",
      "104",
      "105",
      "106",
      "107",
      "108",
      "109",
      "110",
      "111",
      "112",
      "113",
      "114",
    ];
    for (let i = 3; i < customersData.length; i++) {
      const cust = customers[i];
      const isOwner = customersData[i].customerType === "HomeOwner";
      const floorNum = Math.ceil((i - 2) / 2); // simple floor grouping
      unitsData.push({
        name: `A${blockACodes[i - 3]}`,
        unitType: "Residential",
        division: "Block A",
        floorUnitNo: String(floorNum + 1),
        lettableFloorArea: 70,
        grossArea: 82,
        netLettableArea: 65,
        status: "Occupied",
        facilityId: facility._id,
        homeOwnerId: isOwner ? cust._id : customers[2]._id,
        residentId: cust._id,
        occupants: [
          {
            customerId: cust._id,
            customerType: isOwner ? "home owner" : "tenant",
            moveInDate: new Date("2024-06-01"),
            moveOutDate: null,
          },
        ],
      });
    }

    units = [];
    for (const ud of unitsData) {
      let u = await Unit.findOne({ name: ud.name, facilityId: facility._id });
      if (!u) {
        u = await new Unit(ud).save();
        log(`+ Unit: ${u.name}  [${u.division}]  (${u._id})`);
      } else {
        log(`= Unit exists: ${u.name}`);
      }
      units.push(u);
    }
    await facilityConn.close();
  } else {
    log(`= Company already seeded (${company._id}) — loading existing records`);
    facility = await Facility.findById(company.facilities[0]);
    adminUser = await User.findOne({ email: SEED_ADMIN_EMAIL });
    customers = await Customer.find({ facilityId: facility._id })
      .sort({ customerNumber: 1 })
      .limit(15);
    FACILITY_DB = facility.dbName;

    const facilityConn = await mongoose
      .createConnection(
        `mongodb://Ps:Letmein987@127.0.0.1:27017/${FACILITY_DB}?authSource=admin`,
      )
      .asPromise();
    const Unit = bindModel(facilityConn, "Unit");
    units = await Unit.find({ facilityId: facility._id }).limit(16);
    await facilityConn.close();

    log(`  Facility: ${facility.name}  (DB: ${FACILITY_DB})`);
    log(`  Admin:    ${adminUser?.email}`);
    log(`  Customers: ${customers.length}   Units: ${units.length}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // CUSTOMER OBSESSION
  // ════════════════════════════════════════════════════════════════════════
  section("5 · Customer Obsession — Departments");
  const AgentDepartment = bindModel(propertyConn, "AgentDepartment");
  const AgentRole = bindModel(propertyConn, "AgentRole");
  const SupportLevelConfig = bindModel(
    propertyConn,
    "SupportLevelConfig",
    SupportLevelConfigFallbackSchema,
  );
  const Agent = bindModel(propertyConn, "Agent");
  const TicketCategory = bindModel(propertyConn, "TicketCategory");
  const CustomerTicket = bindModel(propertyConn, "CustomerTicket");
  const KnowledgeBase = bindModel(propertyConn, "KnowledgeBase");

  const deptDefs = [
    {
      name: "Technical Support",
      code: "TECH",
      description: "Handles technical and utility issues",
    },
    {
      name: "Billing & Finance",
      code: "BILLING",
      description: "Handles invoices, payments and disputes",
    },
    {
      name: "General Enquiries",
      code: "GENERAL",
      description: "Handles general resident enquiries",
    },
  ];
  const departments = [];
  for (const dd of deptDefs) {
    let dept = await AgentDepartment.findOne({ code: dd.code });
    if (!dept) {
      dept = await new AgentDepartment({
        ...dd,
        created_by: adminUser._id,
        updated_by: adminUser._id,
      }).save();
      log(`+ Department: ${dept.name}  (${dept.code})`);
    } else {
      log(`= Department exists: ${dept.name}`);
    }
    departments.push(dept);
  }

  section("6 · Customer Obsession — Roles");
  const roleDefs = [
    {
      name: "Call Centre Agent",
      code: "call_center_agent",
      level: 1,
      description: "First-line support agent",
      department: departments[2]._id,
      permissions: [
        "view_tickets",
        "create_tickets",
        "update_tickets",
        "view_kb",
      ],
    },
    {
      name: "Team Leader",
      code: "team_leader",
      level: 2,
      description: "Supervises agents and handles escalations",
      department: departments[0]._id,
      permissions: [
        "view_tickets",
        "create_tickets",
        "update_tickets",
        "assign_tickets",
        "view_kb",
        "manage_agents",
      ],
    },
    {
      name: "Billing Supervisor",
      code: "supervisor",
      level: 2,
      description: "Manages billing disputes and approvals",
      department: departments[1]._id,
      permissions: [
        "view_tickets",
        "create_tickets",
        "update_tickets",
        "assign_tickets",
        "view_kb",
      ],
    },
    {
      name: "Support Manager",
      code: "manager",
      level: 3,
      description: "Manages the whole support function",
      department: departments[0]._id,
      permissions: [
        "view_tickets",
        "create_tickets",
        "update_tickets",
        "assign_tickets",
        "delete_tickets",
        "view_kb",
        "manage_agents",
        "manage_departments",
      ],
    },
  ];
  const roles = [];
  for (const rd of roleDefs) {
    let role = await AgentRole.findOne({ code: rd.code });
    if (!role) {
      role = await new AgentRole({
        ...rd,
        created_by: adminUser._id,
        updated_by: adminUser._id,
      }).save();
      log(`+ Role: ${role.name}  (${role.code}  L${role.level})`);
    } else {
      log(`= Role exists: ${role.name}`);
    }
    roles.push(role);
  }

  section("7 · Customer Obsession — Support Level Config");
  const levelDefs = [
    {
      level: 1,
      name: "1st Level Support",
      description: "Handles first-contact support and basic issue triage.",
      roles: ["call_center_agent"],
    },
    {
      level: 2,
      name: "2nd Level Support",
      description: "Handles advanced and technical escalations.",
      roles: ["team_leader", "supervisor", "technician"],
    },
    {
      level: 3,
      name: "3rd Level Support",
      description: "Handles management-level escalations and final decisions.",
      roles: ["manager"],
    },
  ];
  for (const ld of levelDefs) {
    await SupportLevelConfig.updateOne(
      { level: ld.level },
      { $setOnInsert: { ...ld } },
      { upsert: true },
    );
    log(`✓ Support level L${ld.level}: ${ld.name}`);
  }

  section("8 · Customer Obsession — Agents");
  const agentDefs = [
    {
      firstName: "David",
      lastName: "Otieno",
      email: "david.otieno.agent@example.com",
      phoneNumber: "+254711200001",
      idNumber: "ID-AGT-001",
      role: "call_center_agent",
      department: "GENERAL",
    },
    {
      firstName: "Faith",
      lastName: "Kamau",
      email: "faith.kamau.agent@example.com",
      phoneNumber: "+254711200002",
      idNumber: "ID-AGT-002",
      role: "team_leader",
      department: "TECH",
    },
    {
      firstName: "George",
      lastName: "Kiprop",
      email: "george.kiprop.agent@example.com",
      phoneNumber: "+254711200003",
      idNumber: "ID-AGT-003",
      role: "supervisor",
      department: "BILLING",
    },
  ];
  const agents = [];
  for (const ad of agentDefs) {
    let agent = await Agent.findOne({ email: ad.email });
    if (!agent) {
      let agentUser = await User.findOne({ email: ad.email });
      if (!agentUser) {
        agentUser = await new User({
          fullName: `${ad.firstName} ${ad.lastName}`,
          email: ad.email,
          phoneNumber: ad.phoneNumber,
          idNumber: ad.idNumber,
          type: "Customer_Support",
          role: "user",
          password: hash,
        }).save();
      }
      const roleDoc = roles.find((r) => r.code === ad.role);
      const agentIdStr = `PS${String(Math.floor(Math.random() * 9000) + 1000)}`;
      agent = await new Agent({
        agent_id: agentIdStr,
        user_id: agentUser._id,
        name: `${ad.firstName} ${ad.lastName}`,
        email: ad.email,
        phone: ad.phoneNumber,
        id_number: ad.idNumber,
        role: ad.role,
        department: ad.department,
        facility_id: facility._id,
        status: "active",
        permissions: roleDoc ? roleDoc.permissions || [] : [],
      }).save();
      log(
        `+ Agent: ${agent.name}  [${agent.role} / ${agent.department}]  (${agent.agent_id})`,
      );
    } else {
      log(`= Agent exists: ${agent.name}`);
    }
    agents.push(agent);
  }

  section("9 · Customer Obsession — Ticket Categories");
  const catDefs = [
    {
      name: "Water Supply Issue",
      description: "Problems with water supply or metering",
      priority: "high",
      sla_minutes: 240,
      color: "#ef4444",
    },
    {
      name: "Billing Dispute",
      description: "Invoice errors and payment disputes",
      priority: "medium",
      sla_minutes: 1440,
      color: "#f97316",
    },
    {
      name: "General Enquiry",
      description: "Non-urgent resident questions",
      priority: "low",
      sla_minutes: 4320,
      color: "#22c55e",
    },
  ];
  const categories = [];
  for (const cd of catDefs) {
    let cat = await TicketCategory.findOne({
      name: { $regex: new RegExp(`^${cd.name}$`, "i") },
    });
    if (!cat) {
      cat = await new TicketCategory({
        ...cd,
        is_active: true,
        created_by: adminUser._id,
        updated_by: adminUser._id,
      }).save();
      log(
        `+ Category: ${cat.name}  [${cat.priority} / SLA: ${cat.sla_minutes} min]`,
      );
    } else {
      log(`= Category exists: ${cat.name}`);
    }
    categories.push(cat);
  }

  section("10 · Customer Obsession — Tickets");
  const makeTicketNum = () =>
    `TKT-SEED-${String(Math.floor(Math.random() * 90000) + 10000)}`;
  const now = new Date();

  const ticketDefs = [
    {
      ticket_number: makeTicketNum(),
      customer_id: customers[0]._id,
      facility_id: facility._id,
      title: "No water in unit A101 since morning",
      description:
        "Water supply to unit A101 has been completely cut off since 06:00 today. All taps are dry. Please assist urgently.",
      category_id: categories[0]._id,
      priority: "high",
      status: "in_progress",
      source: "phone",
      assigned_agent_id: agents[1]._id,
      created_by_agent_id: agents[0]._id,
      tags: ["water", "urgent", "block-a", "seed"],
      // FIX: CustomerTicket's field is `sla_due_date`, not `sla_deadline`.
      sla_due_date: new Date(Date.now() + 4 * 3600000),
      created_at: new Date(Date.now() - 2 * 3600000),
    },
    {
      ticket_number: makeTicketNum(),
      customer_id: customers[1]._id,
      facility_id: facility._id,
      title: "Incorrect charge on November invoice",
      description:
        "My November invoice shows 85 units water consumption but my meter reading was only 42 units. I believe I have been overcharged.",
      category_id: categories[1]._id,
      priority: "medium",
      status: "open",
      source: "email",
      created_by_agent_id: agents[0]._id,
      tags: ["billing", "invoice", "dispute", "seed"],
      sla_due_date: new Date(Date.now() + 24 * 3600000),
      created_at: new Date(Date.now() - 5 * 3600000),
    },
    {
      ticket_number: makeTicketNum(),
      customer_id: customers[2]._id,
      facility_id: facility._id,
      title: "Request for parking allocation change",
      description:
        "I would like to change my parking bay from P12 to P15, which is closer to the lift lobby.",
      category_id: categories[2]._id,
      priority: "low",
      status: "resolved",
      source: "whatsapp",
      assigned_agent_id: agents[0]._id,
      created_by_agent_id: agents[0]._id,
      tags: ["parking", "general", "seed"],
      sla_due_date: new Date(Date.now() + 72 * 3600000),
      resolved_at: new Date(Date.now() - 1 * 3600000),
      created_at: new Date(Date.now() - 24 * 3600000),
    },
    {
      ticket_number: makeTicketNum(),
      customer_id: customers[0]._id,
      facility_id: facility._id,
      title: "Intercom system not working in Block A",
      description:
        "The Block A entrance intercom has not been working for 3 days. Visitors cannot notify us on arrival — this is a security concern.",
      category_id: categories[0]._id,
      priority: "high",
      status: "closed",
      source: "phone",
      assigned_agent_id: agents[1]._id,
      created_by_agent_id: agents[0]._id,
      tags: ["security", "intercom", "block-a", "seed"],
      sla_due_date: new Date(Date.now() - 12 * 3600000),
      resolved_at: new Date(Date.now() - 48 * 3600000),
      created_at: new Date(Date.now() - 72 * 3600000),
    },
  ];

  for (const td of ticketDefs) {
    const exists = await CustomerTicket.findOne({
      ticket_number: td.ticket_number,
    });
    if (!exists) {
      const t = await new CustomerTicket(td).save();
      log(`+ Ticket [${t.status}]: "${t.title.substring(0, 55)}"`);
    }
  }

  section("11 · Customer Obsession — Knowledge Base");
  const articleDefs = [
    {
      title: "How to read your prepaid water meter",
      content: `## Reading Your Prepaid Water Meter\n\nYour prepaid water meter shows your current balance in cubic metres (m\u00b3).\n\n### Steps\n1. Locate the meter cabinet in your unit or corridor.\n2. Press the information button to cycle through readings.\n3. The display shows **balance**, **total consumption**, and **last top-up**.\n\n### Top-up methods\n- **M-Pesa:** Paybill 247247, Account = your meter number.\n- **Resident Portal:** Log in and use the top-up feature.\n\nContact the helpdesk for further assistance.`,
      summary:
        "Step-by-step guide for reading your prepaid water meter and topping up.",
      category_id: categories[0]._id,
      tags: ["water", "meter", "prepaid", "top-up"],
      status: "published",
      visibility: "public",
      is_featured: true,
      author_id: adminUser._id,
      created_by: adminUser._id,
      updated_by: adminUser._id,
      views_count: 14,
      helpful_count: 11,
      not_helpful_count: 1,
    },
    {
      title: "Understanding your monthly invoice — draft",
      content: `## Monthly Invoice Breakdown\n\nYour monthly invoice includes:\n- **Water consumption** — based on meter readings.\n- **Sewer/drainage levy** — fixed percentage of water charge.\n- **Service charge** — facility maintenance fund.\n- **VAT** — where applicable.\n\n_Under review by the Billing team before publication._`,
      summary: "Draft explanation of all line items on your monthly invoice.",
      category_id: categories[1]._id,
      tags: ["billing", "invoice", "charges"],
      status: "draft",
      visibility: "internal",
      is_featured: false,
      author_id: agents[2]._id,
      created_by: agents[2]._id,
      updated_by: agents[2]._id,
      views_count: 3,
      helpful_count: 2,
      not_helpful_count: 0,
    },
  ];
  for (const ad of articleDefs) {
    const exists = await KnowledgeBase.findOne({ title: ad.title });
    if (!exists) {
      const article = await new KnowledgeBase({
        ...ad,
        created_at: new Date(),
        updated_at: new Date(),
      }).save();
      log(`+ Article: "${article.title}"  [${article.status}]`);
    } else {
      log(`= Article exists: "${exists.title}"`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // UTILITY — Water Accounts & Invoices
  // ════════════════════════════════════════════════════════════════════════
  section("12 · Utility — Water Meter Accounts");
  const WaterMeterAccount = bindModel(utilConn, "WaterMeterAccount");
  const WaterPrepaidCredit = bindModel(utilConn, "WaterPrepaidCredit");
  const WaterPrepaidDebit = bindModel(utilConn, "WaterPrepaidDebit");
  const SmsNotification = bindModel(utilConn, "SmsNotification");
  const WaterInvoice = bindModel(utilConn, "WaterInvoice");

  // Prepaid account (Alice — unit A101)  → low-balance SMS trigger scenario
  let prepaidAccount = await WaterMeterAccount.findOne({
    account_no: "SEED-WTR-PREPAID-001",
  });
  if (!prepaidAccount) {
    prepaidAccount = await new WaterMeterAccount({
      facilityId: facility._id,
      account_no: "SEED-WTR-PREPAID-001",
      customerId: customers[0]._id,
      customerName: "Alice Wambua",
      phoneNumber: "+254712001001",
      email: "alice.wambua@seedtest.example.com",
      meterNumber: "WM-SEED-001",
      unitId: units[0]._id,
      payment_type: "Prepaid",
      previousReading: 220,
      currentReading: 270,
      status: "Active",
      accountBalance: 150, // low → triggers SMS cron
    }).save();
    log(`+ Prepaid account: ${prepaidAccount.account_no}  (balance: 150 L)`);

    await new WaterPrepaidCredit({
      accountId: prepaidAccount._id,
      meterId: prepaidAccount._id,
      ref: "SEED-CR-001",
      amount: 500,
      time: "08:00:00",
      addedOn: new Date().toISOString().slice(0, 10),
      reason: "Seed top-up",
      type: "Mobile Money",
    }).save();
    await new WaterPrepaidDebit({
      accountId: prepaidAccount._id,
      meterId: prepaidAccount._id,
      prev_reading: 220,
      current_reading: 270,
      consumption: 1.4,
      rate: "250",
      totalAmount: 350,
      date: new Date().toISOString().slice(0, 10),
      time: "08:01:00",
    }).save();
    // Pre-set higher range so next cron sees a change and fires the low-balance alert
    await new SmsNotification({
      accountId: prepaidAccount._id,
      currentRange: "500-800",
      balance: 600,
      lastNotificationDate: new Date(Date.now() - 25 * 3600000),
    }).save();
    log(
      "  ✓ Credits / debits / SmsNotification seeded for low-balance SMS scenario",
    );
  } else {
    log(`= Prepaid account exists: ${prepaidAccount.account_no}`);
  }

  // Postpaid account (Brian — unit A102)
  let postpaidAccount = await WaterMeterAccount.findOne({
    account_no: "SEED-WTR-POSTPAID-001",
  });
  if (!postpaidAccount) {
    postpaidAccount = await new WaterMeterAccount({
      facilityId: facility._id,
      account_no: "SEED-WTR-POSTPAID-001",
      customerId: customers[1]._id,
      customerName: "Brian Mwenda",
      phoneNumber: "+254712001002",
      email: "brian.mwenda@seedtest.example.com",
      meterNumber: "WM-SEED-002",
      unitId: units[1]._id,
      payment_type: "Postpaid",
      previousReading: 410,
      currentReading: 475,
      status: "Active",
      accountBalance: 0,
    }).save();
    log(`+ Postpaid account: ${postpaidAccount.account_no}`);
  } else {
    log(`= Postpaid account exists: ${postpaidAccount.account_no}`);
  }

  section("13 · Utility — Water Invoices");
  // BillerAddress.email is validated with /^\w+([\.-]?\w+)@\w+([\.-]?\w+)(\.\w{2,3})+$/
  // Use a simple address with no hyphens before the @
  const billerAddress = {
    name: "Zuri Heights",
    email: "billing@seedresidences.example.com",
    phone: "+254700000100",
    address: "P O Box 00100",
    city: "Nairobi",
  };

  const overdueExists = await WaterInvoice.findOne({
    invoiceNumber: "WTR-SEED-OVERDUE-001",
  });
  if (!overdueExists) {
    const overdue = await new WaterInvoice({
      invoiceNumber: "WTR-SEED-OVERDUE-001",
      accountNumber: "SEED-WTR-POSTPAID-001",
      unitName: "A102",
      yearMonth: "2026-05",
      facilityId: facility._id,
      customerId: customers[1]._id,
      // FIX: WaterInvoice.billingType enum is only ['postpaid'] — that's
      // fine here, this invoice is genuinely postpaid.
      billingType: "postpaid",
      balanceBroughtForward: 0,
      billerAddress,
      dueDate: new Date(Date.now() - 5 * 86400000), // 5 days overdue
      meterNumber: "WM-SEED-002",
      meterReadings: {
        previousReading: 410,
        currentReading: 475,
        usage: 65,
      },
      consumptionPeriod: {
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-31"),
      },
      charges: {
        waterCharge: 1625,
        sewerCharge: 325,
        tax: 0,
        fixedCharge: 200,
        totalMonthlyBill: 2150,
      },
      amountPaid: 0,
      status: "Pending",
      currency: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
      dateIssued: new Date(Date.now() - 35 * 86400000),
    }).save();
    log(
      `+ Overdue invoice: ${overdue.invoiceNumber}  (due ${overdue.dueDate.toISOString().slice(0, 10)})`,
    );
  } else {
    log(`= Overdue invoice exists: ${overdueExists.invoiceNumber}`);
  }

  const currentExists = await WaterInvoice.findOne({
    invoiceNumber: "WTR-SEED-CURRENT-001",
  });
  if (!currentExists) {
    const current = await new WaterInvoice({
      invoiceNumber: "WTR-SEED-CURRENT-001",
      accountNumber: "SEED-WTR-PREPAID-001",
      unitName: "A101",
      yearMonth: new Date().toISOString().slice(0, 7),
      facilityId: facility._id,
      customerId: customers[0]._id,
      // FIX: WaterInvoice.billingType enum only accepts 'postpaid'. This
      // invoice is for the prepaid account, so we simply omit the field
      // instead of passing the unsupported value "prepaid" (which crashed
      // on save with "billingType is not a valid enum value").
      balanceBroughtForward: 0,
      billerAddress,
      dueDate: new Date(Date.now() + 10 * 86400000), // due in 10 days
      meterNumber: "WM-SEED-001",
      meterReadings: {
        previousReading: 220,
        currentReading: 270,
        usage: 50,
      },
      consumptionPeriod: {
        startDate: new Date(Date.now() - 30 * 86400000),
        endDate: new Date(),
      },
      charges: {
        waterCharge: 1250,
        sewerCharge: 250,
        tax: 0,
        fixedCharge: 200,
        totalMonthlyBill: 1700,
      },
      amountPaid: 0,
      status: "Pending",
      // FIX: `currency` is a nested object in the schema ({id, name, code,
      // symbol}), not a plain string — passing "KES" was silently dropped.
      currency: { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
      dateIssued: new Date(),
    }).save();
    log(
      `+ Current invoice: ${current.invoiceNumber}  (due ${current.dueDate.toISOString().slice(0, 10)})`,
    );
  } else {
    log(`= Current invoice exists: ${currentExists.invoiceNumber}`);
  }

  // ════════════════════════════════════════════════════════════════════════
  // MOVE-IN — always wiped and re-seeded for a clean slate
  // ════════════════════════════════════════════════════════════════════════
  section("14 · Move-In — Landlords & Tenants");

  const LandlordUser = moveinConn.model(
    "MoveInLandlordUser",
    LandlordUserSchema,
  );
  const MoveInUser = moveinConn.model("MoveInUser", MoveInTenantSchema);
  const MoveInUnit = moveinConn.model("MoveInUnit", MoveInUnitSchema);
  const ViewingSlot = moveinConn.model("MoveInViewingSlot", ViewingSlotSchema);
  const Application = moveinConn.model(
    "MoveInApplication",
    MoveInApplicationSchema,
  );
  const Conversation = moveinConn.model(
    "MoveInConversation",
    ConversationSchema,
  );
  const Message = moveinConn.model("MoveInMessage", MessageSchema);

  await Promise.all([
    LandlordUser.deleteMany({}),
    MoveInUser.deleteMany({}),
    MoveInUnit.deleteMany({}),
    ViewingSlot.deleteMany({}),
    Application.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);
  log("✓ Move-In collections cleared");

  const [ll1, ll2] = await LandlordUser.insertMany([
    {
      fullName: "James Kariuki",
      email: "james.kariuki@movein.example.com",
      phoneNumber: "+254711300001",
      password: hash,
      companyName: "Kariuki Properties Ltd",
      isEnabled: true,
    },
    {
      fullName: "Wanjiku Mwangi",
      email: "wanjiku.mwangi@movein.example.com",
      phoneNumber: "+254722300002",
      password: hash,
      companyName: "Mwangi Real Estate",
      isEnabled: true,
    },
  ]);
  log(`+ Landlords: ${ll1.fullName} / ${ll2.fullName}`);

  const [mt1, mt2, mt3] = await MoveInUser.insertMany([
    {
      fullName: "Kevin Odhiambo",
      email: "kevin.odhiambo@movein.example.com",
      phoneNumber: "+254700400001",
      password: hash,
      nationalId: "32500001",
      occupation: "Software Engineer",
      emergencyContactName: "Mary Odhiambo",
      emergencyContactPhone: "+254700400099",
    },
    {
      fullName: "Aisha Abdi",
      email: "aisha.abdi@movein.example.com",
      phoneNumber: "+254700400002",
      password: hash,
      nationalId: "32500002",
      occupation: "Nurse",
      emergencyContactName: "Hassan Abdi",
      emergencyContactPhone: "+254700400098",
    },
    {
      fullName: "Brian Njoroge",
      email: "brian.njoroge@movein.example.com",
      phoneNumber: "+254700400003",
      password: hash,
      nationalId: "32500003",
      occupation: "Accountant",
      emergencyContactName: "Grace Njoroge",
      emergencyContactPhone: "+254700400097",
    },
  ]);
  log(`+ Tenants: ${mt1.fullName} / ${mt2.fullName} / ${mt3.fullName}`);

  section("15 · Move-In — Listings");
  const listings = await MoveInUnit.insertMany([
    {
      landlordId: ll1._id,
      title: "Modern 2BR Apartment — Westlands",
      description:
        "Bright, fully furnished 2-bedroom apartment on the 5th floor with stunning city views. 24-hour security and covered parking included.",
      listingType: "Apartment",
      bedrooms: 2,
      bathrooms: 2,
      grossArea: 85,
      price: 65000,
      location: {
        address: "Waiyaki Way, Westlands",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.2631, lng: 36.8063 },
      },
      amenities: [
        "Parking",
        "Security",
        "Wi-Fi",
        "Gym",
        "Swimming Pool",
        "CCTV",
      ],
      images: [
        {
          category: "Living Room",
          label: "Open-plan living",
          url: `${IMG}/livingroom-01.jpg`,
        },
        {
          category: "Bedroom",
          label: "Master bedroom",
          url: `${IMG}/bedroom-01.jpg`,
        },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
    {
      landlordId: ll1._id,
      title: "Cosy Studio — Kilimani",
      description:
        "Self-contained studio with kitchenette and balcony. Walking distance from Junction Mall.",
      listingType: "Studio",
      bedrooms: 0,
      bathrooms: 1,
      grossArea: 35,
      price: 28000,
      location: {
        address: "Ngong Road, Kilimani",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.2896, lng: 36.7825 },
      },
      amenities: ["Security", "Wi-Fi", "Water 24/7", "Borehole"],
      images: [
        {
          category: "Living Room",
          label: "Studio space",
          url: `${IMG}/studio-01.jpg`,
        },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
    {
      landlordId: ll1._id,
      title: "Spacious 3BR Maisonette — Karen",
      description:
        "Elegant maisonette on a quiet road in Karen. Large garden, servant quarter, and private garage.",
      listingType: "Maisonette",
      bedrooms: 3,
      bathrooms: 3,
      grossArea: 160,
      price: 120000,
      location: {
        address: "Marula Lane, Karen",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.3517, lng: 36.7087 },
      },
      amenities: [
        "Garden",
        "Parking",
        "Security",
        "Servant Quarter",
        "Generator",
        "Water Tank",
      ],
      images: [
        {
          category: "Living Room",
          label: "Formal lounge",
          url: `${IMG}/lounge-01.jpg`,
        },
        {
          category: "Exterior",
          label: "Building front",
          url: `${IMG}/exterior-01.jpg`,
        },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
    {
      landlordId: ll2._id,
      title: "Bedsitter — South B",
      description:
        "Affordable bedsitter on the 2nd floor. Water, security, and refuse collection included.",
      listingType: "Bedsitter",
      bedrooms: 1,
      bathrooms: 1,
      grossArea: 22,
      price: 12000,
      location: {
        address: "Mombasa Road, South B",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.3118, lng: 36.8469 },
      },
      amenities: ["Security", "Water 24/7", "Refuse Collection"],
      images: [
        {
          category: "Bedroom",
          label: "Room view",
          url: `${IMG}/bedsitter-01.jpg`,
        },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
    {
      landlordId: ll2._id,
      title: "1BR Apartment — Lavington",
      description:
        "Modern one-bedroom apartment in leafy Lavington. Fitted wardrobes, modern kitchen, fibre internet.",
      listingType: "Apartment",
      bedrooms: 1,
      bathrooms: 1,
      grossArea: 55,
      price: 42000,
      location: {
        address: "James Gichuru Road, Lavington",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.2784, lng: 36.7679 },
      },
      amenities: [
        "Parking",
        "Security",
        "Fibre Internet",
        "CCTV",
        "Water 24/7",
      ],
      images: [
        {
          category: "Living Room",
          label: "Lounge",
          url: `${IMG}/lounge-02.jpg`,
        },
        { category: "Bedroom", label: "Bedroom", url: `${IMG}/bedroom-02.jpg` },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
    {
      landlordId: ll2._id,
      title: "Penthouse 4BR — Upperhill",
      description:
        "Premium penthouse on the 18th floor with panoramic Nairobi views. Open-plan design and chef's kitchen.",
      listingType: "Apartment",
      bedrooms: 4,
      bathrooms: 4,
      grossArea: 240,
      price: 280000,
      location: {
        address: "Upperhill Road, Upperhill",
        city: "Nairobi",
        county: "Nairobi",
        coordinates: { lat: -1.2961, lng: 36.8182 },
      },
      amenities: [
        "Parking x2",
        "Concierge",
        "Gym",
        "Pool",
        "Rooftop Terrace",
        "Backup Generator",
        "Smart Home",
      ],
      images: [
        {
          category: "Living Room",
          label: "Penthouse living",
          url: `${IMG}/penthouse-01.jpg`,
        },
        {
          category: "Exterior",
          label: "Building exterior",
          url: `${IMG}/exterior-02.jpg`,
        },
      ],
      moveInApproval: "approved",
      isListed: true,
    },
  ]);
  log(`+ Created ${listings.length} listings`);

  section("16 · Move-In — Viewing Slots");
  await ViewingSlot.insertMany([
    {
      landlordId: ll1._id,
      unitId: listings[0]._id,
      unitName: listings[0].title,
      date: daysFrom(1),
      time: "10:00",
      durationMins: 30,
      capacity: 2,
    },
    {
      landlordId: ll1._id,
      unitId: listings[0]._id,
      unitName: listings[0].title,
      date: daysFrom(1),
      time: "14:00",
      durationMins: 30,
      capacity: 2,
    },
    {
      landlordId: ll1._id,
      unitId: listings[1]._id,
      unitName: listings[1].title,
      date: daysFrom(2),
      time: "09:00",
      durationMins: 45,
      capacity: 1,
    },
    {
      landlordId: ll1._id,
      unitId: listings[2]._id,
      unitName: listings[2].title,
      date: daysFrom(2),
      time: "11:00",
      durationMins: 60,
      capacity: 3,
    },
    {
      landlordId: ll2._id,
      unitId: listings[3]._id,
      unitName: listings[3].title,
      date: daysFrom(3),
      time: "10:30",
      durationMins: 30,
      capacity: 2,
    },
    {
      landlordId: ll2._id,
      unitId: listings[4]._id,
      unitName: listings[4].title,
      date: daysFrom(3),
      time: "15:00",
      durationMins: 30,
      capacity: 2,
    },
    {
      landlordId: ll2._id,
      unitId: listings[5]._id,
      unitName: listings[5].title,
      date: daysFrom(5),
      time: "10:00",
      durationMins: 60,
      capacity: 1,
    },
    {
      landlordId: ll2._id,
      unitId: listings[5]._id,
      unitName: listings[5].title,
      date: daysFrom(5),
      time: "14:00",
      durationMins: 60,
      capacity: 1,
    },
  ]);
  log("+ Created 8 viewing slots");

  section("17 · Move-In — Applications");
  const mvin1 = daysFrom(30);
  const mvin2 = daysFrom(45);
  const dummyFacId = new mongoose.Types.ObjectId();

  await Application.insertMany([
    {
      unitId: listings[0]._id,
      facilityId: dummyFacId,
      unitName: listings[0].title,
      facilityName: "Westlands Heights",
      tenantId: mt1._id,
      tenantName: mt1.fullName,
      tenantEmail: mt1.email,
      tenantPhone: mt1.phoneNumber,
      desiredMoveInDate: mvin1,
      message:
        "I have been working in Westlands for 3 years — this location is ideal for me.",
      status: "pending",
      landlordId: ll1._id,
    },
    {
      unitId: listings[1]._id,
      facilityId: dummyFacId,
      unitName: listings[1].title,
      facilityName: "Kilimani Studios",
      tenantId: mt2._id,
      tenantName: mt2.fullName,
      tenantEmail: mt2.email,
      tenantPhone: mt2.phoneNumber,
      desiredMoveInDate: mvin2,
      message:
        "The studio looks perfect. I am a nurse at Nairobi Hospital which is nearby.",
      status: "approved",
      adminNote: "Background check passed.",
      landlordId: ll1._id,
    },
    {
      unitId: listings[4]._id,
      facilityId: dummyFacId,
      unitName: listings[4].title,
      facilityName: "Lavington Gardens",
      tenantId: mt3._id,
      tenantName: mt3.fullName,
      tenantEmail: mt3.email,
      tenantPhone: mt3.phoneNumber,
      desiredMoveInDate: mvin1,
      message:
        "I have lived in Lavington for 2 years and love the neighbourhood.",
      status: "pending",
      landlordId: ll2._id,
    },
    {
      unitId: listings[3]._id,
      facilityId: dummyFacId,
      unitName: listings[3].title,
      facilityName: "South B Apartments",
      tenantId: mt1._id,
      tenantName: mt1.fullName,
      tenantEmail: mt1.email,
      tenantPhone: mt1.phoneNumber,
      desiredMoveInDate: mvin2,
      message:
        "Looking for a temporary place while my main apartment is being renovated.",
      status: "rejected",
      adminNote: "Unit reserved for another applicant.",
      landlordId: ll2._id,
    },
  ]);
  log("+ Created 4 applications  (pending / approved / pending / rejected)");

  section("18 · Move-In — Conversations & Messages");
  const conv1 = await new Conversation({
    tenantId: mt1._id,
    landlordId: ll1._id,
    unitId: listings[0]._id,
    unitName: listings[0].title,
    lastMessage: "Looking forward to the viewing!",
    lastMessageAt: now,
    tenantUnread: 0,
    landlordUnread: 1,
    status: "active",
  }).save();
  const conv2 = await new Conversation({
    tenantId: mt2._id,
    landlordId: ll2._id,
    unitId: listings[4]._id,
    unitName: listings[4].title,
    lastMessage: "Can I see it this weekend?",
    lastMessageAt: new Date(now - 3600000),
    tenantUnread: 0,
    landlordUnread: 1,
    status: "active",
  }).save();

  await Message.insertMany([
    {
      conversationId: conv1._id,
      senderId: mt1._id,
      senderType: "tenant",
      body: "Hi, I just submitted an application for the Westlands apartment. Is it still available?",
      isRead: true,
      readAt: new Date(now - 7200000),
      createdAt: new Date(now - 7200000),
    },
    {
      conversationId: conv1._id,
      senderId: ll1._id,
      senderType: "landlord",
      body: "Hello Kevin! Yes it is still available. Your application looks good — would you like to book a viewing?",
      isRead: true,
      readAt: new Date(now - 3600000),
      createdAt: new Date(now - 3600000),
    },
    {
      conversationId: conv1._id,
      senderId: mt1._id,
      senderType: "tenant",
      body: "Looking forward to the viewing!",
      isRead: false,
      createdAt: now,
    },
    {
      conversationId: conv2._id,
      senderId: mt2._id,
      senderType: "tenant",
      body: "Good afternoon. I saw your 1BR listing in Lavington and I am very interested.",
      isRead: true,
      readAt: new Date(now - 5400000),
      createdAt: new Date(now - 5400000),
    },
    {
      conversationId: conv2._id,
      senderId: ll2._id,
      senderType: "landlord",
      body: "Hi Aisha! The apartment is available from the 1st of next month. What dates work for a viewing?",
      isRead: true,
      readAt: new Date(now - 4000000),
      createdAt: new Date(now - 4000000),
    },
    {
      conversationId: conv2._id,
      senderId: mt2._id,
      senderType: "tenant",
      body: "Can I see it this weekend?",
      isRead: false,
      createdAt: new Date(now - 3600000),
    },
  ]);
  log("+ Created 2 conversations with 6 messages");

  // ── Close ─────────────────────────────────────────────────────────────
  await propertyConn.close();
  await moveinConn.close();
  await utilConn.close();

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  ✅  SEED COMPLETE                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CORE PORTAL  (Password: Password123)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Admin:     ${SEED_ADMIN_EMAIL}
 Company:   Seed Properties Ltd  (PIN: ${SEED_COMPANY_PIN})
 Facility:  Zuri Heights      (DB:  ${FACILITY_DB})

 Customers (15): alice.wambua, brian.mwenda, carol.njeri, dennis.kiptoo,
   esther.nyambura, felix.omondi, grace.wairimu, hassan.mohamed,
   irene.achieng, joseph.mutiso, karen.cherono, lawrence.otieno,
   mary.auma, nicholas.kamau, olive.chebet   (all @seedtest.example.com)

 Units: A101..A102 + A103..A114 (Occupied) | B201 (Vacant) | PH-01 (Occupied)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 CUSTOMER OBSESSION  (Password: Password123)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 david.otieno.agent@example.com   — call_center_agent  (GENERAL)
 faith.kamau.agent@example.com    — team_leader        (TECH)
 george.kiprop.agent@example.com  — supervisor         (BILLING)

 Tickets:
   [in_progress]  No water in unit A101 since morning
   [open       ]  Incorrect charge on November invoice
   [resolved   ]  Request for parking allocation change
   [closed     ]  Intercom system not working in Block A

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 MOVE-IN  (Password: Password123)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Landlords:  james.kariuki / wanjiku.mwangi  (@movein.example.com)
 Tenants:    kevin.odhiambo / aisha.abdi / brian.njoroge  (@movein.example.com)
 Listings:   6  |  Viewing slots: 8  |  Applications: 4  |  Conversations: 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 UTILITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 SEED-WTR-PREPAID-001   Alice Wambua  WM-SEED-001  balance:150L
   → SmsNotification seeded at range '500-800' so next cron fires low-balance alert
 SEED-WTR-POSTPAID-001  Brian Mwenda  WM-SEED-002
   → Overdue invoice WTR-SEED-OVERDUE-001 (due 5 days ago)
   → Current invoice WTR-SEED-CURRENT-001 (due in 10 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

seed().catch((err) => {
  console.error("\n❌  SEED FAILED:", err.message);
  console.error(err.stack);
  process.exit(1);
});
