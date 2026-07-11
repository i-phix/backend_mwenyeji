const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Controller to delete a tax rate
 * @param {Object} request - The request object containing params
 * @param {Object} reply - The reply object for sending responses
 * @returns {Object} Response with success/error message
 */
const delete_tax_rate = async (request, reply) => {
    try {
        const { facilityId, taxId } = request.params;

        // Validate required parameters
        if (!facilityId || !taxId) {
            return reply.code(400).send({
                success: false,
                message: 'Missing required parameters'
            });
        }

        // Get the CountryTaxRate model for the facility
        const CountryTaxRate = await getModel('CountryTaxRate', payservedb.CountryTaxRate.schema, facilityId);

        // Find and delete the tax rate
        const result = await CountryTaxRate.findByIdAndDelete(taxId);

        if (!result) {
            return reply.code(404).send({
                success: false,
                message: 'Tax rate not found'
            });
        }

        return reply.code(200).send({
            success: true,
            message: 'Tax rate deleted successfully'
        });

    } catch (err) {
        console.error('Error deleting tax rate:', err);

        // Handle specific MongoDB errors
        if (err.name === 'CastError') {
            return reply.code(400).send({
                success: false,
                message: 'Invalid tax rate ID format'
            });
        }

        return reply.code(500).send({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    }
};

module.exports = delete_tax_rate;