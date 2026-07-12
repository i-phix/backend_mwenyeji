const ViewingSlot = require("../../models/ViewingSlot");
const Unit = require("../../models/Unit");
const Booking = require("../../models/Booking");

// Shared by the authenticated (book_slot) and guest (book_guest_slot)
// booking endpoints. `identity` is either { tenantId } or { guest }.
async function createBooking(body, identity) {
  const { slotId, tenantNote } = body || {};

  if (slotId) {
    const slot = await ViewingSlot.findById(slotId);
    if (!slot || slot.status !== "active") throw Object.assign(new Error("Slot not available"), { status: 404 });
    if (slot.bookedCount >= slot.capacity) throw Object.assign(new Error("Slot is fully booked"), { status: 409 });

    const unit = await Unit.findById(slot.unitId).select("title");
    slot.bookedCount += 1;
    await slot.save();

    return new Booking({
      slotId: slot._id,
      unitId: slot.unitId,
      landlordId: slot.landlordId,
      unitName: unit?.title,
      scheduledDate: slot.date,
      scheduledTime: slot.time,
      tenantNote: tenantNote || undefined,
      status: "confirmed",
      ...identity,
    }).save();
  }

  // Ad-hoc request — no pre-defined slot, landlord confirms/reschedules manually.
  const { unitId, scheduledDate, scheduledTime } = body || {};
  if (!unitId || !scheduledDate || !scheduledTime) {
    throw Object.assign(new Error("unitId, scheduledDate and scheduledTime are required"), { status: 400 });
  }
  const unit = await Unit.findById(unitId);
  if (!unit) throw Object.assign(new Error("Listing not found"), { status: 404 });

  return new Booking({
    unitId: unit._id,
    landlordId: unit.landlordId,
    unitName: unit.title,
    scheduledDate,
    scheduledTime,
    tenantNote: tenantNote || undefined,
    status: "pending",
    ...identity,
  }).save();
}

// POST /api/move_in/viewing/book — authenticated tenant
async function bookSlot(request, reply) {
  try {
    const booking = await createBooking(request.body, { tenantId: request.user.userId });
    return reply.code(201).send({ success: true, data: booking });
  } catch (err) {
    if (err.status) return reply.code(err.status).send({ error: err.message });
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = bookSlot;
module.exports.createBooking = createBooking;
