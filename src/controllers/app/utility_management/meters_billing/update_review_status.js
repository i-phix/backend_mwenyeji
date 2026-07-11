const utilityDb = require('../../../../middlewares/utilityDb');

const updateSelectedMetersBillingStatus = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { meterNumbers } = request.body;
        
        // Validate request body
        if (!Array.isArray(meterNumbers) || meterNumbers.length === 0) {
            return reply.code(400).send({
                error: 'Request must include an array of meter numbers'
            });
        }
        
        // Determine the current year-month (format: YYYY-MM)
        const currentYearMonth = new Date().toISOString().slice(0, 7);
        
        // Get the AnalogBilling model from utility database
        const analogBillingModel = await utilityDb.getModel('AnalogBilling');
        
        // Update the status for the selected meters with the current yearMonth to 'reviewed'
        const result = await analogBillingModel.updateMany(
            { 
                meterNumber: { $in: meterNumbers },
                yearMonth: currentYearMonth,
                facilityId: facilityId
            },
            { status: 'reviewed' }
        );

        return reply.code(200).send({
            message: `Billing status updated to 'reviewed' for ${result.modifiedCount || result.nModified || 0} meter(s)`,
            data: result
        });
    } catch (err) {
        return reply.code(400).send({ error: err.message });
    }
};

module.exports = updateSelectedMetersBillingStatus;