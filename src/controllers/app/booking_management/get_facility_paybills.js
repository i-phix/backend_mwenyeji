const mongoose = require('mongoose');
const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

/**
 * Get facility paybill accounts for booking payments
 */
const get_facility_paybills = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get FacilityPaymentDetails model
        const FacilityPaymentDetails = await getModel('FacilityPaymentDetails', payservedb.FacilityPaymentDetails.schema, facilityId);

        // Fetch paybills for "All" or "Booking" modules
        const paybills = await FacilityPaymentDetails.find({
            facility: facilityId,
            module: { $in: ['All', 'Booking'] }
        }).select('shortCode module authorizationKey passkey');

        // Format response
        const formattedPaybills = paybills.map(paybill => ({
            _id: paybill._id,
            paybillNumber: paybill.shortCode,
            module: paybill.module,
            label: `${paybill.shortCode} (${paybill.module})`,
            hasCredentials: !!(paybill.passkey && paybill.authorizationKey)
        }));

        return reply.code(200).send({
            success: true,
            data: formattedPaybills
        });

    } catch (error) {
        console.error('Error fetching facility paybills:', error);
        return reply.code(500).send({
            success: false,
            error: error.message || 'An unexpected error occurred while fetching paybills.'
        });
    }
};

module.exports = get_facility_paybills;
