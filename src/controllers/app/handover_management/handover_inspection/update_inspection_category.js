const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const update_inspection_category = async (request, reply) => {
    try {
        const { facilityId, categoryId } = request.params;
        const { name, description, active } = request.body || {};

        console.log('Update inspection category - received data:', {
            facilityId, categoryId, name, description, active
        });

        // Validate required fields
        if (!categoryId) {
            return reply.code(400).send({
                success: false,
                error: 'Category ID is required'
            });
        }

        // Get the inspection category model for this facility
        const InspectionCategory = await getModel('InspectionCategory', payservedb.InspectionCategory.schema, facilityId);

        // Build update object with only provided fields
        const updateData = {};

        if (name !== undefined) {
            if (!name || name.trim() === '') {
                return reply.code(400).send({
                    success: false,
                    error: 'Category name cannot be empty'
                });
            }

            // Check if another category with the same name exists (excluding current category)
            const existingCategory = await InspectionCategory.findOne({
                facilityId,
                name: name.trim(),
                _id: { $ne: categoryId }
            });

            if (existingCategory) {
                return reply.code(400).send({
                    success: false,
                    error: 'Another category with this name already exists'
                });
            }

            updateData.name = name.trim();
        }

        if (description !== undefined) {
            updateData.description = description.trim();
        }

        if (active !== undefined) {
            updateData.active = active;
        }

        // Find and update the category
        const updatedCategory = await InspectionCategory.findByIdAndUpdate(
            categoryId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedCategory) {
            return reply.code(404).send({
                success: false,
                error: `Category with ID ${categoryId} not found`
            });
        }

        console.log('Updated inspection category:', updatedCategory);

        return reply.code(200).send({
            success: true,
            message: 'Inspection category updated successfully',
            data: updatedCategory
        });
    } catch (err) {
        console.error('Error in update_inspection_category:', err);

        // Handle MongoDB duplicate key error
        if (err.code === 11000) {
            return reply.code(400).send({
                success: false,
                error: 'A category with this name already exists'
            });
        }

        // Handle MongoDB validation errors
        if (err.name === 'ValidationError') {
            return reply.code(400).send({
                success: false,
                error: 'Validation error',
                details: Object.values(err.errors).map(e => e.message)
            });
        }

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while updating inspection category'
        });
    }
};

module.exports = update_inspection_category;
