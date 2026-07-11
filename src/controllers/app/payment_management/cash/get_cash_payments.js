const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Get all cash payments for a facility with optional filtering
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} Response with payments or error
 */
const get_cash_payments = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Validate required fields
        if (!facilityId) {
            throw new Error('Missing facility ID');
        }

        console.log('Looking for cash payments for facility:', facilityId);

        // Get CashPayment model for the specific facility
        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        if (!CashPayment) throw new Error('Failed to get CashPayment model');

        // Get total count first (with no filters) to see if any documents exist
        const totalDocsInCollection = await CashPayment.countDocuments({});
        console.log('Total documents in collection:', totalDocsInCollection);

        // Apply filters if provided
        const query = {};

        // Only add facilityId to query if it exists in the schema
        // This prevents issues with older documents that might not have this field
        const schemaFields = Object.keys(CashPayment.schema.paths);
        if (schemaFields.includes('facilityId')) {
            query.facilityId = new mongoose.Types.ObjectId(facilityId);
        }

        const {
            clientId,
            invoiceNumber,
            receiptNumber,
            approvalStatus,
            reconciliationStatus,
            paymentMethod,
            startDate,
            endDate,
            currencyCode
        } = request.query;

        // Apply additional filters to query
        if (clientId) query['client.clientId'] = new mongoose.Types.ObjectId(clientId);
        if (invoiceNumber) query['invoice.invoiceNumber'] = invoiceNumber;
        if (receiptNumber) query.receiptNumber = receiptNumber;
        if (approvalStatus) query.approvalStatus = approvalStatus;
        if (reconciliationStatus) query.reconciliationStatus = reconciliationStatus;

        // Handle payment method filter with case insensitivity and mapping
        if (paymentMethod) {
            // Map UI-friendly values to schema values if needed
            const methodMap = {
                'Cash': 'cash',
                'Check': 'cheque',
                'Bank Transfer': 'bank-transfer'
            };
            const normalizedMethod = methodMap[paymentMethod] || paymentMethod.toLowerCase();
            query.paymentMethod = normalizedMethod;
        }

        if (currencyCode) query['currency.code'] = currencyCode;

        // Date range filter
        if (startDate || endDate) {
            query.paymentDate = {};
            if (startDate) query.paymentDate.$gte = new Date(startDate);
            if (endDate) query.paymentDate.$lte = new Date(endDate);
        }

        console.log('Query being used:', JSON.stringify(query));

        // If there are no matches, try a simpler query to determine the issue
        const total = await CashPayment.countDocuments(query);
        console.log('Number of documents matching query:', total);

        if (total === 0) {
            const simpleQueryCount = await CashPayment.countDocuments({});
            console.log('Documents in collection (no filters):', simpleQueryCount);

            // Try with just facilityId if available
            if (schemaFields.includes('facilityId')) {
                const facilityOnlyCount = await CashPayment.countDocuments({
                    facilityId: new mongoose.Types.ObjectId(facilityId)
                });
                console.log('Documents matching facilityId only:', facilityOnlyCount);
            }
        }

        // Execute query without pagination - don't use populate
        const payments = await CashPayment.find(query)
            .sort({ paymentDate: -1, createdAt: -1 }) // Add createdAt as secondary sort
            .lean();

        console.log('Found payments:', payments.length);

        // Format the payments for display if needed
        const formattedPayments = payments.map(payment => {
            // Format payment method for display if needed
            if (payment.paymentMethod) {
                const methodMap = {
                    'cash': 'Cash',
                    'cheque': 'Cheque',
                    'bank-transfer': 'Bank Transfer'
                };
                payment.displayPaymentMethod = methodMap[payment.paymentMethod] ||
                    payment.paymentMethod.charAt(0).toUpperCase() + payment.paymentMethod.slice(1);
            }
            return payment;
        });

        return reply.code(200).send({
            success: true,
            message: 'Cash payments retrieved successfully',
            data: {
                payments: formattedPayments,
                total: formattedPayments.length
            }
        });
    } catch (err) {
        console.error('Error fetching cash payments:', err);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to fetch cash payments'
        });
    }
};

module.exports = get_cash_payments;