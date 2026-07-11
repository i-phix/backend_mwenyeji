const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_inspection_category = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { name, description } = request.body || {};

        console.log('Add inspection category - received data:', {
            name, description, facilityId
        });

        // Validate required fields
        if (!name || name.trim() === '') {
            return reply.code(400).send({
                success: false,
                error: 'Category name is required'
            });
        }

        // Get the inspection category model for this facility
        const InspectionCategory = await getModel('InspectionCategory', payservedb.InspectionCategory.schema, facilityId);

        // Check if category already exists for this facility
        const existingCategory = await InspectionCategory.findOne({
            facilityId,
            name: name.trim()
        });

        if (existingCategory) {
            return reply.code(400).send({
                success: false,
                error: 'A category with this name already exists for this facility'
            });
        }

        // Create inspection category data
        const categoryData = {
            facilityId,
            name: name.trim(),
            description: (description || '').trim()
        };

        console.log('Inspection category data to be saved:', categoryData);

        // Create inspection category
        const category = await InspectionCategory.create(categoryData);

        console.log('Created inspection category:', category);

        return reply.code(201).send({
            success: true,
            message: 'Inspection category created successfully',
            data: category
        });
    } catch (err) {
        console.error('Error in add_inspection_category:', err);

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
            error: err.message || 'An error occurred while creating inspection category'
        });
    }
};

module.exports = add_inspection_category;
