/**
 * Move-In seed script
 * Run from payserve_backend root: node src/scripts/seed_movein.js
 *
 * Creates:
 *   - 2 MoveInLandlordUsers (standalone, password: Password123)
 *   - 3 MoveInUsers / tenants   (password: Password123)
 *   - 6 MoveInUnits with images
 *   - 8 MoveInViewingSlots
 *   - 4 MoveInApplications
 *   - 2 MoveInConversations + 6 MoveInMessages
 *
 * All images must be served from move_in/public/images/
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

// ── DB connection ────────────────────────────────────────────────────────────
const MONGO_URL =
  'mongodb://Ps:Letmein987@127.0.0.1:27017/payserve_movein?authSource=admin';

// ── Image base URL (as served by move_in React dev server / build) ──────────
const IMG = '/images';

// ── Schemas (inline — avoids payservedb wiring complexity in a one-off script) ─
const ObjectId = mongoose.Schema.Types.ObjectId;

const LandlordUserSchema = new mongoose.Schema({
  fullName:       { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true },
  phoneNumber:    { type: String, required: true, unique: true },
  password:       { type: String, default: 'MANAGED_BY_PAYSERVE' },
  companyName:    { type: String, default: null },
  isEnabled:      { type: Boolean, default: true },
  payserveUserId: { type: ObjectId, default: null },
}, { timestamps: true });

const TenantUserSchema = new mongoose.Schema({
  fullName:              { type: String, required: true },
  email:                 { type: String, required: true, unique: true, lowercase: true },
  phoneNumber:           { type: String, required: true, unique: true },
  password:              { type: String, required: true },
  isEnabled:             { type: Boolean, default: true },
  nationalId:            { type: String },
  occupation:            { type: String },
  emergencyContactName:  { type: String },
  emergencyContactPhone: { type: String },
}, { timestamps: true });

const UnitSchema = new mongoose.Schema({
  landlordId:   { type: ObjectId, required: true },
  title:        { type: String, required: true },
  description:  { type: String, default: null },
  listingType:  { type: String, enum: ['Apartment','Studio','Bedsitter','Bungalow','Maisonette','Townhouse','Villa','Office'], default: null },
  bedrooms:     { type: Number, default: null },
  bathrooms:    { type: Number, default: null },
  grossArea:    { type: Number, default: null },
  price:        { type: Number, required: true },
  location: {
    address:     { type: String, default: null },
    city:        { type: String, default: null },
    county:      { type: String, default: null },
    coordinates: { lat: { type: Number, default: null }, lng: { type: Number, default: null } },
  },
  amenities:    { type: [String], default: [] },
  images: [{
    category: { type: String, default: 'Other' },
    label:    { type: String, default: '' },
    url:      { type: String, required: true },
  }],
  moveInApproval: { type: String, enum: ['pending','approved','rejected'], default: 'approved' },
  isListed:     { type: Boolean, default: true },
}, { timestamps: true });

const ViewingSlotSchema = new mongoose.Schema({
  landlordId:   { type: ObjectId, required: true },
  unitId:       { type: ObjectId, required: true },
  unitName:     { type: String, default: null },
  facilityId:   { type: ObjectId, default: null },
  date:         { type: Date, required: true },
  time:         { type: String, required: true },
  durationMins: { type: Number, default: 30 },
  capacity:     { type: Number, default: 2 },
  bookedCount:  { type: Number, default: 0 },
  isAvailable:  { type: Boolean, default: true },
}, { timestamps: true });

const ApplicationSchema = new mongoose.Schema({
  unitId:            { type: ObjectId, required: true },
  facilityId:        { type: ObjectId, required: true },
  unitName:          { type: String, default: null },
  facilityName:      { type: String, default: null },
  tenantId:          { type: ObjectId, required: true },
  tenantName:        { type: String, default: null },
  tenantEmail:       { type: String, default: null },
  tenantPhone:       { type: String, default: null },
  desiredMoveInDate: { type: Date, default: null },
  message:           { type: String, default: null },
  status:            { type: String, enum: ['pending','assigned','approved','rejected','completed'], default: 'pending' },
  adminNote:         { type: String, default: null },
  assignedAt:        { type: Date, default: null },
  landlordId:        { type: ObjectId, default: null },
}, { timestamps: true });

const ConversationSchema = new mongoose.Schema({
  tenantId:      { type: ObjectId, required: true },
  landlordId:    { type: ObjectId, required: true },
  unitId:        { type: ObjectId, required: true },
  unitName:      { type: String, default: null },
  lastMessage:   { type: String, default: null },
  lastMessageAt: { type: Date, default: null },
  tenantUnread:  { type: Number, default: 0 },
  landlordUnread:{ type: Number, default: 0 },
  status:        { type: String, enum: ['active','closed'], default: 'active' },
}, { timestamps: true });

const MessageSchema = new mongoose.Schema({
  conversationId: { type: ObjectId, required: true },
  senderId:       { type: ObjectId, required: true },
  senderType:     { type: String, enum: ['tenant','landlord'], required: true },
  body:           { type: String, required: true },
  type:           { type: String, enum: ['text','image'], default: 'text' },
  attachmentUrl:  { type: String, default: null },
  isRead:         { type: Boolean, default: false },
  readAt:         { type: Date, default: null },
}, { timestamps: true });

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to payserve_movein');

  // Register models on this connection
  const LandlordUser   = mongoose.model('MoveInLandlordUser', LandlordUserSchema);
  const TenantUser     = mongoose.model('MoveInUser',         TenantUserSchema);
  const Unit           = mongoose.model('MoveInUnit',         UnitSchema);
  const ViewingSlot    = mongoose.model('MoveInViewingSlot',  ViewingSlotSchema);
  const Application    = mongoose.model('MoveInApplication',  ApplicationSchema);
  const Conversation   = mongoose.model('MoveInConversation', ConversationSchema);
  const Message        = mongoose.model('MoveInMessage',      MessageSchema);

  // ── Wipe existing seed data ──────────────────────────────────────────────
  await Promise.all([
    LandlordUser.deleteMany({}),
    TenantUser.deleteMany({}),
    Unit.deleteMany({}),
    ViewingSlot.deleteMany({}),
    Application.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
  ]);
  console.log('Cleared existing Move-In data');

  // ── Hash password ────────────────────────────────────────────────────────
  const hash = await bcrypt.hash('Password123', 10);

  // ── Landlords ────────────────────────────────────────────────────────────
  const [landlord1, landlord2] = await LandlordUser.insertMany([
    {
      fullName:    'James Kariuki',
      email:       'james.kariuki@example.com',
      phoneNumber: '+254711000001',
      password:    hash,
      companyName: 'Kariuki Properties Ltd',
      isEnabled:   true,
    },
    {
      fullName:    'Wanjiku Mwangi',
      email:       'wanjiku.mwangi@example.com',
      phoneNumber: '+254722000002',
      password:    hash,
      companyName: 'Mwangi Real Estate',
      isEnabled:   true,
    },
  ]);
  console.log('Created 2 landlords');

  // ── Tenants ──────────────────────────────────────────────────────────────
  const [tenant1, tenant2, tenant3] = await TenantUser.insertMany([
    {
      fullName:              'Kevin Odhiambo',
      email:                 'kevin.odhiambo@example.com',
      phoneNumber:           '+254700111001',
      password:              hash,
      nationalId:            '32001122',
      occupation:            'Software Engineer',
      emergencyContactName:  'Mary Odhiambo',
      emergencyContactPhone: '+254700111099',
    },
    {
      fullName:              'Aisha Abdi',
      email:                 'aisha.abdi@example.com',
      phoneNumber:           '+254700111002',
      password:              hash,
      nationalId:            '32001133',
      occupation:            'Nurse',
      emergencyContactName:  'Hassan Abdi',
      emergencyContactPhone: '+254700111098',
    },
    {
      fullName:              'Brian Njoroge',
      email:                 'brian.njoroge@example.com',
      phoneNumber:           '+254700111003',
      password:              hash,
      nationalId:            '32001144',
      occupation:            'Accountant',
      emergencyContactName:  'Grace Njoroge',
      emergencyContactPhone: '+254700111097',
    },
  ]);
  console.log('Created 3 tenants');

  // ── Units ────────────────────────────────────────────────────────────────
  const dummyFacilityId = new mongoose.Types.ObjectId();

  const units = await Unit.insertMany([
    {
      landlordId:  landlord1._id,
      title:       'Modern 2BR Apartment — Westlands',
      description: 'Bright, fully furnished 2-bedroom apartment on the 5th floor with a stunning city view. Perfect for working professionals. 24-hour security and covered parking included.',
      listingType: 'Apartment',
      bedrooms:    2,
      bathrooms:   2,
      grossArea:   85,
      price:       65000,
      location: {
        address: 'Waiyaki Way, Westlands',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.2631, lng: 36.8063 },
      },
      amenities: ['Parking', 'Security', 'Wi-Fi', 'Gym', 'Swimming Pool', 'CCTV'],
      images: [
        { category: 'Living Room', label: 'Open-plan living', url: `${IMG}/keresi72-room-416049_1280.jpg` },
        { category: 'Bedroom',     label: 'Master bedroom',   url: `${IMG}/jarmoluk-apartment-2094674_1280.jpg` },
        { category: 'Kitchen',     label: 'Fitted kitchen',   url: `${IMG}/piro4d-kitchen-1543493_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
    {
      landlordId:  landlord1._id,
      title:       'Cosy Studio — Kilimani',
      description: 'Self-contained studio with a kitchenette and a balcony. Located within walking distance of Junction Mall and Yaya Centre. Ideal for a single professional.',
      listingType: 'Studio',
      bedrooms:    0,
      bathrooms:   1,
      grossArea:   35,
      price:       28000,
      location: {
        address: 'Ngong Road, Kilimani',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.2896, lng: 36.7825 },
      },
      amenities: ['Security', 'Wi-Fi', 'Water 24/7', 'Borehole'],
      images: [
        { category: 'Living Room', label: 'Studio space',  url: `${IMG}/jarmoluk-apartment-2094701_1280.jpg` },
        { category: 'Bedroom',     label: 'Sleeping area', url: `${IMG}/xinyutouxinliang-furniture-3062400_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
    {
      landlordId:  landlord1._id,
      title:       'Spacious 3BR Maisonette — Karen',
      description: 'Elegant maisonette on a quiet road in Karen. Features a large garden, servant quarter, and a private garage. Ideal for a family.',
      listingType: 'Maisonette',
      bedrooms:    3,
      bathrooms:   3,
      grossArea:   160,
      price:       120000,
      location: {
        address: 'Marula Lane, Karen',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.3517, lng: 36.7087 },
      },
      amenities: ['Garden', 'Parking', 'Security', 'Servant Quarter', 'Generator', 'Water Tank'],
      images: [
        { category: 'Living Room', label: 'Formal lounge',  url: `${IMG}/dr_brain-interior-3001598_1280.jpg` },
        { category: 'Living Room', label: 'Open living area',url: `${IMG}/andremergulhaum-living-room-930804_1920.jpg` },
        { category: 'Exterior',    label: 'Building front', url: `${IMG}/andreas160578-apartment-2138949_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
    {
      landlordId:  landlord2._id,
      title:       'Bedsitter — South B',
      description: 'Affordable bedsitter on the 2nd floor. All amenities included — water, security, and refuse collection. Ideal for students or young professionals.',
      listingType: 'Bedsitter',
      bedrooms:    1,
      bathrooms:   1,
      grossArea:   22,
      price:       12000,
      location: {
        address: 'Mombasa Road, South B',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.3118, lng: 36.8469 },
      },
      amenities: ['Security', 'Water 24/7', 'Refuse Collection'],
      images: [
        { category: 'Bedroom', label: 'Room view', url: `${IMG}/xinyutouxinliang-furniture-3062400_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
    {
      landlordId:  landlord2._id,
      title:       '1BR Apartment — Lavington',
      description: 'Modern one-bedroom apartment in the leafy suburb of Lavington. Comes with fitted wardrobes, a modern kitchen, and fibre internet.',
      listingType: 'Apartment',
      bedrooms:    1,
      bathrooms:   1,
      grossArea:   55,
      price:       42000,
      location: {
        address: 'James Gichuru Road, Lavington',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.2784, lng: 36.7679 },
      },
      amenities: ['Parking', 'Security', 'Fibre Internet', 'CCTV', 'Water 24/7'],
      images: [
        { category: 'Living Room', label: 'Lounge',    url: `${IMG}/vasiliy-753-apartment-3090517_1280.jpg` },
        { category: 'Bedroom',     label: 'Bedroom',   url: `${IMG}/jarmoluk-apartment-2094674_1280.jpg` },
        { category: 'Kitchen',     label: 'Kitchen',   url: `${IMG}/piro4d-kitchen-1543493_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
    {
      landlordId:  landlord2._id,
      title:       'Penthouse 4BR — Upperhill',
      description: 'Premium penthouse on the 18th floor with panoramic views of Nairobi. Open-plan design, chef\'s kitchen, and a wraparound terrace. Available for long-term lease only.',
      listingType: 'Apartment',
      bedrooms:    4,
      bathrooms:   4,
      grossArea:   240,
      price:       280000,
      location: {
        address: 'Upperhill Road, Upperhill',
        city:    'Nairobi',
        county:  'Nairobi',
        coordinates: { lat: -1.2961, lng: 36.8182 },
      },
      amenities: ['Parking x2', 'Concierge', 'Gym', 'Pool', 'Rooftop Terrace', 'Backup Generator', 'Smart Home'],
      images: [
        { category: 'Living Room', label: 'Penthouse living',  url: `${IMG}/keresi72-room-416049_1280.jpg` },
        { category: 'Living Room', label: 'Entertainment area',url: `${IMG}/andremergulhaum-living-room-930804_1920.jpg` },
        { category: 'Kitchen',     label: "Chef's kitchen",    url: `${IMG}/piro4d-kitchen-1543493_1280.jpg` },
        { category: 'Exterior',    label: 'Building exterior', url: `${IMG}/andreas160578-apartment-2138949_1280.jpg` },
      ],
      moveInApproval: 'approved',
      isListed: true,
    },
  ]);
  console.log(`Created ${units.length} units`);

  // ── Viewing Slots ────────────────────────────────────────────────────────
  const tomorrow   = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
  const in2Days    = new Date(); in2Days.setDate(in2Days.getDate() + 2);   in2Days.setHours(0,0,0,0);
  const in3Days    = new Date(); in3Days.setDate(in3Days.getDate() + 3);   in3Days.setHours(0,0,0,0);
  const in5Days    = new Date(); in5Days.setDate(in5Days.getDate() + 5);   in5Days.setHours(0,0,0,0);

  await ViewingSlot.insertMany([
    { landlordId: landlord1._id, unitId: units[0]._id, unitName: units[0].title, date: tomorrow, time: '10:00', durationMins: 30, capacity: 2 },
    { landlordId: landlord1._id, unitId: units[0]._id, unitName: units[0].title, date: tomorrow, time: '14:00', durationMins: 30, capacity: 2 },
    { landlordId: landlord1._id, unitId: units[1]._id, unitName: units[1].title, date: in2Days,  time: '09:00', durationMins: 45, capacity: 1 },
    { landlordId: landlord1._id, unitId: units[2]._id, unitName: units[2].title, date: in2Days,  time: '11:00', durationMins: 60, capacity: 3 },
    { landlordId: landlord2._id, unitId: units[3]._id, unitName: units[3].title, date: in3Days,  time: '10:30', durationMins: 30, capacity: 2 },
    { landlordId: landlord2._id, unitId: units[4]._id, unitName: units[4].title, date: in3Days,  time: '15:00', durationMins: 30, capacity: 2 },
    { landlordId: landlord2._id, unitId: units[5]._id, unitName: units[5].title, date: in5Days,  time: '10:00', durationMins: 60, capacity: 1 },
    { landlordId: landlord2._id, unitId: units[5]._id, unitName: units[5].title, date: in5Days,  time: '14:00', durationMins: 60, capacity: 1 },
  ]);
  console.log('Created 8 viewing slots');

  // ── Applications ─────────────────────────────────────────────────────────
  const moveInDate1 = new Date(); moveInDate1.setDate(moveInDate1.getDate() + 30);
  const moveInDate2 = new Date(); moveInDate2.setDate(moveInDate2.getDate() + 45);

  await Application.insertMany([
    {
      unitId:            units[0]._id,
      facilityId:        dummyFacilityId,
      unitName:          units[0].title,
      facilityName:      'Westlands Heights',
      tenantId:          tenant1._id,
      tenantName:        tenant1.fullName,
      tenantEmail:       tenant1.email,
      tenantPhone:       tenant1.phoneNumber,
      desiredMoveInDate: moveInDate1,
      message:           'I am very interested in this apartment. I have been working in Westlands for 3 years and this location is ideal for me.',
      status:            'pending',
      landlordId:        landlord1._id,
    },
    {
      unitId:            units[1]._id,
      facilityId:        dummyFacilityId,
      unitName:          units[1].title,
      facilityName:      'Kilimani Studios',
      tenantId:          tenant2._id,
      tenantName:        tenant2.fullName,
      tenantEmail:       tenant2.email,
      tenantPhone:       tenant2.phoneNumber,
      desiredMoveInDate: moveInDate2,
      message:           'The studio looks perfect for my needs. I am a nurse at Nairobi Hospital which is nearby.',
      status:            'approved',
      adminNote:         'Background check passed. Approved.',
      landlordId:        landlord1._id,
    },
    {
      unitId:            units[4]._id,
      facilityId:        dummyFacilityId,
      unitName:          units[4].title,
      facilityName:      'Lavington Gardens',
      tenantId:          tenant3._id,
      tenantName:        tenant3.fullName,
      tenantEmail:       tenant3.email,
      tenantPhone:       tenant3.phoneNumber,
      desiredMoveInDate: moveInDate1,
      message:           'I have been renting in Lavington for the past 2 years and I love the neighbourhood. Happy to provide references.',
      status:            'pending',
      landlordId:        landlord2._id,
    },
    {
      unitId:            units[3]._id,
      facilityId:        dummyFacilityId,
      unitName:          units[3].title,
      facilityName:      'South B Apartments',
      tenantId:          tenant1._id,
      tenantName:        tenant1.fullName,
      tenantEmail:       tenant1.email,
      tenantPhone:       tenant1.phoneNumber,
      desiredMoveInDate: moveInDate2,
      message:           'Looking for a temporary place while my main apartment is being renovated.',
      status:            'rejected',
      adminNote:         'Unit reserved for another applicant.',
      landlordId:        landlord2._id,
    },
  ]);
  console.log('Created 4 applications');

  // ── Conversations + Messages ──────────────────────────────────────────────
  const now = new Date();

  const conv1 = await Conversation.create({
    tenantId:      tenant1._id,
    landlordId:    landlord1._id,
    unitId:        units[0]._id,
    unitName:      units[0].title,
    lastMessage:   'Looking forward to the viewing!',
    lastMessageAt: now,
    tenantUnread:  0,
    landlordUnread:1,
    status:        'active',
  });

  const conv2 = await Conversation.create({
    tenantId:      tenant2._id,
    landlordId:    landlord2._id,
    unitId:        units[4]._id,
    unitName:      units[4].title,
    lastMessage:   'The apartment sounds great. Can I see it this weekend?',
    lastMessageAt: new Date(now.getTime() - 3600000),
    tenantUnread:  0,
    landlordUnread:1,
    status:        'active',
  });

  await Message.insertMany([
    // conv1
    {
      conversationId: conv1._id,
      senderId:       tenant1._id,
      senderType:     'tenant',
      body:           'Hi, I just submitted an application for the Westlands apartment. Is it still available?',
      isRead:         true,
      readAt:         new Date(now.getTime() - 7200000),
      createdAt:      new Date(now.getTime() - 7200000),
    },
    {
      conversationId: conv1._id,
      senderId:       landlord1._id,
      senderType:     'landlord',
      body:           'Hello Kevin! Yes, it is still available. I have reviewed your application and it looks good. Would you like to book a viewing?',
      isRead:         true,
      readAt:         new Date(now.getTime() - 3600000),
      createdAt:      new Date(now.getTime() - 3600000),
    },
    {
      conversationId: conv1._id,
      senderId:       tenant1._id,
      senderType:     'tenant',
      body:           'Looking forward to the viewing!',
      isRead:         false,
      createdAt:      now,
    },
    // conv2
    {
      conversationId: conv2._id,
      senderId:       tenant2._id,
      senderType:     'tenant',
      body:           'Good afternoon. I saw your 1BR listing in Lavington and I am very interested.',
      isRead:         true,
      readAt:         new Date(now.getTime() - 5400000),
      createdAt:      new Date(now.getTime() - 5400000),
    },
    {
      conversationId: conv2._id,
      senderId:       landlord2._id,
      senderType:     'landlord',
      body:           'Hi Aisha! Thank you for your interest. The apartment is available from the 1st of next month. What dates work for a viewing?',
      isRead:         true,
      readAt:         new Date(now.getTime() - 4000000),
      createdAt:      new Date(now.getTime() - 4000000),
    },
    {
      conversationId: conv2._id,
      senderId:       tenant2._id,
      senderType:     'tenant',
      body:           'The apartment sounds great. Can I see it this weekend?',
      isRead:         false,
      createdAt:      new Date(now.getTime() - 3600000),
    },
  ]);

  console.log('Created 2 conversations and 6 messages');

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('Landlord accounts (password: Password123):');
  console.log('  james.kariuki@example.com  — Kariuki Properties Ltd');
  console.log('  wanjiku.mwangi@example.com — Mwangi Real Estate');
  console.log('\nTenant accounts (password: Password123):');
  console.log('  kevin.odhiambo@example.com');
  console.log('  aisha.abdi@example.com');
  console.log('  brian.njoroge@example.com');
  console.log('\nUnits created:', units.map(u => `\n  ${u.title} — KES ${u.price.toLocaleString()}/mo`).join(''));

  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
