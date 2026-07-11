const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const delete_inspection_category = async (request, reply) => {
    try {
        const { facilityId, categoryId } = request.params;

        console.log('Delete inspection category - ID:', categoryId, 'Facility:', facilityId);

        // Validate required fields
        if (!categoryId) {
            return reply.code(400).send({
                success: false,
                error: 'Category ID is required'
            });
        }

        // Get the inspection category model for this facility
        const InspectionCategory = await getModel('InspectionCategory', payservedb.InspectionCategory.schema, facilityId);

        // Find the category to be deleted
        const category = await InspectionCategory.findById(categoryId);

        if (!category) {
            return reply.code(404).send({
                success: false,
                error: `Category with ID ${categoryId} not found`
            });
        }

        // Check if any inspection items are using this category
        const InspectionItem = await getModel('InspectionItem', payservedb.InspectionItem.schema, facilityId);
        const itemsUsingCategory = await InspectionItem.countDocuments({
            facilityId,
            category: category.name
        });

        if (itemsUsingCategory > 0) {
            return reply.code(400).send({
                success: false,
                error: `Cannot delete category. ${itemsUsingCategory} inspection item(s) are using this category`
            });
        }

        // Delete the category
        await InspectionCategory.findByIdAndDelete(categoryId);

        console.log('Deleted inspection category:', categoryId);

        return reply.code(200).send({
            success: true,
            message: 'Inspection category deleted successfully'
        });
    } catch (err) {
        console.error('Error in delete_inspection_category:', err);

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while deleting inspection category'
        });
    }
};

module.exports = delete_inspection_category;
