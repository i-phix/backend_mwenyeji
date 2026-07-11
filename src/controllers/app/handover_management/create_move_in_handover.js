const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const create_move_in_handover = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const {
            unitId,
            customerId,
            handoverDate,
            items,
            meterReadings,
            keysHandedOver,
            notes,
            attachments,
            signatures,
            status
        } = request.body;

        // Validate required fields
        if (!unitId || !customerId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Missing required fields: unitId and customerId are required.' 
            });
        }

        // Process file attachments if any
        let processedAttachments = [];
        if (attachments && attachments.length > 0) {
            // Process each attachment
            processedAttachments = attachments.map(attachment => {
                const { name, fileUrl, file, uploadDate } = attachment;
                
                // In a real scenario, the file would be saved to disk/cloud storage
                // and a path would be stored instead of the file object
                // For now, we'll just keep the name and upload date
                return {
                    name,
                    fileUrl, // In production, this would be a path to stored file
                    uploadDate: uploadDate || new Date()
                };
            });
        }

        let handover;
        let populatedHandover;
        let handoverModel;
        let customer;

        try {
            // Dynamically fetch facility-specific models
            handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
            const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);

            // Validate unit exists in facility database
            const unit = await unitModel.findById(unitId);
            if (!unit) {
                return reply.code(404).send({ 
                    success: false,
                    error: `Unit with ID ${unitId} does not exist.` 
                });
            }

            // Customer is in the main database - use direct model without getModel
            customer = await payservedb.Customer.findById(customerId);
            if (!customer) {
                return reply.code(404).send({ 
                    success: false,
                    error: `Customer with ID ${customerId} does not exist.` 
                });
            }

            // Check if move-in handover already exists for this customer and unit
            const existingHandover = await handoverModel.findOne({
                unitId,
                customerId,
                handoverType: 'MoveIn'
            });

            if (existingHandover) {
                console.log(`Move-in handover already exists for customer ${customerId} in unit ${unitId}`);
                return reply.code(200).send({
                    success: true,
                    message: 'Move-in handover already exists',
                    data: existingHandover
                });
            }

            // Create handover data
            const handoverData = {
                facilityId,
                unitId,
                customerId,
                handoverType: 'MoveIn',
                handoverDate: handoverDate ? new Date(handoverDate) : new Date(),
                items: items || [],
                meterReadings: meterReadings || {
                    electricity: { reading: 0 },
                    water: { reading: 0 },
                    gas: { reading: 0 }
                },
                keysHandedOver: keysHandedOver || 0,
                notes: notes || '',
                attachments: processedAttachments,
                signatures: signatures || {
                    propertyManager: {},
                    customer: {}
                },
                status: status || 'Draft'
            };
            
            // Create handover in the facility database
            handover = await handoverModel.create(handoverData);

        } catch (modelError) {
            console.error('Error with models or creating handover:', modelError);
            
            // Check if the handover was actually created despite the error
            if (handover && handover._id) {
                console.log('Handover was created despite error. Continuing with response.');
            } else {
                return reply.code(500).send({ 
                    success: false,
                    error: `Database error: ${modelError.message}` 
                });
            }
        }

        try {
            // If we have a handover ID, try to fetch it with unit data populated
            if (handover && handover._id) {
                try {
                    populatedHandover = await handoverModel
                        .findById(handover._id)
                        .populate('unitId')
                        .lean();
                } catch (populateError) {
                    console.error('Error populating handover:', populateError);
                    // If population fails, use the original handover
                    populatedHandover = handover.toObject ? handover.toObject() : JSON.parse(JSON.stringify(handover));
                }

                // If we have a customer, manually add customer data
                if (customer && populatedHandover) {
                    populatedHandover.customerId = {
                        _id: customer._id,
                        firstName: customer.firstName,
                        lastName: customer.lastName,
                        email: customer.email,
                        phoneNumber: customer.phoneNumber
                    };
                }

                return reply.code(200).send({
                    success: true,
                    message: 'Move-In Handover created successfully',
                    data: populatedHandover
                });
            } else {
                return reply.code(500).send({ 
                    success: false,
                    error: 'Failed to create handover due to unknown error' 
                });
            }
        } catch (responseError) {
            console.error('Error preparing response:', responseError);
            
            // If handover was created but we can't prepare a proper response,
            // still return success with the basic handover data
            if (handover && handover._id) {
                const basicHandover = {
                    _id: handover._id,
                    message: 'Handover was created, but detailed data could not be retrieved'
                };
                
                return reply.code(200).send({
                    success: true,
                    message: 'Move-In Handover created with limited details',
                    data: basicHandover
                });
            } else {
                return reply.code(500).send({ 
                    success: false,
                    error: responseError.message || 'An error occurred while preparing the response.' 
                });
            }
        }
    } catch (err) {
        console.error('Error in create_move_in_handover:', err);
        
        return reply.code(500).send({ 
            success: false,
            error: err.message || 'An error occurred while creating the move-in handover.'
        });
    }
};

module.exports = create_move_in_handover;