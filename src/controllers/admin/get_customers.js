const Tenant = require("../../models/Tenant");
const Application = require("../../models/Application");

// GET /api/core/move_in/customers — authenticated admin
// The customers.js table reads `name`/`phone` directly (no fallback), while
// the edit modal reads `fullName || name`/`phoneNumber || phone` — so the
// response includes both key sets for every record.
async function getCustomers(request, reply) {
  try {
    const tenants = await Tenant.find().select("-password").sort({ createdAt: -1 }).lean();

    const counts = await Application.aggregate([
      { $group: { _id: "$tenantId", count: { $sum: 1 } } },
    ]);
    const countByTenant = new Map(counts.map((c) => [String(c._id), c.count]));

    const data = tenants.map((t) => ({
      ...t,
      name: t.fullName,
      phone: t.phoneNumber,
      applicationCount: countByTenant.get(String(t._id)) ?? 0,
    }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getCustomers;
