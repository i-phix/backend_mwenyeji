const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const get_inspection_categories = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        console.log('Get inspection categories - Facility ID:', facilityId);

        // Validate facilityId
        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required parameter: facilityId'
            });
        }

        // Get the inspection category model for this facility
        const InspectionCategory = await getModel('InspectionCategory', payservedb.InspectionCategory.schema, facilityId);

        // Fetch only active categories
        const categories = await InspectionCategory.find({ active: { $ne: false } }).sort({ name: 1 }).lean();

        console.log(`Found ${categories.length} inspection categories for facility ${facilityId}`);
        if (categories.length > 0) {
            console.log('Sample category:', categories[0]);
        }

        return reply.code(200).send({
            success: true,
            message: 'Inspection categories retrieved successfully',
            data: categories,
            count: categories.length
        });
    } catch (err) {
        console.error('Error in get_inspection_categories:', err);

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while retrieving inspection categories'
        });
    }
};

module.exports = get_inspection_categories;
