const Application = require("../../models/Application");
const { matchesDay, matchesDate, matchesSearch, sortUpcoming } = require("../../utils/workflowFilters");

// GET /api/move_in/landlord/applications — authenticated landlord
// Query: status, search, day, date, sort=upcoming
async function getLandlordApplications(request, reply) {
  try {
    const { status, search, day, date } = request.query || {};

    const filter = { landlordId: request.user.userId };
    if (status && status !== "All") filter.status = status;

    const applications = await Application.find(filter)
      .populate("unitId", "title")
      .populate("tenantId", "fullName email phoneNumber")
      .sort({ createdAt: -1 })
      .lean();

    let list = applications.map((a) => ({
      ...a,
      unitName: a.unitId?.title || "Unit",
      unitId: a.unitId?._id || a.unitId,
      tenantName: a.tenantId?.fullName || a.guest?.fullName || "Tenant",
      tenantEmail: a.tenantId?.email || a.guest?.email || "",
      tenantPhone: a.tenantId?.phoneNumber || a.guest?.phoneNumber || "",
    }));

    list = list.filter(
      (a) =>
        matchesSearch(a, [a.tenantName, a.unitName, a.tenantEmail], search) &&
        matchesDay(a.desiredMoveInDate, day) &&
        matchesDate(a.desiredMoveInDate, date),
    );
    list = sortUpcoming(list, "desiredMoveInDate");

    return reply.code(200).send({ success: true, data: list });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getLandlordApplications;
