const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getLevy = async (request, reply) => {
    try {
        const { facilityId, levyId } = request.params;

        if (!facilityId || !levyId) {
            return reply.code(400).send({
                success: false,
                error: 'Facility ID and Levy ID are required'
            });
        }

        // Validate facility from main DB
        const facility = await payservedb.Facility.findById(facilityId);
        if (!facility) {
            return reply.code(404).send({
                success: false,
                error: 'Facility not found'
            });
        }

        // Get tenant-specific model
        const levyModel = await getModel("Levy", payservedb.Levy.schema, facilityId);

        // Fetch the levy with deep population
        const levy = await levyModel.findOne({
            _id: levyId,
            facilityId: facilityId
        })
        .populate('levyType')
        .populate('currency')
        .populate('bankAccountId')
        .populate('billerAddressId')
        .populate('paymentMethodId')
        .populate('reminderId')
        .populate('penaltyId')
        .populate('glAccounts.invoice.debit')
        .populate('glAccounts.invoice.credit')
        .populate('glAccounts.payment.debit')
        .populate('glAccounts.payment.credit');

        if (!levy) {
            return reply.code(404).send({
                success: false,
                error: 'Levy not found for this facility'
            });
        }

        return reply.code(200).send({
            success: true,
            data: levy
        });

    } catch (err) {
        console.error('Error fetching levy:', err);
        return reply.code(500).send({
            success: false,
            error: 'Failed to retrieve levy',
            details: err.message
        });
    }
};

module.exports = getLevy;
