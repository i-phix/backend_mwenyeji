 const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getFacilityPaymentDetails = async (request, reply) => {
    try {
        let { facilityId, paymentMethodId } = request.params;

        // Trim potential whitespace
        facilityId = facilityId.trim();
        paymentMethodId = paymentMethodId.trim();

        if (!facilityId || !paymentMethodId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Payment Method ID are required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(paymentMethodId)) {
            return reply.code(400).send({
                success: false,
                error: 'Invalid Payment Method ID format'
            });
        }

        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        const facilityPaymentDetailsModel = await getModel(
            "FacilityPaymentDetails",
            payservedb.FacilityPaymentDetails.schema,
            facilityId
        );

        const paymentDetails = await facilityPaymentDetailsModel.findOne({
            _id: new mongoose.Types.ObjectId(paymentMethodId),
            facility: facilityId
        });

        if (!paymentDetails) {
            return reply.code(404).send({
                success: false,
                error: 'Payment method not found for this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            data: paymentDetails
        });

    } catch (err) {
        console.error('Error fetching facility payment details:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve payment method details',
            details: err.message
        });
    }
};

module.exports = getFacilityPaymentDetails;
