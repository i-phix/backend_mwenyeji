const db = require("payservedb");
const { getModel } = require("../../../utils/getModel");

const ACTIVE_DEAL_STATUSES = [
  "lead",
  "viewing_requested",
  "viewing_confirmed",
  "applied",
  "application_approved",
  "reserved",
  "offer_sent",
  "tenant_confirmed",
  "payment_pending",
];

const TERMINAL_DEAL_STATUSES = ["rented", "cancelled", "expired", "lost"];

const clean = (value) => String(value || "").trim();
const normalizeEmail = (value) => clean(value).toLowerCase();

function prospectFilter({ userId, email }) {
  return userId
    ? { tenantId: userId }
    : { tenantEmail: normalizeEmail(email), isGuest: true };
}

async function resolveMoveInUnit({ unitId, facilityId, requireListed = true }) {
  const standalone = await db.moveIn.MoveInUnit.findById(unitId).lean();
  if (standalone) {
    if (
      requireListed &&
      (!standalone.isListed ||
        standalone.moveInApproval !== "approved" ||
        ["rented", "suspended"].includes(standalone.moveInStatus))
    ) {
      const error = new Error("This unit is not available.");
      error.statusCode = 400;
      throw error;
    }

    return {
      source: "standalone",
      unit: standalone,
      unitId: standalone._id,
      sourceUnitId: null,
      sourceFacilityId: null,
      unitName: standalone.title,
      facilityId: standalone.facilityId || null,
      facilityName: standalone.facilityName || null,
      landlordId: standalone.landlordId || null,
      price: Number(standalone.price || 0),
    };
  }

  if (!facilityId) {
    const error = new Error(
      "facilityId is required for PayServe-backed units.",
    );
    error.statusCode = 400;
    throw error;
  }

  const UnitModel = await getModel("Unit", db.Unit.schema, facilityId);
  const unit = await UnitModel.findById(unitId)
    .select(
      "name listedInMoveIn moveInApproval moveInStatus moveInPrice moveInBedrooms moveInBathrooms homeOwnerId tenantId residentId status moveInListingId",
    )
    .lean();

  if (!unit) {
    const error = new Error("Unit not found.");
    error.statusCode = 404;
    throw error;
  }

  if (
    requireListed &&
    (!unit.listedInMoveIn || unit.moveInApproval !== "approved")
  ) {
    const error = new Error("This unit is not available.");
    error.statusCode = 400;
    throw error;
  }

  if (
    requireListed &&
    (unit.tenantId ||
      unit.residentId ||
      ["rented", "suspended"].includes(unit.moveInStatus))
  ) {
    const error = new Error("This unit is no longer available.");
    error.statusCode = 400;
    throw error;
  }

  const [facility, moveInListing] = await Promise.all([
    db.Facility.findById(facilityId).select("name location").lean(),
    db.moveIn.MoveInUnit.findOne({
      source: "payserve",
      $or: [
        { _id: unit.moveInListingId },
        { sourceFacilityId: facilityId, sourceUnitId: unit._id },
      ],
    })
      .select("_id landlordId payserveLandlordId title price")
      .lean(),
  ]);

  return {
    source: "payserve",
    unit,
    unitId: moveInListing?._id || unit._id,
    sourceUnitId: unit._id,
    sourceFacilityId: facilityId,
    unitName: moveInListing?.title || unit.name,
    facilityId,
    facilityName: facility?.name || null,
    landlordId: moveInListing?.landlordId || null,
    payserveLandlordId: moveInListing?.payserveLandlordId || null,
    price: Number(moveInListing?.price || unit.moveInPrice || 0),
  };
}

