const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const getCurrencies = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                message: 'Facility ID is required'
            });
        }

        const Currency = await getModel('Currency', payservedb.Currency.schema, facilityId);
        const currencies = await Currency.find({ facilityId }).sort({ createdAt: -1 });

        return reply.code(200).send({
            success: true,
            data: currencies
        });
    } catch (err) {
        console.error('Error fetching currencies:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = getCurrencies;
