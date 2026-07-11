const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

const add_inspection_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        
        // With multer middleware, form data is automatically parsed
        const {
            name,
            category,
            description,
            possibleConditions,
            defaultCondition,
            isRequired,
            defaultQuantity,
            serialNumber,
            cost,
            active,
            unitId,
            currencyId
        } = request.body || {};
        
        console.log('Add inspection settings - received data:', {
            name, category, description, possibleConditions, defaultCondition,
            isRequired, defaultQuantity, serialNumber, cost, active, unitId, currencyId
        });
        
        // Validate required fields
        if (!name || !category) {
            return reply.code(400).send({
                success: false,
                error: 'Missing required fields in the request body. Name and category are required.'
            });
        }
        
        // Get the inspection item model for this facility
        const InspectionItem = await getModel('InspectionItem', payservedb.InspectionItem.schema, facilityId);
        
        // Handle file uploads
        let imageUrls = [];
        if (request.files && request.files.length > 0) {
            imageUrls = request.files.map(file => `/uploads/${file.filename}`);
        }
        
        // Parse possibleConditions if it's a string
        let parsedConditions = possibleConditions;
        if (typeof possibleConditions === 'string') {
            try {
                parsedConditions = JSON.parse(possibleConditions);
            } catch {
                parsedConditions = possibleConditions.split(',').map(s => s.trim());
            }
        }
        
        // Create inspection item data
        const inspectionItemData = {
            facilityId,
            unitId: unitId || null,
            currencyId: currencyId || null,
            name,
            category,
            description: description || '',
            possibleConditions: parsedConditions || ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged', 'Non-functional'],
            defaultCondition: defaultCondition || 'Good',
            isRequired: isRequired !== undefined ? isRequired : true,
            defaultQuantity: defaultQuantity || 1,
            serialNumber: serialNumber || '',
            cost: parseFloat(cost) || 0,
            images: imageUrls,
            active: active !== undefined ? active : true
        };
        
        console.log('Inspection item data to be saved:', inspectionItemData);
        
        // Create inspection item
        const inspectionItem = await InspectionItem.create(inspectionItemData);
        
        console.log('Created inspection item:', inspectionItem);
        
        return reply.code(201).send({
            success: true,
            message: 'Inspection item created successfully',
            data: inspectionItem
        });
    } catch (err) {
        console.error('Error in add_inspection_settings:', err);
        
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
            error: err.message || 'An error occurred while creating inspection item.'
        });
    }
};

module.exports = add_inspection_settings;