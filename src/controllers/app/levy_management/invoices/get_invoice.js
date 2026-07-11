const mongoose = require("mongoose");
const payservedb = require("payservedb");

const getInvoice = async (req, res) => {
  const invoiceId = req.params.invoiceId;
  const invoice = await payservedb.Invoice.findOne({
    where: {
      id: invoiceId,
    },
    include: [
      {
        model: payservedb.InvoiceItem,
      },
    ],
  });
  if (!invoice) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  return res.status(200).json(invoice);
};

module.exports = getInvoice;
