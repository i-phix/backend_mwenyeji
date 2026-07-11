const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');
const get_tax_rates = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                message: 'Facility ID is required'
            });
        }

        const CountryTaxRate = await getModel('CountryTaxRate', payservedb.CountryTaxRate.schema, facilityId);
        const taxRates = await CountryTaxRate.find({ facilityId }).sort({ createdAt: -1 });

        return reply.code(200).send({
            success: true,
            data: taxRates
        });
    } catch (err) {
        console.error('Error fetching tax rates:', err);
        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = get_tax_rates;