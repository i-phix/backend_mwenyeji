// controllers/lease/penalties/penalty_status.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const penalty_status = async (request, reply) => {
    try {
        const { facilityId, penaltyId } = request.params;
        const { isActive } = request.body;

        // Validate isActive parameter
        if (typeof isActive !== 'boolean') {
            return reply.code(400).send({
                error: 'isActive must be a boolean value'
            });
        }

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        // Check if penalty exists and belongs to the facility
        const existingPenalty = await penaltyModel.findOne({
            _id: penaltyId,
            facilityId,
            module: 'lease'
        });

        if (!existingPenalty) {
            return reply.code(404).send({
                error: 'Lease penalty not found'
            });
        }

        // Update penalty status
        const updatedPenalty = await penaltyModel.findByIdAndUpdate(
            penaltyId,
            {
                $set: {
                    isActive: isActive,
                    updatedAt: new Date()
                }
            },
            {
                new: true,
                runValidators: true
            }
        );

        if (!updatedPenalty) {
            return reply.code(500).send({
                error: 'Failed to update penalty status'
            });
        }

        // Log activity for audit trail
        console.log(`Penalty ${penaltyId} status changed to ${isActive ? 'active' : 'inactive'} in facility ${facilityId}`);

        return reply.code(200).send({
            message: `Penalty ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: {
                _id: updatedPenalty._id,
                name: updatedPenalty.name,
                isActive: updatedPenalty.isActive,
                updatedAt: updatedPenalty.updatedAt
            }
        });

    } catch (error) {
        console.error('Error in penalty_status:', error);

        // Handle specific MongoDB errors
        if (error.name === 'CastError') {
            return reply.code(400).send({
                error: 'Invalid penalty ID format'
            });
        }

        if (error.name === 'ValidationError') {
            return reply.code(400).send({
                error: 'Validation error',
                details: error.message
            });
        }

        return reply.code(500).send({
            error: 'Failed to update penalty status',
            details: error.message
        });
    }
};

module.exports = penalty_status;