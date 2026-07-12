const Tenant = require("../../models/Tenant");
const { logAdminAction } = require("../../utils/audit");

// Shared by suspend/:id and activate/:id — `status` is the target value.
function makeSetCustomerStatus(status) {
  return async function setCustomerStatus(request, reply) {
    try {
      const { id } = request.params;
      const tenant = await Tenant.findByIdAndUpdate(id, { status }, { new: true });
      if (!tenant) return reply.code(404).send({ error: "Customer not found" });

      await logAdminAction(request, { action: `${status}_customer`, resourceType: "Tenant", resourceId: tenant._id, details: tenant.email });

      return reply.code(200).send({ success: true, data: tenant });
    } catch (err) {
      request.log.error(err);
      return reply.code(502).send({ error: err.message });
    }
  };
}

module.exports = makeSetCustomerStatus;
