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

        // Extract query parameters including pagination
        const {
            accountNumber = '', // Only search parameter
            type = '',
            status = '',
            manufacturer = '',
            sortBy = 'createdAt',
            sortOrder = 'desc',
            page = '1',
            limit = '100'
        } = request.query;

        // Parse pagination parameters
        const pageNum = Math.max(1, parseInt(page, 10));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10))); // Max 100 items per page

        // Build query parameters including pagination
        const queryParams = new URLSearchParams({
            accountNumber, // Search by account number only
            type,
            status,
            manufacturer,
            sortBy,
            sortOrder,
            page: pageNum.toString(),
            limit: limitNum.toString()
        });

        // Forward request to Power Meter Service with facility ID and pagination
        const response = await axios.get(
            `${powerMeterServiceUrl}/get_all_power_meters/${facilityId}?${queryParams}`
        );

        const responseData = response.data;
        const powerMetersData = responseData.data || responseData;
        
        // Get pagination info from Power Meter Service response (if available)
        const totalItems = responseData.pagination?.totalItems || responseData.total || powerMetersData.length;
        const totalPages = responseData.pagination?.totalPages || Math.ceil(totalItems / limitNum);

        // Enhance only the paginated power meters with unit information
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
            data: enhancedPowerMeters,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems,
                itemsPerPage: limitNum,
                hasNextPage: pageNum < totalPages,
                hasPreviousPage: pageNum > 1
            }
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