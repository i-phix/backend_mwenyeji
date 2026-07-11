const axios = require('axios');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
require('dotenv').config();

const getFacilityAccounts = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
                
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(`${powerMeterServiceUrl}/get_facility_customer_accounts/${facilityId}`);
        const accountsData = response.data.data || response.data;

        // Enhance each account with unit information
        let enhancedAccountsData = accountsData;
        
        if (Array.isArray(accountsData)) {
            enhancedAccountsData = await Promise.all(accountsData.map(async (accountData) => {
                let unitInfo = null;
                
                if (accountData.unitId && accountData.facilityId) {
                    try {
                        const unitModel = await getModel('Unit', payservedb.Unit.schema, accountData.facilityId);
                        const unit = await unitModel.findById(accountData.unitId);
                        if (unit) {
                            unitInfo = {
                                _id: unit._id,
                                unitName: unit.name
                            };
                        }
                    } catch (err) {
                        console.error('Error fetching unit:', err);
                    }
                }

                return {
                    ...accountData,
                    unitInfo
                };
            }));
        }

        return reply.code(200).send({
            message: 'Facility accounts retrieved successfully',
            data: enhancedAccountsData,
            count: Array.isArray(enhancedAccountsData) ? enhancedAccountsData.length : 0
        });

    } catch (error) {
        console.error('Error forwarding get facility accounts request:', error);
                
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get facility accounts'
            });
        }
                
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getFacilityAccounts;