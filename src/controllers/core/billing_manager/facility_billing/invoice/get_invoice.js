const payservedb = require("payservedb");

const getInvoice = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;

        // Find the invoice
        const invoice = await payservedb.FacilityInvoice.findOne({
            _id: invoiceId,
            facilityId
        });

        if (!invoice) {
            return reply.code(404).send({
                error: "Invoice not found"
            });
        }

        return reply.code(200).send({
            success: true,
            invoice
        });

    } catch (err) {
        console.error("Error getting invoice:", err);
        return reply.code(500).send({ 
            error: "Failed to retrieve invoice",
            details: err.message 
        });
    }
};

module.exports = getInvoice;