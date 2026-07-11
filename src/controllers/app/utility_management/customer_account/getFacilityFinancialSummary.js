const axios = require('axios');
const logger = require('../../../../../config/winston');

/**
 * Fastify handler — forwards the facility financial summary request
 * to the billing service and returns its response.
 *
 * Route: GET /api/app/customer-account/facility-financial-summary/:facilityId?months=2025-01,2025-02
 */
const getFacilityFinancialSummary = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { months }     = request.query;

        if (!facilityId) {
            return reply.code(400).send({
                success: false,
                error: 'facilityId is required'
            });
        }

        if (!months) {
            return reply.code(400).send({
                success: false,
                error: 'months query param is required (e.g. ?months=2025-01,2025-02)'
            });
        }

        // Forward to billing service
        const response = await axios.get(
            `${process.env.BILLING_SERVICE_URL}/facility-financial-summary/${facilityId}`,
            { params: { months } }
        );

        return reply.code(200).send(response.data);

    } catch (err) {
        logger.error('Error in getFacilityFinancialSummary:', {
            error: err.message,
            stack: err.stack,
            params: {
                facilityId: request.params.facilityId,
                months:     request.query.months,
            }
        });

        const statusCode   = err.response?.status || 400;
        const errorMessage = err.response?.data?.error || err.message;

        return reply.code(statusCode).send({
            success: false,
            error: errorMessage
        });
    }
};

module.exports = getFacilityFinancialSummary;