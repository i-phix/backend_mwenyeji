// Normalizes a JWT role ('tenant' | 'landlord' | 'admin' | 'support') into
// the Notification.recipientType enum ('tenant' | 'landlord' | 'admin') —
// any staff role (admin/support) is treated as 'admin' for notifications.
function recipientTypeFor(role) {
  return role === "tenant" || role === "landlord" ? role : "admin";
}

module.exports = { recipientTypeFor };
