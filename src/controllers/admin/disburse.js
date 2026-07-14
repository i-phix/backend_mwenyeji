const Disbursement = require("../../models/Disbursement");
const { logAdminAction } = require("../../utils/audit");

// POST /api/move_in/admin/disbursements/:id/disburse — authenticated admin
// Records a payout the admin already made manually (M-Pesa or bank) —
// this endpoint does not move money itself, only tracks that it was sent.
// Body: { method: 'mpesa'|'bank', reference, note?, bankName?, bankAccount?, bankBranch? }
async function disburse(request, reply) {
  try {
    const { id } = request.params;
    const { method, reference, note, bankName, bankAccount, bankBranch } = request.body || {};
    if (!method || !reference) return reply.code(400).send({ error: "method and reference are required" });

    const disbursement = await Disbursement.findById(id);
    if (!disbursement) return reply.code(404).send({ error: "Disbursement not found" });
    if (disbursement.status === "settled") {
      return reply.code(400).send({ error: "Already disbursed" });
    }

    disbursement.status = "settled";
    disbursement.method = method;
    disbursement.reference = reference;
    disbursement.note = note || undefined;
    if (method === "bank") {
      disbursement.bankName = bankName;
      disbursement.bankAccount = bankAccount;
      disbursement.bankBranch = bankBranch;
    }
    disbursement.disbursedAt = new Date();
    disbursement.disbursedBy = request.user.userId;
    await disbursement.save();

    await logAdminAction(request, {
      action: "disburse",
      resourceType: "Disbursement",
      resourceId: disbursement._id,
      details: `${method} ${reference} — KES ${disbursement.netAmount}`,
    });

    return reply.code(200).send({ success: true, data: disbursement });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = disburse;
