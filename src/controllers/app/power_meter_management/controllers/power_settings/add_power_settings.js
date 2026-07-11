const axios = require('axios');
require('dotenv').config();

const addPowerSettings = async (request, reply) => {
    try {
        const {
            facilityId,
            minAmount,
            maxAmount,
            lowThreshold,
            highThreshold,
            gracePeriod,
            invoiceDay,
            enforcePayment,
            minimumPaymentAmount,
            tariff,
            tariffAmount,
            fixedTariffAmount,
            meterLoan,
            glAccounts,
            otherCharges,
            notifications,
            dailyNotifications,
            weeklyNotifications,
            allNotifications
        } = request.body;

        // Basic validation
        if (!facilityId) {
            return reply.code(400).send({
                error: 'Facility ID is required'
            });
        }

        // Validate GL accounts if tariff is enabled
        if (tariff === 'yes') {
            if (!glAccounts?.invoice?.debit || !glAccounts?.invoice?.credit || 
                !glAccounts?.payment?.debit || !glAccounts?.payment?.credit) {
                return reply.code(400).send({
                    error: 'All GL accounts (invoice debit/credit and payment debit/credit) must be specified when tariff is enabled'
                });
            }
        }

        // Get the Power Meter Service base URL from environment variables
        const powerMeterServiceUrl = process.env.POWER_METER_SERVICE_APP_URL;
        
        if (!powerMeterServiceUrl) {
            return reply.code(500).send({
                error: 'Power Meter Service URL not configured'
            });
        }

        // Prepare the request payload
        const payload = {
            facilityId,
            minAmount: Number(minAmount) || 0,
            maxAmount: Number(maxAmount) || 50000,
            lowThreshold: Number(lowThreshold) || 0,
            highThreshold: Number(highThreshold) || 0,
            gracePeriod: Number(gracePeriod) || 10,
            invoiceDay: Number(invoiceDay) || 3,
            enforcePayment: enforcePayment || '',
            minimumPaymentAmount: Number(minimumPaymentAmount) || 0,
            tariff: tariff || '',
            tariffAmount: Number(tariffAmount) || 0,
            fixedTariffAmount: Number(fixedTariffAmount) || 0,
            meterLoan: Number(meterLoan) || 0,
            glAccounts: glAccounts || {
                invoice: { debit: '', credit: '' },
                payment: { debit: '', credit: '' }
            },
            otherCharges: otherCharges || '',
            notifications: Boolean(notifications),
            dailyNotifications: Boolean(dailyNotifications),
            weeklyNotifications: Boolean(weeklyNotifications),
            allNotifications: Boolean(allNotifications)
        };

        // Forward request to Power Meter Service
        const response = await axios.post(`${powerMeterServiceUrl}/add_power_settings`, payload);

        return reply.code(200).send({
            message: 'Power meter settings added successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding add power settings request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to add power meter settings'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = addPowerSettings;