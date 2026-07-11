const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const delete_bank_details = async (request, reply) => {
    try {
        const { facilityId, bankDetailsId } = request.params;

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

        // Check if the bank details exist and belong to this facility
        const existingBankDetails = await bankDetailsModel.findOne({
            _id: bankDetailsId,
            facilityId
        });

        if (!existingBankDetails) {
            return reply.code(404).send({
                success: false,
                error: 'Bank details not found or do not belong to this facility'
            });
        }

        // Prevent deletion of default account unless it's the only one
        if (existingBankDetails.isDefault) {
            const totalBankAccounts = await bankDetailsModel.countDocuments({ facilityId });

            if (totalBankAccounts > 1) {
                return reply.code(400).send({
                    success: false,
                    error: 'Cannot delete default bank account. Please set another account as default first.'
                });
            }
        }

        await bankDetailsModel.findByIdAndDelete(bankDetailsId);

        return reply.code(200).send({
            success: true,
            message: 'Bank details deleted successfully'
        });

    } catch (err) {
        console.error('Error in delete_bank_details:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to delete bank details',
            details: err.message
        });
    }
};

module.exports = delete_bank_details;