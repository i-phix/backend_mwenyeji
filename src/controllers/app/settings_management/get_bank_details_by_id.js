const payservedb = require('payservedb');

const get_bank_details_by_id = async (request, reply) => {
    try {
        const { facilityId, bankDetailsId } = request.params;

        if (!facilityId || !bankDetailsId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Bank Details ID are required'
            });
        }

        // Verify facility exists
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Get the facility-specific BankDetails model
        const bankDetailsModel = await getModel("BankDetails", payservedb.BankDetails.schema, facilityId);

        const bankDetails = await bankDetailsModel.findOne({
            _id: bankDetailsId,
            facilityId
        });

        if (!bankDetails) {
            return reply.code(404).send({
                success: false,
                error: 'Bank details not found or do not belong to this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Bank details retrieved successfully',
            data: bankDetails
        });

    } catch (err) {
        console.error('Error in get_bank_details_by_id:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve bank details',
            details: err.message
        });
    }
};

module.exports = get_bank_details_by_id;