// controllers/lease/penalties/update_lease_penalty.js
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_lease_penalty = async (request, reply) => {
    try {
        const { facilityId, penaltyId } = request.params;
        const updates = request.body;

        const penaltyModel = await getModel('Penalty', payservedb.Penalty.schema, facilityId);

        // Ensure penalty exists and belongs to facility
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

        // Validate type and corresponding values if being updated
        if (updates.type) {
            if (!['percentage', 'fixed'].includes(updates.type)) {
                return reply.code(400).send({
                    error: 'Type must be either percentage or fixed'
                });
            }

            if (updates.type === 'percentage') {
                if (updates.percentage === undefined || updates.percentage < 0) {
                    return reply.code(400).send({
                        error: 'For percentage type, provide a valid percentage value (minimum 0)'
                    });
                }
                updates.amount = undefined; // Clear amount field for percentage type
            } else {
                if (updates.amount === undefined || updates.amount < 0) {
                    return reply.code(400).send({
                        error: 'For fixed type, provide a valid positive amount'
                    });
                }
                updates.percentage = undefined; // Clear percentage field for fixed type
            }
        } else {
            // If type is not being updated, validate against existing type
            if (existingPenalty.type === 'percentage' && updates.percentage !== undefined) {
                if (updates.percentage < 0) {
                    return reply.code(400).send({
                        error: 'Percentage must be at least 0'
                    });
                }
            } else if (existingPenalty.type === 'fixed' && updates.amount !== undefined) {
                if (updates.amount < 0) {
                    return reply.code(400).send({
                        error: 'Amount must be a positive number'
                    });
                }
            }
        }

        // Validate effectDays if being updated
        if (updates.effectDays !== undefined && updates.effectDays < 1) {
            return reply.code(400).send({
                error: 'Effect days must be at least 1'
            });
        }

        // Check name uniqueness if being updated
        if (updates.name && updates.name !== existingPenalty.name) {
            const nameExists = await penaltyModel.findOne({
                name: updates.name,
                facilityId,
                _id: { $ne: penaltyId }
            });

            if (nameExists) {
                return reply.code(400).send({
                    error: 'A penalty with this name already exists in this facility'
                });
            }
        }

        // Prevent changing the module
        updates.module = 'lease';

        // Update the penalty
        const updatedPenalty = await penaltyModel.findByIdAndUpdate(
            penaltyId,
            { $set: updates },
            { 
                new: true,
                runValidators: true 
            }
        );

        return reply.code(200).send({
            message: 'Lease penalty updated successfully',
            data: updatedPenalty
        });

    } catch (error) {
        console.error('Error in update_lease_penalty:', error);
        return reply.code(500).send({
            error: 'Failed to update lease penalty',
            details: error.message
        });
    }
};

module.exports = update_lease_penalty;