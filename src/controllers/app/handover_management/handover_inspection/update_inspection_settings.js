const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Update existing inspection item
 * Route: PUT /api/app/handover_management/update_inspection_settings/:facilityId/:inspectionId
 */
const update_inspection_settings = async (request, reply) => {
    try {
        const { facilityId, inspectionId } = request.params;
        const updateData = request.body;

        console.log('Update inspection settings - received data:', updateData);
        console.log('Update inspection settings - facilityId:', facilityId, 'inspectionId:', inspectionId);

        // Get the inspection item model for this facility
        const InspectionItem = await getModel('InspectionItem', payservedb.InspectionItem.schema, facilityId);

        // Check if inspection item exists
        const existingItem = await InspectionItem.findById(inspectionId);

        if (!existingItem) {
            return reply.code(404).send({
                success: false,
                error: `Inspection item with ID ${inspectionId} not found.`
            });
        }

        // Handle new image uploads
        let newImageUrls = [];
        if (request.files && request.files.length > 0) {
            newImageUrls = request.files.map(file => `/uploads/${file.filename}`);
            console.log('New images uploaded:', newImageUrls);
        }

        // Parse possibleConditions if it's a string
        if (updateData.possibleConditions && typeof updateData.possibleConditions === 'string') {
            try {
                updateData.possibleConditions = JSON.parse(updateData.possibleConditions);
            } catch {
                updateData.possibleConditions = updateData.possibleConditions.split(',').map(s => s.trim());
            }
        }

        // Handle images: use existing images that user kept + new uploads
        let finalImages = [];

        // Parse existingImages from request body (images user wants to keep)
        if (updateData.existingImages) {
            try {
                const existingImagesToKeep = JSON.parse(updateData.existingImages);
                if (Array.isArray(existingImagesToKeep)) {
                    finalImages = [...existingImagesToKeep];
                    console.log('Keeping existing images:', existingImagesToKeep);
                }
            } catch (err) {
                console.error('Error parsing existingImages:', err);
            }
            // Remove existingImages from updateData as it's not a model field
            delete updateData.existingImages;
        } else {
            // If no existingImages field sent, keep all existing images (backward compatibility)
            finalImages = [...(existingItem.images || [])];
        }

        // Add new uploaded images
        if (newImageUrls.length > 0) {
            finalImages = [...finalImages, ...newImageUrls];
            console.log('Adding new images:', newImageUrls);
        }

        // Update images array if it changed
        if (finalImages.length > 0 || updateData.existingImages !== undefined) {
            updateData.images = finalImages;
            console.log('Final images array:', finalImages);
        }

        // Parse numeric fields
        if (updateData.cost) {
            updateData.cost = parseFloat(updateData.cost);
        }
        if (updateData.defaultQuantity) {
            updateData.defaultQuantity = parseInt(updateData.defaultQuantity);
        }

        // Add updatedBy if user is available
        if (request.user) {
            updateData.updatedBy = request.user._id;
        }

        // Update inspection item
        const updatedItem = await InspectionItem.findByIdAndUpdate(
            inspectionId,
            updateData,
            { new: true, runValidators: true }
        );

        console.log('Updated inspection item:', updatedItem);

        return reply.code(200).send({
            success: true,
            message: 'Inspection item updated successfully',
            data: updatedItem
        });
    } catch (err) {
        console.error('Error in update_inspection_settings:', err);

        // Handle validation errors
        if (err.name === 'ValidationError') {
            return reply.code(400).send({
                success: false,
                error: 'Validation error',
                details: Object.values(err.errors).map(e => e.message)
            });
        }

        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while updating inspection item.'
        });
    }
};

module.exports = update_inspection_settings;