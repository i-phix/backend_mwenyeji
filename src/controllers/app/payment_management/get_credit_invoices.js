// controllers/get_credit_invoices.js
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_credit_invoices = async (request, reply) => {
    console.log('=== Start: get_credit_invoices ===');
    console.log(`Request params: ${JSON.stringify(request.params)}`);
    
    try {
        const { facilityId, clientId } = request.params;
        console.log(`Processing request for facilityId: ${facilityId}, clientId: ${clientId}`);

        if (!facilityId || !clientId) {
            console.log('Error: Missing required parameters');
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Client ID are required'
            });
        }

        // Validate ObjectIds
        const isValidFacilityId = mongoose.Types.ObjectId.isValid(facilityId);
        const isValidClientId = mongoose.Types.ObjectId.isValid(clientId);
        console.log(`ObjectId validation - facilityId valid: ${isValidFacilityId}, clientId valid: ${isValidClientId}`);
        
        if (!isValidFacilityId || !isValidClientId) {
            console.log('Error: Invalid ObjectId format');
            return reply.code(400).send({
                success: false,
                error: 'Invalid Facility ID or Client ID format'
            });
        }

        // Get models from different collections
        console.log('Fetching database models...');
        const Invoice = await getModel("Invoice", payservedb.Invoice.schema, facilityId);
        const VasInvoice = await getModel("VasInvoice", payservedb.VasInvoice.schema, facilityId);
        const WaterInvoice = await getModel("WaterInvoice", payservedb.WaterInvoice.schema, facilityId);
        console.log('Database models fetched successfully');

        console.log('Querying for invoices with credit balance...');
        
        // Create a new ObjectId instance correctly using 'new'
        const clientObjectId = new mongoose.Types.ObjectId(clientId);
        console.log(`Converted clientId to ObjectId: ${clientObjectId}`);
        
        // Find all invoices with negative balanceBroughtForward (credit)
        const [regularInvoices, vasInvoices, waterInvoices] = await Promise.all([
            Invoice.find({
                'client.clientId': clientObjectId,
                balanceBroughtForward: { $lt: 0 }  // Less than 0 means credit balance
            }).sort({ updatedAt: -1 }),  // Most recently updated first
            
            VasInvoice.find({
                customerId: clientObjectId,
                balanceBroughtForward: { $lt: 0 }
            }).sort({ updatedAt: -1 }),
            
            WaterInvoice.find({
                customerId: clientObjectId,
                balanceBroughtForward: { $lt: 0 }
            }).sort({ updatedAt: -1 })
        ]);

        console.log(`Invoice counts - Regular: ${regularInvoices.length}, VAS: ${vasInvoices.length}, Water: ${waterInvoices.length}`);
        
        // Transform VAS invoices to match regular invoice structure
        const transformedVasInvoices = vasInvoices.map(invoice => {
            return {
                _id: invoice._id,
                invoiceType: 'vas',
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                balanceBroughtForward: invoice.balanceBroughtForward,
                // Include overpay for backward compatibility
                overpay: Math.abs(invoice.balanceBroughtForward),
                // Include other relevant fields...
                client: {
                    clientId: invoice.customerId
                }
            };
        });

        // Transform water invoices to match regular invoice structure
        const transformedWaterInvoices = waterInvoices.map(invoice => {
            return {
                _id: invoice._id,
                invoiceType: 'water',
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                balanceBroughtForward: invoice.balanceBroughtForward,
                // Include overpay for backward compatibility
                overpay: Math.abs(invoice.balanceBroughtForward),
                // Include other relevant fields...
                client: {
                    clientId: invoice.customerId
                }
            };
        });

        // Enhance regular invoices with type
        const enhancedRegularInvoices = regularInvoices.map(invoice => ({
            ...invoice.toObject(),
            invoiceType: 'regular',
            // Ensure overpay field is correctly set for backward compatibility
            overpay: Math.abs(invoice.balanceBroughtForward)
        }));

        // Combine all invoices with credit
        const allCreditInvoices = [
            ...enhancedRegularInvoices,
            ...transformedVasInvoices,
            ...transformedWaterInvoices
        ];
        
        console.log(`Combined total credit invoices: ${allCreditInvoices.length}`);

        // Backward compatibility - If we don't find credit invoices by negative balanceBroughtForward,
        // try looking for invoices with traditional overpay > 0 as a fallback
        if (allCreditInvoices.length === 0) {
            console.log('No invoices with negative balanceBroughtForward found, checking for overpay > 0...');
            
            const [regularWithOverpay, vasWithOverpay, waterWithOverpay] = await Promise.all([
                Invoice.find({
                    'client.clientId': clientObjectId,
                    overpay: { $gt: 0 }  // Greater than 0 means has overpayment
                }).sort({ updatedAt: -1 }),
                
                VasInvoice.find({
                    customerId: clientObjectId,
                    overpay: { $gt: 0 }
                }).sort({ updatedAt: -1 }),
                
                WaterInvoice.find({
                    customerId: clientObjectId,
                    overpay: { $gt: 0 }
                }).sort({ updatedAt: -1 })
            ]);
            
            console.log(`Found invoices with overpay > 0 - Regular: ${regularWithOverpay.length}, VAS: ${vasWithOverpay.length}, Water: ${waterWithOverpay.length}`);
            
            // Transform these invoices to have negative balanceBroughtForward
            const transformLegacyInvoices = (invoices, type) => {
                return invoices.map(invoice => ({
                    ...invoice.toObject(),
                    invoiceType: type,
                    // Set a negative balanceBroughtForward based on overpay value
                    balanceBroughtForward: invoice.balanceBroughtForward < 0 ? 
                        invoice.balanceBroughtForward : 
                        -Math.abs(invoice.overpay)
                }));
            };
            
            allCreditInvoices.push(
                ...transformLegacyInvoices(regularWithOverpay, 'regular'),
                ...transformLegacyInvoices(vasWithOverpay, 'vas'),
                ...transformLegacyInvoices(waterWithOverpay, 'water')
            );
            
            console.log(`After checking legacy overpay, found ${allCreditInvoices.length} total credit invoices`);
        }

        console.log('Successfully processed all credit invoices, returning response');
        return reply.code(200).send({
            success: true,
            message: 'Credit invoices retrieved successfully',
            data: allCreditInvoices
        });

    } catch (error) {
        console.error('Error retrieving credit invoices:', error);
        console.error('Error stack trace:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error retrieving credit invoices'
        });
    } finally {
        console.log('=== End: get_credit_invoices ===');
    }
};

module.exports = get_credit_invoices;