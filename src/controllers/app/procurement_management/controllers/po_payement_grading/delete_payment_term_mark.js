const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');

const delete_payment_term_mark = async (request, reply) => {
    try {
        const facilityId = request.params.facilityId || request.body.facilityId;
        const paymentTermMarkId = request.params.id;
        
        const paymentTermMarkModel = await getModel('PaymentTermMark', payservedb.PaymentTermMark.schema, facilityId);

        // Delete the payment term mark
        await paymentTermMarkModel.findByIdAndDelete(paymentTermMarkId);

        return reply.code(200).send({
            success: true,
            message: 'Payment term mark deleted successfully'
        });
    } catch (err) {
        console.error('Error in deleting payment term mark:', err);
        return reply.code(500).send({
            success: false,
            error: err.message || 'An error occurred while deleting the payment term mark'
        });
    }
};

module.exports = delete_payment_term_mark;
