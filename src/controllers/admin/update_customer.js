const Tenant = require("../../models/Tenant");
const { logAdminAction } = require("../../utils/audit");

// PUT /api/core/move_in/customers/:id — authenticated admin
async function updateCustomer(request, reply) {
  try {
    const { id } = request.params;
    const { fullName, email, phoneNumber } = request.body || {};

    const tenant = await Tenant.findById(id);
    if (!tenant) return reply.code(404).send({ error: "Customer not found" });

    if (fullName !== undefined) tenant.fullName = fullName;
    if (email !== undefined) tenant.email = email.toLowerCase().trim();
    if (phoneNumber !== undefined) tenant.phoneNumber = phoneNumber;
    await tenant.save();

    await logAdminAction(request, { action: "update_customer", resourceType: "Tenant", resourceId: tenant._id, details: tenant.email });

    return reply.code(200).send({ success: true, data: tenant });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = updateCustomer;
