const Application = require("../../models/Application");

// GET /api/move_in/applications/my — authenticated tenant
async function getMyApplications(request, reply) {
  try {
    const applications = await Application.find({ tenantId: request.user.userId })
      .populate("unitId")
      .sort({ createdAt: -1 })
      .lean();

    return reply.code(200).send({ success: true, data: applications });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getMyApplications;
