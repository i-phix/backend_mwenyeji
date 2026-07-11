const payservedb = require('payservedb');
const mongoose = require('mongoose');
const { getModel } = require("../../../utils/getModel");
const logger = require('../../../../config/winston');

/**
 * Retrieves a public invoice with support for different invoice types
 * Enhanced with fallback lookup by lease ID/contract ID
 * 
 * @param {Object} request - Fastify request object
 * @param {Object} reply - Fastify reply object
 * @returns {Object} Invoice details or error response
 */
const get_public_invoice = async (request, reply) => {
    const { facilityId, invoiceId, type } = request.params;

    try {
        // Validate input parameters
        if (!facilityId || !invoiceId) {
            logger.warn('Missing facilityId or invoiceId in public invoice request', {
                facilityId,
                invoiceId,
                type
            });

            return reply.code(400).send({
                success: false,
                message: 'Facility ID and Invoice ID are required'
            });
        }

        // Sanitize invoiceId by removing any additional parameters
        const sanitizedInvoiceId = invoiceId.split('&')[0].trim();
        const sanitizedType = type ? type.toLowerCase() : null;

        // Log the request parameters
        console.log('Public invoice request:', {
            facilityId,
            invoiceId: sanitizedInvoiceId,
            type: sanitizedType
        });

        // Get the Invoice model for the specific facility
        const InvoiceModel = await getModel(
            'Invoice', 
            payservedb.Invoice.schema, 
            facilityId
        );

        // Attempt to find invoice by direct ID first
        let invoice = null;
        
        if (mongoose.Types.ObjectId.isValid(sanitizedInvoiceId)) {
            // Direct lookup by invoice ID
            invoice = await InvoiceModel.findOne({
                _id: sanitizedInvoiceId,
                'facility.id': facilityId
            }).lean();
            
            if (invoice) {
                console.log(`Invoice found by direct ID: ${sanitizedInvoiceId}`);
            }
        }
        
        // If not found and type is 'lease', try looking up by lease ID in whatFor.description
        if (!invoice && sanitizedType === 'lease') {
            // Try to find by lease ID in the whatFor.description field
            invoice = await InvoiceModel.findOne({
                'whatFor.description': sanitizedInvoiceId,
                'facility.id': facilityId,
                'whatFor.invoiceType': 'Lease'
            }).sort({ createdAt: -1 }).lean();
            
            if (invoice) {
                console.log(`Invoice found by lease ID in whatFor.description: ${sanitizedInvoiceId} -> ${invoice._id}`);
            }
        }
        
        // If not found and type is 'levy', try looking up by contract ID in whatFor.description
        if (!invoice && (sanitizedType === 'levy' || sanitizedType === 'contract')) {
            // Try to find by contract ID in the whatFor.description field
            invoice = await InvoiceModel.findOne({
                'whatFor.description': sanitizedInvoiceId,
                'facility.id': facilityId,
                'whatFor.invoiceType': { $in: ['Contract', 'Levy'] }
            }).sort({ createdAt: -1 }).lean();
            
            if (invoice) {
                console.log(`Invoice found by contract ID in whatFor.description: ${sanitizedInvoiceId} -> ${invoice._id}`);
            }
        }
        
        // As a last resort, try to find any invoice related to this ID regardless of type
        if (!invoice && mongoose.Types.ObjectId.isValid(sanitizedInvoiceId)) {
            // Try to find any invoice with this ID as whatFor.description
            invoice = await InvoiceModel.findOne({
                'whatFor.description': sanitizedInvoiceId,
                'facility.id': facilityId
            }).sort({ createdAt: -1 }).lean();
            
            if (invoice) {
                console.log(`Invoice found by generic ID lookup in whatFor.description: ${sanitizedInvoiceId} -> ${invoice._id}`);
            }
        }

        // Check if invoice exists
        if (!invoice) {
            logger.warn('Invoice not found after all lookup attempts', {
                facilityId,
                invoiceId: sanitizedInvoiceId,
                type: sanitizedType
            });

            return reply.code(404).send({
                success: false,
                message: 'Invoice not found',
                error: `Error: 404 - undefined`
            });
        }

        // Get associated models for additional data
        const ClientModel = await getModel(
            'Customer', 
            payservedb.Customer.schema, 
            facilityId
        );

        const UnitModel = await getModel(
            'Unit', 
            payservedb.Unit.schema, 
            facilityId
        );

        // Populate related data
        const populatedInvoice = { ...invoice };

        // Populate client - Enhanced with better fallback handling
        if (invoice.client?.clientId) {
            try {
                const clientData = await ClientModel.findById(invoice.client.clientId).lean();
                if (clientData) {
                    populatedInvoice.client = clientData;
                } else {
                    // Client not found in database - create placeholder
                    logger.warn('Client not found in database, using placeholder', {
                        clientId: invoice.client.clientId,
                        invoiceId: invoice._id
                    });
                    
                    // Preserve existing client data and add placeholder information
                    populatedInvoice.client = {
                        _id: invoice.client.clientId,
                        firstName: invoice.client.firstName || 'Unknown',
                        lastName: invoice.client.lastName || 'Client',
                        // Flag to indicate this is a placeholder
                        isPlaceholder: true
                    };
                }
            } catch (clientError) {
                logger.warn('Error fetching client details', {
                    error: clientError.message,
                    clientId: invoice.client.clientId
                });
                
                // Create placeholder client data
                populatedInvoice.client = {
                    _id: invoice.client.clientId,
                    firstName: invoice.client.firstName || 'Unknown',
                    lastName: invoice.client.lastName || 'Client',
                    isPlaceholder: true
                };
            }
        } else {
            // No client ID in the invoice - create default client
            logger.warn('No client data in invoice, using default client', {
                invoiceId: invoice._id
            });
            
            populatedInvoice.client = {
                _id: null,
                firstName: 'Unknown',
                lastName: 'Client',
                isPlaceholder: true
            };
        }

        // Populate unit with better fallback handling
        if (invoice.unit?.id) {
            try {
                const unitData = await UnitModel.findById(invoice.unit.id).lean();
                if (unitData) {
                    populatedInvoice.unit = unitData;
                } else {
                    // Unit not found in database - create placeholder
                    logger.warn('Unit not found in database, using placeholder', {
                        unitId: invoice.unit.id,
                        invoiceId: invoice._id
                    });
                    
                    // Preserve existing unit data and add placeholder information
                    populatedInvoice.unit = {
                        _id: invoice.unit.id,
                        name: invoice.unit.name || 'Unknown Unit',
                        isPlaceholder: true
                    };
                }
            } catch (unitError) {
                logger.warn('Error fetching unit details', {
                    error: unitError.message,
                    unitId: invoice.unit.id
                });
                
                // Create placeholder unit data
                populatedInvoice.unit = {
                    _id: invoice.unit.id,
                    name: invoice.unit.name || 'Unknown Unit', 
                    isPlaceholder: true
                };
            }
        } else {
            // No unit ID in the invoice - create default unit
            populatedInvoice.unit = {
                _id: null,
                name: 'General Service',
                isPlaceholder: true
            };
        }

        // Handle payment details - preserve existing details if they are already an object
        if (invoice.paymentDetails) {
            // If paymentDetails is already an object with required properties, use it directly
            if (typeof invoice.paymentDetails === 'object' && 
                invoice.paymentDetails.paymentMethod && 
                invoice.paymentDetails.paymentStatus) {
                populatedInvoice.paymentDetails = invoice.paymentDetails;
            } else if (mongoose.Types.ObjectId.isValid(invoice.paymentDetails)) {
                // Only attempt to fetch if it's a valid ObjectId
                try {
                    const PaymentDetailsModel = await getModel(
                        'FacilityPaymentDetails', 
                        payservedb.FacilityPaymentDetails.schema, 
                        facilityId
                    );

                    populatedInvoice.paymentDetails = await PaymentDetailsModel.findById(invoice.paymentDetails).lean();
                } catch (paymentError) {
                    logger.warn('Error fetching payment details', {
                        error: paymentError.message,
                        paymentDetailsId: invoice.paymentDetails
                    });
                    // Keep original payment details if fetch fails
                }
            }
        }

        // Log successful retrieval
        logger.info('Public invoice retrieved successfully', {
            facilityId,
            invoiceId: invoice._id,
            originalId: sanitizedInvoiceId,
            type: invoice.whatFor?.invoiceType
        });

        // Return invoice data
        return reply.code(200).send({
            success: true,
            message: 'Invoice retrieved successfully',
            data: {
                data: populatedInvoice
            }
        });

    } catch (error) {
        // Comprehensive error logging
        logger.error('Error retrieving public invoice', {
            message: error.message,
            stack: error.stack,
            facilityId,
            invoiceId,
            type,
            errorDetails: JSON.stringify(error)
        });

        // Return a generic error response
        return reply.code(500).send({
            success: false,
            message: 'Unable to retrieve invoice',
            error: `Error: 500 - ${error.message}`,
            errorId: Date.now().toString()
        });
    }
};

module.exports = get_public_invoice;