async function upsertDeal({
  resolved,
  tenant,
  guest,
  status,
  event,
  applicationId = null,
  reservationId = null,
  bookingId = null,
  desiredMoveInDate = null,
  notes = null,
}) {
  const tenantEmail = tenant?.email || normalizeEmail(guest?.email);
  const query = {
    unitId: resolved.unitId,
    status: { $nin: TERMINAL_DEAL_STATUSES },
    ...prospectFilter({ userId: tenant?._id, email: tenantEmail }),
  };

  const update = {
    $set: {
      unitName: resolved.unitName,
      source: resolved.source,
      sourceFacilityId: resolved.sourceFacilityId || null,
      sourceUnitId: resolved.sourceUnitId || null,
      landlordId: resolved.landlordId || null,
      tenantId: tenant?._id || null,
      tenantName: tenant?.fullName || guest?.fullName || null,
      tenantEmail,
      tenantPhone: tenant?.phoneNumber || guest?.phoneNumber || null,
      isGuest: !tenant,
      desiredMoveInDate: desiredMoveInDate || null,
      agreedRentAmount: resolved.price || null,
      status,
      lastEvent: event,
      notes,
      "payserveSync.status":
        resolved.source === "payserve" ? "pending" : "not_applicable",
    },
    $setOnInsert: {
      unitId: resolved.unitId,
      commissionStatus: "not_due",
    },
  };

  if (applicationId) update.$set.applicationId = applicationId;
  if (reservationId) update.$set.reservationId = reservationId;
  if (bookingId) update.$set.bookingId = bookingId;

  const deal = await db.moveIn.MoveInDeal.findOneAndUpdate(query, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  });

  return deal;
}

async function setStandaloneUnitStatus(unitId, status, dealId = null) {
  const update = { moveInStatus: status };
  if (dealId !== undefined) update.activeDealId = dealId;
  if (status === "rented") update.isListed = false;
  if (status === "listed") update.activeDealId = null;
  await db.moveIn.MoveInUnit.updateOne({ _id: unitId }, { $set: update });
}

function commissionAmount(
  baseAmount,
  ruleType = "percentage_of_rent",
  ruleValue = 10,
) {
  const base = Number(baseAmount || 0);
  const value = Number(ruleValue || 0);
  if (ruleType === "fixed" || ruleType === "manual")
    return Math.max(0, Math.round(value));
  return Math.max(0, Math.round(base * (value / 100)));
}

async function ensureCommissionDue(deal, options = {}) {
  const baseAmount = Number(options.baseAmount || deal.agreedRentAmount || 0);
  const ruleType = options.ruleType || "percentage_of_rent";
  const ruleValue = options.ruleValue ?? 10;
  const amount = commissionAmount(baseAmount, ruleType, ruleValue);
  if (!amount) return null;

  const commission = await db.moveIn.MoveInCommission.findOneAndUpdate(
    { dealId: deal._id },
    {
      $setOnInsert: {
        dealId: deal._id,
        unitId: deal.unitId,
        unitName: deal.unitName,
        landlordId: deal.landlordId || null,
        tenantId: deal.tenantId || null,
        tenantEmail: deal.tenantEmail || null,
        payerType: options.payerType || "landlord",
        ruleType,
        ruleValue,
        baseAmount,
        amount,
        currency: deal.currency || "KES",
        status: "due",
        dueAt: new Date(),
        notes:
          options.notes || "Generated when Move-In deal was marked rented.",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  await db.moveIn.MoveInDeal.updateOne(
    { _id: deal._id },
    {
      $set: { commissionStatus: commission.status === "paid" ? "paid" : "due" },
    },
  );

  await db.moveIn.MoveInPayment.findOneAndUpdate(
    { commissionId: commission._id, type: "commission" },
    {
      $setOnInsert: {
        tenantId: deal.tenantId || null,
        tenantName: deal.tenantName,
        unitId: deal.unitId,
        unitName: deal.unitName,
        dealId: deal._id,
        commissionId: commission._id,
        type: "commission",
        amount,
        currency: deal.currency || "KES",
        status: "pending",
        payerType: commission.payerType,
        notes: "Admin commission pending collection.",
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return commission;
}

module.exports = {
  ACTIVE_DEAL_STATUSES,
  clean,
  normalizeEmail,
  prospectFilter,
  resolveMoveInUnit,
  upsertDeal,
  setStandaloneUnitStatus,
  ensureCommissionDue,
};
