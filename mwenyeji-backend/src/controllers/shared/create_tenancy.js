const Unit = require("../../models/Unit");
const Tenancy = require("../../models/Tenancy");
const PlatformSetting = require("../../models/PlatformSetting");
const { generateAccountNumber } = require("../../utils/accountNumber");
const { computeAmountFromRule } = require("../../utils/feeRules");

// Shared by "mark as rented" on both Applications and Reservations. Creates
// the Tenancy record that drives the payment + lease-signing flow, and
// flips the unit to rented/unlisted so it drops off public listings.
//
// Commission: a unit-level commissionRate (percentage, admin-set) always
// wins if present; otherwise falls back to the platform's commission fee
// rule (same_as_rent / percentage_of_rent / fixed_amount).
//
// source: { applicationId?, reservationId?, unitId, landlordId, tenantId?, unitName }
async function createTenancy(source) {
  const unit = await Unit.findById(source.unitId);
  if (!unit) throw new Error("Unit not found");

  const rent = Number(unit.price || 0);

  let commissionAmount;
  let commissionValue;
  if (typeof unit.commissionRate === "number") {
    commissionValue = unit.commissionRate;
    commissionAmount = Math.round((rent * unit.commissionRate) / 100);
  } else {
    const settings = await PlatformSetting.getSingleton();
    commissionValue = settings.commission?.value ?? 10;
    commissionAmount = computeAmountFromRule(settings.commission?.rule, settings.commission?.value, rent);
  }
  const netToLandlord = Math.max(0, rent - commissionAmount);

  const tenancy = await new Tenancy({
    applicationId: source.applicationId || undefined,
    reservationId: source.reservationId || undefined,
    unitId: unit._id,
    landlordId: unit.landlordId,
    tenantId: source.tenantId || undefined,
    unitName: source.unitName || unit.title,
    accountNumber: generateAccountNumber("MVR"),
    status: "awaiting_both",
    amount: rent,
    commissionType: "percentage",
    commissionValue,
    commissionAmount,
    netToLandlord,
  }).save();

  unit.status = "rented";
  unit.isListed = false;
  await unit.save();

  return tenancy;
}

module.exports = createTenancy;
