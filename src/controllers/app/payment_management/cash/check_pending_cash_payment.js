const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Check if there's a pending cash payment for a specific invoice
 */
const check_pending_cash_payment = async (request, reply) => {
    try {
        const { facilityId, invoiceId } = request.params;

        console.log('Checking pending payment for invoice:', invoiceId);

        // Get CashPayment model
        const CashPayment = await getModel('CashPayment', payservedb.CashPayment.schema, facilityId);
        
        // Simple query - just check for pending payment on this invoice
        const pendingPayment = await CashPayment.findOne({
            'invoice.invoiceId': new mongoose.Types.ObjectId(invoiceId),
            approvalStatus: 'Pending',
            isVoided: false
        })
        .sort({ createdAt: -1 })
        .lean();

        console.log('Pending payment found:', !!pendingPayment);

        if (pendingPayment) {
            return reply.code(200).send({
                success: true,
                message: 'Pending payment found',
                data: {
                    hasPendingPayment: true,
                    pendingPayment: pendingPayment
                }
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'No pending payment found',
            data: {
                hasPendingPayment: false,
                pendingPayment: null
            }
        });

    } catch (err) {
        console.error('Error checking pending payment:', err);
        return reply.code(500).send({
            success: false,
            message: err.message || 'Failed to check pending payment'
        });
    }
};

module.exports = check_pending_cash_payment;