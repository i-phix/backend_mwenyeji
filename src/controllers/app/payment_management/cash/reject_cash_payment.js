const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../../utils/getModel');

/**
 * Rejects a pending cash payment
 * @param {Object} request - The request object
 * @param {Object} reply - The reply object
 * @returns {Promise<Object>} Response with rejected payment or error
 */
const rejectCashPayment = async (request, reply) => {
    try {
        const { facilityId, paymentId } = request.params;
        const { comments } = request.body;

        // Get user from request (assuming authentication middleware sets this)
        const user = request.user;

        // Validate required fields
        if (!facilityId || !paymentId) {
            throw new Error('Missing required parameters');
        }

        if (!comments || !comments.trim()) {
            throw new Error('Rejection reason is required');
        }

        // Try to get CashPayment schema from payservedb with fallback
        let cashPaymentSchema;
        if (payservedb.CashPayment && payservedb.CashPayment.schema) {
            cashPaymentSchema = payservedb.CashPayment.schema;
        } else {
            try {
                cashPaymentSchema = require('../../../../models/CashPayment').schema;
            } catch (err) {
                console.error('Error loading CashPayment schema:', err);
                throw new Error('Failed to load CashPayment schema');
            }
        }

        // Get CashPayment model for the specific facility
        const CashPayment = await getModel('CashPayment', cashPaymentSchema, facilityId);
        if (!CashPayment) throw new Error('Failed to get CashPayment model');

        // Find the payment
        const payment = await CashPayment.findById(paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }

        // Check if payment is already processed
        if (payment.approvalStatus !== 'Pending') {
            return reply.code(400).send({
                success: false,
                message: `Payment already ${payment.approvalStatus.toLowerCase()}`
            });
        }

        // Check if payment is voided
        if (payment.isVoided) {
            return reply.code(400).send({
                success: false,
                message: 'Cannot reject a voided payment'
            });
        }

        // Update rejection details using findByIdAndUpdate to avoid validation issues
        const updatedPayment = await CashPayment.findByIdAndUpdate(
            paymentId,
            {
                $set: {
                    approvalStatus: 'Rejected',
                    rejectedBy: {
                        userId: user ? new mongoose.Types.ObjectId(user._id) : null,
                        name: user ? `${user.firstName} ${user.lastName}` : 'System',
                        rejectionDate: new Date(),
                        reason: comments
                    }
                }
            },
            { new: true }
        );

        if (!updatedPayment) {
            throw new Error('Failed to update payment status');
        }

        return reply.code(200).send({
            success: true,
            message: 'Payment rejected successfully',
            payment: updatedPayment
        });
    } catch (err) {
        console.error('Error rejecting cash payment:', err);
        return reply.code(400).send({
            success: false,
            message: err.message || 'Failed to reject cash payment'
        });
    }
};

module.exports = rejectCashPayment;