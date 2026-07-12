const Unit = require("../../models/Unit");
const Application = require("../../models/Application");
const Booking = require("../../models/Booking");
const Conversation = require("../../models/Conversation");

// GET /api/move_in/landlord/dashboard — authenticated landlord
async function getLandlordDashboard(request, reply) {
  try {
    const landlordId = request.user.userId;

    const [
      totalUnits,
      listedUnits,
      totalApplications,
      pendingApplications,
      totalBookings,
      upcomingBookings,
      conversations,
      recentApplications,
    ] = await Promise.all([
      Unit.countDocuments({ landlordId }),
      Unit.countDocuments({ landlordId, isListed: true }),
      Application.countDocuments({ landlordId }),
      Application.countDocuments({ landlordId, status: "pending" }),
      Booking.countDocuments({ landlordId }),
      Booking.countDocuments({ landlordId, status: { $in: ["pending", "confirmed"] } }),
      Conversation.find({ landlordId }).select("landlordUnread").lean(),
      Application.find({ landlordId }).populate("unitId", "title").populate("tenantId", "fullName").sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    const unreadMessages = conversations.reduce((sum, c) => sum + (c.landlordUnread || 0), 0);

    const recentApps = recentApplications.map((a) => ({
      _id: a._id,
      tenantName: a.tenantId?.fullName || a.guest?.fullName || "Tenant",
      unitName: a.unitId?.title || "Unit",
      status: a.status,
    }));

    return reply.code(200).send({
      success: true,
      data: {
        stats: { totalUnits, listedUnits, totalApplications, pendingApplications, totalBookings, upcomingBookings, unreadMessages },
        recentApplications: recentApps,
      },
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordDashboard;
