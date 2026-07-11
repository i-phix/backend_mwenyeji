const mongoose = require("mongoose");
const { getModel } = require("../../../../utils/getModel");
const payservedb = require("payservedb");

const deleteInvoice = async (req, reply) => {
  try {
    const { facilityId, invoiceId } = req.params;

    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );

    const invoice = await invoiceModel.findOne({ _id: invoiceId });

    if (!invoice) {
      return reply.code(404).send({ message: "Invoice not found" });
    }

    await invoice.deleteOne();

    return reply.code(200).send({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error occurred while deleting invoice:", error.message);
    return reply.code(502).send({ error: error.message });
  }
};

module.exports = deleteInvoice;
