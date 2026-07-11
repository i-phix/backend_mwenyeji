const payservedb = require('payservedb');

const update_invoice_billing = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { dueDays, levyNote } = request.body;

        // Check if a record already exists for the facility
        let existingRecord = await payservedb.InvoiceBillingSetting.findOne({ facilityId });

        if (existingRecord) {
            // If record exists, update it
            existingRecord.dueDays = dueDays;
            existingRecord.levyNote = levyNote;
            await existingRecord.save();
            return reply.code(200).send({ success: true, data: existingRecord })
        } else {
            // If no record exists, create a new one
            const newRecord = new payservedb.InvoiceBillingSetting({
                dueDays,
                levyNote,
                facilityId
            });
            await newRecord.save();
            return reply.code(200).send({ success: true, data: newRecord });
        }
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = update_invoice_billing;
