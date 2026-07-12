const Disbursement = require("../../models/Disbursement");

// GET /api/move_in/admin/disbursements?status= — authenticated admin
async function getDisbursements(request, reply) {
  try {
    const { status } = request.query || {};
    const filter = status && status !== "all" ? { status } : {};

    const disbursements = await Disbursement.find(filter)
      .populate("landlordId", "fullName email companyName")
      .sort({ createdAt: -1 })
      .lean();

    const data = disbursements.map((d) => ({ ...d, landlord: d.landlordId, landlordId: d.landlordId?._id }));

    return reply.code(200).send({ success: true, data });
  } catch (err) {
    request.log.error(err);
    return reply.code(502).send({ error: err.message });
  }
}

module.exports = getDisbursements;
