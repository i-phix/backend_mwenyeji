const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');
const logger = require('../../../../../config/winston');

/**
 * Get inspection items for a specific unit
 * Route: GET /api/app/handover_management/get_unit_inspection_items/:facilityId/:unitId
 */
const get_unit_inspection_items = async (request, reply) => {
    try {
        const { facilityId, unitId } = request.params;

        logger.info(`Fetching inspection items for facility: ${facilityId}, unit: ${unitId}`);

        // Get the inspection item model for this facility
        const InspectionItem = await getModel('InspectionItem', payservedb.InspectionItem.schema, facilityId);

        // Query for items specific to this unit and active items
        const query = {
            facilityId,
            unitId,
            active: true
        };

        logger.info(`Query conditions: ${JSON.stringify(query)}`);

        // Fetch inspection items with populated currency information
        let inspectionItems;
        try {
            inspectionItems = await InspectionItem.find(query)
                .populate('currencyId', 'currencyName currencyShortCode isDefaultCurrency exchangeRate')
                .sort({ category: 1, name: 1 })
                .lean();

            logger.info(`Found ${inspectionItems.length} inspection items with populate`);
        } catch (populateError) {
            logger.error('Error with populate, falling back to basic query:', populateError);
            // Fallback to basic query without populate
            inspectionItems = await InspectionItem.find(query)
                .sort({ category: 1, name: 1 })
                .lean();

            logger.info(`Found ${inspectionItems.length} inspection items without populate`);
        }

        // Transform inspection items to handover item format
        const handoverItems = inspectionItems.map(item => ({
            // From inspection item
            inspectionItemId: item._id,
            name: item.name,
            category: item.category,
            description: item.description || '',
            condition: item.defaultCondition || 'Good',
            quantity: item.defaultQuantity || 1,
            serialNumber: item.serialNumber || '',
            images: item.images || [],
            notes: '',
            // Additional metadata for reference
            cost: item.cost || 0,
            currencyId: item.currencyId,
            possibleConditions: item.possibleConditions || ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Non-functional']
        }));

        logger.info(`Transformed ${handoverItems.length} items to handover format`);

        return reply.code(200).send({
            success: true,
            data: handoverItems,
            meta: {
                total: handoverItems.length,
                unitId,
                facilityId
            }
        });
    } catch (err) {
        logger.error('Error in get_unit_inspection_items:', err);

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while fetching unit inspection items.'
        });
    }
};

module.exports = get_unit_inspection_items;
