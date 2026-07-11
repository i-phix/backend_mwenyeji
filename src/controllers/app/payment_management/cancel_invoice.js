const { getModel } = require('../../../utils/getModel');
const payservedb = require("payservedb");

const cancel_invoice = async (req, reply) => {
  try {
    const { facilityId, invoiceId } = req.params;
    const { reason, userId, userName, userRole } = req.body;

    if (!reason) {
      return reply.code(400).send({ error: "Cancellation reason is required" });
    }

    const invoiceModel = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
    const invoice = await invoiceModel.findById(invoiceId);

    if (!invoice) {
      return reply.code(404).send({ error: "Invoice not found" });
    }

    invoice.status = "Cancelled";
    invoice.cancelMetadata = {
      cancelledBy: { userId, name: userName, role: userRole },
      cancelledAt: new Date(),
      reason
    };

    await invoice.save();

    return reply.code(200).send({
      message: "Invoice successfully cancelled",
      invoice
    });

  } catch (error) {
    console.error("Error cancelling invoice:", error.message);
    return reply.code(500).send({ error: "Internal server error" });
  }
};

module.exports = cancel_invoice;
