const Notification = require("../models/Notification");

// Creates an in-app notification for a tenant/landlord/admin. Delivery over
// email/SMS/WhatsApp is a separate integration (Africa's Talking / Green
// API credentials, like the M-Pesa creds in Phase 3) — not wired up yet,
// so this only guarantees the in-app bell/notifications list updates.
async function notify({ recipientType, recipientId, type = "info", title, body = "", relatedId, relatedType }) {
  if (!recipientId) return null;
  return Notification.create({ recipientType, recipientId, type, title, body, relatedId, relatedType });
}

module.exports = { notify };
