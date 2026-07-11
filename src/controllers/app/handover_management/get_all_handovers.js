const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_all_handovers = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { handoverType } = request.query;

        console.log('GET ALL HANDOVERS - Facility ID:', facilityId);
        console.log('GET ALL HANDOVERS - Type Filter:', handoverType || 'None');

        // Validate facilityId
        if (!facilityId) {
            return reply.code(400).send({ 
                success: false,
                error: 'Missing required parameter: facilityId.' 
            });
        }

        try {
            // Dynamically fetch the facility-specific Handover model
            const handoverModel = await getModel('Handover', payservedb.Handover.schema, facilityId);
            console.log('Successfully got Handover model');

            // Build query - filter by type if provided
            const query = {};
            if (handoverType) {
                query.handoverType = handoverType;
            }

            // Fetch handovers without population to avoid schema errors
            const handovers = await handoverModel.find(query).lean();
            console.log(`Found ${handovers.length} handovers matching query`);

            // Process each handover to add customer and unit information
            const processedHandovers = await Promise.all(handovers.map(async (handover) => {
                // Get customer information from main database
                let customerInfo = null;
                try {
                    if (handover.customerId) {
                        const customer = await payservedb.Customer.findById(handover.customerId);
                        if (customer) {
                            customerInfo = {
                                _id: customer._id,
                                firstName: customer.firstName,
                                lastName: customer.lastName,
                                name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Unknown Customer',
                                email: customer.email,
                                phoneNumber: customer.phoneNumber
                            };
                        }
                    }
                } catch (customerError) {
                    console.error('Error fetching customer:', customerError.message);
                }

                // Get unit information
                let unitInfo = null;
                try {
                    if (handover.unitId) {
                        const unitModel = await getModel('Unit', payservedb.Unit.schema, facilityId);
                        const unit = await unitModel.findById(handover.unitId);
                        if (unit) {
                            unitInfo = unit.toObject ? unit.toObject() : JSON.parse(JSON.stringify(unit));
                        }
                    }
                } catch (unitError) {
                    console.error('Error fetching unit:', unitError.message);
                }

                // Get related handover for move-out handovers
                let relatedHandoverInfo = null;
                try {
                    if (handover.handoverType === 'MoveOut' && handover.relatedHandoverId) {
                        const relatedHandover = await handoverModel.findById(handover.relatedHandoverId);
                        if (relatedHandover) {
                            relatedHandoverInfo = relatedHandover.toObject ? 
                                relatedHandover.toObject() : JSON.parse(JSON.stringify(relatedHandover));
                        }
                    }
                } catch (relatedError) {
                    console.error('Error fetching related handover:', relatedError.message);
                }

                // Migrate legacy attachments if needed
                let migratedAttachments = handover.attachments || [];
                if (Array.isArray(migratedAttachments)) {
                    migratedAttachments = migratedAttachments.map(att => {
                        if (att.name && !att.fileName) {
                            // Legacy format: name contains the filename
                            return {
                                ...att,
                                fileName: att.name,  // Original filename
                                name: ''             // Empty custom name
                            };
                        }
                        return att;
                    });
                }

                // Return the processed handover with added info
                const result = {
                    ...handover,
                    customerId: customerInfo || handover.customerId,
                    unitId: unitInfo || handover.unitId,
                    relatedHandoverId: relatedHandoverInfo || handover.relatedHandoverId,
                    attachments: migratedAttachments
                };

                return result;
            }));

            // Return success response with consistent structure
            return reply.code(200).send({
                success: true,
                message: 'Handovers retrieved successfully',
                data: processedHandovers,
                count: processedHandovers.length,
                facilityId: facilityId,
                filters: { handoverType: handoverType || 'all' }
            });
        } catch (modelError) {
            console.error('Error with models in get_all_handovers:', modelError);
            return reply.code(500).send({ 
                success: false,
                error: `Database error: ${modelError.message}` 
            });
        }
    } catch (err) {
        console.error('Error in get_all_handovers:', err);
        return reply.code(500).send({ 
            success: false,
            error: err.message || 'An error occurred while retrieving handovers.'
        });
    }
};

module.exports = get_all_handovers;