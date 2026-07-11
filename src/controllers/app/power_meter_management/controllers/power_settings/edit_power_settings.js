const axios = require('axios');
require('dotenv').config();

const editPowerSettings = async (request, reply) => {
    try {
        // Extract facility ID from request parameters
        const { facilityId } = request.params;
        
        // Validate facility ID
        if (!facilityId) {
            return reply.code(400).send({
                error: 'Facility ID is required'
            });
        }

        const {
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

        // Prepare the request payload - only include fields that are provided
        const payload = {};
        
        if (minAmount !== undefined) payload.minAmount = Number(minAmount);
        if (maxAmount !== undefined) payload.maxAmount = Number(maxAmount);
        if (lowThreshold !== undefined) payload.lowThreshold = Number(lowThreshold);
        if (highThreshold !== undefined) payload.highThreshold = Number(highThreshold);
        if (gracePeriod !== undefined) payload.gracePeriod = Number(gracePeriod);
        if (invoiceDay !== undefined) payload.invoiceDay = Number(invoiceDay);
        if (enforcePayment !== undefined) payload.enforcePayment = enforcePayment;
        if (minimumPaymentAmount !== undefined) payload.minimumPaymentAmount = Number(minimumPaymentAmount);
        if (tariff !== undefined) payload.tariff = tariff;
        if (tariffAmount !== undefined) payload.tariffAmount = Number(tariffAmount);
        if (fixedTariffAmount !== undefined) payload.fixedTariffAmount = Number(fixedTariffAmount);
        if (meterLoan !== undefined) payload.meterLoan = Number(meterLoan);
        if (glAccounts !== undefined) payload.glAccounts = glAccounts;
        if (otherCharges !== undefined) payload.otherCharges = otherCharges;
        if (notifications !== undefined) payload.notifications = Boolean(notifications);
        if (dailyNotifications !== undefined) payload.dailyNotifications = Boolean(dailyNotifications);
        if (weeklyNotifications !== undefined) payload.weeklyNotifications = Boolean(weeklyNotifications);
        if (allNotifications !== undefined) payload.allNotifications = Boolean(allNotifications);

        // Forward request to Power Meter Service
        const response = await axios.put(`${powerMeterServiceUrl}/edit_power_settings/${facilityId}`, payload);

        return reply.code(200).send({
            message: 'Power meter settings updated successfully',
            data: response.data.data
        });

    } catch (error) {
        console.error('Error forwarding edit power settings request:', error);
        
        // Handle axios errors
        if (error.response) {
            return reply.code(error.response.status).send({
                error: error.response.data.error || 'Failed to update power meter settings'
            });
        }
        
        return reply.code(502).send({
            error: 'Failed to communicate with Power Meter Service'
        });
    }
};

module.exports = editPowerSettings;