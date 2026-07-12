const bcrypt = require("bcryptjs");
const Tenant = require("../../models/Tenant");
const { logAdminAction } = require("../../utils/audit");

function generateTempPassword() {
  return `Mv${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 90 + 10)}`;
}

// PUT /api/core/move_in/customers/reset_password/:id — authenticated admin
async function resetCustomerPassword(request, reply) {
  try {
    const { id } = request.params;
    const tenant = await Tenant.findById(id);
    if (!tenant) return reply.code(404).send({ error: "Customer not found" });

    const tempPassword = generateTempPassword();
    tenant.password = await bcrypt.hash(tempPassword, 10);
    await tenant.save();

    await logAdminAction(request, { action: "reset_customer_password", resourceType: "Tenant", resourceId: tenant._id, details: tenant.email });

    return reply.code(200).send({ success: true, data: { tempPassword } });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = resetCustomerPassword;
