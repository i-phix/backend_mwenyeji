const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_email_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        const emailModel = await getModel('FacilityEmailDetails', payservedb.SMSMeliora.schema, facilityId);

        const settings = await emailModel.findOne({ facilityId });

        if (settings) {
            return reply.code(200).send({
                success: true,
                data: settings
            });
        } else {
            // No settings found - return success with null data
            return reply.code(200).send({
                success: true,
                data: 0,
                message: 'No email settings found'
            });
        }
    } catch (err) {
        console.error('Error in get_email_settings:', err);
        return reply.code(502).send({
            success: false,
            error: err.message
        });
    }
};

module.exports = get_email_settings;