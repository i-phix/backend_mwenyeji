// controllers/get_unpaid_invoices.js
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const mongoose = require('mongoose');

const get_unpaid_invoices = async (request, reply) => {
    console.log('=== Start: get_unpaid_invoices ===');
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

        console.log('Querying for unpaid invoices...');
        
        // FIX: Create a new ObjectId instance correctly using 'new'
        const clientObjectId = new mongoose.Types.ObjectId(clientId);
        console.log(`Converted clientId to ObjectId: ${clientObjectId}`);
        
        // Find all unpaid invoices for this client from all invoice types
        const [regularInvoices, vasInvoices, waterInvoices] = await Promise.all([
            Invoice.find({
                'client.clientId': clientObjectId,
                status: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
            }).sort({ dueDate: 1 }),
            
            VasInvoice.find({
                customerId: clientObjectId,
                status: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
            }).sort({ dueDate: 1 }),
            
            WaterInvoice.find({
                customerId: clientObjectId,
                status: { $in: ['Unpaid', 'Partially Paid', 'Overdue'] }
            }).sort({ dueDate: 1 })
        ]);

        console.log(`Invoice counts - Regular: ${regularInvoices.length}, VAS: ${vasInvoices.length}, Water: ${waterInvoices.length}`);
        
        // Log sample invoice from each type if available
        if (regularInvoices.length > 0) {
            console.log(`Sample regular invoice: ${JSON.stringify(regularInvoices[0]._id)}`);
        }
        if (vasInvoices.length > 0) {
            console.log(`Sample VAS invoice: ${JSON.stringify(vasInvoices[0]._id)}`);
        }
        if (waterInvoices.length > 0) {
            console.log(`Sample water invoice: ${JSON.stringify(waterInvoices[0]._id)}`);
        }

        console.log('Transforming VAS invoices...');
        // Transform VAS invoices to match regular invoice structure
        const transformedVasInvoices = vasInvoices.map(invoice => {
            const transformed = {
                _id: invoice._id,
                invoiceType: 'vas',
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                issueDate: invoice.createdAt,
                dueDate: invoice.dueDate,
                totalAmount: invoice.amount,
                amountPaid: invoice.amountPaid || 0,
                status: invoice.status,
                client: {
                    clientId: invoice.customerId,
                    fullName: invoice.customerInfo?.fullName || 'Customer'
                },
                currency: invoice.currency
            };
            
            // Log any potential missing fields
            if (!invoice.dueDate) console.log(`Warning: VAS invoice ${invoice._id} missing dueDate`);
            if (!invoice.amount) console.log(`Warning: VAS invoice ${invoice._id} missing amount`);
            
            return transformed;
        });

        console.log('Transforming water invoices...');
        // Transform water invoices to match regular invoice structure
        const transformedWaterInvoices = waterInvoices.map(invoice => {
            const transformed = {
                _id: invoice._id,
                invoiceType: 'water',
                invoiceNumber: invoice.invoiceNumber,
                accountNumber: invoice.accountNumber,
                issueDate: invoice.dateIssued,
                dueDate: invoice.dueDate,
                totalAmount: invoice.charges?.totalMonthlyBill,
                amountPaid: invoice.amountPaid || 0,
                status: invoice.status,
                client: {
                    clientId: invoice.customerId
                },
                currency: invoice.currency
            };
            
            // Log any potential missing fields
            if (!invoice.dueDate) console.log(`Warning: Water invoice ${invoice._id} missing dueDate`);
            if (!invoice.charges || !invoice.charges.totalMonthlyBill) {
                console.log(`Warning: Water invoice ${invoice._id} missing totalMonthlyBill`);
            }
            
            return transformed;
        });

        console.log('Enhancing regular invoices...');
        // Enhance regular invoices with type
        const enhancedRegularInvoices = regularInvoices.map(invoice => {
            // Check for potential data issues
            if (!invoice.dueDate) console.log(`Warning: Regular invoice ${invoice._id} missing dueDate`);
            
            return {
                ...invoice.toObject(),
                invoiceType: 'regular'
            };
        });

        // Combine all invoices
        const allInvoices = [
            ...enhancedRegularInvoices,
            ...transformedVasInvoices,
            ...transformedWaterInvoices
        ];
        console.log(`Combined total invoices: ${allInvoices.length}`);

        console.log('Sorting invoices...');
        // Sort combined invoices by due date, putting overdue ones first
        allInvoices.sort((a, b) => {
            // First priority: put overdue invoices first
            if (a.status === 'Overdue' && b.status !== 'Overdue') return -1;
            if (a.status !== 'Overdue' && b.status === 'Overdue') return 1;
            
            // Second priority: sort by due date (oldest first)
            // Handle missing due dates
            if (!a.dueDate && !b.dueDate) return 0;
            if (!a.dueDate) return 1; // Push items with missing due dates to the end
            if (!b.dueDate) return -1;
            
            return new Date(a.dueDate) - new Date(b.dueDate);
        });

        console.log('Successfully processed all invoices, returning response');
        return reply.code(200).send({
            success: true,
            message: 'Unpaid invoices retrieved successfully',
            data: allInvoices
        });

    } catch (error) {
        console.error('Error retrieving unpaid invoices:', error);
        console.error('Error stack trace:', error.stack);
        return reply.code(500).send({
            success: false,
            error: error.message || 'Error retrieving unpaid invoices'
        });
    } finally {
        console.log('=== End: get_unpaid_invoices ===');
    }
};

module.exports = get_unpaid_invoices;