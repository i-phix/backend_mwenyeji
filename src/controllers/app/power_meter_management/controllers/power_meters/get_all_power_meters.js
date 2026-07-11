const axios = require('axios');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
require('dotenv').config();

const getAllPowerMeters = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
                
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Extract query parameters for filtering (no pagination)
        const {
            search = '',
            type = '',
            status = '',
            manufacturer = '',
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = request.query;

        // Build query parameters (exclude page & limit)
        const queryParams = new URLSearchParams({
            search,
            type,
            status,
            manufacturer,
            sortBy,
            sortOrder
        });

        // Forward request to Power Meter Service with facility ID
        const response = await axios.get(
            `${powerMeterServiceUrl}/get_all_power_meters/${facilityId}?${queryParams}`
        );

        const powerMetersData = response.data.data || response.data;

        // Enhance each power meter with unit information
        const enhancedPowerMeters = await Promise.all(
            powerMetersData.map(async (meter) => {
                let unitInfo = null;
                
                if (meter.unitId && meter.facilityId) {
                    try {
                        const unitModel = await getModel('Unit', payservedb.Unit.schema, meter.facilityId);
                        const unit = await unitModel.findById(meter.unitId);
                        if (unit) {
                            unitInfo = {
                                _id: unit._id,
                                unitName: unit.name
                            };
                        }
                    } catch (err) {
                        console.error(`Error fetching unit for meter ${meter._id}:`, err);
                    }
                }

                return {
                    ...meter,
                    unitInfo
                };
            })
        );

        return reply.code(200).send({
            message: 'Power meters retrieved successfully',
            data: enhancedPowerMeters
        });

    } catch (error) {
        console.error('Error forwarding get all power meters request:', error);
                
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get power meters'
            });
        }
                
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getAllPowerMeters;