const axios = require('axios');
require('dotenv').config();

// Helper function to floor numbers to 2 decimal places
const floorFigure = (num) => {
    return Math.floor(num * 100) / 100;
};

const addPowerCharge = async (request, reply) => {
    try {
        const {
            facilityId,
            yearMonth,
            tariff,
            assumedConsumedUnit,
            ec,              // Energy Charge
            fcc,             // Fuel Cost Charge
            ferfa,           // Forex Adjustment
            ia,              // Inflation Adjustment
            warma,           // Water Resource Management Levy
            erc,             // Energy Regulatory Levy
            repPercentage,   // Rural Electrification Programme Percentage
            pfs,             // Power Factor Surcharge
            vatPercentage    // Value Added Tax Percentage
        } = request.body;

        // Basic validation
        if (!facilityId || !yearMonth || !tariff || 
            ec === undefined || fcc === undefined || ferfa === undefined || 
            ia === undefined || warma === undefined || erc === undefined || 
            repPercentage === undefined || vatPercentage === undefined) {
            
            return reply.code(400).send({
                error: 'All fields are required: facilityId, yearMonth, tariff, and all charge components'
            });
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Convert values to numbers and use them as-is (no calculations)
        const energyCharge = Number(ec) || 0;
        const fuelCostCharge = Number(fcc) || 0;
        const forexAdjustment = Number(ferfa) || 0;
        const inflationAdjustment = Number(ia) || 0;
        const waterResourceManagementLevy = Number(warma) || 0;
        const energyRegulatoryLevy = Number(erc) || 0;
        const repLevyPercentage = Number(repPercentage) || 5;
        const powerFactorSurcharge = Number(pfs) || 0;
        const vatRate = Number(vatPercentage) || 16;
        const consumedUnit = Number(assumedConsumedUnit) || 0;

        // Prepare the request payload with the provided values (no calculations)
        const payload = {
            facilityId,
            yearMonth,
            fuelCostCharge: floorFigure(fuelCostCharge),
            forexAdjustment: floorFigure(forexAdjustment),
            inflationAdjustment: floorFigure(inflationAdjustment),
            waterResourceManagementLevy: floorFigure(waterResourceManagementLevy),
            energyRegulatoryLevy: floorFigure(energyRegulatoryLevy),
            ruralElectrificationLevy: 0, // Will be calculated by the service if needed
            valueAddedTax: 0, // Will be calculated by the service if needed
            totalCharge: 0, // Will be calculated by the service if needed
            energyCharge: floorFigure(energyCharge),
            powerFactorSurcharge: floorFigure(powerFactorSurcharge),
            tariff,
            assumedConsumedUnit: floorFigure(consumedUnit),
            repPercentage: repLevyPercentage,
            vatPercentage: vatRate
        };

        console.log('Payload to save:', payload);

        // Forward request to Power Meter Service
        const response = await axios.post(`${powerMeterServiceUrl}/add_power_charge`, payload);

        return reply.code(200).send({
            message: 'Power charge added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add power charge request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add power charge'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addPowerCharge;