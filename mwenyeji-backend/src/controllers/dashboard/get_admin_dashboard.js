const Unit = require("../../models/Unit");
const Tenant = require("../../models/Tenant");
const Application = require("../../models/Application");

// GET /api/core/move_in/dashboard — authenticated admin
// Note: this response is read one level shallower than the tenant/landlord
// dashboards (res.data.stats, not res.data.data.stats) — matching the
// existing admin dashboard.js frontend contract exactly.
async function getAdminDashboard(request, reply) {
  try {
    const [totalListings, pendingApprovals, activeCustomers, openApplications, recentApps] = await Promise.all([
      Unit.countDocuments({}),
      Unit.countDocuments({ approvalStatus: "pending" }),
      Tenant.countDocuments({ status: "active" }),
      Application.countDocuments({ status: "pending" }),
      Application.find({}).populate("unitId", "title").sort({ createdAt: -1 }).limit(8).lean(),
    ]);

    const recentActivity = recentApps.map((a) => ({
      title: `Application — ${a.unitId?.title || "Unit"}`,
      time: new Date(a.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }),
      status: a.status,
    }));

    return reply.code(200).send({
      success: true,
      stats: { totalListings, pendingApprovals, activeCustomers, openApplications },
      recentActivity,
    });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getAdminDashboard;
