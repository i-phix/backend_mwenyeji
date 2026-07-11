// controllers/lease/penalties/delete_lease_penalty.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_lease_penalty = async (request, reply) => {
    try {
        const { facilityId, penaltyId } = request.params;
        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        // Check if penalty exists and is active
        const existingPenalty = await penaltyModel.findOne({
            _id: penaltyId,
            facilityId,
            module: 'lease',
            isActive: true
        });

        if (!existingPenalty) {
            return reply.code(404).send({
                error: 'Active lease penalty not found'
            });
        }

        // Check if penalty is in use
        const leaseAgreementModel = await getModel('LeaseAgreement', payservedb.LeaseAgreement.schema, facilityId);
        const isInUse = await leaseAgreementModel.exists({
            'financialTerms.penaltyId': penaltyId,
            status: { $in: ['Active', 'Pending'] }
        });

        if (isInUse) {
            return reply.code(400).send({
                error: 'Cannot delete penalty as it is currently in use by active lease agreements'
            });
        }

        // Soft delete by setting isActive to false
        const deletedPenalty = await penaltyModel.findByIdAndUpdate(
            penaltyId,
            { 
                isActive: false,
                deactivatedAt: new Date()
            },
            { new: true }
        );

        return reply.code(200).send({
            message: 'Lease penalty deleted successfully',
            data: deletedPenalty
        });

    } catch (error) {
        console.error('Error in delete_lease_penalty:', error);
        return reply.code(500).send({
            error: 'Failed to delete lease penalty',
            details: error.message
        });
    }
};

module.exports = delete_lease_penalty;