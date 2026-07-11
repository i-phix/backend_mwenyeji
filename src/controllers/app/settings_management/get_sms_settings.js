const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const get_sms_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;

        // Get the facility-specific SMS model
        const smsMelioraModel = await getModel('SMSMeliora', payservedb.SMSMeliora.schema, facilityId);

        // Use the facility-specific model to find settings
        const settings = await smsMelioraModel.findOne({ facilityId });

        if (!settings) {
            return reply.code(404).send({
                message: 'SMS settings not found for this facility'
            });
        }

        return reply.code(200).send({
            message: 'SMS settings retrieved successfully',
            data: settings
        });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = get_sms_settings;