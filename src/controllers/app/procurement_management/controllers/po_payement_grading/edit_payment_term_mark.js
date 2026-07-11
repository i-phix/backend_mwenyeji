const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const edit_payment_term_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        const paymentTermMarkId = request.params.id;
        const { paymentTerm, marks } = request.body;
        
        // Validate required fields
        if (!paymentTerm || marks === undefined || marks === null) {
            return reply.code(400).send({
                success: false,
                error: 'Payment term and marks are required'
            });
        }
     
        const paymentTermMarkModel = await getModel('PaymentTermMark', payservedb.PaymentTermMark.schema, facilityId);

        // Check if payment term mark exists
        const existingPaymentTermMark = await paymentTermMarkModel.findById(paymentTermMarkId);
        if (!existingPaymentTermMark) {
            return reply.code(404).send({
                success: false,
                error: 'Payment term mark not found'
            });
        }

        // Check if payment term already exists (excluding current record)
        const duplicatePaymentTerm = await paymentTermMarkModel.findOne({ 
            paymentTerm: paymentTerm.trim(),
            _id: { $ne: paymentTermMarkId }
        });
        if (duplicatePaymentTerm) {
            return reply.code(409).send({
                success: false,
                error: 'Payment term already exists'
            });
        }

        // Update the payment term mark
        const updatedPaymentTermMark = await paymentTermMarkModel.findByIdAndUpdate(
            paymentTermMarkId,
            {
                paymentTerm: paymentTerm.trim(),
                marks: marks
            },
            { new: true, runValidators: true }
        );

        return reply.code(200).send({
            success: true,
            message: 'Payment term mark updated successfully',
            data: updatedPaymentTermMark
        });
    } catch (err) {
        console.error('Error in updating payment term mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while updating the payment term mark'
        });
    }
};

module.exports = edit_payment_term_mark;