const payservedb = require('payservedb');
const { getModel } = require('../../../utils/getModel');

const add_sms_settings = async (request, reply) => {
    try {
        const { facilityId } = request.params;
        const { user, senderId, apiKey } = request.body;

        // Get the facility-specific SMS model
        const smsMelioraModel = await getModel('SMSMeliora', payservedb.SMSMeliora.schema, facilityId);

        // Create a new record using the facility-specific model
        const data = await smsMelioraModel.create({
            user,
            senderId,
            apiKey,
            facilityId,
        });

        return reply.code(200).send({
            message: 'SMS settings added successfully',
            data: data
        });
    } catch (err) {
        return reply.code(502).send({ error: err.message });
    }
};

module.exports = add_sms_settings;