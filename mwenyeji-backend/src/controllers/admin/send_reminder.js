const Booking = require("../../models/Booking");
const Reservation = require("../../models/Reservation");
const { notify } = require("../../utils/notify");

// POST /api/core/move_in/reminders/send — authenticated admin
// Body: { relatedType: 'viewing'|'reservation', relatedId, target: 'both'|'tenant'|'landlord', channels: string[], message }
// Only the in-app "channel" is actually delivered here — SMS/email/WhatsApp
// need Africa's Talking/Green API credentials (same situation as M-Pesa in
// Phase 3) and aren't wired up yet. The reminder always lands as an in-app
// notification regardless of which channels were requested.
async function sendReminder(request, reply) {
  try {
    const { relatedType, relatedId, target = "both", message } = request.body || {};
    if (!relatedType || !relatedId || !message) {
      return reply.code(400).send({ error: "relatedType, relatedId and message are required" });
    }

    const Model = relatedType === "reservation" ? Reservation : Booking;
    const record = await Model.findById(relatedId);
    if (!record) return reply.code(404).send({ error: `${relatedType} not found` });

    const notifications = [];
    if ((target === "both" || target === "tenant") && record.tenantId) {
      notifications.push(
        notify({
          recipientType: "tenant",
          recipientId: record.tenantId,
          type: relatedType,
          title: "Reminder",
          body: message,
          relatedId: record._id,
          relatedType,
        }),
      );
    }
    if (target === "both" || target === "landlord") {
      notifications.push(
        notify({
          recipientType: "landlord",
          recipientId: record.landlordId,
          type: relatedType,
          title: "Reminder",
          body: message,
          relatedId: record._id,
          relatedType,
        }),
      );
    }
    await Promise.all(notifications);

    return reply.code(200).send({ success: true });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = sendReminder;
