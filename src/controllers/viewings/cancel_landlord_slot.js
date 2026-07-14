const ViewingSlot = require("../../models/ViewingSlot");

// DELETE /api/move_in/landlord/viewings/slots/:slotId — authenticated landlord
async function cancelLandlordSlot(request, reply) {
  try {
    const { slotId } = request.params;
    const slot = await ViewingSlot.findOne({ _id: slotId, landlordId: request.user.userId });
    if (!slot) return reply.code(404).send({ error: "Slot not found" });
    if (slot.bookedCount > 0) {
      return reply.code(409).send({ error: "Cannot cancel a slot that already has bookings" });
    }

    slot.status = "cancelled";
    await slot.save();

    return reply.code(200).send({ success: true, data: slot });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = cancelLandlordSlot;
