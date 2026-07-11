const axios = require('axios');
require('dotenv').config();

/**
 * POST /bulk_import  (Power Meter Service gateway route)
 *
 * Forwards the validated meters array to the Power Meter Service.
 * The body shape mirrors what bulk_import_power_meters.js expects.
 */
const bulkImportPowerMeters = async (request, reply) => {
    try {
        const { meters } = request.body;

        if (!Array.isArray(meters) || meters.length === 0) {
            return reply.code(400).send({
                success: false,
                error: 'Request body must contain a non-empty "meters" array'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_URL;

        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                success: false,
                error: 'Power Meter Service URL not configured'
            });
        }

        const response = await axios.post(
            `${powerMeterServiceUrl}/bulk_import_power_meters`,
            { meters },
            { timeout: 60000 } // 60s — large batches may take a moment
        );

        return reply.code(200).send({
            success: true,
            message: response.data.message,
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding bulk import request:', error);

        if (error.response) {
            return reply.code(error.response.status).send({
                success: false,
                error: error.response.data?.error || 'Failed to bulk import power meters'
            });
        }

        return reply.code(502).send({
            success: false,
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = bulkImportPowerMeters;