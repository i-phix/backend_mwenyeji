const { getModel } = require("../../../../utils/getModel");
const payservedb = require("payservedb");

function generateInvoiceNumber(facilityId) {
  const timestamp = Date.now();
  return `INV-${facilityId}-${timestamp}`;
}

const createInvoice = async (req, reply) => {
  try {
    const { facilityId } = req.params;
    const {
      client,
      unit,
      items,
      subTotal,
      tax,
      totalAmount,
      issueDate,
      dueDate,
      status,
      penalty,
      whatFor,
      invoiceNote,
      lastReminderSent,
      paymentDetails,
    } = req.body;

    if (!client || !totalAmount) {
      return reply.code(400).send({
        error: "Required fields are missing: client or totalAmount",
      });
    }

    // Get the model for the specified facility
    const invoiceModel = await getModel(
      "Invoice",
      payservedb.Invoice.schema,
      facilityId
    );

    // Generate the invoice number
    const invoiceNumber = generateInvoiceNumber(facilityId);

    const data = new invoiceModel({
      invoiceNumber,
      client,
      facility: facilityId,
      unit,
      items,
      subTotal,
      tax,
      totalAmount,
      issueDate,
      dueDate,
      status,
      penalty,
      whatFor,
      invoiceNote,
      lastReminderSent,
      paymentDetails,
    });

    await data.save();

    return reply.code(200).send({
      message: "Invoice added successfully",
      invoice: data,
    });
  } catch (error) {
    console.error("Error occurred while creating invoice:", error.message);
    return reply.code(502).send({ error: error.message });
  }
};

module.exports = createInvoice;
