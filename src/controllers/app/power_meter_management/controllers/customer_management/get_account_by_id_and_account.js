const axios = require('axios');
const payservedb = require('payservedb');
const { getModel } = require('../../../../../utils/getModel');
require('dotenv').config();

const getCustomerAccountByIdAndNumber = async (request, reply) => {
    try {
        const { customerId, accountNumber } = request.params;

        if (!customerId || !accountNumber) {
            return reply.code(400).send({
                error: 'Customer ID and Account Number are required'
            });
        }

        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Forward request to Power Meter Service
        const response = await axios.get(
            `${powerMeterServiceUrl}/get_customer_account_by_id_and_number/${customerId}/${accountNumber}`
        );
        const accountData = response.data.data || response.data;

        let unitInfo = null;
        if (accountData.unitId && accountData.facilityId) {
            try {
                const unitModel = await getModel('Unit', payservedb.Unit.schema, accountData.facilityId);
                const unit = await unitModel.findById(accountData.unitId);
                if (unit) {
                    unitInfo = {
                        _id: unit._id,
                        unitName: unit.name,
                        unitNumber: unit.unitNumber
                    };
                }
            } catch (err) {
                console.error('Error fetching unit:', err);
            }
        }

        // Construct enhanced response
        const enhancedAccountData = {
            ...accountData,
            unitInfo
        };

        return reply.code(200).send({
            message: 'Customer account retrieved successfully',
            data: enhancedAccountData
        });

    } catch (error) {
        console.error('Error forwarding get customer account by ID and number request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to get customer account'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = getCustomerAccountByIdAndNumber;