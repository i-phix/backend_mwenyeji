const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const add_payment_term_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        
        const { paymentTerm, marks } = request.body;

        // Get the PaymentTermMark model using getModel
        const paymentTermMarkModel = await getModel('PaymentTermMark', payservedb.PaymentTermMark.schema, facilityId);

        // Check if payment term already exists
        const existingPaymentTerm = await paymentTermMarkModel.findOne({ paymentTerm: paymentTerm.trim() });
        if (existingPaymentTerm) {
            return reply.code(409).send({
                success: false,
                error: 'Payment term already exists'
            });
        }

        // Create new payment term mark
        const newPaymentTermMark = new paymentTermMarkModel({
            paymentTerm: paymentTerm.trim(),
            marks: marks
        });

        const savedPaymentTermMark = await newPaymentTermMark.save();

        return reply.code(200).send({
            success: true,
            message: 'Payment term mark created successfully',
            data: savedPaymentTermMark
        });
    } catch (err) {
        console.error('Error in creating payment term mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while creating the payment term mark'
        });
    }
};
module.exports = add_payment_term_mark;