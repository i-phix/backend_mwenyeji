const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const logger = require('../../../../config/winston');

/**
 * Get units that have move-in handovers
 * Route: GET /api/app/handover_management/units_with_move_in/:facilityId
 */
const get_units_with_move_in = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { customerId } = request.query;

        logger.info(`Fetching units with move-in handovers for facility: ${facilityId}`);

        // Get facility-specific models
        const Handover = await getModel('Handover', payservedb.Handover.schema, facilityId);
        const Unit = await getModel('Unit', payservedb.Unit.schema, facilityId);

        // Build query for move-in handovers - only completed ones
        const handoverQuery = {
            facilityId,
            handoverType: 'MoveIn',
            status: 'Completed' // Only completed move-in handovers
        };

        // Optionally filter by customer if provided
        if (customerId) {
            handoverQuery.customerId = customerId;
            logger.info(`Filtering by customerId: ${customerId}`);
        }

        // Find all move-in handovers
        const moveInHandovers = await Handover.find(handoverQuery)
            .select('unitId customerId handoverDate status')
            .lean();

        logger.info(`Found ${moveInHandovers.length} move-in handovers`);

        // Extract unique unit IDs
        const unitIds = [...new Set(moveInHandovers.map(h => h.unitId.toString()))];

        logger.info(`Unique units with move-in: ${unitIds.length}`);

        // Fetch unit details
        const units = await Unit.find({ _id: { $in: unitIds } })
            .select('name floorUnitNo floor status propertyType')
            .lean();

        // Enhance units with move-in handover info
        const unitsWithHandoverInfo = units.map(unit => {
            const handover = moveInHandovers.find(h => h.unitId.toString() === unit._id.toString());
            return {
                ...unit,
                moveInHandoverId: handover._id,
                moveInDate: handover.handoverDate,
                moveInStatus: handover.status,
                customerId: handover.customerId
            };
        });

        logger.info(`Returning ${unitsWithHandoverInfo.length} units with move-in handover info`);

        return reply.code(200).send({
            success: true,
            data: unitsWithHandoverInfo,
            meta: {
                total: unitsWithHandoverInfo.length,
                facilityId,
                customerId: customerId || null
            }
        });
    } catch (err) {
        logger.error('Error in get_units_with_move_in:', err);

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching units with move-in handovers.'
        });
    }
};

module.exports = get_units_with_move_in;
