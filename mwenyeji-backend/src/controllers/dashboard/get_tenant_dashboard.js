const Application = require("../../models/Application");
const Booking = require("../../models/Booking");
const Reservation = require("../../models/Reservation");
const Notification = require("../../models/Notification");

// GET /api/move_in/dashboard — authenticated tenant
async function getTenantDashboard(request, reply) {
  try {
    const tenantId = request.user.userId;

    const [totalApplications, pendingApplications, upcomingViewings, activeReservations, unreadNotifications, recentApps] =
      await Promise.all([
        Application.countDocuments({ tenantId }),
        Application.countDocuments({ tenantId, status: "pending" }),
        Booking.countDocuments({ tenantId, status: { $in: ["pending", "confirmed"] } }),
        Reservation.countDocuments({ tenantId, status: { $in: ["pending", "confirmed"] } }),
        Notification.countDocuments({ recipientType: "tenant", recipientId: tenantId, isRead: false }),
        Application.find({ tenantId }).populate("unitId", "title").sort({ createdAt: -1 }).limit(5).lean(),
      ]);

    const recentActivity = recentApps.map((a) => ({
      title: `Application — ${a.unitId?.title || "Unit"}`,
      time: new Date(a.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }),
      status: a.status,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        stats: { totalApplications, pendingApplications, upcomingViewings, activeReservations, unreadNotifications },
        recentActivity,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getTenantDashboard;
