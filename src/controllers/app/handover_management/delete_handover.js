const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const delete_handover = async (request, reply) => {
    try {
        const { facilityId, handoverId } = request.params;

        // Validate required fields
        if (!handoverId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Handover ID is required.' 
            });
        }

        // Dynamically fetch models
        const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);

        // Find the handover
        const handover = await handoverModel.findById(handoverId);

        if (!handover) {
            return reply.code(404).send({ 
                success: false,
                error: `Handover with ID ${handoverId} does not exist.` 
            });
        }

        // If it's a move-in handover, check if it has related move-out handovers
        if (handover.handoverType === 'MoveIn') {
            const relatedMoveOut = await handoverModel.findOne({
                relatedHandoverId: handoverId
            });

            if (relatedMoveOut) {
                return reply.code(400).send({ 
                    success: false,
                    error: 'Cannot delete this Move-In handover because it has a related Move-Out handover. Delete the Move-Out handover first.' 
                });
            }
        }

        // Delete the handover
        await handoverModel.findByIdAndDelete(handoverId);

        return reply.code(200).send({
            success: true,
            message: 'Handover deleted successfully'
        });

    } catch (err) {
        console.error('Error in delete_handover:', err);
        
        return reply.code(500).send({ 
            success: false,
            error: err.message || 'An error occurred while deleting the handover.'
        });
    }
};

module.exports = delete_handover;