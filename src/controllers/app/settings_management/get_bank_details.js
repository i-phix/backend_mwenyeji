const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_bank_details = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID is required'
            });
        }

        const facility = await payservedb.Facility.findById(facilityId);

        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Get the facility-specific BankDetails model
        const bankDetailsModel = await getModel("BankDetails", payservedb.BankDetails.schema, facilityId);

        const bankDetails = await bankDetailsModel.find({ facilityId: facilityId })
            .sort({ isDefault: -1, createdAt: -1 }); // Default accounts first, then by creation date

        return reply.code(200).send({
            success: true,
            message: 'Bank details retrieved successfully',
            data: bankDetails
        });

    } catch (err) {
        console.error('Error in get_bank_details:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve bank details',
            details: err.message
        });
    }
}

module.exports = get_bank_details;