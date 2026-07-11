const axios = require('axios');
require('dotenv').config();

const editPowerCharge = async (request, reply) => {
    try {
        // Extract charge ID from request parameters
        const { chargeId } = request.params;
        
        // Validate charge ID
        if (!chargeId) {
            return reply.code(400).send({
                error: 'Charge ID is required'
            });
        }

        const {
            facilityId,
            yearMonth,
            fuelCostCharge,
            forexAdjustment,
            inflationAdjustment,
            waterResourceManagementLevy,
            energyRegulatoryLevy,
            ruralElectrificationLevy,
            valueAddedTax,
            totalCharge
        } = request.body;

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare the request payload - only include fields that are provided
        const payload = {};
        
        if (facilityId !== undefined) payload.facilityId = facilityId;
        if (yearMonth !== undefined) payload.yearMonth = yearMonth;
        if (fuelCostCharge !== undefined) payload.fuelCostCharge = Number(fuelCostCharge);
        if (forexAdjustment !== undefined) payload.forexAdjustment = Number(forexAdjustment);
        if (inflationAdjustment !== undefined) payload.inflationAdjustment = Number(inflationAdjustment);
        if (waterResourceManagementLevy !== undefined) payload.waterResourceManagementLevy = Number(waterResourceManagementLevy);
        if (energyRegulatoryLevy !== undefined) payload.energyRegulatoryLevy = Number(energyRegulatoryLevy);
        if (ruralElectrificationLevy !== undefined) payload.ruralElectrificationLevy = Number(ruralElectrificationLevy);
        if (valueAddedTax !== undefined) payload.valueAddedTax = Number(valueAddedTax);
        if (totalCharge !== undefined) payload.totalCharge = Number(totalCharge);

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/edit_power_charge/${chargeId}`, payload);

        return reply.code(200).send({
            message: 'Power charge updated successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding edit power charge request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to update power charge'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = editPowerCharge;